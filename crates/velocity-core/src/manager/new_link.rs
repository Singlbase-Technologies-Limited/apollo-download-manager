//! A new link for a download whose link expired (#466): links from file hosts and CDNs often carry
//! a token that stops working, and the browser gives a fresh one for the same file. The download
//! continues from its checkpoint with it, instead of starting again from zero.
//!
//! - **The new link is checked as an added one** (#40, #67): its length and form, a direct
//!   download of the same kind the engine can fetch, and no login inside it. It counts as typed by
//!   the user: no confirmation given for the old link carries over.
//! - **Same file or not** (PO decisions on #466): the checkpoint loses the old link's ETag and
//!   `Last-Modified`, since a new link may tag the same file anew, so it continues on the size
//!   alone and is marked "not verified" (ADR-0010) unless a checksum is given. A file of another
//!   size is refused by the engine ([`Resume::NewLink`]), and every byte is kept.
//! - **A login goes only to its own server:** on another scheme, host or port, the login, custom
//!   headers, referrer and SSH key are dropped, and a login saved in the keychain is deleted.

use super::finished::Forget;
use super::Manager;
use crate::database::Stored;
use crate::domain::{DownloadStatus, ErrorCode};
use crate::request::{normalize_link, split_login, MAX_URL_BYTES};
use crate::transfer::{Checkpoint, Resume, TransferSpec, Trust, CHECKPOINT_FORMAT};

/// The scheme, host and port of `url`, the port filled in from the scheme: what decides whether a
/// login may go to it. `None` for a link that doesn't parse.
fn origin(url: &str) -> Option<(String, String, Option<u16>)> {
    let parsed = url::Url::parse(url).ok()?;
    Some((
        parsed.scheme().to_owned(),
        parsed.host_str()?.to_ascii_lowercase(),
        parsed.port_or_known_default(),
    ))
}

impl Manager {
    /// Gives a failed or paused direct download a new link for the same file (#466), and queues it
    /// to continue from its checkpoint. `InvalidUrl` for a link that isn't one an added download
    /// could have, or of another kind; `InvalidState` for any other status; `Unsupported` for a
    /// torrent. Nothing changes when it is refused.
    pub fn use_new_link(&mut self, id: &str, link: &str, now_ms: u64) -> Result<(), ErrorCode> {
        let d = self.downloads.get(id).ok_or(ErrorCode::NotFound)?;
        let job = d.direct().ok_or(ErrorCode::Unsupported)?;
        let status = d.record.status;
        if !matches!(status, DownloadStatus::Failed | DownloadStatus::Paused) {
            return Err(ErrorCode::InvalidState);
        }
        if link.len() > MAX_URL_BYTES {
            return Err(ErrorCode::InvalidUrl);
        }
        let link = normalize_link(link)?;
        // Another kind (a magnet, `ftp` for an `https` download) is another download.
        let kind = super::adding::direct_kind(&link).map_err(|_| ErrorCode::InvalidUrl)?;
        if kind != d.record.kind || self.engine.capabilities().protocol(kind).is_none() {
            return Err(ErrorCode::InvalidUrl);
        }
        // A login goes in its own fields, never in the link (#40).
        if split_login(&link).1.is_some() {
            return Err(ErrorCode::InvalidUrl);
        }
        let same_server = origin(&link).is_some() && origin(&link) == origin(&d.record.source_url);
        let request = if same_server {
            TransferSpec {
                urls: vec![link.clone()],
                trust: Trust::default(),
                ..job.request.clone()
            }
        } else {
            TransferSpec {
                urls: vec![link.clone()],
                trust: Trust::default(),
                credentials: None,
                headers: Vec::new(),
                referrer: None,
                ssh_key: None,
                ..job.request.clone()
            }
        };
        request.check_request()?;
        let drop_saved_login = !same_server && job.login_saved;

        // The checkpoint, for the new link and without the old one's tags; without one, the part
        // file is the download's own and starts over (#43).
        let checkpoint = match self.database.checkpoint(id).map_err(|e| e.code)? {
            Some(Stored::Known(c)) if c.format == CHECKPOINT_FORMAT => Some(Checkpoint {
                source: Checkpoint::source_of(&link),
                etag: None,
                last_modified: None,
                ..c
            }),
            _ => None,
        };
        // The engine lets go of the old transfer; a paused one keeps its part file (#366).
        let how = if status == DownloadStatus::Paused {
            Forget::Release
        } else {
            Forget::Remove
        };
        self.forget_transfer(id, how)?;
        self.database
            .use_new_link(id, &link, checkpoint.as_ref(), now_ms)
            .map_err(|e| e.code)?;
        if drop_saved_login {
            // The saved login was for the old server (PO decision on #466).
            if let Err(code) = self.keychain.delete(id) {
                tracing::warn!("the saved login of {id} couldn't be deleted: {code:?}");
            }
        }

        let d = self.downloads.get_mut(id).expect("known");
        d.record.source_url = crate::database::without_login(&link).0;
        if let Some(job) = d.direct_mut() {
            job.request = request;
            job.resume = Some(match checkpoint {
                Some(checkpoint) => Resume::NewLink { checkpoint },
                None => Resume::DiscardPartFile {},
            });
            if drop_saved_login {
                job.login_saved = false;
            }
        }
        d.needs_login = false;
        d.paused = false;
        d.running = false;
        let record = &mut d.record;
        record.error = None;
        record.verification = None;
        record.completed_at_ms = None;
        record.progress.download_speed_bps = 0;
        record.progress.connections = 0;
        d.record.status = d.waiting_status();
        self.store_options(id);
        if !self.order.iter().any(|queued| queued == id) {
            self.order.push(id.to_owned());
        }
        self.mark(id);
        self.fill();
        Ok(())
    }
}
