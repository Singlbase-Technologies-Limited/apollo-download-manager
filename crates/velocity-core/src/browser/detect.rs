//! Which browsers are installed, and the program that starts each (#241), so the Settings screen
//! lists only browsers found here and can open the extension's store page in that browser.
//!
//! - **Windows:** each browser's installer records its program under
//!   `Software\Microsoft\Windows\CurrentVersion\App Paths\<exe>`, for this user (`HKEY_CURRENT_USER`)
//!   or for every user (`HKEY_LOCAL_MACHINE`). Chromium has no installer there, so it isn't found.
//! - **Linux:** the browsers' usual program names on `PATH`, then the Snap and Flatpak ones. Those
//!   two run sandboxed, and a sandboxed browser may not be able to start the native host: that is
//!   reported, not hidden (PO decision on #241).
//!
//! Only a regular file is taken (on Linux, one marked executable). Nothing found is `None`, never
//! a guess.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::registration::Browser;
use crate::domain::ErrorCode;

/// An installed browser.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Found {
    /// The program that starts it.
    pub program: String,
    /// A Snap or Flatpak browser, which may not reach the native host.
    pub sandboxed: bool,
}

/// Where to look. Tests point it at folders and a registry key of their own.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Finder {
    /// The `PATH` folders, in order.
    path: Vec<PathBuf>,
    /// Snap's program folder, `/snap/bin`.
    snap_bin: PathBuf,
    /// Flatpak's program folders: the system's, then this user's.
    flatpak_bins: Vec<PathBuf>,
    /// The `App Paths` key under `HKEY_CURRENT_USER`; the same path is read under
    /// `HKEY_LOCAL_MACHINE` only when `machine` is set.
    #[cfg_attr(not(windows), allow(dead_code))]
    app_paths: String,
    #[cfg_attr(not(windows), allow(dead_code))]
    machine: bool,
}

const APP_PATHS: &str = r"Software\Microsoft\Windows\CurrentVersion\App Paths";

impl Finder {
    /// This user's: `PATH`, Snap, Flatpak and the registry.
    pub fn for_user() -> Self {
        let path = std::env::var_os("PATH")
            .map(|p| std::env::split_paths(&p).collect())
            .unwrap_or_default();
        let mut flatpak_bins = vec![PathBuf::from("/var/lib/flatpak/exports/bin")];
        if let Some(home) = dirs::home_dir() {
            flatpak_bins.push(home.join(".local/share/flatpak/exports/bin"));
        }
        Self {
            path,
            snap_bin: PathBuf::from("/snap/bin"),
            flatpak_bins,
            app_paths: APP_PATHS.to_owned(),
            machine: true,
        }
    }

    /// Explicit places, for tests; the registry key is read under `HKEY_CURRENT_USER` only.
    pub fn new(
        path: Vec<PathBuf>,
        snap_bin: PathBuf,
        flatpak_bins: Vec<PathBuf>,
        app_paths: &str,
    ) -> Self {
        Self {
            path,
            snap_bin,
            flatpak_bins,
            app_paths: app_paths.to_owned(),
            machine: false,
        }
    }

    /// The installed `browser`, if found.
    pub fn find(&self, browser: Browser) -> Option<Found> {
        if cfg!(windows) {
            self.find_windows(browser)
        } else if cfg!(target_os = "linux") {
            self.find_linux(browser)
        } else {
            None
        }
    }

    #[cfg(windows)]
    fn find_windows(&self, browser: Browser) -> Option<Found> {
        use super::registration::registry;
        let exe = match browser {
            Browser::Chrome => "chrome.exe",
            Browser::Edge => "msedge.exe",
            Browser::Brave => "brave.exe",
            Browser::Firefox => "firefox.exe",
            Browser::Chromium => return None,
        };
        let key = format!(r"{}\{exe}", self.app_paths);
        let user = registry::get_default(&key);
        let machine = || {
            self.machine
                .then(|| registry::get_machine_default(&key))
                .flatten()
        };
        [user, machine()]
            .into_iter()
            .flatten()
            .map(|v| PathBuf::from(v.trim().trim_matches('"')))
            .find(|p| program_at(p))
            .map(|p| Found {
                program: p.to_string_lossy().into_owned(),
                sandboxed: false,
            })
    }

