//! Categories and destinations in the manager (#31): the category commands, a download's
//! category, and where a new download is placed. The rules are in [`crate::destination`] and
//! [`crate::category`]; here they meet the database and the downloads in the list.

use std::path::{Path, PathBuf};

use super::finished::Forget;
use super::Manager;
use crate::category::{for_file_name, Category, CategoryInput};
use crate::database::resume_from;
use crate::database::Database;
use crate::destination::{
    existing, resolve, system_downloads, Choice, FolderSettings, OnConflict, Place, Placement,
};
use crate::domain::{
    CategoryMove, DestinationCheck, DownloadKind, DownloadRecord, DownloadStatus, ErrorCode,
};
use crate::file_move::{move_error, move_into, move_no_replace};
use crate::metalink::create_folders;
use crate::naming::name_for_download;
use crate::naming::{free_file_name, PART_FILE_SUFFIX};
use crate::request::MAX_URL_BYTES;

impl Manager {
    /// Every category, in the order the automatic category is chosen in.
    pub fn categories(&self) -> Result<Vec<Category>, ErrorCode> {
        self.database.categories().map_err(|e| e.code)
    }

    /// Adds a user category. `InvalidInput`, `InvalidPath` or `NameTaken`.
    pub fn create_category(&mut self, input: &CategoryInput) -> Result<Category, ErrorCode> {
        self.database.create_category(input).map_err(|e| e.code)
    }

    /// Changes a category. Downloads keep it, and nothing is moved.
    pub fn update_category(
        &mut self,
        id: &str,
        input: &CategoryInput,
    ) -> Result<Category, ErrorCode> {
        self.database.update_category(id, input).map_err(|e| e.code)
    }

    /// Deletes a user category: its downloads are left without one, and no file is touched.
    /// `NotFound`, or `InvalidState` for a built-in one.
    pub fn delete_category(&mut self, id: &str) -> Result<(), ErrorCode> {
        self.database.delete_category(id).map_err(|e| e.code)?;
        // The database cleared it on the stored rows; the records in the list follow.
        for download in self.downloads.values_mut() {
            if download.record.category_id.as_deref() == Some(id) {
                download.record.category_id = None;
            }
        }
        Ok(())
    }

    /// Sets or clears a download's category (V1's `set_download_category`), and moves its file to
    /// the folder a new download of that category would get (#366).
    pub fn set_download_category(
        &mut self,
        id: &str,
        category_id: Option<&str>,
    ) -> Result<CategoryMove, ErrorCode> {
        let category_id = self.known_category(category_id)?;
        let d = self.downloads.get(id).ok_or(ErrorCode::NotFound)?;
        let mut record = d.record.clone();
        record.category_id = category_id;
        let direct = d.direct().is_some() && single_file(record.kind);
        let at_rest = !d.running && direct;
        if d.running && direct && record.status != DownloadStatus::Completed {
            // Moved once the engine has stopped it ([`Manager::move_paused_downloads`]).
            self.pause(id)?;
            let d = self.downloads.get_mut(id).expect("known");
            d.move_when_paused = true;
            d.record.category_id = record.category_id.clone();
            let record = d.record.clone();
            self.database
                .update_download(&record, &d.activity.totals)
                .map_err(|e| e.code)?;
            return Ok(CategoryMove::Moving);
        }
        let moved = match record.status {
            _ if d.torrent().is_some() => self.move_torrent(id, &record),
            DownloadStatus::Completed if at_rest => self.move_finished(&mut record),
            DownloadStatus::Paused
            | DownloadStatus::Queued
            | DownloadStatus::Failed
            | DownloadStatus::WaitingForNetwork
                if at_rest =>
            {
                self.move_unfinished(id, &mut record)
            }
            _ => CategoryMove::Unchanged,
        };
        let download = self.downloads.get_mut(id).ok_or(ErrorCode::NotFound)?;
        self.database
            .update_download(&record, &download.activity.totals)
            .map_err(|e| e.code)?;
        download.record = record;
        Ok(moved)
    }

