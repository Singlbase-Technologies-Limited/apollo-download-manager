# A free download manager for Windows and Linux

Resumes after a break, sorts files into folders, and takes downloads from your browser. Torrents, FTP and SFTP too.

## At a glance

- **Picks up where it stopped.** Resumes after a break, once it has checked the file hasn't changed.
- **Several connections over HTTP and HTTPS.** Up to 8 per file, kept only while they make it faster.
- **Torrents built in.** Magnet links and `.torrent` files, with seeding.
- **Tells you why.** When a download waits or fails, it says so in plain words.

## What it downloads

| Links | Connections per file | Resumes | Logins |
|---|---|---|---|
| `http://`, `https://` | Up to 8 by default, kept only while they make it faster | Yes, after checking the file hasn't changed | Password, custom headers |
| `ftp://`, `ftps://` | One | Yes, after checking the file hasn't changed | Password |
| `sftp://` | One | Yes, after checking the file hasn't changed | Password, SSH key |
| Magnet links, `.torrent` | As many peers as it finds | Yes | None needed |

Metalink files work too, once they're turned on in Settings. Logins, custom headers and SSH keys stay out of its database and logs.

## Private by design

No telemetry and no analytics. It connects only to the servers you download from. [What it keeps, and where](/privacy/).

## Free software

Under the GNU General Public License, version 3. The source code is on [GitHub](https://github.com/Singlbase-Technologies-Limited/apollo-download-manager).

## Still in development

The downloads are test builds, made by the project's CI and not yet signed. The [user guide](/guide/) says what this version does.