    #[cfg(not(windows))]
    fn find_windows(&self, _browser: Browser) -> Option<Found> {
        None
    }

    fn find_linux(&self, browser: Browser) -> Option<Found> {
        let (names, snap, flatpak): (&[&str], Option<&str>, &str) = match browser {
            Browser::Chrome => (
                &["google-chrome-stable", "google-chrome"],
                None,
                "com.google.Chrome",
            ),
            Browser::Chromium => (
                &["chromium", "chromium-browser"],
                Some("chromium"),
                "org.chromium.Chromium",
            ),
            Browser::Edge => (
                &["microsoft-edge-stable", "microsoft-edge"],
                None,
                "com.microsoft.Edge",
            ),
            Browser::Brave => (
                &["brave-browser", "brave"],
                Some("brave"),
                "com.brave.Browser",
            ),
            Browser::Firefox => (
                &["firefox", "firefox-esr"],
                Some("firefox"),
                "org.mozilla.firefox",
            ),
        };
        // Ubuntu's /usr/bin/firefox and chromium-browser only start the Snap, so a Snap there
        // means the browser is the Snap, whatever PATH finds first.
        let snapped = snap
            .map(|n| self.snap_bin.join(n))
            .filter(|p| program_at(p));
        let on_path = names
            .iter()
            .flat_map(|n| self.path.iter().map(move |d| d.join(n)))
            .find(|p| program_at(p));
        if let Some(p) = snapped {
            return Some(found(&p, true));
        }
        if let Some(p) = on_path {
            return Some(found(&p, false));
        }
        self.flatpak_bins
            .iter()
            .map(|d| d.join(flatpak))
            .find(|p| program_at(p))
            .map(|p| found(&p, true))
    }
}

fn found(p: &Path, sandboxed: bool) -> Found {
    Found {
        program: p.to_string_lossy().into_owned(),
        sandboxed,
    }
}

/// A regular file, executable on Unix. Links are followed, since browsers' programs often are
/// links; this only reads, and nothing is written, moved or started here.
fn program_at(p: &Path) -> bool {
    let Ok(meta) = std::fs::metadata(p) else {
        return false;
    };
    if !meta.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        meta.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}

