//! Starting Apollo Download Manager when the user signs in (#321, PO decisions): the system's own
//! start-up list for the current user, with no new dependency. On Windows that is a value named
//! after the app's identifier under `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`;
//! on Linux, an `<identifier>.desktop` file in the XDG autostart folder. The identifier is this
//! build's own, so V1's entry and another build's are never touched (#11, #27).

use std::path::PathBuf;

use crate::domain::ErrorCode;

/// What starts at sign-in: the app's identifier, the name the system shows, and the program.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Entry {
    pub identifier: String,
    pub name: String,
    pub program: PathBuf,
}

/// A start-up list for the current user.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StartupList {
    /// A registry key under `HKEY_CURRENT_USER`, whose named values are commands.
    #[cfg(windows)]
    Registry { key: String },
    /// A folder of `.desktop` files.
    #[cfg(unix)]
    Folder(PathBuf),
}

impl StartupList {
    /// The current user's start-up list; `None` when it can't be found (no home folder).
    pub fn user() -> Option<Self> {
        #[cfg(windows)]
        {
            Some(StartupList::Registry {
                key: r"Software\Microsoft\Windows\CurrentVersion\Run".to_owned(),
            })
        }
        #[cfg(unix)]
        {
            // `$XDG_CONFIG_HOME/autostart`, else `~/.config/autostart` (XDG Autostart spec).
            dirs::config_dir().map(|config| StartupList::Folder(config.join("autostart")))
        }
    }

    /// Adds `entry` to the list, or replaces this app's own entry, with `on`; takes it out
    /// without it. Taking out an entry that isn't there is fine.
    pub fn set(&self, entry: &Entry, on: bool) -> Result<(), ErrorCode> {
        match self {
            #[cfg(windows)]
            StartupList::Registry { key } => {
                use crate::browser::registration::registry;
                if on {
                    registry::set_value(key, Some(&entry.identifier), &command(entry))
                } else {
                    registry::delete_value(key, &entry.identifier)
                }
            }
            #[cfg(unix)]
            StartupList::Folder(dir) => desktop::set(dir, entry, on),
        }
    }

    /// Whether `entry` is in the list, starting this program.
    pub fn has(&self, entry: &Entry) -> bool {
        match self {
            #[cfg(windows)]
            StartupList::Registry { key } => {
                crate::browser::registration::registry::get_value(key, Some(&entry.identifier))
                    .is_some_and(|value| value == command(entry))
            }
            #[cfg(unix)]
            StartupList::Folder(dir) => desktop::has(dir, entry),
        }
    }
}

/// The command Windows runs: the program, quoted, since its folder may have spaces.
#[cfg(windows)]
fn command(entry: &Entry) -> String {
    format!("\"{}\"", entry.program.display())
}

/// The `.desktop` file (XDG Desktop Entry spec), written beside its place and renamed into it, and
/// never through a link ([`crate::fs_safety`]).
#[cfg(unix)]
mod desktop {
    use std::io::Write;
    use std::path::{Path, PathBuf};

    use super::Entry;
    use crate::domain::ErrorCode;
    use crate::fs_safety::{is_link, plain_dir};

    fn path(dir: &Path, entry: &Entry) -> PathBuf {
        dir.join(format!("{}.desktop", entry.identifier))
    }

    /// The file for `entry`: what it holds, so `has` can compare it.
    pub(super) fn text(entry: &Entry) -> String {
        format!(
            "[Desktop Entry]\nType=Application\nName={}\nExec={}\nTerminal=false\nX-GNOME-Autostart-enabled=true\n",
            single_line(&entry.name),
            exec_quoted(&entry.program.to_string_lossy()),
        )
    }

    /// A value on one line: line breaks would start another key.
    fn single_line(value: &str) -> String {
        value.replace(['\n', '\r'], " ")
    }

