//! A download's speed as the list shows it (#246): the bytes received over the last
//! [`SpeedMeter::WINDOW`], measured from real progress, never an estimate.
//!
//! - **Why a window:** progress comes every 256 KiB, about every 80 ms at 3 MiB/s. A speed over
//!   one step jumped between KiB/s and GiB/s with each pause or flush.
//! - **Why 3 s:** a change in speed shows half within 1.5 s and fully within 3 s, the most the
//!   issue allows, while one slow connection or write barely moves the figure.
//! - **Only bytes that arrived count:** the first report after a start or resume holds the bytes
//!   already on disk, so it only sets where measuring starts. A count that goes down (the download
//!   started over) starts measuring again.

use std::collections::VecDeque;
use std::time::{Duration, Instant};

#[derive(Debug, Default)]
pub(crate) struct SpeedMeter {
    /// (when, bytes then), oldest first.
    samples: VecDeque<(Instant, u64)>,
}

impl SpeedMeter {
    /// The time the speed is measured over.
    pub(crate) const WINDOW: Duration = Duration::from_secs(3);
    /// Less measured time than this gives no figure: a few events apart can't tell the speed.
    const LEAST: Duration = Duration::from_millis(500);
    /// Samples are kept at least this far apart, so the window holds about 30 at any speed.
    const SPACING: Duration = Duration::from_millis(100);

    /// Counts `written` bytes at `now`, and returns the bytes per second over the window, or 0
    /// while less than [`Self::LEAST`] is measured.
    pub(crate) fn observe(&mut self, now: Instant, written: u64) -> u64 {
        if self
            .samples
            .back()
            .is_some_and(|&(_, bytes)| written < bytes)
        {
            self.samples.clear();
        }
        // The oldest sample that still covers the window is where measuring starts.
        while self
            .samples
            .get(1)
            .is_some_and(|&(at, _)| now.saturating_duration_since(at) >= Self::WINDOW)
        {
            self.samples.pop_front();
        }
        let rate = match self.samples.front() {
            Some(&(at, bytes)) if now.saturating_duration_since(at) >= Self::LEAST => {
                ((written - bytes) as f64 / (now - at).as_secs_f64()) as u64
            }
            _ => 0,
        };
        if self
            .samples
            .back()
            .is_none_or(|&(at, _)| now.saturating_duration_since(at) >= Self::SPACING)
        {
            self.samples.push_back((now, written));
        }
        rate
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MIB: u64 = 1 << 20;
    const STEP: u64 = 256 * 1024;

    /// Feeds `meter` a 256 KiB step at `bps` from `t` and `bytes` on, for `secs`, and returns the
    /// figures it gave, with the time and bytes after.
    fn run(
        meter: &mut SpeedMeter,
        t: Instant,
        bytes: u64,
        bps: u64,
        secs: f64,
    ) -> (Vec<(f64, u64)>, Instant, u64) {
        let gap = Duration::from_secs_f64(STEP as f64 / bps as f64);
        let (mut now, mut written, mut figures, mut elapsed) = (t, bytes, Vec::new(), 0.0);
        while elapsed < secs {
            now += gap;
            written += STEP;
            elapsed += gap.as_secs_f64();
            figures.push((elapsed, meter.observe(now, written)));
        }
        (figures, now, written)
    }

    fn near(figure: u64, bps: u64, within: f64) -> bool {
        (figure as f64 - bps as f64).abs() <= bps as f64 * within
    }

    #[test]
    fn a_steady_rate_gives_a_steady_figure_even_when_the_steps_come_unevenly() {
        let mut m = SpeedMeter::default();
        let t0 = Instant::now();
        m.observe(t0, 0);
        // 3 MiB/s on average, but every other step comes 4 times later than the one before it:
        // per step, that measured 7.5 and 1.9 MiB/s in turn.
        let (mut now, mut written) = (t0, 0);
        let mut figures = Vec::new();
        for i in 0..200u32 {
            let gap = if i % 2 == 0 { 1.0 / 30.0 } else { 4.0 / 30.0 };
            now += Duration::from_secs_f64(gap);
            written += STEP;
            figures.push((now - t0, m.observe(now, written)));
        }
        for (at, f) in figures.iter().filter(|(at, _)| *at >= SpeedMeter::WINDOW) {
            assert!(near(*f, 3 * MIB, 0.05), "{f} B/s at {at:?}, for 3 MiB/s");
        }
    }

    #[test]
    fn a_change_of_speed_shows_fully_within_the_window() {
        let mut m = SpeedMeter::default();
        let t0 = Instant::now();
        m.observe(t0, 0);
        let (_, t, bytes) = run(&mut m, t0, 0, 4 * MIB, 10.0);
        // A speed limit drops it to 1 MiB/s.
        let (figures, _, _) = run(&mut m, t, bytes, MIB, 6.0);
        let (half, _) = figures.iter().find(|(_, f)| *f <= 5 * MIB / 2).unwrap();
        assert!(*half <= 1.6, "half the change showed after {half} s");
        for (at, f) in figures.iter().filter(|(at, _)| *at >= 3.1) {
            assert!(
                near(*f, MIB, 0.05),
                "{f} B/s {at} s after the drop, for 1 MiB/s"
            );
        }
    }

    #[test]
    fn the_bytes_a_download_resumed_with_are_not_counted_as_received() {
        let mut m = SpeedMeter::default();
        let t0 = Instant::now();
        // The first report after a resume holds the 450 MiB already on disk.
        assert_eq!(m.observe(t0, 450 * MIB), 0);
        let (figures, _, _) = run(&mut m, t0, 450 * MIB, 10 * MIB, 5.0);
        for (at, f) in figures {
            assert!(
                f <= 10 * MIB * 21 / 20,
                "{f} B/s {at} s after resuming at 10 MiB/s"
            );
        }
    }

    #[test]
    fn no_figure_until_half_a_second_is_measured() {
        let mut m = SpeedMeter::default();
        let t0 = Instant::now();
        m.observe(t0, 0);
        let (figures, _, _) = run(&mut m, t0, 0, 3 * MIB, 1.0);
        for (at, f) in &figures {
            assert_eq!(*f == 0, *at < 0.5, "{f} B/s at {at} s");
        }
    }

    #[test]
    fn a_download_that_starts_over_is_measured_from_its_new_start() {
        let mut m = SpeedMeter::default();
        let t0 = Instant::now();
        m.observe(t0, 0);
        let (_, t, _) = run(&mut m, t0, 0, 8 * MIB, 5.0);
        // It starts over from 0 at 2 MiB/s.
        assert_eq!(m.observe(t, 0), 0, "a count that goes down gives no figure");
        let (figures, _, _) = run(&mut m, t, 0, 2 * MIB, 4.0);
        for (at, f) in figures.iter().filter(|(at, _)| *at >= 0.5) {
            assert!(
                near(*f, 2 * MIB, 0.05),
                "{f} B/s {at} s after starting over"
            );
        }
    }

    #[test]
    fn it_keeps_a_bounded_number_of_samples_at_any_speed() {
        let mut m = SpeedMeter::default();
        let t0 = Instant::now();
        m.observe(t0, 0);
        // 4 GiB/s: 16,384 steps a second.
        run(&mut m, t0, 0, 4096 * MIB, 5.0);
        assert!(m.samples.len() <= 40, "{} samples", m.samples.len());
    }
}
