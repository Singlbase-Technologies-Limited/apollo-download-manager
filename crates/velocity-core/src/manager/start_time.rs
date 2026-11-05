//! A download's own start time (#350; PO decisions, 2026-11-05). It is set in the Add dialog or
//! later from a waiting download's menu, and beats the schedule's daily window: the download
//! waits until then, and starts at once if the time passed while the app was closed. Once it
//! starts, the time is cleared, so it never starts twice.

use jiff::civil::DateTime;

use super::{Download, Manager};
use crate::domain::{DownloadStatus, ErrorCode, ScheduleWindow, WaitReason, WaitsUntil};
use crate::queue::LocalTime;

impl Manager {
    /// Gives an unfinished download that isn't running its own start time, or takes it away
    /// with `None`. A time un-pauses a paused download, and the window no longer holds it back.
    /// `InvalidState` for one running, finished or waiting for the network;
    /// `ConfirmationRequired` for a paused one that came back without its login.
    pub fn set_start_at(&mut self, id: &str, at: Option<DateTime>) -> Result<(), ErrorCode> {
        let d = self.downloads.get_mut(id).ok_or(ErrorCode::NotFound)?;
        if d.running
            || d.record.status.is_terminal()
            || d.record.status == DownloadStatus::WaitingForNetwork
        {
            return Err(ErrorCode::InvalidState);
        }
        if at.is_some() && d.paused && d.needs_login {
            return Err(ErrorCode::ConfirmationRequired);
        }
        d.start_at = at;
        if at.is_some() {
            d.scheduled = false;
            d.paused = false;
            d.record.status = d.waiting_status();
        }
        self.mark(id);
        self.fill();
        Ok(())
    }

    /// The schedule's window open now, or the next one, at the last tick's local time.
    pub(super) fn schedule_window(&self) -> Option<ScheduleWindow> {
        let now = self.local?;
        let window = self.settings.schedule.window_from(now)?;
        Some(ScheduleWindow {
            opens: LocalTime(window.opens).to_string(),
            closes: LocalTime(window.closes).to_string(),
            open: window.opens <= now,
        })
    }

    /// Why `d` waits, and until when: its own start time, or the schedule's next window while
    /// it waits for one. `None` unless it is queued.
    pub(super) fn waits_until(&self, d: &Download) -> Option<WaitsUntil> {
        if d.running || d.paused || d.record.status != DownloadStatus::Queued {
            return None;
        }
        if let Some(at) = d.start_at {
            return Some(WaitsUntil {
                reason: WaitReason::ChosenTime,
                at: LocalTime(at).to_string(),
            });
        }
        if !d.scheduled || self.window_open {
            return None;
        }
        let window = self.settings.schedule.window_from(self.local?)?;
        Some(WaitsUntil {
            reason: WaitReason::Schedule,
            at: LocalTime(window.opens).to_string(),
        })
    }
}
