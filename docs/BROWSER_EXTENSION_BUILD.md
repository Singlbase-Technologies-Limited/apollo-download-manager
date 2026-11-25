# Building, testing and publishing the extension

How the browser extension is built, tested, loaded by hand, packaged for the stores and published. How it works is in [BROWSER_EXTENSION.md](BROWSER_EXTENSION.md); split from it by #425.

## Building

```sh
pnpm build:extension              # development build: talks to the development app
pnpm build:extension -- --release # release build: talks to the release app
```

Both write `browser-extension/dist/chrome` (Chrome, Edge and Brave, Manifest V3 with a service worker; Chrome 116 or later) and `browser-extension/dist/firefox` (Manifest V3 with a background script; Firefox 115 or later). Each script is bundled by Vite as a classic script, and the icons are the desktop app's own ([`src-tauri/icons`](../src-tauri/icons/)).

To try a build: in Chrome, open `chrome://extensions`, turn on developer mode and load `browser-extension/dist/chrome` unpacked; in Firefox, open `about:debugging`, This Firefox, and load `browser-extension/dist/firefox/manifest.json` as a temporary add-on. It reaches Apollo Download Manager once the native host is registered with that browser ([below](BROWSER_EXTENSION.md#registering-with-each-browser)).

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
  - **Build first:** `cargo build -p velocity-desktop-v2 -p velocity-transfer -p velocity-torrent -p velocity-native-host` and `pnpm build:extension`, and V1's extension built in `../velocity-download-manager` (or `V1_EXTENSION_DIR`). No Apollo Download Manager development instance may be running, since Apollo Download Manager is single-instance.
  - **Chromium** runs on Windows and Linux. On Windows, Chromium reads native hosts only from the registry: the test writes `HKCU\Software\Chromium\NativeMessagingHosts` keys for Apollo Download Manager's development host and V1's stand-in, and puts back any key that was there. The browser is Playwright's (`pnpm exec playwright install chromium`, as for the [layout test](TESTING.md)); on Linux it also needs system libraries, installed once as root with `pnpm exec playwright install-deps chromium` (`--dry-run` lists them).
  - **The page button** (#426): `pnpm test:e2e:page-files`, in Playwright's Chromium on Windows and Linux, with the same builds (V1's extension isn't needed). It loads a copy of the built extension whose manifest grants access to pages, since a test can't answer the browser's prompt, and finds the button and panel in the browser's accessibility tree, since a closed shadow root hides them from page scripts. It checks: no button on a page without files; the button and its first-time tip on a page with 12; choosing all 12 by keyboard and sending them adds 12 downloads; Escape closes the panel; dragging moves the button and the place is kept after a reload; a page's styles don't change its size; turning it off removes it without a reload; 20 files a page adds after 2 s bring the button; and it prints the scripting time on a page with 5,000 links, and after the page adds 20 more (targets: under 50 ms and under 10 ms). `--shots <folder>` saves screenshots. In Firefox, on Linux: `pnpm test:e2e:page-files:firefox`, through geckodriver ([`tests/e2e/browser/firefox-driver.mjs`](../tests/e2e/browser/firefox-driver.mjs), shared with the Firefox test). WebDriver can't look into a closed shadow root, so it reaches the button with real key presses and checks the 12 files in the app's database. It checks that Firefox granted the copy access to pages, no button without files, the button for files added later and for 12, and sending all 12 by keyboard.
  - **Firefox** runs on Linux only (PO decision on #64), with Firefox, geckodriver and `zip` installed, as V1's did. Checked with Firefox 159 from Mozilla's APT repository and geckodriver 0.37.1 from its GitHub release, on Ubuntu 24.04 under WSLg.
