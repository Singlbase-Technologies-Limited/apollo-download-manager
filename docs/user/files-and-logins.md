# Files, folders and logins

What Apollo Download Manager does with the files it downloads, and how it handles passwords and keys.

See also, for developers: [how file names and folders are chosen](../FILE_NAMING.md).

## Files and folders

- **No file is ever overwritten.** If a file appears at a download's name while it downloads, from V1 or any other program, Apollo Download Manager keeps it and stops the download: "the destination file already exists; it is never replaced".
- **While downloading,** the data goes to `<name>.vdmpart` beside the final file, which gets its name only once the download is complete and, with a checksum, verified.
- **Where a download goes:** the folder you chose, or its category's folder ([Categories](categories.md#where-a-download-goes)).
- **Look-alike names:** two names that look the same but are typed differently are two files. On Windows, names that differ only in upper and lower case are the same file.
- **Long paths:** downloads into folders deeper than Windows' old 260-character limit work.
- **Marked as from the internet (Windows):** a finished direct download is marked as downloaded from the internet, as browsers mark theirs, so Windows SmartScreen and Office still warn before opening it. The mark names only the server (for example `https://example.com/`), never the rest of the link. On a drive that can't hold the mark, such as a FAT32 or exFAT USB stick, the download finishes without it. A finished torrent's files are marked too, without a server, since a torrent has none.
- **Delete files** removes only that download's own file and its unfinished part, inside its folder. A link in their place (a symbolic link or a junction) is never followed, and what it points to is never touched.
- **Cloud-sync folders** such as OneDrive work as ordinary folders.

## Logins, headers and keys

Passwords, custom header values (such as cookies or tokens) and SSH key passphrases are secrets. Apollo Download Manager never writes them to its database, its saved progress or its log.

- **Remember this login in the system keychain,** in the Add dialog and the login window, is off by default. Ticked, the download's login is kept in Windows Credential Manager or the Secret Service on Linux (GNOME Keyring, KWallet), and removing the download deletes it there.
- **When the server refuses the login:** the window **Log in to download** opens, says the server refused it, and asks for the user name and password (and, for SFTP, the key). **Log in and retry** tries again with them; **Not now** leaves the download Failed. It opens for a refused login only (HTTP's 401, FTP's or SFTP's refused login), never when the server lets you in but not to the file, and never for the proxy's login, which is in Settings, Proxy.
- **After a restart:** a download whose login was remembered carries on. Otherwise it comes back paused, as "Needs its login", and asks for it again when you resume it, as V1 did ([Resume after a break](resume.md#when-it-needs-its-login-again)).
- **No keychain** (for example a minimal Linux without a Secret Service): Apollo Download Manager says "The system keychain isn't available, so the login wasn't saved." The download still works until Apollo Download Manager closes.
