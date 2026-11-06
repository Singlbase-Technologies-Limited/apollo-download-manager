//! Starting the app for a link from the browser (#322, PO decisions): when the app isn't running,
//! the native host starts it in the tray, waits up to [`WAIT`] for it to answer, and hands it the
//! link; otherwise the browser keeps the download. The host starts one program only: the app
//! installed beside it ([`app_beside`]), never anything the browser names.

use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use crate::fs_safety::plain_file;

/// The argument the host starts the app with: it starts hidden in the tray, when there is one,
/// and a second start with it doesn't show the window.
pub const BACKGROUND_ARG: &str = "--background";

/// How long the host waits for the app it started to answer (PO decision on #322).
pub const WAIT: Duration = Duration::from_secs(10);

/// How often the host tries the app again while it waits.
pub const RETRY_EVERY: Duration = Duration::from_millis(250);

/// The app's program name, without the platform's extension: the desktop crate's binary, which
/// packaging installs beside the native host (ADR-0003 keeps internal names).
const APP_PROGRAM: &str = "velocity-desktop-v2";

/// The app installed beside `host`, the native host's own program: a plain file, never a link.
/// `None` when there is none there.
pub fn app_beside(host: &Path) -> Option<PathBuf> {
    let app = host
        .parent()?
        .join(format!("{APP_PROGRAM}{}", std::env::consts::EXE_SUFFIX));
    plain_file(&app).is_ok().then_some(app)
}

/// Whether the app was started with [`BACKGROUND_ARG`], among its arguments.
pub fn started_in_background(args: &[String]) -> bool {
    args.iter().any(|a| a == BACKGROUND_ARG)
}

/// What [`deliver`] did.
#[derive(Debug, PartialEq, Eq)]
pub enum Delivery<T> {
    /// The app answered.
    Answered(T),
    /// The app isn't running, and couldn't be started or didn't answer in time.
    NotRunning,
}

/// Sends with `send`, which gives `None` while the app isn't running. When it isn't, starts it
/// once with `start` and tries again every [`RETRY_EVERY`] until `wait` has passed.
pub fn deliver<T>(
    mut send: impl FnMut() -> Option<T>,
    start: impl FnOnce() -> bool,
    wait: Duration,
    sleep: impl FnMut(Duration),
) -> Delivery<T> {
    let mut sleep = sleep;
    if let Some(answer) = send() {
        return Delivery::Answered(answer);
    }
    if !start() {
        return Delivery::NotRunning;
    }
    let deadline = Instant::now() + wait;
    loop {
        let left = deadline.saturating_duration_since(Instant::now());
        if left.is_zero() {
            return Delivery::NotRunning;
        }
        sleep(RETRY_EVERY.min(left));
        if let Some(answer) = send() {
            return Delivery::Answered(answer);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;

    struct Dir(PathBuf);

    impl Dir {
        fn new(name: &str) -> Self {
            let p = std::env::temp_dir().join(format!("v2-launch-{name}-{}", std::process::id()));
            let _ = std::fs::remove_dir_all(&p);
            std::fs::create_dir_all(&p).unwrap();
            Dir(p)
        }
    }

    impl Drop for Dir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn app_name() -> String {
        format!("velocity-desktop-v2{}", std::env::consts::EXE_SUFFIX)
    }

    #[test]
    fn the_app_beside_the_host_is_found() {
        let dir = Dir::new("beside");
        let host = dir.0.join(format!(
            "velocity-native-host-v2{}",
            std::env::consts::EXE_SUFFIX
        ));
        std::fs::write(&host, b"host").unwrap();
        assert_eq!(app_beside(&host), None, "no app there yet");
        std::fs::write(dir.0.join(app_name()), b"app").unwrap();
        assert_eq!(app_beside(&host), Some(dir.0.join(app_name())));
    }

    #[test]
    fn a_link_or_a_folder_in_place_of_the_app_is_never_started() {
        let dir = Dir::new("link");
        let host = dir.0.join("host");
        std::fs::create_dir_all(dir.0.join(app_name())).unwrap();
        assert_eq!(app_beside(&host), None, "a folder");
        std::fs::remove_dir(dir.0.join(app_name())).unwrap();
        let elsewhere = dir.0.join("elsewhere");
        std::fs::write(&elsewhere, b"other").unwrap();
        if crate::fs_safety::test_links::file_link(&elsewhere, &dir.0.join(app_name())) {
            assert_eq!(app_beside(&host), None, "a link");
        }
    }

    #[test]
    fn only_the_exact_background_argument_counts() {
        let args = |a: &[&str]| a.iter().map(|s| (*s).to_owned()).collect::<Vec<_>>();
        assert!(started_in_background(&args(&["--background"])));
        assert!(started_in_background(&args(&["--x", "--background"])));
        assert!(!started_in_background(&args(&[])));
        assert!(!started_in_background(&args(&[
            "--background=1",
            "background"
        ])));
    }

    #[test]
    fn a_running_app_gets_it_at_once_and_nothing_is_started() {
        let started = Cell::new(false);
        let got = deliver(
            || Some(7),
            || {
                started.set(true);
                true
            },
            WAIT,
            |_| panic!("no wait"),
        );
        assert_eq!(got, Delivery::Answered(7));
        assert!(!started.get());
    }

    #[test]
    fn a_closed_app_is_started_once_and_gets_it_when_it_answers() {
        let (tries, starts) = (Cell::new(0), Cell::new(0));
        let got = deliver(
            || {
                tries.set(tries.get() + 1);
                (tries.get() > 3).then_some("ok")
            },
            || {
                starts.set(starts.get() + 1);
                true
            },
            WAIT,
            |_| {},
        );
        assert_eq!(got, Delivery::Answered("ok"));
        assert_eq!(starts.get(), 1);
    }

    #[test]
    fn an_app_that_never_answers_is_given_up_on_after_the_wait() {
        let (starts, slept) = (Cell::new(0), Cell::new(Duration::ZERO));
        let got: Delivery<()> = deliver(
            || None,
            || {
                starts.set(starts.get() + 1);
                true
            },
            Duration::from_secs(1),
            |d| {
                slept.set(slept.get() + d);
                std::thread::sleep(d);
            },
        );
        assert_eq!(got, Delivery::NotRunning);
        assert_eq!(starts.get(), 1);
        assert!(
            slept.get() >= Duration::from_secs(1) - RETRY_EVERY,
            "{:?}",
            slept.get()
        );
    }

    #[test]
    fn an_app_that_can_t_be_started_is_given_up_on_at_once() {
        let tries = Cell::new(0);
        let got: Delivery<()> = deliver(
            || {
                tries.set(tries.get() + 1);
                None
            },
            || false,
            WAIT,
            |_| panic!("no wait"),
        );
        assert_eq!(got, Delivery::NotRunning);
        assert_eq!(tries.get(), 1);
    }
}
