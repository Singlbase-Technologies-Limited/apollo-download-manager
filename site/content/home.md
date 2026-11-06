# A free download manager for Windows and Linux

Resumes after a break, sorts files into folders, and takes downloads from your browser. Torrents, FTP and SFTP too.

## What it downloads

| Links | Connections per file | Resumes | Logins |
|---|---|---|---|
| `http://`, `https://` | Up to 8 by default, kept only while they make it faster | Yes, after checking the file hasn't changed | Password, custom headers |
| `ftp://`, `ftps://` | One | Yes, after checking the file hasn't changed | Password |
| `sftp://` | One | Yes, after checking the file hasn't changed | Password, SSH key |
| Magnet links, `.torrent` | As many peers as it finds | Yes | None needed |

Metalink files, which list a download's mirrors and checksums, work too, once they're turned on in Settings. Logins, custom headers and SSH keys stay out of its database and logs.

## Private by design

Apollo Download Manager has no telemetry and no analytics. It connects only to the servers you download from, and the browser extension talks only to the app on your computer. [What it keeps, and where](/privacy/).

## Free software

Apollo Download Manager is free software under the GNU General Public License, version 3. Its source code is on [GitHub](https://github.com/Singlbase-Technologies-Limited/apollo-download-manager).

**Still in development:** the downloads are test builds, made by the project's CI and not yet signed. The [user guide](/guide/) says what this version does.