    /// The folder a new download of `record`'s category and name would get: the category's own,
    /// or the default folder (in the category's subfolder when that setting is on). With no
    /// category, the default folder itself, whatever automatic categories would pick.
    fn category_folder(&self, record: &DownloadRecord) -> Result<PathBuf, ErrorCode> {
        let categories = self.categories()?;
        let settings = FolderSettings {
            auto_categorize: false,
            ..self
                .database
                .section::<FolderSettings>()
                .map_err(|e| e.code)?
        };
        let choice = Choice {
            category_id: record.category_id.clone(),
            file_name: record.file_name.clone(),
            ..Choice::default()
        };
        let resolved = resolve(&choice, &settings, &categories, system_downloads())?;
        let exists = resolved.directory.is_dir();
        ready_folder(&resolved.directory, resolved.subfolder, exists)?;
        Ok(resolved.directory)
    }

    /// Moves a finished download's file to its category's folder (#366), and points `record` at
    /// it. A name taken there, by a file or another download, gives the next free one.
    fn move_finished(&self, record: &mut DownloadRecord) -> CategoryMove {
        let Some(name) = record.file_name.clone() else {
            return CategoryMove::Unchanged;
        };
        let source = Path::new(&record.directory).join(&name);
        let stayed = |code| CategoryMove::Stayed {
            path: source.to_string_lossy().into_owned(),
            code,
        };
        let folder = match self.category_folder(record) {
            Ok(folder) => folder,
            Err(code) => return stayed(code),
        };
        if Path::new(&record.directory) == folder {
            return CategoryMove::Unchanged;
        }
        match move_into(&source, &folder, |n| self.name_taken(&folder, n)) {
            Ok(moved) => {
                record.directory = folder.to_string_lossy().into_owned();
                record.file_name = moved.file_name().map(|n| n.to_string_lossy().into_owned());
                CategoryMove::Moved {
                    path: moved.to_string_lossy().into_owned(),
                }
            }
            Err(e) => stayed(move_error(&e)),
        }
    }

    /// What adding `url` with `choice` would do, before it is added: the folder, the category,
    /// the name and whether it is taken. A typed name keeps the link's file type (V1 #46); with
    /// none, the link names the file, or the server does once it starts.
    pub fn check_destination(
        &self,
        url: &str,
        choice: &Choice,
    ) -> Result<DestinationCheck, ErrorCode> {
        self.checked(url, choice).map(|(check, _)| check)
    }

    /// [`Manager::check_destination`], with the category subfolder at the end of the folder.
    fn checked(
        &self,
        url: &str,
        choice: &Choice,
    ) -> Result<(DestinationCheck, Option<String>), ErrorCode> {
        if url.len() > MAX_URL_BYTES {
            return Err(ErrorCode::InvalidUrl);
        }
        let categories = self.categories()?;
        let settings = self
            .database
            .section::<FolderSettings>()
            .map_err(|e| e.code)?;
        let file_name = name_for_download(url, choice.file_name.as_deref(), |ext| {
            categories
                .iter()
                .any(|c| c.extensions.iter().any(|e| e == ext))
        })?;
        let choice = Choice {
            file_name: file_name.clone(),
            ..choice.clone()
        };
        let resolved = resolve(&choice, &settings, &categories, system_downloads())?;
        let found = existing(&resolved.directory, file_name.as_deref(), |name| {
            self.waiting_at(&resolved.directory, name)
        });
        let check = DestinationCheck {
            directory: resolved.directory.to_string_lossy().into_owned(),
            directory_exists: found.directory_exists,
            automatic_directory: resolved.automatic_directory,
            category_id: resolved.category.map(|c| c.id),
            path: shown_path(&resolved.directory, file_name.as_deref()),
            file_name,
            file_exists: found.file_exists,
            partial_download_exists: found.partial_download_exists,
            suggested_name: found.suggested_name,
        };
        Ok((check, resolved.subfolder))
    }