    /// The program as one quoted `Exec` argument, as the spec asks: `"`, `` ` `` and `$` escaped
    /// with `\`, and `%` doubled. A `\` is written as four, since the file's own string escapes
    /// are undone before the quoting is.
    fn exec_quoted(program: &str) -> String {
        let mut out = String::from("\"");
        for c in single_line(program).chars() {
            match c {
                '\\' => out.push_str(r"\\\\"),
                '"' | '`' | '$' => {
                    out.push('\\');
                    out.push(c);
                }
                '%' => out.push_str("%%"),
                c => out.push(c),
            }
        }
        out.push('"');
        out
    }

    /// What is at `path`: nothing, this app's plain file, or something it must not touch.
    fn existing(path: &Path) -> Result<bool, ErrorCode> {
        match std::fs::symlink_metadata(path) {
            Ok(meta) if meta.is_file() && !is_link(&meta) => Ok(true),
            Ok(_) => Err(ErrorCode::InvalidPath),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(_) => Err(ErrorCode::Io),
        }
    }

    pub(super) fn set(dir: &Path, entry: &Entry, on: bool) -> Result<(), ErrorCode> {
        let path = path(dir, entry);
        if !on {
            return match existing(&path)? {
                true => std::fs::remove_file(&path).map_err(|_| ErrorCode::Io),
                false => Ok(()),
            };
        }
        existing(&path)?;
        std::fs::create_dir_all(dir).map_err(|_| ErrorCode::Io)?;
        plain_dir(dir).map_err(|_| ErrorCode::InvalidPath)?;
        let temporary = dir.join(format!(".{}.desktop.tmp", entry.identifier));
        if std::fs::symlink_metadata(&temporary).is_ok() {
            existing(&temporary)?;
            std::fs::remove_file(&temporary).map_err(|_| ErrorCode::Io)?;
        }
        let written = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .and_then(|mut file| {
                file.write_all(text(entry).as_bytes())?;
                file.sync_all()
            })
            .and_then(|()| std::fs::rename(&temporary, &path));
        if written.is_err() {
            let _ = std::fs::remove_file(&temporary);
            return Err(ErrorCode::Io);
        }
        Ok(())
    }

    pub(super) fn has(dir: &Path, entry: &Entry) -> bool {
        let path = path(dir, entry);
        matches!(existing(&path), Ok(true))
            && std::fs::read_to_string(&path).is_ok_and(|t| t == text(entry))
    }
}

/// Start-up lists of the tests' own, shared with the manager's tests.
#[cfg(test)]
pub(crate) mod test_list {
    use std::path::PathBuf;

    use super::{Entry, StartupList};

    /// A start-up list of the test's own: a registry key under `Software\VelocityV2Tests`, or a
    /// temporary folder, removed when dropped.
    pub(crate) struct Fixture {
        pub(crate) list: StartupList,
    }

    impl Fixture {
        pub(crate) fn new(test: &str) -> Self {
            #[cfg(windows)]
            let list = StartupList::Registry {
                key: format!(
                    r"Software\VelocityV2Tests\autostart-{test}-{}",
                    std::process::id()
                ),
            };
            #[cfg(unix)]
            let list = StartupList::Folder(
                std::env::temp_dir().join(format!("v2-autostart-{test}-{}", std::process::id())),
            );
            let fixture = Fixture { list };
            fixture.clean();
            fixture
        }

        fn clean(&self) {
            match &self.list {
                #[cfg(windows)]
                StartupList::Registry { key } => {
                    crate::browser::registration::registry::delete_tree(key)
                }
                #[cfg(unix)]
                StartupList::Folder(dir) => {
                    let _ = std::fs::remove_dir_all(dir);
                }
            }
        }

