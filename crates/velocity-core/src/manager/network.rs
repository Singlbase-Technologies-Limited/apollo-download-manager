//! Downloads that wait for the network (#318, ADR-0019). A download that failed because no
//! connection could be made waits as `WaitingForNetwork`, with its checkpoint, instead of
//! failing. It keeps its place in the queue but takes no slot. When the system's network watcher
//! says the network changed, every waiting download goes back to Queued and starts again from its
//! checkpoint, however long after. If there is still no network, the engine's own retries
//! (#317) end in the same failure, and it waits again.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use super::Manager;
use crate::database::resume_from;
use crate::domain::DownloadStatus;

impl Manager {
    /// The signal the system's network watcher raises when the network changes; the manager
    /// takes it at each [`Manager::tick`].
    pub fn with_network_signal(mut self, signal: Arc<AtomicBool>) -> Self {
        self.network_signal = Some(signal);
        self
    }

    /// Takes the network signal: when it was raised, the downloads waiting for the network wait
    /// for a slot again.
    pub(super) fn take_network_signal(&mut self) {
        let raised = self
            .network_signal
            .as_ref()
            .is_some_and(|s| s.swap(false, Ordering::SeqCst));
        if raised {
            for id in self.ids_with(DownloadStatus::WaitingForNetwork) {
                self.stop_waiting_for_network(&id);
            }
        }
    }

    /// Lets the engine forget the failed transfer, and keeps the checkpoint to resume from, so
    /// the download starts again like any waiting one.
    pub(super) fn wait_for_network(&mut self, id: &str) {
        if let Err(code) = self.forget_transfer(id, true) {
            // The engine still has the failed transfer; starting again replaces it.
            tracing::warn!("download {id}: the engine couldn't forget its transfer: {code:?}");
        }
        let checkpoint = match self.database.checkpoint(id) {
            Ok(checkpoint) => checkpoint,
            Err(e) => {
                tracing::warn!("download {id}: its checkpoint couldn't be read: {e}");
                None
            }
        };
        let d = self.downloads.get_mut(id).expect("known");
        d.running = false;
        let resume = resume_from(&d.record.source_url, checkpoint.as_ref());
        if let Some(job) = d.direct_mut() {
            job.resume = Some(resume);
        }
    }

    /// A download waiting for the network waits for a slot again, where it is in the queue.
    pub(super) fn stop_waiting_for_network(&mut self, id: &str) {
        let d = self.downloads.get_mut(id).expect("known");
        d.record.status = d.waiting_status();
        d.record.error = None;
        d.record.progress.download_speed_bps = 0;
        d.record.progress.connections = 0;
        self.mark(id);
    }

    /// With the setting turned off, the downloads waiting for the network fail, as before #318.
    pub(super) fn fail_those_waiting_for_network(&mut self) {
        for id in self.ids_with(DownloadStatus::WaitingForNetwork) {
            let d = self.downloads.get_mut(&id).expect("known");
            d.record.status = DownloadStatus::Failed;
            self.order.retain(|o| *o != id);
            self.mark(&id);
        }
    }
}