    /// Where to add `url` with `choice`. A taken name is asked about (`Conflict`) or replaced by
    /// the first free one, as `on_conflict` says; an existing file is never replaced (PO decision
    /// on #31). `FileExists` when no free name is left.
    ///
    /// A missing category subfolder is created then, inside its existing parent; anything at its
    /// name but a plain folder, such as a link, is refused (`InvalidPath`). Any other missing folder is `DestinationMissing`: the default
    /// folder, a category's own and a chosen one.
    pub fn place(
        &self,
        url: &str,
        choice: &Choice,
        on_conflict: OnConflict,
    ) -> Result<Placement, ErrorCode> {
        let (check, subfolder) = self.checked(url, choice)?;
        let file_name = if check.file_exists || check.partial_download_exists {
            match on_conflict {
                OnConflict::Ask => return Ok(Placement::Conflict(check)),
                OnConflict::Rename => {
                    Some(check.suggested_name.clone().ok_or(ErrorCode::FileExists)?)
                }
            }
        } else {
            check.file_name
        };
        let directory = PathBuf::from(check.directory);
        ready_folder(&directory, subfolder, check.directory_exists)?;
        Ok(Placement::Placed(Place {
            directory,
            file_name,
            category_id: check.category_id,
        }))
    }

    /// Where to add a torrent with `choice`, whose file name, if any, chooses the automatic
    /// category, as [`Manager::place`] does for a link. `name` is the torrent's own: its file, or
    /// its folder for several files, once known. A taken one is asked about whatever
    /// `on_conflict` says, because a torrent's names come from its metadata and aren't changed;
    /// the check then suggests none.
    pub(super) fn place_torrent(
        &self,
        choice: &Choice,
        name: Option<&str>,
    ) -> Result<Placement, ErrorCode> {
        let categories = self.categories()?;
        let settings = self
            .database
            .section::<FolderSettings>()
            .map_err(|e| e.code)?;
        let resolved = resolve(choice, &settings, &categories, system_downloads())?;
        let found = existing(&resolved.directory, name, |n| {
            self.waiting_at(&resolved.directory, n)
        });
        let category_id = resolved.category.map(|c| c.id);
        if found.file_exists || found.partial_download_exists {
            return Ok(Placement::Conflict(DestinationCheck {
                directory: resolved.directory.to_string_lossy().into_owned(),
                directory_exists: found.directory_exists,
                automatic_directory: resolved.automatic_directory,
                category_id,
                file_name: name.map(str::to_owned),
                path: shown_path(&resolved.directory, name),
                file_exists: found.file_exists,
                partial_download_exists: found.partial_download_exists,
                suggested_name: None,
            }));
        }
        ready_folder(
            &resolved.directory,
            resolved.subfolder,
            found.directory_exists,
        )?;
        Ok(Placement::Placed(Place {
            directory: resolved.directory,
            file_name: None,
            category_id,
        }))
    }

    /// `id` when that category exists, `NotFound` when it doesn't.
    pub(super) fn known_category(&self, id: Option<&str>) -> Result<Option<String>, ErrorCode> {
        let Some(id) = id else { return Ok(None) };
        match self.database.category(id).map_err(|e| e.code)? {
            Some(category) => Ok(Some(category.id)),
            None => Err(ErrorCode::NotFound),
        }
    }

