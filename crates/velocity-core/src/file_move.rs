//! Moving a download's file to another folder (#366): when its category changes, the file follows
//! the category's folder. Nothing is ever replaced: a taken name becomes `name (2).ext` (PO
//! decision on #366), and a link is never moved or followed ([`crate::fs_safety`]). Across drives
//! the file is copied, synced and checked before the original goes; a failure on the way leaves
//! the original where it was.

use std::fs::{self, File, OpenOptions};
use std::io;
use std::path::{Path, PathBuf};

use crate::domain::ErrorCode;
use crate::fs_safety::{plain_dir, plain_file, rename_no_replace};
use crate::naming::free_file_name;

/// Moves the plain file `source` into `folder`, keeping its name when it is free there and taking
/// the first free `name (n).ext` otherwise. `taken` names what counts as taken besides anything
/// already in the folder, such as another download's part file. `folder` is created when missing.
/// Returns the file's new path, or `source` itself when it is already in `folder`.
pub fn move_into(
    source: &Path,
    folder: &Path,
    taken: impl Fn(&str) -> bool,
) -> io::Result<PathBuf> {
    plain_file(source)?;
    if source.parent() == Some(folder) {
        return Ok(source.to_path_buf());
    }
    let name = source.file_name().and_then(|n| n.to_str()).ok_or_else(|| {
        io::Error::new(io::ErrorKind::InvalidInput, "a file name that isn't text")
    })?;
    fs::create_dir_all(folder)?;
    plain_dir(folder)?;
    // A name taken between the choice and the move is skipped, a bounded number of times.
    for _ in 0..NAME_RACES {
        let free = free_file_name(name, |n| {
            fs::symlink_metadata(folder.join(n)).is_ok() || taken(n)
        })
        .ok_or_else(|| {
            io::Error::new(io::ErrorKind::AlreadyExists, "no free name in the folder")
        })?;
        let target = folder.join(free);
        match move_no_replace(source, &target) {
            Err(e) if e.kind() == io::ErrorKind::AlreadyExists => continue,
            result => return result.map(|()| target),
        }
    }
    Err(io::Error::new(
        io::ErrorKind::AlreadyExists,
        "every free name was taken while moving",
    ))
}

/// How many times [`move_into`] picks another name when the one it chose is taken before the move.
const NAME_RACES: usize = 3;

/// Moves the plain file `from` to `to`, never replacing anything at `to`.
pub fn move_no_replace(from: &Path, to: &Path) -> io::Result<()> {
    move_with(from, to, rename_no_replace, copy_synced)
}

fn move_with(
    from: &Path,
    to: &Path,
    rename: impl Fn(&Path, &Path) -> io::Result<()>,
    copy: impl Fn(&mut File, &mut File) -> io::Result<u64>,
) -> io::Result<()> {
    plain_file(from)?;
    match rename(from, to) {
        Err(e) if e.kind() == io::ErrorKind::CrossesDevices => copy_then_remove(from, to, copy),
        result => result,
    }
}

/// Copies `from` to a new file at `to`, checks the length, and only then removes `from`. Any
/// failure removes the copy, which this move created, and leaves `from` as it was.
fn copy_then_remove(
    from: &Path,
    to: &Path,
    copy: impl Fn(&mut File, &mut File) -> io::Result<u64>,
) -> io::Result<()> {
    let mut source = File::open(from)?;
    // Checked again on the open handle, in case the name changed since `plain_file`.
    let meta = source.metadata()?;
    if !meta.is_file() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "not a plain file",
        ));
    }
    let expected = meta.len();
    // `create_new` refuses any existing name, a link included.
    let mut target = OpenOptions::new().write(true).create_new(true).open(to)?;
    let copied = copy(&mut source, &mut target).and_then(|copied| {
        let written = target.metadata()?.len();
        if copied == expected && written == expected {
            Ok(())
        } else {
            Err(io::Error::other(format!(
                "copied {written} of {expected} bytes"
            )))
        }
    });
    drop((source, target));
    match copied.and_then(|()| fs::remove_file(from)) {
        Ok(()) => Ok(()),
        Err(e) => {
            // Undoing our own copy; if even that fails, the error that stopped the move is the one
            // reported, and the original is still in place.
            if let Err(undo) = fs::remove_file(to) {
                tracing::warn!(error = %undo, "a half copy couldn't be removed");
            }
            Err(e)
        }
    }
}

/// What a failed move tells the user.
pub fn move_error(e: &io::Error) -> ErrorCode {
    match e.kind() {
        io::ErrorKind::NotFound => ErrorCode::NotFound,
        io::ErrorKind::PermissionDenied => ErrorCode::PermissionDenied,
        io::ErrorKind::InvalidInput => ErrorCode::InvalidPath,
        io::ErrorKind::AlreadyExists => ErrorCode::FileExists,
        io::ErrorKind::StorageFull => ErrorCode::InsufficientDiskSpace,
        _ => ErrorCode::Io,
    }
}

