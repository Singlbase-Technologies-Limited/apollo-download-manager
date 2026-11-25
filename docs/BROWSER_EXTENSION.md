# Browser extension

The browser extension offers the browser's downloads to Apollo Download Manager, and lets the browser carry on whenever the app can't take one. It is V1's extension ported with the app's own identity (#64), so V1's extension and this one can be installed side by side. It reaches the app through the app's own native host, which each browser starts once it is registered in Settings, Browser (#65). The rules for this area are in [`.claude/rules/browser-integration.md`](../.claude/rules/browser-integration.md).

See also, for users: [Use with your browser](user/browser.md).

## What it does

How it works inside; what a user sees and chooses is in the user guide's [Use with your browser](user/browser.md#what-the-extension-does).

- **Interception:** when the browser starts a download that matches the rules, the extension pauses it and offers it to Apollo Download Manager. If Apollo Download Manager takes it, the browser's copy is cancelled and erased; on any failure the browser's download resumes.
- **Modes:** send matching downloads to Apollo Download Manager (the default), ask first in a small window, or leave every download to the browser. Closing the ask window lets the browser continue.
- **Rules:** file types (archives, disk images, installers, video, audio, PDF and e-books by default), matched by the file name's extension or, when that doesn't match (often the name isn't known yet), by the download's MIME type (`application/zip` counts as `zip`; #406), a size threshold (20 MiB by default; only when the browser knows the size), allow and deny lists of domains with their subdomains, and private windows (off by default).
- **Never intercepted:** `blob:`, `data:`, `file:` and other browser-only links; downloads the extension started itself as a fallback; and the same link twice within 5 seconds.
- **Context menu:** "Download with Apollo Download Manager" on links, images, video and audio. If Apollo Download Manager can't take the link, the browser downloads it.
- **Popup:** shows whether Apollo Download Manager is reachable (checking; connected, with the app's version; connected but the engine isn't running; connected but browser requests are off; not connected, with the reason and **Try again**), switches the mode, sends a typed link, and lists the last 5 sends (#356).
- **Recent sends:** each keeps only the file name, the host, sent or failed, the error code and the time, in `storage.local` under `recentSends`. Never the link itself, whose path or query can hold a token, and never the error message, which can repeat it. The list is checked on every read (`src/shared/recent.ts`) and cleared with **Clear recent sends** on the settings page.
- **Magnet links and `.torrent` downloads:** off by default. Turning them on asks for access to pages, which magnet clicks need; `.torrent` downloads work without it. Apollo Download Manager always asks before adding a torrent.
- **Files on a page (#426):** on pages with files, a button shows how many the page links to ("12 files"). It opens a panel to choose some or all of them, by type or by name, and **Send** hands them to Apollo Download Manager together. It is on by default (PO decision, 2026-11-17), needs access to pages like magnet capture, and the first time it appears a tip says how to hide it on the site or turn it off. It can be dragged anywhere, and keeps its place per site; the panel can be resized, and keeps its size. **Alt+Shift+D** opens the panel, and the popup's **Files on this page** card does too. One send takes up to 500 files, the Add dialog's limit (`MAX_ADD`); with more chosen, the panel says so and **Send** stays off. A link counts as a file when its name ends in one of the user's file types or `.torrent`; links to sites the user excluded are listed as skipped, with the reason. The page's links are read once the page has loaded, then only the parts the page adds later, half a second after it stops changing. Video and audio streams aren't detected (#253). The button and panel sit in a closed shadow root, so the page's styles can't change them, and every name from the page is set as text.
- **Failures:** the toolbar badge turns red with "!", and its tooltip says what went wrong, for example that the connection isn't set up or that Apollo Download Manager didn't answer within 10 seconds.
- **What it never sends:** cookies, page content or logins. A download that needs them may fail in Apollo Download Manager, and the browser can then download it.

## Identity

Apollo Download Manager's extension uses none of V1's names or IDs ([ADR-0003](decisions/0003-v2-app-identity.md), [COEXISTENCE.md](COEXISTENCE.md)). All of them come from [`branding.json`](../branding.json).

| | Apollo DM development build | Apollo DM release build | V1 |
|---|---|---|---|
| Name | Apollo Download Manager (dev) | Apollo Download Manager | V1's product name |
| Native host it talks to | `dev.velocity.download_manager_v2` | `com.velocity.download_manager_v2` | `com.velocity.download_manager` |
| Chrome extension ID | `fhhohpcahhmlijibcpppoddcklobfpld`, the Chrome Web Store's item ID (`adhefdmekgeafmopfbiappajaolcbhkc` until 0.2.0) | the same | `eecopkgfiffjgmngfmjmdaejbkbbippo` |
| Firefox add-on ID | `apollo-download-manager@singlbase.com` ([ADR-0020](decisions/0020-extension-store-distribution.md); `velocity-download-manager-v2@velocity.local` until 0.2.0) | the same | `velocity-download-manager@velocity.local` |

- **Telling them apart:** Apollo Download Manager's name, toolbar title and context-menu item say "Apollo Download Manager", and its short name and messages "Apollo DM" (the short form, docs/BRANDING.md).
- **The Chrome key:** the manifest's `key` is the Chrome Web Store item's public key (#240), and it pins the Chrome extension ID, so a build loaded by hand has the store's ID. Google holds the private half; until 0.2.0 the key was one generated for Apollo Download Manager in #64. The repository ignores `*.pem` and `*.key` files. A test derives the ID from the key and checks it against [`branding.json`](../branding.json) ([`scripts/extension-lib.test.mjs`](../scripts/extension-lib.test.mjs)).
- **Store publication:** the stores and their links are below ([Publishing in the stores](#publishing-in-the-stores)). The Chrome Web Store link is set since 0.2.0 and the Firefox Add-ons link since 0.3.0; the Edge link follows once its store approves (PO decision on #240, 2026-11-10).

## Protocol

The extension speaks V1's native messaging protocol, version 1, unchanged: it can ping, ask for the app's status, or offer a link (`download.add` with the URL and, when known, the referrer, the file name, the size, the MIME type and where it came from). It never sends paths, commands or engine options. The files chosen on a page go together in `download.addMany` (#426): up to 100 links (`MAX_BATCH_LINKS`), each with an optional file name, and the page as the referrer, checked link by link like `download.add`. A longer choice goes in several messages, each under the 64 KiB limit, so a choice of 500 is 5 messages, well within the 30-in-10-seconds rate limit. The answer says how many were added, how many opened in the Add dialog, and which failed and why. [`tests/fixtures/contract/browser-messages.json`](../tests/fixtures/contract/browser-messages.json) holds valid and invalid messages; the extension's tests check its messages against it, and the native host (#65) accepts the valid ones and refuses the invalid ones.

## Permissions

The same as V1's, each in use (checked on #356). These reasons are also the store listings' permission justifications:

| Permission | Why the extension needs it |
|---|---|
| `downloads` | To see a download the browser starts, pause it while the app takes it, then cancel and erase the browser's copy, or resume it when the app can't take it. |
| `nativeMessaging` | To pass links to the Apollo Download Manager desktop app through its native host. It is the only channel to the app. |
| `storage` | To keep the extension's settings and the popup's last 5 sends (file name and host only), and pending ask-first prompts. |
| `contextMenus` | For "Download with Apollo Download Manager" on a link, image, video or audio. It can be turned off. |
| `scripting` | To register the magnet-link script and the page button's script (#426), each only while it is on and page access was granted, and to put them into the web pages already open when they start, so they work there without a reload (#416). |
| `<all_urls>` (optional) | Asked for when you turn on magnet capture or allow the page button, so a magnet link click on a page reaches the app, and the button can find the files a page links to. Without it, only `.torrent` downloads are sent and the button doesn't appear. |

The windows, toolbar button, tabs, keyboard shortcut (`commands`) and permissions APIs the extension also calls need no permission of their own. The extension's pages run only the extension's own scripts (`script-src 'self'`).

## Building

```sh
pnpm build:extension              # development build: talks to the development app
pnpm build:extension -- --release # release build: talks to the release app
```

Both write [`browser-extension/dist/chrome`](../browser-extension/dist/chrome/) (Chrome, Edge and Brave, Manifest V3 with a service worker; Chrome 116 or later) and [`browser-extension/dist/firefox`](../browser-extension/dist/firefox/) (Manifest V3 with a background script; Firefox 115 or later). Each script is bundled by Vite as a classic script, and the icons are the desktop app's own ([`src-tauri/icons`](../src-tauri/icons/)).

To try a build: in Chrome, open `chrome://extensions`, turn on developer mode and load [`browser-extension/dist/chrome`](../browser-extension/dist/chrome/) unpacked; in Firefox, open `about:debugging`, This Firefox, and load [`browser-extension/dist/firefox/manifest.json`](../browser-extension/dist/firefox/manifest.json) as a temporary add-on. It reaches Apollo Download Manager once the native host is registered with that browser ([below](#registering-with-each-browser)).

### Loading a build by hand

For testing a build that isn't in a store, after [building](#building) it (moved from the user guide, #425):

- **Chrome, Edge, Brave:** open `chrome://extensions` (or `edge://extensions`, `brave://extensions`), turn on developer mode, choose **Load unpacked**, and pick the extension's `chrome` folder.
- **Firefox:** open `about:debugging`, **This Firefox**, **Load Temporary Add-on**, and pick the `manifest.json` in the extension's `firefox` folder. Firefox removes a temporary add-on when it closes.

### Store packages

```sh
pnpm package:extension   # a release build, zipped for the stores
```

It writes `browser-extension/dist/packages/apollo-download-manager-chrome-<version>.zip` (for the Chrome Web Store and Microsoft Edge Add-ons) and `apollo-download-manager-firefox-<version>.zip` (for addons.mozilla.org), with the manifest at the archive's root. The zip writer ([`scripts/zip-lib.mjs`](../scripts/zip-lib.mjs)) uses Node's own zlib, sorts the files and dates them 1980-01-01, so the same build gives the same bytes. The Chrome package leaves out the manifest's `key`, since the Chrome Web Store gives the item its own; the Firefox package declares that the add-on collects no data ([ADR-0020](decisions/0020-extension-store-distribution.md)). [`scripts/extension-lib.test.mjs`](../scripts/extension-lib.test.mjs) checks both. Uploading is a manual step for the PO (#240). The listing text and the permission reasons are in [`browser-extension/store/`](../browser-extension/store/README.md), and each package is checked by hand with the [release test](BROWSER_EXTENSION_RELEASE_TEST.md) before it is uploaded.

### Publishing in the stores

The PO holds the Singlbase store accounts and submits each package; the agent has no store access ([ADR-0020](decisions/0020-extension-store-distribution.md)). For each release whose extension changed:

1. **Build and check:** `pnpm package:extension`, then the [release test](BROWSER_EXTENSION_RELEASE_TEST.md) with those packages.
2. **Chrome Web Store** ([developer dashboard](https://chrome.google.com/webstore/devconsole)): upload `apollo-download-manager-chrome-<version>.zip`. Fill in the listing from [`browser-extension/store/`](../browser-extension/store/README.md): descriptions, single purpose, a reason for each permission, the privacy answers and link, the icon and screenshots. Submit for review.
   - **The first upload only:** the store gives the item its ID and key. Copy the item ID and, from the Package tab's **View public key**, the key as one line, into the issue ([Chrome: manifest key](https://developer.chrome.com/docs/extensions/reference/manifest/key)). They go into [`branding.json`](../branding.json) (`chromeExtensionIds`, `chromeExtensionKey`) in a release, so the native host allows the store's extension.
3. **Microsoft Edge Add-ons** ([Partner Center](https://partner.microsoft.com/dashboard/microsoftedge)): upload the same Chrome zip, with the same listing. **The first upload only:** copy the ID Edge assigns into the issue; it joins `chromeExtensionIds`.
4. **Firefox Add-ons** ([developer hub](https://addons.mozilla.org/developers/)): upload `apollo-download-manager-firefox-<version>.zip`, listed on AMO, with the same listing. The ID is in the package (`apollo-download-manager@singlbase.com`) and can't change once published.
5. **Store links:** once each listing is public, its address goes into [`branding.json`](../branding.json)'s `extensionStoreUrls`, which turns on the app's **Get the extension** buttons (#241).
6. **Check:** install the extension from each store and confirm it reaches the installed app (the popup says "Connected"), and record it in the issue.

## Tests

- **Unit tests** ([`browser-extension/tests`](../browser-extension/tests/), Vitest's `extension` project): interception, fallback, ask mode, the context menu, magnet links, the files on a page and the page button's panel (in jsdom, with an axe-core accessibility check; jsdom has no layout, so not colour contrast), the rules, the settings, the protocol and Apollo Download Manager's identity, against fakes of the WebExtension APIs. `pnpm test:focused -- extension` runs them; `tsc --noEmit -p browser-extension` checks their types.
- **The manifest and the key** ([`scripts/extension-lib.test.mjs`](../scripts/extension-lib.test.mjs)): permissions, pinned IDs and names.
- **The native host** ([`crates/velocity-native-host/tests/host_e2e.rs`](../crates/velocity-native-host/tests/host_e2e.rs), L2): the real host program, with browser framing, against a real local listener: callers other than Apollo Download Manager's extensions (V1's included) refused, only valid messages passed on with the token and the caller, a wrong token refused, the app not running, a copy of the host with a stand-in app beside it that never answers (started, then given up on after 10 s), an oversized message. Each test runs a copy of the host in a folder of its own, so a real app build beside the built host is never started.
- **The bridge and registration** (`velocity_core::browser`, unit tests): the protocol against the shared fixture, the token and its file, the local connection and its limits, the routing (callers, settings, torrents always asking, rate limit, what adding did), and registering with each browser in a folder and a registry key of the test's own, with V1's manifests and registry values in place and unchanged afterwards.
- **Real browsers** (L4): `pnpm test:e2e:chromium` and `pnpm test:e2e:firefox` ([`tests/e2e/browser`](../tests/e2e/browser/)). A link clicked on a local page is intercepted by the extension, goes through the native host into a running Apollo Download Manager, which records it once; the browser's copy is cancelled. The page is on 127.0.0.1, so the app holds the link until the user confirms its local address ([SECURITY.md](SECURITY.md#links-redirects-and-local-addresses-67)): the test checks it does, without asking the server for anything or writing a file. Downloading itself is the engine tests' to check. V1's extension is installed too, with a recording stand-in for V1's host: the test checks V1's extension reached only V1's host.
  - **Build first:** `cargo build -p velocity-desktop-v2 -p velocity-transfer -p velocity-torrent -p velocity-native-host` and `pnpm build:extension`, and V1's extension built in [`../velocity-download-manager`](../../velocity-download-manager/) (or `V1_EXTENSION_DIR`). No Apollo Download Manager development instance may be running, since Apollo Download Manager is single-instance.
  - **Chromium** runs on Windows and Linux. On Windows, Chromium reads native hosts only from the registry: the test writes `HKCU\Software\Chromium\NativeMessagingHosts` keys for Apollo Download Manager's development host and V1's stand-in, and puts back any key that was there. The browser is Playwright's (`pnpm exec playwright install chromium`, as for the [layout test](TESTING.md)); on Linux it also needs system libraries, installed once as root with `pnpm exec playwright install-deps chromium` (`--dry-run` lists them).
  - **The page button** (#426): `pnpm test:e2e:page-files`, in Playwright's Chromium on Windows and Linux, with the same builds (V1's extension isn't needed). It loads a copy of the built extension whose manifest grants access to pages, since a test can't answer the browser's prompt, and finds the button and panel in the browser's accessibility tree, since a closed shadow root hides them from page scripts. It checks: no button on a page without files; the button and its first-time tip on a page with 12; choosing all 12 by keyboard and sending them adds 12 downloads; Escape closes the panel; dragging moves the button and the place is kept after a reload; a page's styles don't change its size; turning it off removes it without a reload; 20 files a page adds after 2 s bring the button; and it prints the scripting time on a page with 5,000 links, and after the page adds 20 more (targets: under 50 ms and under 10 ms). `--shots <folder>` saves screenshots. In Firefox, on Linux: `pnpm test:e2e:page-files:firefox`, through geckodriver ([`tests/e2e/browser/firefox-driver.mjs`](../tests/e2e/browser/firefox-driver.mjs), shared with the Firefox test). WebDriver can't look into a closed shadow root, so it reaches the button with real key presses and checks the 12 files in the app's database. It checks that Firefox granted the copy access to pages, no button without files, the button for files added later and for 12, and sending all 12 by keyboard.
  - **Firefox** runs on Linux only (PO decision on #64), with Firefox, geckodriver and `zip` installed, as V1's did. Checked with Firefox 159 from Mozilla's APT repository and geckodriver 0.37.1 from its GitHub release, on Ubuntu 24.04 under WSLg.

## The native host

`velocity-native-host-v2` ([`crates/velocity-native-host`](../crates/velocity-native-host/)) is what the browser starts for Apollo Download Manager's extension. It is ported from V1's host with Apollo Download Manager's names.

- **Framing:** native messaging's: a 32-bit length in native byte order, then UTF-8 JSON. A message over 64 KiB is refused before it is read; an answer over 1 MB is replaced by an error.
- **Callers:** only Apollo Download Manager's Chrome extension origin and Firefox add-on ID, from the arguments the browser passes. V1's extensions are refused (`FORBIDDEN_CALLER`).
- **Checked twice:** the host checks each message (`velocity_core::browser::protocol`), and the app checks it again.
- **The local connection:** the host passes a valid message to the running app over Apollo Download Manager's own pipe or socket ([COEXISTENCE.md](COEXISTENCE.md)), with this launch's token, which the app writes to `<data folder>/ipc.token` when it starts (32 random bytes from the operating system, `getrandom`). On Windows the pipe is created first and refuses remote clients; on Unix the socket and the token are readable by this user only. A wrong token is refused (`UNAUTHORIZED`).
- **Starting the app** (#322, PO decisions): when the app isn't running, the host starts the app installed beside it (`velocity-desktop-v2`, a plain file, never a link; `velocity_core::browser::launch`) with `--background`, so it starts in the tray, and tries again every 250 ms for up to 10 seconds. It starts nothing else, nothing the browser names, and at most once per host process; the app's single-instance rule keeps one running, and a second start with `--background` doesn't show its window. The app is started with no stdio, detached and out of the browser's job on Windows (where a job forbids that, without leaving it), and in a process group of its own on Linux. Without an app beside it, or with no answer in time, the browser hears `DESKTOP_NOT_RUNNING` and downloads the file itself. Whether a real browser lets the started app outlive the host is checked by hand, not by a test.
- **Nothing else:** it reads the token and nothing more, runs nothing, and has no other way into the app.

## What the app does with a link

`velocity_core::browser::bridge`, ported from V1's bridge:

- **At most 30 messages in 10 seconds;** more are refused (`RATE_LIMITED`).
- **Settings, Browser:** "Take links from the browser" (on) and "Ask before adding" (on), V1's defaults. With links refused, the extension's popup says so and the browser downloads.
- **Asking:** the link opens the Add dialog, filled in with what the browser sent, and the window comes forward. Torrents and magnet links always ask, whatever the setting.
- **Adding at once:** with "Ask before adding" off, the link is added to the automatic folder, with the browser's file name when it is a safe one. A taken name or a link added before opens the Add dialog instead. Either way the download is marked as from the browser, so a link that reaches this computer or a private network waits for the user ([SECURITY.md](SECURITY.md#links-redirects-and-local-addresses-67)). A link typed in place of the browser's in the dialog isn't from the browser.

## Registering with each browser

Settings, Browser, and step 3 of Get started, list each of Chrome, Chromium, Edge, Brave and Firefox that is installed here, or still registered, with Register or Unregister (`register_browser`, `unregister_browser`) and **Get the extension** (`open_extension_page`, #241). Installed browsers are found in each browser's App Paths registry entry on Windows (for this user, then for every user; Chromium has none, so it isn't listed unless registered), and on Linux by their usual program names on `PATH`, then as a Snap (`/snap/bin`) or Flatpak. A Snap or Flatpak browser is listed with a note that it may not reach the native host; that hasn't been tried on a real system yet. **Get the extension** opens the store page from [`branding.json`](../branding.json)'s `extensionStoreUrls` in that browser; all three are `null` until #240 publishes the extension, so the button is off and says why. Registering is for this user only: nothing system-wide, no elevation.

- **The manifest** names Apollo Download Manager's host, the host program beside the app, and the extensions allowed to start it: Apollo Download Manager's Chrome extension (`allowed_origins`) or Firefox add-on (`allowed_extensions`).
- **Where:** on Linux, each browser's own folder (for example `~/.config/google-chrome/NativeMessagingHosts`, `~/.mozilla/native-messaging-hosts`); on Windows, `<data folder>/native-messaging/<host>.<browser>.json`, with each browser's `HKEY_CURRENT_USER\Software\…\NativeMessagingHosts\<host>` key pointing to it (`windows-sys`, PO decision on #65). The macOS places are V1's, untested (#83).
- **V1 is never touched:** every file and key is named after Apollo Download Manager's host. Unregistering removes the app's own key, and its manifest only when the file there names the app's host and is a plain file, never a link.
- **A moved app:** a manifest naming another copy of the host shows "Registered for another copy"; registering again fixes it.
