# Privacy

What Apollo Download Manager keeps, and what it sends. AGENTS.md's rule is that V2 makes no network calls beyond the downloads themselves without a PO decision.

## What V2 sends

- **Only the downloads.** V2 connects to the servers, mirrors, trackers and peers of the downloads you add, and to nothing else.
- **No telemetry or analytics.** V2 has none. Adding any needs a PO decision first.
- **No crash reports.** A crash is recorded on this computer only ([DIAGNOSTICS.md](DIAGNOSTICS.md#crash-logs)).
- **The browser extension** (#64, #65) talks only to the app on this computer, through the native host and a local connection that refuses remote clients. It sends the link, and the referrer, file name, size and type when the browser knows them; never cookies, logins or page content.

## What V2 keeps on this computer

All of it is in V2's own data folder ([COEXISTENCE.md](COEXISTENCE.md)):

- **The downloads and their history:** links with any login removed, folders, file names, statuses and times ([DATA_AND_MIGRATIONS.md](DATA_AND_MIGRATIONS.md)). The history keeps them for the retention you set.
- **Settings and categories.**
- **Checkpoints and torrent resume data,** so downloads resume after a restart. Torrent resume data is kept without trackers.
- **Trusted SFTP host keys,** in V2's own `known_hosts` file.
- **Logins you asked to remember,** in the system keychain (Windows Credential Manager, or your Linux keyring), one per download, deleted with it ([ADR-0015](decisions/0015-keychain-with-consent.md)). Nothing else about a login is kept.
- **Crash logs:** at most 5, redacted.
- **The window keeps nothing you type** (#345). The window is a web view (WebView2 on Windows, WebKitGTK on Linux), which can remember what is typed into forms. Every text field in the app asks it not to (`autocomplete="off"`, in the shared `Input` and `Textarea`), and the window uses no browser storage or cookies. Versions before 0.2.0 didn't ask, so Windows' WebView2 kept typed links, folders and the proxy's user name in its own autofill store, in the app's `EBWebView` folder. The first start of 0.2.0 clears the window's browsing data once (`clear_window_data_once` in `src-tauri/src/downloads.rs`, recorded as `upkeep.windowDataCleared`); a clear that fails is tried again at the next start. Linux's WebKitGTK isn't known to keep an autofill store for these fields; that is an assumption, not checked.

**Never kept:** passwords, cookies, custom headers, SSH keys and passphrases. They stay in memory for the session only, and a download that needs one asks again after a restart.

## Diagnostics you share

**In memory only:** the app's log and the engines' logs, with secrets removed ([DIAGNOSTICS.md](DIAGNOSTICS.md#redaction)). They are lost when V2 closes.

**Exporting:** "Export diagnostics…" writes a report to a file you choose. It names no download, link or folder: it counts downloads by status only. Logins, cookies, keys, tokens, magnet links and tracker passkeys are removed from every line.

**Sharing:** you decide whether to share the file, and with whom.
