# Changelog

What changed in each version of Apollo Download Manager, which had an earlier name until 0.2.0. Versions follow [Semantic Versioning](https://semver.org/); while V2 is below 1.0.0, a minor version may change things that break. How sections are drafted from the merged pull requests, and edited into release notes, is in [docs/RELEASE_PROCESS.md](docs/RELEASE_PROCESS.md).

## 0.2.0 - 2026-11-10

The first version named **Apollo Download Manager**, with a new look, a browser extension in the Chrome Web Store, and a user guide in the app. Install it over 0.1.x, which had an earlier name: your downloads, settings and history are kept, and on Windows the browsers keep working ([Upgrading](docs/user/installing.md#upgrading)).

### A new name and a new window

- **Apollo Download Manager:** a new name, logo, icons and colours, in the app, the installers and the browser extension (#346, #347).
- **A new window layout:** the app draws its own title bar, with Windows 11's snap layouts on the maximise button, and its panels float beside the list (#359, #360, #363).
- **Settings opens over the app,** in a window of its own, instead of replacing the list (#364).
- **A redesigned details panel,** with a download's actions in its footer. Double-clicking a download opens its details, or its file once it's finished (#349).
- **Hovering a row** shows values the column cuts off, and says what the download's status means (#424).
- **A narrow window** keeps the whole toolbar: Cancel, Retry and Remove selected move into **More** (#442).
- **A first-run setup** that fits small windows and asks one thing at a time. It says at once when the download folder doesn't exist (#372, #403).
- **Layouts, lists, buttons, messages and pointers** are consistent across the window (#348).

### Your browser

- **In the Chrome Web Store:** Chrome and Brave install the extension from its store page. **Get the extension** in Settings, Browser opens it (#240, #241). The Edge and Firefox store pages follow in a later version.
- **A redesigned extension,** with Ask first, rules and the right-click menu (#356).
- **The app starts itself** when a link arrives while it isn't running, and the link's Add dialog opens once the window is ready (#322, #415).
- **Fixes:**
  - Several links sent while Add download was open replaced each other, so only the last was kept (#365).
  - A `.zip` link without ".zip" in it stayed in the browser (#406).
  - In Firefox, a download given back to the browser was usually lost (#408).
  - The Ask-first prompt was empty in Chrome 116 (#411).
  - Magnet links in pages open before you allowed access still went to the browser (#416).
  - The popup's Recent sends label covered the site name (#412).

### Downloads

- **Plain error messages,** with the technical detail behind a toggle (#252).
- **The login window opens** when a download fails because the server asks for a login (#249).
- **Changing a download's category moves its files** to that category's folder (#366).
- **Metalink files on your computer:** **Choose Metalink files…** in the Add window adds every file they list (#222).
- **Faster starts:** the app remembers how many connections each server allowed, so later downloads from it start at that pace. Extra connections to a server reuse its TLS session (#325, #327, #432).
- **Downloads wait for the network:** a download that failed because there was no network shows **Waiting for network**, and continues by itself from where it stopped when Windows or Linux says the network is back. On by default; Settings, Queue and performance (#318).
- **Two downloads at once by default,** instead of 3, so each one gets more of your connection and finishes sooner. If you kept the old default of 3, updating sets it to 2 once; you can set it back in Settings, Queue and performance (#351).
- **Start when you sign in,** so queued downloads and seeding carry on after a restart: on for a new install, off if you used an earlier version (#321).
- **Private torrents** get none of the extra trackers (#377).

### The schedule

- **A schedule that's easier to set and to follow:** choose its start and stop with hour and minute boxes instead of typing them. Settings says when it next runs (**Next: tomorrow 02:00 to 07:00**), and the list says when each scheduled download starts (#350).
- **A start time for each download:** in the Add window, or later with **Start at…** in a waiting download's menu. It beats the schedule, and a time missed while the app was closed starts it as soon as the app opens (#350).
- **12-hour times:** Settings, Appearance, Time format switches every time the app shows to 12-hour with AM and PM. 24-hour stays the default (#350).

### Help and the website

- **A user guide in the app,** from the same pages as the website (#79, #354).
- **A website** with downloads and the guide, and a developer site built from the project's documents (#353, #355, #379).

### Fixes

- **What you type stays yours:** the window no longer remembers typed links, folders or the proxy's user name in its own autofill store, and the first start of this version clears what earlier versions kept there (#345).
- **Through an HTTP proxy,** a download no longer fails with "The file changed on the server" as soon as it opens a second connection. A proxy that wants a login none was set for says "The proxy refused the connection" (#344).
- **The login window's remember checkbox** says "system keychain", as the Add dialog does (#398).
- **Release builds' window title** no longer says "(dev)" (#401).

### Security

- **SQLite 3.54.1,** which fixes a memory-exposure advisory in the database the app keeps (RUSTSEC-2026-0459, #446).

## 0.1.1 - 2026-11-04

Fixes only, found by using 0.1.0 with real downloads ([#262](https://github.com/Singlbase-Technologies-Limited/velocity_download_manager_v2/issues/262)). Install it over 0.1.0: your downloads, settings and history are kept.

### Large downloads

- **No more freezing on one connection:** when a server cut connections mid-download, a large download could fall back to one stream, start reading from byte 0 again, and seem to stop. A cut connection now just costs that request, which is asked for again (#333).
- **Progress after a resume or a crash** counts what the download already had. It no longer starts again from a low figure, or from "0 B of unknown size" (#257).
- **A network drop** keeps a download's bytes, and Velocity keeps trying for about 5 minutes, so Wi-Fi dropping out, a router restarting or the computer waking from sleep is ridden out (#317).
- **A connection that trickles** a few bytes now and then is treated like a silent one: the download shows "No data received", and the connection is reset (#292).
- **The speed shown** is measured over the last 3 seconds, so it holds steady (#246).

### Retries and servers that slow you down

- **Every retry says why,** such as "No data arrived for 30 s, so the connection was reset", and counts its tries, such as "Trying again (2 of 5)". A download whose server could never be reached isn't started again on its own (#245).
- **A server name that can't be found** says what to check: the link, a proxy's address, the internet connection, or a network without IPv6 (#250).
- **No network on this computer** is never blamed on the server: the message says so, and the download tries again within seconds instead of waiting minutes (#335).
- **Servers that ask Velocity to slow down,** such as proof.ovh.net, get fewer requests, and connections are opened a step at a time, so the server doesn't block your computer (#247).
- **Under a speed limit,** a download uses only the connections the limit needs, and says that the limit holds it back (#278).

### The app

- **Cancelling** a download no longer shows it as Failed, "That action isn't possible…", for a moment (#339).
- **The download schedule** now works: while "Use the schedule" is on, every new download waits for its time window. Downloads already running when you turn it on carry on, and turning it off lets the waiting ones start (#340).
- **The app's log** says what each download does: added, started, retried and why, paused, completed, removed (#251, #263, #264, #274).
- **Delete files** deletes a magnet link's files, and never reports files it couldn't find as deleted (#268).
- **The browser extension:** an installed Velocity writes its own name into the browser registration, so the extension finds it (#315).
- **The Add download dialog** no longer loops between two questions, and shows a taken file name's path correctly on Windows (#266, #277).
- **Smaller fixes:** long words in an error wrap inside the details panel (#248); a download without a name yet shows its link's file name, never the whole link (#275); Choose files is at the top of the details panel (#276); Ctrl+A works with Caps Lock on, and the speed limit's label and the folder icon are right (#310).

### Security

- **russh 0.65.0 and pageant 0.2.5,** for five advisories in the SFTP libraries (#255).

## 0.1.0 - 2026-10-31

The first version of the app now named Apollo Download Manager: a new app, not an update of V1, the download manager it grew out of. It has its own download engine, on libcurl, and uses libtorrent for torrents. It installs and runs beside V1, and shares nothing with it ([V1 and V2](docs/user/v1-and-v2.md)).

### Downloads

- **Protocols:** HTTP, HTTPS, FTP, FTPS (explicit and implicit) and SFTP, with BitTorrent and Metalink ([Protocols and limits](docs/user/protocols.md)).
- **Fast by default:** a download starts with every connection its performance profile allows, then keeps only those that make it faster, and changes its connections while it runs, without restarting.
- **Resume:** pause and resume, and a download continues after a crash, a restart or a full disk without losing what it already had. If the file changed on the server, V2 notices and starts again rather than mixing two versions.
- **Checksums:** a download can be checked against a checksum, and one that can't be verified is never shown as verified.
- **Mirrors and Metalink:** several sources for one file, with failover when one stops working. Metalink files can be added from a link or from your computer; Metalink is off by default, as in V1.
- **Queue and limits:** how many download at once, their order, a schedule window, a global speed limit and one for each download.
- **Categories** with automatic folders. V2 never replaces an existing file: it asks about a taken name or renames the new file.
- **Proxy:** new in V2. HTTP, HTTPS or SOCKS5, for every download, torrents included.
- **Logins:** remembered in the system keychain only when you tick it, and never written to V2's database, logs or diagnostics.

### Torrents

- `.torrent` files and links and magnet links, with v1, v2 and hybrid torrents. A magnet is checked before anything downloads, and you choose the files.
- Seeding with limits and a seeding queue, trackers with re-announce, peers, DHT, peer exchange and local peer discovery, upload and download limits, and a listening port (6890) with optional port mapping.
- Torrents resume after a restart or a crash, and removing one deletes only its own files.

### The app

- The download list, a details panel (connections, errors, torrent activity, options), the History view, Categories and Settings.
- First-run setup, a tray icon with close to tray, notifications, and light and dark themes.
- Logs with secrets removed, a diagnostics export, and local crash logs. V2 sends nothing anywhere except the downloads themselves.
- Accessibility: keyboard focus returns where it was after a dialog, and text contrast meets WCAG AA.

### Safer by default

- V2 asks before following a redirect from `https://` to `http://`, before downloading a browser link to this computer or your local network, and before trusting an SFTP server's key.
- TLS certificates are always verified.
- V2 deletes only files its downloads made, and never follows a link when it removes one.

### Browser integration

- V2's own extension for Chrome, Edge, Brave and Firefox sends the browser's downloads to V2, with modes, rules and a right-click menu. It works beside V1's extension.
- Settings, Browser connects V2 to each browser, for your user only.
- **Not in the stores yet:** for this version, the extension is loaded by hand ([Browser integration](docs/user/browser.md#installing-the-extension)). Publishing it in the Chrome Web Store, Edge Add-ons and Firefox Add-ons follows (#240, #241).

### Installing

- **Windows, 64-bit:** an installer for your user only, with no administrator prompt. Uninstalling removes V2's browser connections; your downloads, settings and history stay unless you choose to delete them.
- **Linux, 64-bit:** a `.deb` for Ubuntu 22.04 and newer and Debian 12 and newer, and an `.rpm` for Fedora and similar. Before removing V2 on Linux, disconnect the browsers in Settings, Browser.
- **Unsigned:** the installers aren't code-signed yet, so Windows SmartScreen warns the first time ([Installing](docs/user/installing.md)).
- **macOS** isn't supported yet.
- V2 is free software under the GNU General Public License, version 3 only.

### Coming from V1

- **Nothing is imported from V1:** V2 starts with no downloads, its own settings and an empty history. Finish unfinished V1 downloads in V1, or add their links to V2 again; their partial data is aria2's and can't be continued.
- **Settings that changed:** "allow mid-download tuning", the progress polling interval, the Custom profile's "split" count, the torrent-engine choice and "look for more peers below this speed" are gone, because V2 does these by itself. File allocation and disk cache are now Preallocation and the write buffer, in Settings, Advanced ([V1 and V2](docs/user/v1-and-v2.md#what-is-different-from-v1)).

### Known limits

- FTP and SFTP download over one connection.
- SFTP and torrents can't use an HTTPS proxy; choose HTTP or SOCKS5 for them.
- A private torrent finds no peers after V2 restarts, because V2 doesn't keep tracker addresses, which can hold passkeys. Add it again from its `.torrent` file or magnet link.
