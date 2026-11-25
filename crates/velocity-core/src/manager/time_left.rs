//! A running download's time left (#330), worked out here for every kind of download so the window
//! only shows it (PO decision on #330).
//!
//! - **The average since the speed last changed** (the "stretch average"): field tests on 19 real
//!   downloads chose it (PO confirmed on #330). Its median error was 4.1% against 12.8% for the
//!   remaining bytes over the last 3 s, and each update moved it 0.68% against 11.9%.
//! - **A new stretch** starts when the 5 s speed stays more than [`APART`] off the stretch's average
//!   for [`HOLD`] seconds in a row, from where the change began, or when the speed limit changes.
//!   For a stretch's first [`YOUNG_MS`], its average says little, and the 5 s speed stands in.
//! - **What is shown:** nothing in a run's first [`FIRST_MS`], then one figure a second; nothing
//!   while it doesn't run, its size is unknown, or no byte arrives.

use std::collections::VecDeque;

/// How far off the stretch's average the 5 s speed must stay to start a new stretch.
const APART: f64 = 0.25;
/// For how many one-second updates in a row.
const HOLD: u32 = 8;
/// A stretch younger than this uses the 5 s speed.
const YOUNG_MS: u64 = 8_000;
/// The window of the speed that stands in for a young stretch, and that spots a change.
const WINDOW_MS: u64 = 5_000;
/// No figure in a run's first seconds.
const FIRST_MS: u64 = 3_000;
/// One figure a second.
const TICK_MS: u64 = 1_000;

#[derive(Debug, Default)]
pub(super) struct TimeLeft {
    /// When this run started.
    run_started: Option<u64>,
    /// (when, bytes) over the last [`WINDOW_MS`], oldest first, for the 5 s speed.
    window: VecDeque<(u64, u64)>,
    /// (when, bytes) at each update, the last [`HOLD`] + 1, for where a change began.
    ticks: VecDeque<(u64, u64)>,
    /// Where the stretch started.
    stretch: Option<(u64, u64)>,
    /// Updates in a row the 5 s speed was [`APART`] off the stretch's average.
    off: u32,
    /// The speed limit the stretch ran under.
    limit: Option<Option<u64>>,
    /// The figure shown, in seconds.
    shown: Option<u64>,
}

impl TimeLeft {
    /// Counts a report at `now_ms`: whether the download runs, its accepted bytes, its size, and
    /// the speed limit it runs under.
    pub(super) fn observe(
        &mut self,
        now_ms: u64,
        running: bool,
        completed: u64,
        total: Option<u64>,
        limit: Option<u64>,
    ) {
        let Some(total) = total.filter(|_| running) else {
            *self = TimeLeft::default();
            return;
        };
        if self
            .window
            .back()
            .is_some_and(|&(_, bytes)| completed < bytes)
        {
            // It started over: nothing measured before counts.
            *self = TimeLeft::default();
        }
        let started = *self.run_started.get_or_insert(now_ms);
        if self.limit.is_some_and(|l| l != limit) || self.stretch.is_none() {
            self.stretch = Some((now_ms, completed));
            self.off = 0;
        }
        self.limit = Some(limit);
        while self
            .window
            .get(1)
            .is_some_and(|&(at, _)| now_ms.saturating_sub(at) >= WINDOW_MS)
        {
            self.window.pop_front();
        }
        self.window.push_back((now_ms, completed));
        if self
            .ticks
            .back()
            .is_some_and(|&(at, _)| now_ms.saturating_sub(at) < TICK_MS)
        {
            return;
        }
        self.ticks.push_back((now_ms, completed));
        while self.ticks.len() > HOLD as usize + 1 {
            self.ticks.pop_front();
        }
        let recent = match self.window.front() {
            Some(&(at, bytes)) if now_ms.saturating_sub(at) >= 500 => {
                (completed - bytes) as f64 / ((now_ms - at) as f64 / 1000.0)
            }
            _ => 0.0,
        };
        let (since, from) = self.stretch.unwrap_or((now_ms, completed));
        let age = now_ms.saturating_sub(since);
        let average = if age > 0 {
            completed.saturating_sub(from) as f64 / (age as f64 / 1000.0)
        } else {
            0.0
        };
        if age >= YOUNG_MS && average > 0.0 && (recent - average).abs() / average > APART {
            self.off += 1;
        } else {
            self.off = 0;
        }
        if self.off >= HOLD {
            // The speed changed: the new stretch starts where the change began.
            self.stretch = self.ticks.front().copied();
            self.off = 0;
        }
        let (since, from) = self.stretch.unwrap_or((now_ms, completed));
        let age = now_ms.saturating_sub(since);
        let speed = if age >= YOUNG_MS {
            completed.saturating_sub(from) as f64 / (age as f64 / 1000.0)
        } else {
            recent
        };
        let remaining = total.saturating_sub(completed);
        self.shown = (now_ms.saturating_sub(started) >= FIRST_MS && speed > 0.0)
            .then(|| (remaining as f64 / speed).ceil() as u64);
    }

