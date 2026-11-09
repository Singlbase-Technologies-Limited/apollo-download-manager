# Privacy

What Apollo Download Manager keeps, and what it sends. AGENTS.md's rule is that Apollo Download Manager makes no network calls beyond the downloads themselves without a PO decision.

## What Apollo Download Manager sends

- **Only the downloads.** Apollo Download Manager connects to the servers, mirrors, trackers and peers of the downloads you add, and to nothing else.
- **No telemetry or analytics.** Apollo Download Manager has none. Adding any needs a PO decision first.
- **No crash reports.** A crash is recorded on this computer only ([DIAGNOSTICS.md](DIAGNOSTICS.md#crash-logs)).
- **The browser extension** (#64, #65) talks only to the app on this computer, through the native host and a local connection that refuses remote clients. It sends the link, and the referrer, file name, size and type when the browser knows them; never cookies, logins or page content. In the browser it keeps its settings and the popup's last 5 sends: the file name, the host, sent or failed and the time, never the link itself (#356). **Clear recent sends** in its settings removes them.

## What Apollo Download Manager keeps on this computer

All of it is in Apollo Download Manager's own data folder ([COEXISTENCE.md](COEXISTENCE.md)):

- **The downloads and their history:** links with any login removed, folders, file names, statuses and times ([DATA_AND_MIGRATIONS.md](DATA_AND_MIGRATIONS.md)). The history keeps them for the retention you set.
- **Settings and categories.**
- **What downloads learned about servers** (#325): for each server a download came from, its host name and port, how many connections helped, and how many it served before it throttled, so later downloads from it start at the right pace. No links, paths or names. Kept for 7 days, never exported, and forgotten at once with Settings, Advanced, **Forget servers**.
- **Checkpoints and torrent resume data,** so downloads resume after a restart. Torrent resume data is kept without trackers.
- **Trusted SFTP host keys,** in Apollo Download Manager's own `known_hosts` file.
- **Logins you asked to remember,** in the system keychain (Windows Credential Manager, or your Linux keyring), one per download, deleted with it ([ADR-0015](decisions/0015-keychain-with-consent.md)). Nothing else about a login is kept.
- **Crash logs:** at most 5, redacted.
- **The window keeps nothing you type** (#345). The window is a web view (WebView2 on Windows, WebKitGTK on Linux), which can remember what is typed into forms. Every text field in the app asks it not to (`autocomplete="off"`, in the shared `Input` and `Textarea`), and the window uses no browser storage or cookies. Versions before 0.2.0 didn't ask, so Windows' WebView2 kept typed links, folders and the proxy's user name in its own autofill store, in the app's `EBWebView` folder. The first start of 0.2.0 clears the window's browsing data once (`clear_window_data_once` in `src-tauri/src/downloads.rs`, recorded as `upkeep.windowDataCleared`); a clear that fails is tried again at the next start. Linux's WebKitGTK isn't known to keep an autofill store for these fields; that is an assumption, not checked.

**Never kept:** passwords, cookies, custom headers, SSH keys and passphrases. They stay in memory for the session only, and a download that needs one asks again after a restart.

## Diagnostics you share

**In memory only:** the app's log and the engines' logs, with secrets removed ([DIAGNOSTICS.md](DIAGNOSTICS.md#redaction)). They are lost when Apollo Download Manager closes.

**Exporting:** "Export diagnostics…" writes a report to a file you choose. It names no download, link or folder: it counts downloads by status only. Logins, cookies, keys, tokens, magnet links and tracker passkeys are removed from every line.

**Sharing:** you decide whether to share the file, and with whom.
