# UI features

How each part of the window is built: adding downloads, the list, torrents, the details panel, the history, the guide, What's new and Settings. How the UI is put together is in [UI_ARCHITECTURE.md](UI_ARCHITECTURE.md); what users see is in the [user guide](user/README.md). Split from UI_ARCHITECTURE.md by #425.

## Adding downloads

The Add dialog (#60, V1's) is in [`src/features/add/`](../src/features/add/). Its state is in the `ui` store (`addDialog`), so anything can open it with `openAdd(prefill)`.

- **It opens from** the "Add download" button at the top of the navigation, Ctrl+N (⌘N on macOS), `.torrent` files dropped on the window (`useAddEntryPoints`), and a link the browser sends for the user to check (the `browser-request` event, then `take_browser_requests`, #65, #415).
- **Metalink files** (#222): "Choose Metalink files…" (`choose_metalinks`) puts them in the request's `metalinkFiles`, in place of links, as `.torrent` files do. It is disabled, with the reason, while the engine can't read Metalink (`availability`); the manager refuses one while Metalink is off (`PROTOCOL_DISABLED`). Each file's result is `metalinkAdded`, with every download it added.
- **What it checks as the user types** (`addLogic.ts`, V1's): each link's scheme and form, a login typed into a link, and a protocol the engine can't download (`get_capabilities`, with `availability`'s reason). Headers and the checksum are checked too. The native side checks everything again.
- **What it shows before adding:** the name the file gets (`naming.ts`), the automatic category and folder, a name already taken, and a missing chosen folder, which it offers to create (`check_destination`, 300 ms after the last change). A plain `ftp://` link gets the cleartext warning and "Require encryption (FTPS)".
- **What it shows after:** `add_downloads` answers for each link. All added closes the dialog with a toast. Otherwise it lists taken names ("Keep both (rename)"; a torrent's are only explained), duplicates ("Add anyway"; a torrent still in the list is only explained), and the links that failed with why (`outcome.ts`).
- **The SFTP host key** (`HostKeyPrompt`): when a download in the snapshot has failed with `error.hostKey`, the window asks once for that download and key. "Trust and continue" calls `trust_host_key`, then `retry_downloads`. A changed key is only explained.

## The download list

The list (#59, V1's) is in [`src/features/downloads/`](../src/features/downloads/). It shows the snapshot as it is: what a download becomes after a command comes from the next snapshot, never from the window.

- **The table** (`DownloadTable`) is virtualised with TanStack Virtual, so only the rows in view are drawn. Its 13 columns are V1's (`columns.tsx`); the column chooser shows and hides them, always with Name.
- **Column widths:** dragging a column's edge previews the width and saves it once, when the drag ends; arrow keys change it by 16 px, and Home or a double-click restores it. The list's columns save through `set_appearance` over the latest saved appearance, so they never overwrite the layout ([SETTINGS.md](SETTINGS.md#the-window)).
- **Selection** (the `downloads` store, V1's rules): a click selects one, Ctrl or ⌘ toggles, Shift selects a range, and the checkboxes and select-all cover the rows shown. Arrow keys, Home, End, Ctrl+A and Escape move and select; Space pauses or resumes; Delete removes and Shift+Delete deletes the files. A download that leaves the snapshot leaves the selection.
- **Actions** (`useDownloadActions`): the toolbar and the right-click menu (`menus.tsx`) offer what `actionsFor` allows for the selection, as the manager allows it. Removing a running download and deleting files ask first. A command over several downloads reports what it couldn't do, from its `BatchResult`, and the buttons are disabled while a command is being sent. That a late status from the engine can't undo a pause or a cancel is the manager's rule ([ENGINE_CONTRACT.md](ENGINE_CONTRACT.md#the-managers-side)).
- **The toolbar in a narrow list** (#442, PO's choice): the labels of Resume all and Pause all hide first (a container query). Below 540 px (`TOOLBAR_FITS`, measured: the toolbar needs about 536 px with its labels hidden), Cancel, Retry and Remove selected move to the top of the More menu, where they act on the selection as their buttons do. `useNarrowerThan` ([`src/lib/`](../src/lib/)) follows the toolbar's width with a ResizeObserver and re-renders only when the answer changes.
- **Statuses** (`statusLabel`): Retrying counts down to the engine's `retryAtMs`, and says "Waiting to retry" without one; a stalled direct download says "No data received"; one that came back without its login says "Needs its login". Speed and time left show only while bytes come, and the time left is the engine's speed over the bytes left. A notice says when the transfer engine isn't running, and when saved downloads are from a newer Apollo Download Manager.
- **Entering a login again** (`LoginDialog`): resuming or retrying a download in the snapshot's `needsLogin` asks for its login, custom headers or SSH key, sends them with `set_download_login`, then resumes or retries it.
- **Show download:** the Add dialog's "Show download", for a duplicate already in the list, shows the whole list with that download selected (`showDownload`).
- **Hover help (#424):** a cell whose text is cut off (name, category, folder) shows it in full in the window's tooltip (`CutOffText`, which measures only when the tooltip would open), and the status badge says what the status means and what to do (`statusHelp` in [`src/downloads/list.ts`](../src/downloads/list.ts), with a test for every status). The same help describes the row (`aria-describedby`) for screen readers. The list uses no browser `title` tooltips.
- **Opening:** a double-click on a finished download opens its file, and on any other shows its details. "Open file" and "Open folder" are in the right-click menu and the details panel. Opening a program asks first: the native side answers `CONFIRMATION_REQUIRED` until the user confirms (PO decision on #61).

## Torrents

The torrent screens (#63, V1's [`src/features/torrents/`](../src/features/torrents/)) are in [`src/features/torrents/`](../src/features/torrents/).

- **The Add dialog** previews a single `.torrent` file (`preview_torrent_file`): its name, version, hash, a warning when it repeats a download, and its files as a tree (`FileTree`), each chosen by default. Several files are each added whole. For any torrent it offers the seeding policy (`SeedingFields`) and an upload limit.
- **Choose files** (`ChooseFilesDialog`) opens for a torrent waiting in Choose files: double-click it, or use its menu or its details.
- **Pasting** magnet or `.torrent` links outside a text field opens the Add dialog with them (`useAddEntryPoints`).
- **The rules** (`torrentLogic.ts`): the file tree, folder selection, the file choice to send (none when every file is chosen), the seeding policy in words, and a tracker's line.

## The details panel

The panel (#61, V1's `DetailsPanel`) is [`src/features/downloads/DetailsPanel.tsx`](../src/features/downloads/DetailsPanel.tsx).

- **What it shows:** everything comes from the live snapshot, so switching rows shows the new download at once, and no late answer can show another (PO decision on #61). There is no details command.
- **Which download:** while open, the panel follows the focused row (a click or the arrow keys). Without one it shows the download it was opened for, even while the search or a filter hides it, and says so. When its download leaves the list, it says that instead.
- **Opening it:** double-click a row, press Enter, use "Details" in the right-click menu, or the toolbar's panel button. Whether it is open, and its width, are saved with the layout (`appearance.layout.detailsVisible` and `detailsWidth`, [SETTINGS.md](SETTINGS.md#the-window)). The shell fits it into the window (`resolveLayout`) and passes the result through `ShellLayoutContext`.
- **Sections:**
  - **Transfer:** the speed, the average speed and the time left; a direct download's connections in use, how many it may use and what holds it back (`ConnectionLine`, #47); the next try while retrying; the verification state.
  - **Torrent** ([`src/features/torrents/TorrentSection.tsx`](../src/features/torrents/TorrentSection.tsx), #61, #63): the peers and seeds connected, the bytes uploaded, the upload speed and the time seeding, as the torrent helper reports them ("Not reported yet" until it does); the info hashes, version and seeding policy (`get_torrent_details`); the trackers and the connected peers, asked for every second only while shown; re-announce, the upload limit, "Stop seeding", "Leave seeding queue", and changing its files, which keeps the files dropped unless the user asks to delete them.
  - **Source and destination**, and **Timeline**.
  - **Options for this download:** its category, its own speed limit, and a direct download's connections, which change while it runs (#47), so there is no restart to confirm.
- **Errors** show the engine's message, the HTTP status when there is one, a hint about retrying that follows the failure's class (#250), and Retry when the download allows it.
- **Only what the engines report:** there are no per-connection or per-segment figures, because the engine doesn't report them.

## The history

The history (#32, V1's `HistoryView`) is [`src/features/history/HistoryView.tsx`](../src/features/history/HistoryView.tsx).

- **What it shows:** every finished download, newest first, 100 a page, with how it ended, why it failed, and whether it is still in the list.
- **Search and filter:** the search waits 250 ms after typing and goes back to the first page; the status filter is completed, failed or cancelled.
- **Removing:** "Remove selected" and "Clear history" (which asks first) take entries out of the history. Files are never touched, and a download still in the list stays there.
- **Again:** opens the Add dialog with the entry's link, so adding it goes through the usual questions (#60).

## The user guide

The user guide (#354) is [`src/features/help/`](../src/features/help/). It opens from Help, User guide, from each Settings section's "… in the user guide", and with `openGuide(page, anchor)` from anywhere, in a window over the app like Settings (the `ui` store's `guide`).

- **Its pages are the user guides** in [docs/user/](user/README.md), which `pnpm guide` builds into `guide.generated.json` with markdown-it ([`scripts/guide-lib.mjs`](../scripts/guide-lib.mjs)). A Vitest test fails when that file is older than the guides, so edit the guides and run `pnpm guide`; never edit the JSON.
- **No HTML from the guides reaches the window:** the data is typed blocks and inlines, drawn as React elements. Raw HTML and images in a guide fail the build. A link to another guide page opens it in the guide; a web address is shown as text, since the window opens no web page.
- **The contents are grouped as on the website** (#488): [`docs/user/README.md`](user/README.md) lists the guides under four headings (Getting started, Using the app, Reference, Help), and `pnpm guide` writes them as `groups`. The sidebar shows each group as a list named by its heading, and the page order follows the groups. The build fails if the README lists a page outside a group.
- **Search** runs over every section's text in memory, with no network call: a section matches when it holds every word typed, with heading matches first.
- **Layout A** (PO decision on #354): search and the contents on the left, the page on the right, previous and next at the bottom; on a narrow window the contents go above the page.
- **The blocks are drawn by [`src/features/help/blocks.tsx`](../src/features/help/blocks.tsx),** which What's new shares.

## What's new

What's new (#496, [`src/app/WhatsNewDialog.tsx`](../src/app/WhatsNewDialog.tsx)) opens from the **?** menu. It shows the running version's section of [`CHANGELOG.md`](../CHANGELOG.md), then every earlier one, newest first. `pnpm guide` also builds the changelog into [`src/app/changelog.generated.json`](../src/app/changelog.generated.json), one entry per `## <version> - <date>` heading, as typed blocks (`buildChangelog` in [`scripts/guide-lib.mjs`](../scripts/guide-lib.mjs)), and leaves out an `Unreleased` section. So the window works offline and inserts no HTML. A web address is shown as text; a link to a repository file becomes plain text. A version without a section of its own, such as a development build, says so and shows the latest. A Vitest test fails while the bundled copy is older than [`CHANGELOG.md`](../CHANGELOG.md).

## Settings

The Settings screen (#30) is [`src/features/settings/`](../src/features/settings/): what each section holds and when it applies is in [SETTINGS.md](SETTINGS.md#the-settings-screen).

- **One query** (`useSettings`) holds what is saved. A change sends every section through `set_settings` and shows the answer; a refusal shows why, and the saved values again.
- **Numbers** are saved when the field is left or Enter is pressed, brought within their bounds (V1's).
- **Appearance** saves through `set_appearance`, like the panel widths.
- **About and diagnostics** is #28's `DiagnosticsPanel`.