    /// The seconds left to show; `None` for no figure.
    pub(super) fn seconds(&self) -> Option<u64> {
        self.shown
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MB: u64 = 1_000_000;

    /// Runs `left` from `at` for `secs` at `bps`, a report every 100 ms; returns the figure after each
    /// second, the time and the bytes.
    fn run(
        left: &mut TimeLeft,
        at: u64,
        bytes: u64,
        bps: u64,
        secs: u64,
        total: u64,
        limit: Option<u64>,
    ) -> (Vec<Option<u64>>, u64, u64) {
        let (mut now, mut done, mut figures) = (at, bytes, Vec::new());
        for step in 1..=secs * 10 {
            now += 100;
            done += bps / 10;
            left.observe(now, true, done, Some(total), limit);
            if step % 10 == 0 {
                figures.push(left.seconds());
            }
        }
        (figures, now, done)
    }

    #[test]
    fn shows_nothing_in_a_runs_first_three_seconds_then_one_figure_a_second() {
        let mut left = TimeLeft::default();
        left.observe(0, true, 0, Some(100 * MB), None);
        let (figures, now, done) = run(&mut left, 0, 0, MB, 2, 100 * MB, None);
        assert_eq!(figures, [None, None]);
        let (figures, now, done) = run(&mut left, now, done, MB, 2, 100 * MB, None);
        assert!(figures.iter().all(Option::is_some), "{figures:?}");
        // Within a second the figure stays as it was.
        let shown = left.seconds();
        left.observe(now + 300, true, done + 300_000, Some(100 * MB), None);
        assert_eq!(left.seconds(), shown);
    }

    #[test]
    fn a_steady_download_gives_the_time_it_really_has_left() {
        let mut left = TimeLeft::default();
        let (figures, _, _) = run(&mut left, 0, 0, MB, 20, 100 * MB, None);
        let last = figures.last().unwrap().unwrap();
        assert!(
            (79..=81).contains(&last),
            "{last} s left after 20 s of 100 at 1 MB/s"
        );
    }

    #[test]
    fn a_short_dip_barely_moves_the_figure() {
        let mut left = TimeLeft::default();
        let (_, now, done) = run(&mut left, 0, 0, MB, 20, 200 * MB, None);
        let before = left.seconds().unwrap();
        let (figures, _, _) = run(&mut left, now, done, MB / 4, 2, 200 * MB, None);
        let after = figures.last().unwrap().unwrap();
        // Today's figure, the remaining bytes over the last 3 s, would have more than doubled.
        assert!(
            after <= before + before / 20 + 2,
            "{before} s became {after} s after a 2 s dip"
        );
    }

    #[test]
    fn a_lasting_change_is_followed_within_about_ten_seconds() {
        let mut left = TimeLeft::default();
        let (_, now, done) = run(&mut left, 0, 0, 2 * MB, 20, 400 * MB, None);
        let (figures, _, done2) = run(&mut left, now, done, MB, 12, 400 * MB, None);
        let last = figures.last().unwrap().unwrap();
        let truth = (400 * MB - done2) / MB;
        assert!(
            last.abs_diff(truth) <= truth / 10,
            "{last} s shown, {truth} s at the new speed"
        );
    }

    #[test]
    fn a_new_stretch_starts_where_the_change_began_so_an_uneven_new_speed_reads_steady() {
        let mut left = TimeLeft::default();
        let (_, mut now, mut done) = run(&mut left, 0, 0, 3 * MB, 20, 1_000 * MB, None);
        // The speed drops to 1 MB/s on average, unevenly: 0.4 MB/s for 2 s, then 1.6 MB/s for 2 s.
        let mut figures = Vec::new();
        for round in 0..6 {
            for bps in [MB * 2 / 5, MB * 2 / 5, MB * 8 / 5, MB * 8 / 5] {
                let (f, n, d) = run(&mut left, now, done, bps, 1, 1_000 * MB, None);
                (now, done) = (n, d);
                if round >= 3 {
                    figures.push((f[0].unwrap(), (1_000 * MB - done) / MB));
                }
            }
        }
        for (shown, truth) in figures {
            assert!(
                shown.abs_diff(truth) <= truth * 6 / 100,
                "{shown} s shown, {truth} s at 1 MB/s"
            );
        }
    }

    #[test]
    fn a_changed_speed_limit_starts_again_at_once() {
        let mut left = TimeLeft::default();
        let (_, now, done) = run(&mut left, 0, 0, 2 * MB, 20, 400 * MB, Some(2 * MB));
        // The limit is halved: the speed follows at once, and so does the figure.
        let (figures, _, done2) = run(&mut left, now, done, MB, 6, 400 * MB, Some(MB));
        let last = figures.last().unwrap().unwrap();
        let truth = (400 * MB - done2) / MB;
        assert!(
            last.abs_diff(truth) <= truth / 10,
            "{last} s shown, {truth} s at the new limit"
        );
    }

    #[test]
    fn shows_nothing_while_paused_of_unknown_size_or_stalled() {
        let mut left = TimeLeft::default();
        let (_, now, done) = run(&mut left, 0, 0, MB, 10, 100 * MB, None);
        assert!(left.seconds().is_some());
        left.observe(now + 100, false, done, Some(100 * MB), None);
        assert_eq!(left.seconds(), None, "paused");
        let (figures, now, done) = run(&mut left, now + 100, done, MB, 2, 100 * MB, None);
        assert_eq!(figures, [None, None], "a resumed run waits 3 s again");
        left.observe(now + 100, true, done, None, None);
        assert_eq!(left.seconds(), None, "unknown size");
        let mut left = TimeLeft::default();
        let (_, now, done) = run(&mut left, 0, 0, MB, 20, 100 * MB, None);
        let (figures, _, _) = run(&mut left, now, done, 0, 16, 100 * MB, None);
        assert_eq!(
            *figures.last().unwrap(),
            None,
            "no byte for 16 s: {figures:?}"
        );
    }
}
