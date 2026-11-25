# Use with your browser

Apollo Download Manager's browser extension sends downloads from your browser to Apollo Download Manager. It works with Chrome, Edge and Brave (Chrome 116 or later) and Firefox (115 or later).

See also, for developers: [how the extension and its native host work](../BROWSER_EXTENSION.md).

## Installing the extension

- **Chrome and Brave:** install it from the [Chrome Web Store](https://chromewebstore.google.com/detail/fhhohpcahhmlijibcpppoddcklobfpld). In Apollo Download Manager, **Get the extension** in Settings, Browser opens that page in the browser.
- **Firefox:** install it from [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/apollo-download-manager/). **Get the extension** in Settings, Browser opens that page in Firefox.
- **Edge: not in its store yet.** **Get the extension** stays off for Edge until its store page is live, and a note in Settings, Browser says so. Until then, Edge can install the extension from the Chrome Web Store, once you allow extensions from other stores.

The installers don't set the extension up for you. Testers can load a build of the extension by hand, as the [developer documents](../BROWSER_EXTENSION_BUILD.md#loading-a-build-by-hand) say.

**Beside V1:** the extension is named **Apollo Download Manager** (**Apollo DM** for short), its menu item is **Download with Apollo Download Manager**, and it talks only to Apollo Download Manager. V1's extension can stay installed at the same time ([Beside V1](v1-and-v2.md)).

## Connecting it to Apollo Download Manager

In Apollo Download Manager, open **Settings, Browser**. Each browser (Chrome, Chromium, Edge, Brave, Firefox) has **Register** or **Unregister**. Registering is for your user only and needs no administrator rights. The first-run setup offers the same.

"Registered for another copy" means the registration points to a copy of Apollo Download Manager that was moved or reinstalled elsewhere: **Register** again fixes it.

**Before removing Apollo Download Manager on Linux,** unregister the browsers: a package can't remove registrations from your home folder ([Installing](installing.md#removing-apollo-download-manager)).

## What the extension does

- **It takes over matching downloads:** by default, archives, disk images, installers, video, audio, PDF and e-books, and files of 20 MiB or more when the browser knows the size. The browser's own copy is cancelled once Apollo Download Manager has the link.
- **Modes,** in the extension's popup: send matching downloads to Apollo Download Manager (the default), ask first, or leave every download to the browser.
- **Rules,** in the extension's options: the file types, the size, sites to always or never send, and private windows (off by default).
- **The right-click menu** on links, images, video and audio: **Download with Apollo Download Manager**.
- **Magnet links and `.torrent` downloads:** off by default. Turning magnet links on asks for access to pages; once you allow it, magnet links work in the pages already open too. Apollo Download Manager always asks before adding a torrent.
- **Files on a page:** on a page that links to files, such as a list of downloads, a button shows how many there are ("12 files"). Click it to choose some or all of them, by type or by name, then **Send** them to Apollo Download Manager together. Drag the button anywhere it's out of the way, and resize the list by its corner. **Alt+Shift+D** opens the list too, and so does **Files on this page** in the extension's popup. Up to 500 files go at a time. The button is on from the start, but needs access to pages: the popup asks for it. The first time it appears, a tip shows how to turn it off: **Hide on this site**, or **Show a download button on pages with files** in the extension's options. Video streams aren't listed.
- **What it never sends:** cookies, page content or logins. A download that needs them may fail in Apollo Download Manager; the browser can then download it.

## What Apollo Download Manager does with a link

Settings, Browser has two switches, both on by default:

- **Ask before adding:** the Add dialog opens, filled in, and Apollo Download Manager's window comes forward. Off, the link is added at once to the automatic folder. A taken name, a link added before, a torrent or a magnet link still opens the dialog.
- **Take links from the browser:** off, Apollo Download Manager refuses every link, and the browser downloads it itself.

**A link to this computer or your local network** (such as `127.0.0.1`, `192.168.x.x` or `10.x.x.x`) waits in the list before anything is sent: **Download anyway** in its details panel goes on. A link you type or paste yourself isn't held.

## When Apollo Download Manager can't take a link

If Apollo Download Manager isn't running, isn't connected, or refuses the link, the browser downloads the file itself. The extension's badge turns red with "!", and its popup says why:

- **"Apollo Download Manager is not running":** Apollo Download Manager starts by itself in the tray when a link arrives. If it couldn't, start it yourself.
- **"Apollo Download Manager was started but didn't answer in time":** it took longer than 10 seconds to start. Try the link again.
- **"The connection to Apollo DM is not set up":** register that browser in Apollo Download Manager's Settings, Browser, then reload the extension.