    /// Moves an unfinished download that isn't running to its category's folder (#366): the engine
    /// lets go of it, its part file moves under a name free there, and its next start resumes from
    /// its saved checkpoint in the new folder, as after a restart. Whatever happens to the file,
    /// the download stays resumable.
    fn move_unfinished(&mut self, id: &str, record: &mut DownloadRecord) -> CategoryMove {
        let Some(name) = record.file_name.clone() else {
            return CategoryMove::Unchanged;
        };
        let directory = PathBuf::from(&record.directory);
        let stayed = |code| CategoryMove::Stayed {
            path: directory.join(&name).to_string_lossy().into_owned(),
            code,
        };
        let folder = match self.category_folder(record) {
            Ok(folder) if folder == directory => return CategoryMove::Unchanged,
            Ok(folder) => folder,
            Err(code) => return stayed(code),
        };
        let how = if record.status == DownloadStatus::Failed {
            Forget::Remove
        } else {
            Forget::Release
        };
        if let Err(code) = self.forget_transfer(id, how) {
            return stayed(code);
        }
        let resume = match self.database.checkpoint(id) {
            Ok(checkpoint) => resume_from(&record.source_url, checkpoint.as_ref()),
            Err(e) => return stayed(e.code),
        };
        let job = self
            .downloads
            .get_mut(id)
            .and_then(|d| d.direct_mut())
            .expect("a direct download");
        job.resume = Some(resume);
        let Some(free) = free_file_name(&name, |n| self.name_taken(&folder, n)) else {
            return stayed(ErrorCode::FileExists);
        };
        let part = |dir: &Path, n: &str| dir.join(format!("{n}{PART_FILE_SUFFIX}"));
        match move_no_replace(&part(&directory, &name), &part(&folder, &free)) {
            // Nothing written yet: the download simply starts in the new folder.
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return stayed(move_error(&e)),
            Ok(()) => {}
        }
        let job = self
            .downloads
            .get_mut(id)
            .and_then(|d| d.direct_mut())
            .expect("a direct download");
        job.request.directory = folder.clone();
        job.request.file_name = Some(free.clone());
        record.directory = folder.to_string_lossy().into_owned();
        record.file_name = Some(free.clone());
        CategoryMove::Moved {
            path: folder.join(free).to_string_lossy().into_owned(),
        }
    }

    /// Moves the downloads paused for a move (#366) once the engine has stopped them, and lets
    /// them carry on. One that ended otherwise meanwhile stays where it is.
    pub(super) fn move_paused_downloads(&mut self) {
        let ready: Vec<String> = self
            .downloads
            .iter()
            .filter(|(_, d)| d.move_when_paused && !d.running)
            .map(|(id, _)| id.clone())
            .collect();
        for id in ready {
            let d = self.downloads.get_mut(&id).expect("listed");
            d.move_when_paused = false;
            if d.record.status != DownloadStatus::Paused {
                continue;
            }
            let mut record = d.record.clone();
            match self.move_unfinished(&id, &mut record) {
                CategoryMove::Stayed { code, .. } => {
                    tracing::warn!(download = %id, ?code, "the download couldn't move to its category's folder");
                }
                _ => {
                    let d = self.downloads.get_mut(&id).expect("listed");
                    match self.database.update_download(&record, &d.activity.totals) {
                        Ok(()) => d.record = record,
                        Err(e) => {
                            tracing::warn!(download = %id, code = ?e.code, "the moved download couldn't be saved")
                        }
                    }
                }
            }
            if let Err(code) = self.resume(&id) {
                tracing::warn!(download = %id, ?code, "the moved download couldn't carry on");
            }
        }
    }

