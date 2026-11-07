# Browser extension release test

A hand check of the extension's store packages before they are uploaded (#356, #240). Run it on each release candidate whose extension changed, and record the result in the release's issue: PASS, FAIL or NOT RUN for each row and browser. A unit or e2e pass doesn't replace it, since only a real browser with an installed app proves native messaging works ([the extension](BROWSER_EXTENSION.md)).

## Setup

1. Install the release candidate of Apollo Download Manager the way a user would (the installer on Windows, the `.deb` or AppImage on Linux).
2. Build the packages: `pnpm package:extension`.
3. Load each package in a clean browser profile:
   - **Chrome, Edge, Chromium:** `chrome://extensions` (or `edge://extensions`), developer mode, **Load unpacked**, with the package unzipped into a folder.
   - **Firefox:** `about:debugging`, This Firefox, **Load Temporary Add-on**, and pick the zip.
4. In the app, open Settings, Browser, and **Register** each browser.

## Browsers

| System | Browsers |
|---|---|
| Windows 11 | Chrome, Edge, Firefox |
| Linux (Ubuntu 22.04 or later) | Chrome or Chromium, Firefox (the `.deb`; the Snap build may not reach the app, so note what happens) |
| Lowest versions | Chrome 116 and Firefox 115 ESR, once on one system |

## Checks

| # | Check | Expected |
|---|---|---|
| 1 | Open the popup with the app running | `Connected · app <version>`, in green |
| 2 | Quit the app, open the popup | The app starts itself in the tray, and the popup shows Connected ([browser.md](user/browser.md#when-apollo-download-manager-cant-take-a-link)). Only when it can't start: "Not connected", the reason, and **Try again** |
| 3 | Turn off "Take links from the browser" in the app | The popup says browser requests are off, and a download stays in the browser |
| 4 | Start a large `.iso` or `.zip` download in **Send** mode | It appears in the app (with **Ask before adding** on, the default, in its Add dialog), and the browser's copy is removed |
| 5 | Switch to **Ask first**, start one | The prompt shows the name, size and site; both buttons do what they say; closing it lets the browser carry on |
| 6 | Right-click a link, **Download with Apollo Download Manager** | It appears in the app |
| 7 | Paste a link in the popup, **Send** | "Sent", and the link is in the app and in Recent sends with its file name and site only |
| 8 | Quit the app, then send a link from the popup | The app starts itself and takes the link: "Sent". Only when it can't start does Recent sends show "App not running" |
| 9 | Settings, **Clear recent sends** | The popup shows "Nothing sent yet" |
| 10 | Turn on torrent capture, allow page access, click a magnet link | The app asks before adding the torrent |
| 11 | Turn on torrent capture, refuse page access | The settings page says magnet clicks stay with the browser |
| 12 | Install the package over the previous release's extension | Settings are kept, and the popup connects |
| 13 | Light and dark system theme | Every page is readable in both |