        /// Another program's entry in the same list, as V1's would be.
        pub(crate) fn other(&self) -> Entry {
            Entry {
                identifier: "com.velocity.download-manager".to_owned(),
                name: "Velocity Download Manager".to_owned(),
                program: PathBuf::from(if cfg!(windows) {
                    r"C:\Program Files\Velocity\velocity.exe"
                } else {
                    "/usr/bin/velocity"
                }),
            }
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            self.clean();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::test_list::Fixture;
    use super::*;

    fn ours() -> Entry {
        Entry {
            identifier: "dev.velocity.downloadmanager.v2".to_owned(),
            name: "Apollo Download Manager".to_owned(),
            program: PathBuf::from(if cfg!(windows) {
                r"C:\Users\me\AppData\Local\Apollo Download Manager\apollo.exe"
            } else {
                "/opt/Apollo Download Manager/apollo"
            }),
        }
    }

    #[test]
    fn switching_it_on_adds_this_apps_entry_and_off_takes_it_out() {
        let f = Fixture::new("on-off");
        let entry = ours();
        assert!(!f.list.has(&entry));
        f.list.set(&entry, true).expect("on");
        assert!(f.list.has(&entry));
        f.list.set(&entry, false).expect("off");
        assert!(!f.list.has(&entry));
        f.list
            .set(&entry, false)
            .expect("off again: nothing to take out");
    }

    #[test]
    fn a_moved_program_replaces_this_apps_own_entry() {
        let f = Fixture::new("moved");
        let mut entry = ours();
        f.list.set(&entry, true).unwrap();
        entry.program = entry.program.with_file_name("moved.exe");
        assert!(!f.list.has(&entry), "the old entry starts the old program");
        f.list.set(&entry, true).unwrap();
        assert!(f.list.has(&entry));
    }

    #[test]
    fn another_programs_entry_is_never_touched() {
        let f = Fixture::new("other");
        let other = f.other();
        f.list.set(&other, true).unwrap();
        f.list.set(&ours(), true).unwrap();
        f.list.set(&ours(), false).unwrap();
        assert!(f.list.has(&other));
    }

    #[cfg(unix)]
    #[test]
    fn the_desktop_file_starts_the_program_quoted() {
        let f = Fixture::new("desktop");
        f.list.set(&ours(), true).unwrap();
        let StartupList::Folder(dir) = &f.list;
        let text =
            std::fs::read_to_string(dir.join("dev.velocity.downloadmanager.v2.desktop")).unwrap();
        assert!(text.starts_with("[Desktop Entry]\n"), "{text}");
        assert!(text.contains("\nType=Application\n"), "{text}");
        assert!(text.contains("\nName=Apollo Download Manager\n"), "{text}");
        assert!(
            text.contains("\nExec=\"/opt/Apollo Download Manager/apollo\"\n"),
            "{text}"
        );
    }

    /// A link in place of this app's `.desktop` file is never followed or written through.
    #[cfg(unix)]
    #[test]
    fn a_link_in_place_of_the_desktop_file_is_refused() {
        let f = Fixture::new("link");
        let StartupList::Folder(dir) = &f.list;
        std::fs::create_dir_all(dir).unwrap();
        let target = dir.join("someone-elses");
        std::fs::write(&target, b"theirs").unwrap();
        std::os::unix::fs::symlink(&target, dir.join("dev.velocity.downloadmanager.v2.desktop"))
            .unwrap();
        assert_eq!(f.list.set(&ours(), true), Err(ErrorCode::InvalidPath));
        assert_eq!(f.list.set(&ours(), false), Err(ErrorCode::InvalidPath));
        assert_eq!(std::fs::read(&target).unwrap(), b"theirs");
    }

    #[cfg(windows)]
    #[test]
    fn the_registry_value_starts_the_program_quoted() {
        let f = Fixture::new("quoted");
        f.list.set(&ours(), true).unwrap();
        let StartupList::Registry { key } = &f.list;
        assert_eq!(
            crate::browser::registration::registry::get_value(
                key,
                Some("dev.velocity.downloadmanager.v2")
            )
            .as_deref(),
            Some(r#""C:\Users\me\AppData\Local\Apollo Download Manager\apollo.exe""#)
        );
    }
}
