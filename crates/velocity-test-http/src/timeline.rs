//! A record of how a test's download went, for its failure message (#257): a line from `sample`
//! every interval while the test runs. The adaptive-connection tests time their ramp, which a
//! loaded CI runner can bend in ways a local run doesn't show; the timeline shows what the ramp
//! did there.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

/// Lines sampled every interval, each with the seconds since the start.
pub struct Timeline {
    lines: Arc<Mutex<Vec<String>>>,
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl Timeline {
    /// Calls `sample` every `every` on a thread of its own until the timeline is dropped.
    pub fn start(every: Duration, sample: impl Fn() -> String + Send + 'static) -> Self {
        let (lines, stop) = (
            Arc::new(Mutex::new(Vec::new())),
            Arc::new(AtomicBool::new(false)),
        );
        let (into, stopped) = (Arc::clone(&lines), Arc::clone(&stop));
        let started = Instant::now();
        let thread = thread::spawn(move || {
            while !stopped.load(Ordering::Acquire) {
                let line = format!("{:6.1} s  {}", started.elapsed().as_secs_f64(), sample());
                into.lock().unwrap_or_else(|e| e.into_inner()).push(line);
                thread::sleep(every);
            }
        });
        Timeline {
            lines,
            stop,
            thread: Some(thread),
        }
    }

    /// The lines so far, one per line, for a failure message. Sampling goes on.
    pub fn text(&self) -> String {
        self.lines
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .join("\n")
    }
}

impl Drop for Timeline {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Release);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicU32;

    #[test]
    fn it_samples_until_it_is_dropped_with_the_time_of_each_line() {
        let calls = Arc::new(AtomicU32::new(0));
        let counted = Arc::clone(&calls);
        let timeline = Timeline::start(Duration::from_millis(10), move || {
            format!("sample {}", counted.fetch_add(1, Ordering::AcqRel))
        });
        // The count goes up inside `sample`, before its line is kept: wait for the line itself.
        while !timeline.text().contains("sample 2") {
            thread::sleep(Duration::from_millis(5));
        }
        let text = timeline.text();
        assert!(text.starts_with("   0.0 s  sample 0"), "{text}");
        drop(timeline);
        let after = calls.load(Ordering::Acquire);
        thread::sleep(Duration::from_millis(50));
        assert_eq!(
            calls.load(Ordering::Acquire),
            after,
            "it stopped when dropped"
        );
    }
}