/// What starts `browser` on the extension's store page (#241): the program the browser was found
/// at and the page, as its one argument. Never a shell, and never a link from outside: the page is
/// `branding.json`'s. `NotFound` when the browser isn't installed, `Unsupported` until the
/// extension is published in its store (#240).
pub fn store_page_launch(
    finder: &Finder,
    browser: Browser,
) -> Result<(PathBuf, String), ErrorCode> {
    let found = finder.find(browser).ok_or(ErrorCode::NotFound)?;
    let url = browser.store_url().ok_or(ErrorCode::Unsupported)?;
    Ok((PathBuf::from(found.program), url.to_owned()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_store_page_needs_the_browser_and_a_published_page() {
        let d = Dir::new("launch");
        assert_eq!(
            store_page_launch(&d.finder(), Browser::Firefox),
            Err(ErrorCode::NotFound)
        );
        #[cfg(target_os = "linux")]
        {
            // Edge's store hasn't published the extension yet (#240).
            d.program("usr/bin/microsoft-edge");
            assert_eq!(
                store_page_launch(&d.finder(), Browser::Edge),
                Err(ErrorCode::Unsupported)
            );
            // Firefox Add-ons has, since 2026-11-12: Firefox opens its listing.
            let firefox = d.program("usr/bin/firefox");
            assert_eq!(
                store_page_launch(&d.finder(), Browser::Firefox),
                Ok((
                    firefox,
                    Browser::Firefox.store_url().expect("published").to_owned()
                ))
            );
        }
    }

    struct Dir(PathBuf);

    impl Dir {
        fn new(name: &str) -> Self {
            let p = std::env::temp_dir().join(format!("v2-detect-{name}-{}", std::process::id()));
            let _ = std::fs::remove_dir_all(&p);
            std::fs::create_dir_all(&p).unwrap();
            Dir(p)
        }

        /// An executable stand-in at `rel`.
        fn program(&self, rel: &str) -> PathBuf {
            let p = self.0.join(rel);
            std::fs::create_dir_all(p.parent().unwrap()).unwrap();
            std::fs::write(&p, b"#!/bin/sh\n").unwrap();
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o755)).unwrap();
            }
            p
        }

        fn finder(&self) -> Finder {
            Finder::new(
                vec![self.0.join("usr/bin"), self.0.join("usr/local/bin")],
                self.0.join("snap/bin"),
                vec![self.0.join("flatpak/system"), self.0.join("flatpak/user")],
                &format!(r"Software\VelocityV2Tests\detect-{}", std::process::id()),
            )
        }
    }

    impl Drop for Dir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn nothing_installed_is_nothing_found() {
        let d = Dir::new("none");
        for b in Browser::ALL {
            assert_eq!(d.finder().find(b), None, "{b:?}");
        }
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn finds_linux_browsers_by_their_usual_names() {
        let d = Dir::new("linux");
        let chrome = d.program("usr/bin/google-chrome-stable");
        let edge = d.program("usr/local/bin/microsoft-edge");
        let f = d.finder();
        assert_eq!(f.find(Browser::Chrome), Some(found(&chrome, false)));
        assert_eq!(f.find(Browser::Edge), Some(found(&edge, false)));
        assert_eq!(f.find(Browser::Brave), None);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn a_snap_or_flatpak_browser_is_marked_sandboxed() {
        let d = Dir::new("sandboxed");
        // Ubuntu's /usr/bin/firefox only starts the Snap.
        d.program("usr/bin/firefox");
        let snap = d.program("snap/bin/firefox");
        let flatpak = d.program("flatpak/user/com.brave.Browser");
        let f = d.finder();
        assert_eq!(f.find(Browser::Firefox), Some(found(&snap, true)));
        assert_eq!(f.find(Browser::Brave), Some(found(&flatpak, true)));
    }

    #[cfg(unix)]
    #[test]
    fn a_file_not_marked_executable_or_a_folder_is_not_a_browser() {
        use std::os::unix::fs::PermissionsExt;
        let d = Dir::new("not-exec");
        let p = d.program("usr/bin/firefox");
        std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o644)).unwrap();
        std::fs::create_dir_all(d.0.join("usr/bin/google-chrome")).unwrap();
        assert_eq!(d.finder().find(Browser::Firefox), None);
        assert_eq!(d.finder().find(Browser::Chrome), None);
    }

    #[cfg(windows)]
    #[test]
    fn finds_windows_browsers_from_app_paths_only_when_the_program_is_there() {
        use super::super::registration::registry;
        let d = Dir::new("windows");
        let f = d.finder();
        let chrome = d.program("Chrome/chrome.exe");
        registry::set_default(
            &format!(r"{}\chrome.exe", f.app_paths),
            &format!("\"{}\"", chrome.display()),
        )
        .unwrap();
        registry::set_default(
            &format!(r"{}\firefox.exe", f.app_paths),
            r"C:\nowhere\firefox.exe",
        )
        .unwrap();
        let got = (
            f.find(Browser::Chrome),
            f.find(Browser::Firefox),
            f.find(Browser::Chromium),
        );
        let _ = registry::delete(&format!(r"{}\chrome.exe", f.app_paths));
        let _ = registry::delete(&format!(r"{}\firefox.exe", f.app_paths));
        let _ = registry::delete(&f.app_paths);
        assert_eq!(got.0, Some(found(&chrome, false)));
        assert_eq!(got.1, None, "a stale entry whose program is gone");
        assert_eq!(got.2, None);
    }
}
