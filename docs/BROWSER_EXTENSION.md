# Browser extension

The browser extension offers the browser's downloads to V2, and lets the browser carry on whenever V2 can't take one. It is V1's extension ported with V2's own identity (#64), so V1's and V2's extensions can be installed side by side. It reaches V2 through V2's own native host, which each browser starts once it is registered in Settings, Browser (#65). The rules for this area are in `.claude/rules/browser-integration.md`.

## What it does

- **Interception:** when the browser starts a download that matches the rules, the extension pauses it and offers it to V2. If V2 takes it, the browser's copy is cancelled and erased; on any failure the browser's download resumes.
- **Modes:** send matching downloads to V2 (the default), ask first in a small window, or leave every download to the browser. Closing the ask window lets the browser continue.
- **Rules:** file types (archives, disk images, installers, video, audio, PDF and e-books by default), matched by the file name's extension or, when that doesn't match (often the name isn't known yet), by the download's MIME type (`application/zip` counts as `zip`; #406), a size threshold (20 MiB by default; only when the browser knows the size), allow and deny lists of domains with their subdomains, and private windows (off by default).
- **Never intercepted:** `blob:`, `data:`, `file:` and other browser-only links; downloads the extension started itself as a fallback; and the same link twice within 5 seconds.
- **Context menu:** "Download with Apollo Download Manager" on links, images, video and audio. If V2 can't take the link, the browser downloads it.
- **Popup:** shows whether V2 is reachable (checking; connected, with the app's version; connected but the engine isn't running; connected but browser requests are off; not connected, with the reason and **Try again**), switches the mode, sends a typed link, and lists the last 5 sends (#356).
- **Recent sends:** each keeps only the file name, the host, sent or failed, the error code and the time, in `storage.local` under `recentSends`. Never the link itself, whose path or query can hold a token, and never the error message, which can repeat it. The list is checked on every read (`src/shared/recent.ts`) and cleared with **Clear recent sends** on the settings page.
- **Magnet links and `.torrent` downloads:** off by default. Turning them on asks for access to pages, which magnet clicks need; `.torrent` downloads work without it. V2 always asks before adding a torrent.
- **Failures:** the toolbar badge turns red with "!", and its tooltip says what went wrong, for example that the connection isn't set up or that V2 didn't answer within 10 seconds.
- **What it never sends:** cookies, page content or logins. A download that needs them may fail in V2, and the browser can then download it.

## Identity

V2's extension uses none of V1's names or IDs ([ADR-0003](decisions/0003-v2-app-identity.md), [COEXISTENCE.md](COEXISTENCE.md)). All of them come from `branding.json`.

| | V2 development build | V2 release build | V1 |
|---|---|---|---|
| Name | Apollo Download Manager (dev) | Apollo Download Manager | Velocity Download Manager |
| Native host it talks to | `dev.velocity.download_manager_v2` | `com.velocity.download_manager_v2` | `com.velocity.download_manager` |
| Chrome extension ID | `adhefdmekgeafmopfbiappajaolcbhkc` | the same | `eecopkgfiffjgmngfmjmdaejbkbbippo` |
| Firefox add-on ID | `apollo-download-manager@singlbase.com` ([ADR-0020](decisions/0020-extension-store-distribution.md); `velocity-download-manager-v2@velocity.local` until 0.2.0) | the same | `velocity-download-manager@velocity.local` |

- **Telling them apart:** V2's name, toolbar title and context-menu item say "Apollo Download Manager", and its short name and messages "Apollo DM" (the short form, docs/BRANDING.md).
- **The Chrome key:** the manifest's `key` is the public half of a key pair generated for V2 in #64, and it pins the Chrome extension ID. The private half is held by the Product Owner, outside the repository; the repository ignores `*.pem` and `*.key` files. A test derives the ID from the key and checks it against `branding.json` (`scripts/extension-lib.test.mjs`).
- **Store publication** isn't part of #64.

## Protocol

The extension speaks V1's native messaging protocol, version 1, unchanged: it can ping, ask for the app's status, or offer a link (`download.add` with the URL and, when known, the referrer, the file name, the size, the MIME type and where it came from). It never sends paths, commands or engine options. `tests/fixtures/contract/browser-messages.json` holds valid and invalid messages; the extension's tests check its messages against it, and the native host (#65) accepts the valid ones and refuses the invalid ones.

## Permissions

The same as V1's, each in use (checked on #356). These reasons are also the store listings' permission justifications:

| Permission | Why the extension needs it |
|---|---|
| `downloads` | To see a download the browser starts, pause it while the app takes it, then cancel and erase the browser's copy, or resume it when the app can't take it. |
| `nativeMessaging` | To pass links to the Apollo Download Manager desktop app through its native host. It is the only channel to the app. |
| `storage` | To keep the extension's settings and the popup's last 5 sends (file name and host only), and pending ask-first prompts. |
| `contextMenus` | For "Download with Apollo Download Manager" on a link, image, video or audio. It can be turned off. |
| `scripting` | To register the magnet-link script, only while torrent capture is on and page access was granted, and to put it into the web pages already open when capture starts, so their magnet links work without a reload (#416). |
| `<all_urls>` (optional) | Asked for only when you turn on magnet capture, so a magnet link click on a page reaches the app. Without it, only `.torrent` downloads are sent. |

The windows, toolbar button and permissions APIs the extension also calls need no permission of their own. The extension's pages run only the extension's own scripts (`script-src 'self'`).

## Building

```sh
pnpm build:extension              # development build: talks to the development app
pnpm build:extension -- --release # release build: talks to the release app
```

Both write `browser-extension/dist/chrome` (Chrome, Edge and Brave, Manifest V3 with a service worker; Chrome 116 or later) and `browser-extension/dist/firefox` (Manifest V3 with a background script; Firefox 115 or later). Each script is bundled by Vite as a classic script, and the icons are the desktop app's own (`src-tauri/icons`).

To try a build: in Chrome, open `chrome://extensions`, turn on developer mode and load `browser-extension/dist/chrome` unpacked; in Firefox, open `about:debugging`, This Firefox, and load `browser-extension/dist/firefox/manifest.json` as a temporary add-on. It reaches V2 once the native host is registered with that browser ([below](#registering-with-each-browser)).

### Store packages

```sh
pnpm package:extension   # a release build, zipped for the stores
```

It writes `browser-extension/dist/packages/apollo-download-manager-chrome-<version>.zip` (for the Chrome Web Store and Microsoft Edge Add-ons) and `apollo-download-manager-firefox-<version>.zip` (for addons.mozilla.org), with the manifest at the archive's root. The zip writer (`scripts/zip-lib.mjs`) uses Node's own zlib, sorts the files and dates them 1980-01-01, so the same build gives the same bytes. The Chrome package leaves out the manifest's `key`, since the Chrome Web Store gives the item its own; the Firefox package declares that the add-on collects no data ([ADR-0020](decisions/0020-extension-store-distribution.md)). `scripts/extension-lib.test.mjs` checks both. Uploading is a manual step for the PO (#240). The listing text and the permission reasons are in [`browser-extension/store/`](../browser-extension/store/README.md), and each package is checked by hand with the [release test](BROWSER_EXTENSION_RELEASE_TEST.md) before it is uploaded.

### Publishing in the stores

The PO holds the Singlbase store accounts and submits each package; the agent has no store access ([ADR-0020](decisions/0020-extension-store-distribution.md)). For each release whose extension changed:

1. **Build and check:** `pnpm package:extension`, then the [release test](BROWSER_EXTENSION_RELEASE_TEST.md) with those packages.
2. **Chrome Web Store** ([developer dashboard](https://chrome.google.com/webstore/devconsole)): upload `apollo-download-manager-chrome-<version>.zip`. Fill in the listing from [`browser-extension/store/`](../browser-extension/store/README.md): descriptions, single purpose, a reason for each permission, the privacy answers and link, the icon and screenshots. Submit for review.
   - **The first upload only:** the store gives the item its ID and key. Copy the item ID and, from the Package tab's **View public key**, the key as one line, into the issue ([Chrome: manifest key](https://developer.chrome.com/docs/extensions/reference/manifest/key)). They go into `branding.json` (`chromeExtensionIds`, `chromeExtensionKey`) in a release, so the native host allows the store's extension.
3. **Microsoft Edge Add-ons** ([Partner Center](https://partner.microsoft.com/dashboard/microsoftedge)): upload the same Chrome zip, with the same listing. **The first upload only:** copy the ID Edge assigns into the issue; it joins `chromeExtensionIds`.
4. **Firefox Add-ons** ([developer hub](https://addons.mozilla.org/developers/)): upload `apollo-download-manager-firefox-<version>.zip`, listed on AMO, with the same listing. The ID is in the package (`apollo-download-manager@singlbase.com`) and can't change once published.
5. **Store links:** once each listing is public, its address goes into `branding.json`'s `extensionStoreUrls`, which turns on the app's **Get the extension** buttons (#241).
6. **Check:** install the extension from each store and confirm it reaches the installed app (the popup says "Connected"), and record it in the issue.

## Tests

- **Unit tests** (`browser-extension/tests`, Vitest's `extension` project): interception, fallback, ask mode, the context menu, magnet links, the rules, the settings, the protocol and V2's identity, against fakes of the WebExtension APIs. `pnpm test:focused -- extension` runs them; `tsc --noEmit -p browser-extension` checks their types.
- **The manifest and the key** (`scripts/extension-lib.test.mjs`): permissions, pinned IDs and names.
- **The native host** (`crates/velocity-native-host/tests/host_e2e.rs`, L2): the real host program, with browser framing, against a real local listener: callers other than V2's extensions (V1's included) refused, only valid messages passed on with the token and the caller, a wrong token refused, the app not running, a copy of the host with a stand-in app beside it that never answers (started, then given up on after 10 s), an oversized message. Each test runs a copy of the host in a folder of its own, so a real app build beside the built host is never started.
- **The bridge and registration** (`velocity_core::browser`, unit tests): the protocol against the shared fixture, the token and its file, the local connection and its limits, the routing (callers, settings, torrents always asking, rate limit, what adding did), and registering with each browser in a folder and a registry key of the test's own, with V1's manifests and registry values in place and unchanged afterwards.
- **Real browsers** (L4): `pnpm test:e2e:chromium` and `pnpm test:e2e:firefox` (`tests/e2e/browser`). A link clicked on a local page is intercepted by V2's extension, goes through V2's native host into a running V2, which records it once; the browser's copy is cancelled. The page is on 127.0.0.1, so V2 holds the link until the user confirms its local address ([SECURITY.md](SECURITY.md#links-redirects-and-local-addresses-67)): the test checks it does, without asking the server for anything or writing a file. Downloading itself is the engine tests' to check. V1's extension is installed too, with a recording stand-in for V1's host: the test checks V1's extension reached only V1's host.
  - **Build first:** `cargo build -p velocity-desktop-v2 -p velocity-transfer -p velocity-torrent -p velocity-native-host` and `pnpm build:extension`, and V1's extension built in `../velocity-download-manager` (or `V1_EXTENSION_DIR`). No V2 development instance may be running, since V2 is single-instance.
  - **Chromium** runs on Windows and Linux. On Windows, Chromium reads native hosts only from the registry: the test writes `HKCU\Software\Chromium\NativeMessagingHosts` keys for V2's development host and V1's stand-in, and puts back any key that was there. The browser is Playwright's (`pnpm exec playwright install chromium`, as for the [layout test](TESTING.md)); on Linux it also needs system libraries, installed once as root with `pnpm exec playwright install-deps chromium` (`--dry-run` lists them).
  - **Firefox** runs on Linux only (PO decision on #64), with Firefox, geckodriver and `zip` installed, as V1's did. Checked with Firefox 159 from Mozilla's APT repository and geckodriver 0.37.1 from its GitHub release, on Ubuntu 24.04 under WSLg.

## The native host

`velocity-native-host-v2` (`crates/velocity-native-host`) is what the browser starts for V2's extension. It is ported from V1's host with V2's names.

- **Framing:** native messaging's: a 32-bit length in native byte order, then UTF-8 JSON. A message over 64 KiB is refused before it is read; an answer over 1 MB is replaced by an error.
- **Callers:** only V2's Chrome extension origin and Firefox add-on ID, from the arguments the browser passes. V1's extensions are refused (`FORBIDDEN_CALLER`).
- **Checked twice:** the host checks each message (`velocity_core::browser::protocol`), and the app checks it again.
- **The local connection:** the host passes a valid message to the running app over V2's own pipe or socket ([COEXISTENCE.md](COEXISTENCE.md)), with this launch's token, which the app writes to `<data folder>/ipc.token` when it starts (32 random bytes from the operating system, `getrandom`). On Windows the pipe is created first and refuses remote clients; on Unix the socket and the token are readable by this user only. A wrong token is refused (`UNAUTHORIZED`).
- **Starting the app** (#322, PO decisions): when the app isn't running, the host starts the app installed beside it (`velocity-desktop-v2`, a plain file, never a link; `velocity_core::browser::launch`) with `--background`, so it starts in the tray, and tries again every 250 ms for up to 10 seconds. It starts nothing else, nothing the browser names, and at most once per host process; the app's single-instance rule keeps one running, and a second start with `--background` doesn't show its window. The app is started with no stdio, detached and out of the browser's job on Windows (where a job forbids that, without leaving it), and in a process group of its own on Linux. Without an app beside it, or with no answer in time, the browser hears `DESKTOP_NOT_RUNNING` and downloads the file itself. Whether a real browser lets the started app outlive the host is checked by hand, not by a test.
- **Nothing else:** it reads the token and nothing more, runs nothing, and has no other way into the app.

## What the app does with a link

`velocity_core::browser::bridge`, ported from V1's bridge:

- **At most 30 messages in 10 seconds;** more are refused (`RATE_LIMITED`).
- **Settings, Browser:** "Take links from the browser" (on) and "Ask before adding" (on), V1's defaults. With links refused, the extension's popup says so and the browser downloads.
- **Asking:** the link opens the Add dialog, filled in with what the browser sent, and the window comes forward. Torrents and magnet links always ask, whatever the setting.
- **Adding at once:** with "Ask before adding" off, the link is added to the automatic folder, with the browser's file name when it is a safe one. A taken name or a link added before opens the Add dialog instead. Either way the download is marked as from the browser, so a link that reaches this computer or a private network waits for the user ([SECURITY.md](SECURITY.md#links-redirects-and-local-addresses-67)). A link typed in place of the browser's in the dialog isn't from the browser.

## Registering with each browser

Settings, Browser, and step 3 of Get started, list each of Chrome, Chromium, Edge, Brave and Firefox that is installed here, or still registered, with Register or Unregister (`register_browser`, `unregister_browser`) and **Get the extension** (`open_extension_page`, #241). Installed browsers are found in each browser's App Paths registry entry on Windows (for this user, then for every user; Chromium has none, so it isn't listed unless registered), and on Linux by their usual program names on `PATH`, then as a Snap (`/snap/bin`) or Flatpak. A Snap or Flatpak browser is listed with a note that it may not reach the native host; that hasn't been tried on a real system yet. **Get the extension** opens the store page from `branding.json`'s `extensionStoreUrls` in that browser; all three are `null` until #240 publishes the extension, so the button is off and says why. Registering is for this user only: nothing system-wide, no elevation.

- **The manifest** names V2's host, the host program beside the app, and the extensions allowed to start it: V2's Chrome extension (`allowed_origins`) or Firefox add-on (`allowed_extensions`).
- **Where:** on Linux, each browser's own folder (for example `~/.config/google-chrome/NativeMessagingHosts`, `~/.mozilla/native-messaging-hosts`); on Windows, `<data folder>/native-messaging/<host>.<browser>.json`, with each browser's `HKEY_CURRENT_USER\Software\…\NativeMessagingHosts\<host>` key pointing to it (`windows-sys`, PO decision on #65). The macOS places are V1's, untested (#83).
- **V1 is never touched:** every file and key is named after V2's host. Unregistering removes V2's key, and V2's manifest only when the file there names V2's host and is a plain file, never a link.
- **A moved app:** a manifest naming another copy of the host shows "Registered for another copy"; registering again fixes it.
