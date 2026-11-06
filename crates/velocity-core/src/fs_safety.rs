//! File safety (#72, AGENTS.md "File safety"): the checks every part of V2 that creates, opens,
//! finalises or deletes a file shares. Nothing is ever followed through a link, and a path is used
//! only when it is inside the folder it belongs to. The engine's part files (`velocity-transfer`),
//! Metalink folders (#54), download removal, torrent deletion (#62), the database and moving a
//! download to its category's folder (#366) use them. The no-replace rename lives here so the
//! engine and the manager share it; its `unsafe` calls carry `SAFETY` notes.
//!
//! A **link** is anything that redirects to another place: a symbolic link, or on Windows a
//! junction or a mount point (a "name surrogate" reparse point). Other reparse points, such as the
//! files of a cloud-sync folder, are ordinary files (PO decision on #72): the standard library's
//! `is_symlink` draws exactly that line on Windows.

use std::fs::{self, Metadata};
use std::io;
use std::path::{Component, Path};

/// Whether `meta`, read with `symlink_metadata`, is a link: a symbolic link, a junction or a mount
/// point.
pub fn is_link(meta: &Metadata) -> bool {
    meta.file_type().is_symlink()
}

/// The metadata of `path` when it is a plain file, read without following it. A link, a folder or
/// anything else is refused with `InvalidInput`.
pub fn plain_file(path: &Path) -> io::Result<Metadata> {
    let meta = fs::symlink_metadata(path)?;
    if is_link(&meta) || !meta.is_file() {
        return Err(not_plain(path, "a plain file"));
    }
    Ok(meta)
}

/// The metadata of `path` when it is a folder itself, not a link to one, read without following
/// it. Anything else is refused with `InvalidInput`.
pub fn plain_dir(path: &Path) -> io::Result<Metadata> {
    let meta = fs::symlink_metadata(path)?;
    if is_link(&meta) || !meta.is_dir() {
        return Err(not_plain(path, "a plain folder"));
    }
    Ok(meta)
}

fn not_plain(path: &Path, what: &str) -> io::Error {
    io::Error::new(
        io::ErrorKind::InvalidInput,
        format!("{} is a link or not {what}", path.display()),
    )
}

/// Whether `path` names something inside `root`, judged on the names alone: `root` followed by one
/// or more plain names. A `..`, a drive or a root on the way is refused, so the answer never
/// depends on what is on disk. (A `.` after the start is no step: `Path` drops it.)
pub fn inside(root: &Path, path: &Path) -> bool {
    let Ok(rest) = path.strip_prefix(root) else {
        return false;
    };
    let mut names = rest.components().peekable();
    names.peek().is_some() && names.all(|c| matches!(c, Component::Normal(_)))
}

/// Whether `path` is [`inside`] `root` and every folder between them is a plain folder, not a link,
/// so nothing at `path` can lead out of `root`. A folder missing on the way is fine: `path` isn't
/// there either. `root` itself is the user's choice, and the last name is the caller's to check
/// ([`plain_file`], [`plain_dir`]).
pub fn reached_through_plain_folders(root: &Path, path: &Path) -> bool {
    let Ok(rest) = path.strip_prefix(root) else {
        return false;
    };
    if !inside(root, path) {
        return false;
    }
    let mut folder = root.to_path_buf();
    let mut levels = rest.components().peekable();
    while let Some(level) = levels.next() {
        if levels.peek().is_none() {
            break;
        }
        folder.push(level);
        if fs::symlink_metadata(&folder).is_ok_and(|meta| is_link(&meta) || !meta.is_dir()) {
            return false;
        }
    }
    true
}

/// Renames `from` to `to` only if nothing exists at `to`: an existing file is never replaced,
/// whatever appeared there meanwhile (`ErrorKind::AlreadyExists`). On Unix the folder is synced
/// afterwards, so the new name survives a power loss.
#[cfg(windows)]
pub fn rename_no_replace(from: &Path, to: &Path) -> io::Result<()> {
    use windows_sys::Win32::Storage::FileSystem::{MoveFileExW, MOVEFILE_WRITE_THROUGH};
    let (from_w, to_w) = (verbatim(from), verbatim(to));
    // SAFETY: both are NUL-terminated UTF-16 strings that live until the call returns. Without
    // MOVEFILE_REPLACE_EXISTING, MoveFileExW fails if `to` exists; MOVEFILE_WRITE_THROUGH makes it
    // return only once the rename is on disk.
    let ok = unsafe { MoveFileExW(from_w.as_ptr(), to_w.as_ptr(), MOVEFILE_WRITE_THROUGH) };
    if ok == 0 {
        return Err(io::Error::last_os_error());
    }
    Ok(())
}