fn copy_synced(from: &mut File, to: &mut File) -> io::Result<u64> {
    let copied = io::copy(from, to)?;
    to.sync_all()?;
    Ok(copied)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fs_safety::test_links::file_link;

    struct Dir(PathBuf);

    impl Dir {
        fn new(name: &str) -> Self {
            let p =
                std::env::temp_dir().join(format!("v2-file-move-{name}-{}", std::process::id()));
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

    fn other_drive(_: &Path, _: &Path) -> io::Result<()> {
        Err(io::Error::from(io::ErrorKind::CrossesDevices))
    }

    #[test]
    fn a_file_moves_into_a_new_folder_under_its_own_name() {
        let dir = Dir::new("plain");
        let source = dir.0.join("a.zip");
        fs::write(&source, b"done").unwrap();
        let moved = move_into(&source, &dir.0.join("Software"), |_| false).expect("moved");
        assert_eq!(moved, dir.0.join("Software").join("a.zip"));
        assert_eq!(fs::read(&moved).unwrap(), b"done");
        assert!(!source.exists());
    }

    #[test]
    fn a_file_already_in_the_folder_stays_put() {
        let dir = Dir::new("same");
        let source = dir.0.join("a.zip");
        fs::write(&source, b"done").unwrap();
        assert_eq!(
            move_into(&source, &dir.0, |_| false).expect("no move"),
            source
        );
        assert_eq!(fs::read(&source).unwrap(), b"done");
    }

    #[test]
    fn a_taken_name_gets_the_next_free_number_and_nothing_is_replaced() {
        let dir = Dir::new("taken");
        let folder = dir.0.join("Software");
        fs::create_dir_all(&folder).unwrap();
        fs::write(folder.join("a.zip"), b"keep me").unwrap();
        let source = dir.0.join("a.zip");
        fs::write(&source, b"download").unwrap();
        // "a (1).zip" is another download's, still unfinished.
        let moved = move_into(&source, &folder, |n| n == "a (1).zip").expect("moved");
        assert_eq!(moved, folder.join("a (2).zip"));
        assert_eq!(fs::read(&moved).unwrap(), b"download");
        assert_eq!(fs::read(folder.join("a.zip")).unwrap(), b"keep me");
    }

    /// On Windows a symbolic link needs Developer Mode or an administrator; without either this
    /// says NOT RUN (PO decision on #72).
    #[test]
    fn a_link_is_never_moved() {
        let dir = Dir::new("link");
        let target = dir.0.join("someone-elses.bin");
        fs::write(&target, b"theirs").unwrap();
        let source = dir.0.join("a.zip");
        if !file_link(&target, &source) {
            return;
        }
        let e = move_into(&source, &dir.0.join("Software"), |_| false).expect_err("refused");
        assert_eq!(e.kind(), io::ErrorKind::InvalidInput, "{e}");
        assert!(fs::symlink_metadata(&source).is_ok(), "the link stays");
        assert_eq!(fs::read(&target).unwrap(), b"theirs");
    }

    #[test]
    fn across_drives_the_file_is_copied_and_then_the_original_goes() {
        let dir = Dir::new("copy");
        let (from, to) = (dir.0.join("a.zip"), dir.0.join("b.zip"));
        fs::write(&from, b"download").unwrap();
        move_with(&from, &to, other_drive, copy_synced).expect("moved");
        assert_eq!(fs::read(&to).unwrap(), b"download");
        assert!(!from.exists());
    }

    #[test]
    fn a_copy_that_fails_leaves_the_original_and_no_half_copy() {
        let dir = Dir::new("copy-fails");
        let (from, to) = (dir.0.join("a.zip"), dir.0.join("b.zip"));
        fs::write(&from, b"download").unwrap();
        let disk_full = |_: &mut File, to: &mut File| {
            io::Write::write_all(to, b"down")?;
            Err(io::Error::from(io::ErrorKind::StorageFull))
        };
        let e = move_with(&from, &to, other_drive, disk_full).expect_err("failed");
        assert_eq!(e.kind(), io::ErrorKind::StorageFull);
        assert_eq!(fs::read(&from).unwrap(), b"download");
        assert!(!to.exists(), "the half copy is removed");
    }

    #[test]
    fn a_short_copy_is_refused_and_the_original_stays() {
        let dir = Dir::new("copy-short");
        let (from, to) = (dir.0.join("a.zip"), dir.0.join("b.zip"));
        fs::write(&from, b"download").unwrap();
        let short = |_: &mut File, to: &mut File| {
            io::Write::write_all(to, b"down")?;
            Ok(4)
        };
        move_with(&from, &to, other_drive, short).expect_err("refused");
        assert_eq!(fs::read(&from).unwrap(), b"download");
        assert!(!to.exists());
    }

    #[test]
    fn a_copy_never_replaces_a_file_at_the_target() {
        let dir = Dir::new("copy-taken");
        let (from, to) = (dir.0.join("a.zip"), dir.0.join("b.zip"));
        fs::write(&from, b"download").unwrap();
        fs::write(&to, b"keep me").unwrap();
        let e = move_with(&from, &to, other_drive, copy_synced).expect_err("refused");
        assert_eq!(e.kind(), io::ErrorKind::AlreadyExists);
        assert_eq!(fs::read(&to).unwrap(), b"keep me");
        assert_eq!(fs::read(&from).unwrap(), b"download");
    }
}
