//! A download's mirrors (#324): the ones its server announced, the ones its project's official
//! list has, fetched only when the user asks, and the ones the user chose (PO decisions on #324).
//!
//! - **A list fetch isn't a download,** as a `.torrent` link's isn't (#60): the engine fetches the
//!   list into the app's own folder, it takes no queue slot and isn't in the list, at most
//!   [`MAX_LIST_BYTES`], and the file is deleted once read. The app waits with its own limit.
//! - **Chosen mirrors** are the download's further sources, after its own link, at most
//!   [`MAX_MIRRORS`], each checked as [`check_mirror`] says. They change while the download isn't
//!   running: a paused or failed one continues from its checkpoint with them; the engine uses one
//!   only when it serves the same file (#55).

use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::mpsc::{channel, Sender};
use std::time::{Duration, Instant};

use serde::Serialize;

use super::finished::Forget;
use super::service::ManagerService;
use super::Manager;
use crate::database::Stored;
use crate::domain::{DownloadStatus, ErrorCode};
use crate::fs_safety::is_link;
use crate::mirrors::{
    check_mirror, official_list, MirrorCandidate, MirrorList, MirrorProject, MirrorSource,
    MAX_LIST_BYTES, MAX_MIRRORS,
};
use crate::transfer::{
    Limits, Resume, TransferId, TransferSnapshot, TransferSpec, CHECKPOINT_FORMAT,
};

/// The start of a list fetch's file name.
const FETCH_PREFIX: &str = "mirrors-";
/// How long finding mirrors waits for a project's list.
pub const MIRROR_LIST_WAIT: Duration = Duration::from_secs(30);

/// What a list fetch answers: the candidates, or why there are none.
pub type MirrorReply = Sender<Result<Vec<MirrorCandidate>, ErrorCode>>;

/// The list fetches under way.
#[derive(Default)]
pub(super) struct MirrorLists {
    fetches: HashMap<TransferId, ListFetch>,
    /// Fetches cancelled, until the engine has ended them and can forget them.
    cancelled: HashSet<TransferId>,
    next: u64,
}

struct ListFetch {
    name: String,
    list: MirrorList,
    link: String,
    reply: MirrorReply,
}

/// A download's mirrors, for its details panel.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadMirrors {
    /// The mirrors it uses besides its own link, in order.
    pub chosen: Vec<String>,
    /// The ones its server announced and it doesn't use yet.
    pub announced: Vec<MirrorCandidate>,
    /// The project whose official list may have more, when its link is on one's server.
    pub official: Option<MirrorProject>,
    /// They can change now: it isn't running (or a torrent).
    pub changeable: bool,
}

impl Manager {
    /// The mirrors of the direct download `id`. `Unsupported` for a torrent.
    pub fn mirrors(&self, id: &str) -> Result<DownloadMirrors, ErrorCode> {
        let d = self.downloads.get(id).ok_or(ErrorCode::NotFound)?;
        let job = d.direct().ok_or(ErrorCode::Unsupported)?;
        let chosen: Vec<String> = job.request.urls.iter().skip(1).cloned().collect();
        let announced = job
            .announced_mirrors
            .iter()
            .filter(|m| !chosen.contains(m))
            .map(|url| MirrorCandidate {
                url: url.clone(),
                source: MirrorSource::Announced,
                country: None,
            })
            .collect();
        Ok(DownloadMirrors {
            chosen,
            announced,
            official: official_list(&d.record.source_url).map(|l| l.project),
            changeable: !d.running && d.record.status != DownloadStatus::Completed,
        })
    }

    /// Makes `mirrors` the further sources of the direct download `id`, replacing the ones it had
    /// (PO decision on #324: the user's choice, at most [`MAX_MIRRORS`]). One that isn't running
    /// takes them at its next start: a paused or failed one from its checkpoint. `InvalidState`
    /// while it runs or once it completed, `InvalidInput` for more than [`MAX_MIRRORS`], the
    /// download's own link or a mirror twice, [`check_mirror`]'s error for one that can't be a
    /// mirror, and `Unsupported` for a torrent. Nothing changes when it is refused.
    pub fn set_mirrors(&mut self, id: &str, mirrors: &[String]) -> Result<(), ErrorCode> {
        let d = self.downloads.get(id).ok_or(ErrorCode::NotFound)?;
        let job = d.direct().ok_or(ErrorCode::Unsupported)?;
        if d.running || d.record.status == DownloadStatus::Completed {
            return Err(ErrorCode::InvalidState);
        }
        if mirrors.len() > MAX_MIRRORS {
            return Err(ErrorCode::InvalidInput);
        }
        let link = job.request.urls.first().cloned().unwrap_or_default();
        let mut checked: Vec<String> = Vec::new();
        for mirror in mirrors {
            let mirror = check_mirror(mirror, &link)?;
            if checked.contains(&mirror) {
                return Err(ErrorCode::InvalidInput);
            }
            checked.push(mirror);
        }
        let request = TransferSpec {
            urls: std::iter::once(link).chain(checked).collect(),
            ..job.request.clone()
        };
        request.check_request()?;
        let status = d.record.status;
        if d.transfer().is_some() {
            // The engine has the old sources: it lets go of the transfer, a paused one keeping
            // its part file (#366), and the next start continues from the checkpoint.
            let checkpoint = match self.database.checkpoint(id).map_err(|e| e.code)? {
                Some(Stored::Known(c)) if c.format == CHECKPOINT_FORMAT => Some(c),
                _ => None,
            };
            let how = if status == DownloadStatus::Paused {
                Forget::Release
            } else {
                Forget::Remove
            };
            self.forget_transfer(id, how)?;
            if let Some(job) = self.downloads.get_mut(id).and_then(|d| d.direct_mut()) {
                job.resume = Some(match checkpoint {
                    Some(checkpoint) => Resume::Checkpoint { checkpoint },
                    None => Resume::DiscardPartFile {},
                });
            }
        }
        if let Some(job) = self.downloads.get_mut(id).and_then(|d| d.direct_mut()) {
            job.request = request;
        }
        self.store_options(id);
        self.mark(id);
        Ok(())
    }

