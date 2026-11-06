# Beside Velocity Download Manager

Apollo Download Manager is a new app, not an update of the original Velocity Download Manager (V1). V1 downloads with aria2; Apollo Download Manager has its own download engine, and libtorrent for torrents. The aim is to keep every V1 feature, and where a feature had to change without aria2, the change was decided and is listed below.

## Using both side by side

You can install and run V1 and Apollo Download Manager at the same time. They share nothing:

| | Apollo Download Manager | V1 |
|---|---|---|
| Name in menus and in Apps & features | Apollo Download Manager ("Velocity Download Manager V2" until 0.2.0) | Velocity Download Manager |
| Data (Windows) | `%APPDATA%\com.velocity.downloadmanager.v2` | `%APPDATA%\com.velocity.downloadmanager` |
| Data (Linux) | `~/.local/share/com.velocity.downloadmanager.v2` | `~/.local/share/com.velocity.downloadmanager` |
| Browser extension | Apollo Download Manager, "Download with Apollo Download Manager" | Velocity Download Manager |
| Torrent listening port | 6890 | 6881, 6882 |

- **Downloads, settings and history are separate.** Apollo Download Manager doesn't read V1's, and V1 doesn't read Apollo Download Manager's.
- **Files:** if both download to the same folder, neither replaces a file the other made. Apollo Download Manager stops a download whose name another program took while it ran ([Downloads](downloads.md#files-and-folders)).
- **Browsers:** each extension sends links only to its own app ([Browser integration](browser.md)).

## Moving from V1

**Nothing is imported from V1** in this version: Apollo Download Manager starts with no downloads, its own settings and an empty history. Unfinished V1 downloads can't be continued in Apollo Download Manager, because their partial data is aria2's. Finish them in V1, or add their links to Apollo Download Manager again.

## What is different from V1

- **Connections:** Apollo Download Manager starts a download with every connection its profile allows, then keeps only those that make it faster. It changes a running download's connections without restarting it, so V1's "allow mid-download tuning" setting is gone.
- **Performance profiles** (Conservative, Balanced, Maximum, Custom) set the most connections to one server and the smallest piece, as in V1. The Custom profile's aria2 "split" count is gone: Apollo Download Manager splits files by itself.
- **No polling interval:** V1's progress polling setting is gone, because Apollo Download Manager's engine reports progress as it happens.
- **One torrent engine:** V1 could run torrents on aria2 or libtorrent; Apollo Download Manager always uses libtorrent, so that choice is gone. Every torrent feature stays: v1, v2 and hybrid torrents, magnet links and seeding.
- **"Look for more peers below this speed"** (aria2's peer speed limit) is gone: libtorrent finds peers by itself.
- **Disk settings:** V1's file allocation and disk cache are now **Preallocation** and the **write buffer**, in Settings, Advanced.
- **Proxy:** new in Apollo Download Manager. Apollo Download Manager can send every download through an HTTP, HTTPS or SOCKS5 proxy ([Settings](settings.md#proxy)).
- **Remembered logins:** new in Apollo Download Manager, in the system keychain, and only when you tick it ([Downloads](downloads.md#logins-headers-and-keys)).
- **Safer by default:** Apollo Download Manager asks before following a redirect from `https://` to `http://`, before downloading a browser link to your local network, and before trusting an SFTP server. It never replaces an existing file.
- **Metalink:** as in V1, behind a switch that is off by default: a link to a Metalink file, or a Metalink file on your computer.

## Not there yet

- **Signed installers,** and the extension in the browsers' stores.