    /// Has the torrent engine move a torrent's files to its category's folder (#366); its folder
    /// follows once they are there ([`Manager::torrent_moved`]). A name taken there leaves it
    /// where it is (PO decision on #366): renaming it would leave other paths to its files wrong.
    fn move_torrent(&mut self, id: &str, record: &DownloadRecord) -> CategoryMove {
        let directory = PathBuf::from(&record.directory);
        let stayed = |code| CategoryMove::Stayed {
            path: match &record.file_name {
                Some(name) => directory.join(name),
                None => directory.clone(),
            }
            .to_string_lossy()
            .into_owned(),
            code,
        };
        let folder = match self.category_folder(record) {
            Ok(folder) if folder == directory => return CategoryMove::Unchanged,
            Ok(folder) => folder,
            Err(code) => return stayed(code),
        };
        // Its name is known with its metadata; before that there is nothing to move.
        let Some(name) = record.file_name.as_deref() else {
            return stayed(ErrorCode::InvalidState);
        };
        if self.name_taken(&folder, name) {
            return stayed(ErrorCode::FileExists);
        }
        let Some(torrent) = self.downloads.get(id).and_then(|d| d.torrent()) else {
            return stayed(ErrorCode::InvalidState);
        };
        match self.torrents.move_storage(torrent, folder.clone()) {
            Ok(()) => {
                if let Ok(job) = self.torrent_job_mut(id) {
                    job.moving_to = Some(folder);
                }
                CategoryMove::Moving
            }
            Err(code) => stayed(code),
        }
    }

    /// A torrent's files are in `directory` now (#366): it is added again from there. Only the
    /// folder the app asked for is taken; the helper's word alone changes nothing.
    pub(super) fn torrent_moved(&mut self, id: &str, directory: &Path) {
        let Ok(job) = self.torrent_job_mut(id) else {
            return;
        };
        if job.moving_to.as_deref() != Some(directory) {
            tracing::warn!(download = %id, "the torrent helper reported a move the app didn't ask for");
            return;
        }
        job.moving_to = None;
        if let Some(d) = self.downloads.get_mut(id) {
            d.record.directory = directory.to_string_lossy().into_owned();
            self.mark(id);
            self.flush();
        }
    }

    /// `name` in `folder` is taken by a file, a part file or a download in the list that hasn't
    /// finished.
    fn name_taken(&self, folder: &Path, name: &str) -> bool {
        let found = existing(folder, Some(name), |n| self.waiting_at(folder, n));
        found.file_exists || found.partial_download_exists
    }

    /// A download in the list that hasn't finished is to be saved as `name` in `directory`.
    fn waiting_at(&self, directory: &Path, name: &str) -> bool {
        self.downloads.values().any(|d| {
            !d.record.status.is_terminal()
                && d.record.file_name.as_deref() == Some(name)
                && Path::new(&d.record.directory) == directory
        })
    }
}

/// A download the transfer engine saves as one file under a plain name: each file a Metalink
/// lists is one (#54). A torrent's files are moved by the torrent engine.
fn single_file(kind: DownloadKind) -> bool {
    matches!(
        kind,
        DownloadKind::Http | DownloadKind::Ftp | DownloadKind::Sftp | DownloadKind::Metalink
    )
}

/// `name` in `directory` as the UI shows it, in the platform's separator (#277).
fn shown_path(directory: &Path, name: Option<&str>) -> Option<String> {
    name.map(|n| directory.join(n).to_string_lossy().into_owned())
}

/// Makes `directory` ready for a new download: a missing category `subfolder` at its end is created
/// inside its existing parent; any other missing folder is `DestinationMissing`.
fn ready_folder(
    directory: &Path,
    subfolder: Option<String>,
    directory_exists: bool,
) -> Result<(), ErrorCode> {
    match (subfolder, directory.parent()) {
        // Always through `create_folders`, even when the folder seems to exist: `is_dir`
        // follows a link, and a link in place of the subfolder must be refused, not used.
        (Some(subfolder), Some(parent)) => {
            create_folders(parent, &[subfolder])?;
        }
        _ if !directory_exists => return Err(ErrorCode::DestinationMissing),
        _ => {}
    }
    Ok(())
}

/// The automatic category for a name the server gave after the download started, when automatic
/// categories are on. Settings or categories that can't be read give none: adding and the
/// destination check report that error.
pub(super) fn automatic(database: &Database, name: Option<&str>) -> Option<String> {
    let name = name?;
    let on = database.section::<FolderSettings>().ok()?.auto_categorize;
    let categories = database.categories().ok()?;
    on.then(|| for_file_name(&categories, name).map(|c| c.id.clone()))
        .flatten()
}