    /// Starts fetching the official mirror list for `link` (PO decision on #324: only when the
    /// user asks); `reply` gets the candidates, or why there are none. Returns the fetch, to
    /// cancel it. `NotFound` when `link` has no known project's list, `Unsupported` before
    /// [`Manager::with_torrent_links`] gave the app its folder.
    pub fn fetch_mirror_list(
        &mut self,
        link: &str,
        reply: MirrorReply,
    ) -> Result<TransferId, ErrorCode> {
        let list = official_list(link.trim()).ok_or(ErrorCode::NotFound)?;
        let folder = self.links.folder().ok_or(ErrorCode::Unsupported)?;
        self.mirror_lists.next += 1;
        let name = format!("{FETCH_PREFIX}{}.list", self.mirror_lists.next);
        let spec = TransferSpec {
            urls: vec![list.list_url.clone()],
            directory: folder,
            file_name: Some(name.clone()),
            credentials: None,
            require_encryption: false,
            ssh_key: None,
            headers: Vec::new(),
            referrer: None,
            user_agent: None,
            checksum: None,
            pieces: None,
            limits: Limits::default(),
            max_connections: 1,
            resume: None,
            trust: Default::default(),
        };
        spec.check_request()?;
        let transfer = self.engine.add(spec)?;
        self.mirror_lists.fetches.insert(
            transfer,
            ListFetch {
                name,
                list,
                link: link.trim().to_owned(),
                reply,
            },
        );
        Ok(transfer)
    }

    /// Stops a list fetch the app no longer waits for, and deletes its files.
    pub fn cancel_mirror_list(&mut self, fetch: TransferId) {
        if let Some(state) = self.mirror_lists.fetches.remove(&fetch) {
            if self.engine.cancel(fetch).is_ok() {
                self.mirror_lists.cancelled.insert(fetch);
            }
            self.links.drop_fetch_file(&state.name);
        }
    }

    /// Whether the engine's `snapshot` is a list fetch's, which it then handles.
    pub(super) fn apply_mirror_fetch(&mut self, snapshot: &TransferSnapshot) -> bool {
        if self.mirror_lists.cancelled.contains(&snapshot.id) {
            if snapshot.status.is_terminal() {
                self.mirror_lists.cancelled.remove(&snapshot.id);
                // Ended: the engine may forget it; one that can't has already.
                let _ = self.engine.remove(snapshot.id);
            }
            return true;
        }
        let Some(fetch) = self.mirror_lists.fetches.get(&snapshot.id) else {
            return false;
        };
        let too_large = snapshot
            .progress
            .total_bytes
            .unwrap_or(0)
            .max(snapshot.progress.completed_bytes)
            > MAX_LIST_BYTES as u64;
        let answer = if too_large {
            Err(ErrorCode::InvalidInput)
        } else {
            match snapshot.status {
                DownloadStatus::Completed => self.read_list(&fetch.name, &fetch.list, &fetch.link),
                DownloadStatus::Failed => Err(snapshot
                    .error
                    .as_ref()
                    .and_then(|e| e.http_status)
                    .map_or(ErrorCode::Io, |_| ErrorCode::NotFound)),
                DownloadStatus::Removed => Err(ErrorCode::Io),
                _ => return true,
            }
        };
        let fetch = self
            .mirror_lists
            .fetches
            .remove(&snapshot.id)
            .expect("a fetch");
        if snapshot.status.is_terminal() {
            let _ = self.engine.remove(snapshot.id);
        } else if self.engine.cancel(snapshot.id).is_ok() {
            self.mirror_lists.cancelled.insert(snapshot.id);
        }
        self.links.drop_fetch_file(&fetch.name);
        // The app may have stopped waiting.
        let _ = fetch.reply.send(answer);
        true
    }

    /// The candidates in the fetched list `name`: a plain file in the app's folder.
    fn read_list(
        &self,
        name: &str,
        list: &MirrorList,
        link: &str,
    ) -> Result<Vec<MirrorCandidate>, ErrorCode> {
        let path: PathBuf = self
            .links
            .folder()
            .ok_or(ErrorCode::Unsupported)?
            .join(name);
        let meta = std::fs::symlink_metadata(&path).map_err(|_| ErrorCode::Io)?;
        if is_link(&meta) || !meta.is_file() {
            return Err(ErrorCode::InvalidPath);
        }
        if meta.len() > MAX_LIST_BYTES as u64 {
            return Err(ErrorCode::InvalidInput);
        }
        let bytes = std::fs::read(&path).map_err(|_| ErrorCode::Io)?;
        list.candidates(&bytes, link)
    }
}

impl ManagerService {
    /// The mirrors offered for `link`: its official list's, fetched now, after waiting at most
    /// `wait` for it, off the manager's thread; a fetch still running then is cancelled, and `Io`
    /// says the list couldn't be fetched. `NotFound` when `link` has no known project's list.
    pub fn find_mirrors(
        &self,
        link: String,
        wait: Duration,
    ) -> Result<Vec<MirrorCandidate>, ErrorCode> {
        let (reply, answer) = channel();
        let fetch = self.call(move |m| m.fetch_mirror_list(&link, reply))??;
        let deadline = Instant::now() + wait;
        match answer.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
            Ok(result) => result,
            Err(_) => {
                self.call(move |m| m.cancel_mirror_list(fetch))?;
                Err(ErrorCode::Io)
            }
        }
    }
}
