//! A torrent's trackers remembered in the system keychain (#472, ADR-0021): a private tracker's
//! address carries the user's passkey, so it never reaches the database, logs or checkpoints, and
//! without it a private torrent finds no peers after a restart. The user asks, one torrent at a
//! time, as for a login (ADR-0015).
//!
//! - **What is remembered:** every tracker the torrent is known to have: given, in its magnet
//!   link, and stripped from its resume data, where a `.torrent` file's own trackers are.
//! - **Kept current:** resume data that brings a tracker not yet saved saves the list again.
//! - **After a restart** ([`super::recovery`]) the torrent is added again with them; without
//!   them, its details say so.
//! - **Removing the download** deletes them ([`super::finished`]).

use super::Manager;
use crate::domain::ErrorCode;

impl Manager {
    /// Saves the torrent's trackers in the system keychain, at the user's request.
    /// `KeychainUnavailable`, with nothing saved, when the keychain is missing or refuses;
    /// `Unsupported` for a direct download.
    pub fn remember_trackers(&mut self, id: &str) -> Result<(), ErrorCode> {
        let trackers = self.torrent_job(id)?.known_trackers();
        self.keychain.save_trackers(id, &trackers)?;
        let job = self.torrent_job_mut(id)?;
        job.options.trackers_saved = true;
        job.trackers_missing = false;
        self.store_torrent_options(id);
        Ok(())
    }

    /// Deletes the torrent's trackers from the keychain, and remembers them no more.
    pub fn forget_trackers(&mut self, id: &str) -> Result<(), ErrorCode> {
        self.torrent_job(id)?;
        self.keychain.delete_trackers(id)?;
        let job = self.torrent_job_mut(id)?;
        job.options.trackers_saved = false;
        job.trackers_missing = false;
        self.store_torrent_options(id);
        Ok(())
    }

    /// Notes the trackers the torrent's resume data had, before it is saved without them; a
    /// remembered torrent's list is saved again when that brings one it didn't have.
    pub(super) fn note_trackers(&mut self, id: &str, trackers: Vec<String>) {
        let Ok(job) = self.torrent_job_mut(id) else {
            return;
        };
        let before = job.known_trackers();
        for t in trackers {
            if !job.seen_trackers.contains(&t) {
                job.seen_trackers.push(t);
            }
        }
        let after = job.known_trackers();
        if job.options.trackers_saved && after != before {
            if let Err(code) = self.keychain.save_trackers(id, &after) {
                tracing::warn!("the trackers of {id} couldn't be saved again: {code:?}");
            }
        }
    }
}