/// `path` as a NUL-terminated UTF-16 verbatim path (`\\?\C:\…`, `\\?\UNC\server\share\…`), so
/// `MoveFileExW` takes paths longer than `MAX_PATH` (260 characters), as the standard library's
/// own file calls do (#72). Only an absolute path of plain names is made verbatim, since a verbatim
/// path is taken literally; anything else is passed as it is.
#[cfg(windows)]
fn verbatim(path: &Path) -> Vec<u16> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStrExt;
    use std::path::{Component, Prefix};
    let mut parts = path.components();
    let head = match (parts.next(), parts.next()) {
        (Some(Component::Prefix(prefix)), Some(Component::RootDir)) => match prefix.kind() {
            Prefix::Disk(_) => {
                let mut head = OsString::from(r"\\?\");
                head.push(prefix.as_os_str());
                Some(head)
            }
            Prefix::UNC(server, share) => {
                let mut head = OsString::from(r"\\?\UNC\");
                head.push(server);
                head.push(r"\");
                head.push(share);
                Some(head)
            }
            _ => None,
        },
        _ => None,
    };
    let names: Option<Vec<_>> = parts
        .map(|c| match c {
            Component::Normal(name) => Some(name),
            _ => None,
        })
        .collect();
    let full = match (head, names) {
        (Some(mut full), Some(names)) => {
            for name in names {
                full.push(r"\");
                full.push(name);
            }
            full
        }
        _ => path.as_os_str().to_owned(),
    };
    full.encode_wide().chain([0]).collect()
}

#[cfg(unix)]
pub fn rename_no_replace(from: &Path, to: &Path) -> io::Result<()> {
    rename_exclusive(from, to)?;
    // The rename is durable once its folder is synced.
    if let Some(folder) = to.parent().filter(|p| !p.as_os_str().is_empty()) {
        fs::File::open(folder)?.sync_all()?;
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn rename_exclusive(from: &Path, to: &Path) -> io::Result<()> {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;
    let c = |p: &Path| {
        CString::new(p.as_os_str().as_bytes())
            .map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "a NUL byte in a path"))
    };
    let (from_c, to_c) = (c(from)?, c(to)?);
    // SAFETY: both are NUL-terminated C strings that live until the call returns; AT_FDCWD makes
    // them relative to the working directory, as `std::fs::rename` does.
    let r = unsafe {
        libc::renameat2(
            libc::AT_FDCWD,
            from_c.as_ptr(),
            libc::AT_FDCWD,
            to_c.as_ptr(),
            libc::RENAME_NOREPLACE,
        )
    };
    if r == 0 {
        return Ok(());
    }
    let e = io::Error::last_os_error();
    match e.raw_os_error() {
        // A file system without RENAME_NOREPLACE: a hard link also refuses an existing name.
        Some(libc::EINVAL) | Some(libc::ENOSYS) => link_then_remove(from, to),
        _ => Err(e),
    }
}

/// Other Unix systems (macOS is #83): a hard link refuses an existing name, then the old name goes.
#[cfg(all(unix, not(target_os = "linux")))]
fn rename_exclusive(from: &Path, to: &Path) -> io::Result<()> {
    link_then_remove(from, to)
}

#[cfg(unix)]
fn link_then_remove(from: &Path, to: &Path) -> io::Result<()> {
    fs::hard_link(from, to)?;
    fs::remove_file(from)
}

/// Making links in tests, shared by the core's file-safety tests.
#[cfg(test)]
pub(crate) mod test_links {
    use std::path::Path;

    /// Makes `link` a symbolic link to the file `target`. On Windows that needs Developer Mode or
    /// an administrator; without either it prints NOT RUN and returns false (PO decision on #72).
    pub(crate) fn file_link(target: &Path, link: &Path) -> bool {
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(target, link).unwrap();
            true
        }
        #[cfg(windows)]
        match std::os::windows::fs::symlink_file(target, link) {
            Ok(()) => true,
            Err(e) => {
                eprintln!("file symbolic link: NOT RUN (no symlink rights: {e})");
                false
            }
        }
    }

    /// Makes `link` lead to the folder `target`: a symbolic link on Unix, a junction on Windows,
    /// which needs no administrator rights.
    pub(crate) fn folder_link(target: &Path, link: &Path) {
        #[cfg(unix)]
        std::os::unix::fs::symlink(target, link).unwrap();
        #[cfg(windows)]
        {
            let made = std::process::Command::new("cmd")
                .args(["/C", "mklink", "/J"])
                .arg(link)
                .arg(target)
                .output()
                .unwrap();
            assert!(made.status.success(), "mklink /J: {made:?}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::test_links::{file_link, folder_link};
    use super::*;
    use std::path::PathBuf;

    struct Dir(PathBuf);

    impl Dir {
        fn new(name: &str) -> Self {
            let p =
                std::env::temp_dir().join(format!("v2-fs-safety-{name}-{}", std::process::id()));
            let _ = fs::remove_dir_all(&p);
            fs::create_dir_all(&p).unwrap();
            Dir(p)
        }
    }

    impl Drop for Dir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn plain_files_and_folders_pass_and_links_to_them_are_refused() {
        let dir = Dir::new("plain");
        let file = dir.0.join("f.bin");
        fs::write(&file, b"x").unwrap();
        let folder = dir.0.join("sub");
        fs::create_dir(&folder).unwrap();
        assert!(plain_file(&file).is_ok());
        assert!(plain_dir(&folder).is_ok());
        assert!(plain_file(&folder).is_err());
        assert!(plain_dir(&file).is_err());

        let to_folder = dir.0.join("to-sub");
        folder_link(&folder, &to_folder);
        assert!(is_link(&fs::symlink_metadata(&to_folder).unwrap()));
        assert_eq!(
            plain_dir(&to_folder).unwrap_err().kind(),
            io::ErrorKind::InvalidInput
        );
        let to_file = dir.0.join("to-f.bin");
        if file_link(&file, &to_file) {
            assert!(is_link(&fs::symlink_metadata(&to_file).unwrap()));
            assert_eq!(
                plain_file(&to_file).unwrap_err().kind(),
                io::ErrorKind::InvalidInput
            );
        }
    }

    #[test]
    fn inside_is_judged_on_plain_names_only() {
        let root = Path::new("downloads").join("chosen");
        assert!(inside(&root, &root.join("a.bin")));
        assert!(inside(&root, &root.join("sub").join("a.bin")));
        assert!(!inside(&root, &root), "the folder itself isn't inside it");
        assert!(!inside(&root, &root.join("..").join("other").join("a.bin")));
        assert!(!inside(
            &root,
            &root.join("sub").join("..").join("..").join("a.bin")
        ));
        // A `.` in the middle is no step at all: `Path` drops it, so this is `root/a.bin`.
        assert!(inside(&root, &root.join(".").join("a.bin")));
        assert!(!inside(&root, &Path::new("downloads").join("chosen-not")));
        assert!(!inside(&root, &Path::new("elsewhere").join("a.bin")));
    }

    /// A `..` on the way once passed torrent deletion's check, which compared only the prefix
    /// (#72).
    #[test]
    fn a_path_climbing_out_of_its_folder_is_never_reached() {
        let dir = Dir::new("climb");
        let root = dir.0.join("chosen");
        fs::create_dir_all(root.join("a")).unwrap();
        let outside = root.join("a").join("..").join("..").join("victim.txt");
        assert!(!reached_through_plain_folders(&root, &outside));
        assert!(reached_through_plain_folders(
            &root,
            &root.join("a").join("f.bin")
        ));
        assert!(
            reached_through_plain_folders(&root, &root.join("missing").join("f.bin")),
            "a missing folder leads nowhere"
        );
    }

    #[test]
    fn a_link_on_the_way_is_never_gone_through() {
        let dir = Dir::new("through");
        let root = dir.0.join("chosen");
        let elsewhere = dir.0.join("elsewhere");
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&elsewhere).unwrap();
        folder_link(&elsewhere, &root.join("sub"));
        assert!(!reached_through_plain_folders(
            &root,
            &root.join("sub").join("f.bin")
        ));
        // The link itself, as the last name, is the caller's to check.
        assert!(reached_through_plain_folders(&root, &root.join("sub")));
    }
}
