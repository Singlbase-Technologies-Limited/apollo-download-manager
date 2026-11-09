# ADR-0020: The browser extension is published in the three browser stores

- **Status:** Accepted
- **Date:** 2026-11-07
- **Decided by:** the Product Owner
- **Issue:** #240 (and #241, which builds on it)

## Context

Until v0.2.0, users load Apollo Download Manager's extension by hand: unpacked with developer mode in Chrome, Edge and Brave, and as a temporary add-on in Firefox, which Firefox removes when it closes ([docs/user/browser.md](../user/browser.md)). Ordinary users can't get it that way.

The extension needs an identity each store accepts:

- The native host lets only listed extensions start it: Chromium browsers by `allowed_origins`, which can't hold wildcards, and Firefox by `allowed_extensions` ([Chrome: native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging), [MDN: native manifests](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests)). Every published ID is listed in `branding.json`.
- An add-on's ID on Firefox Add-ons (AMO) is permanent once published. The extension's ID until now, `velocity-download-manager-v2@velocity.local`, names a domain nobody owns.
- The Chrome Web Store gives an item its own key. Google's documented way to keep one ID in development and in the store is to upload the package, then copy the item's public key into the manifest's `key` ([Chrome: manifest key](https://developer.chrome.com/docs/extensions/reference/manifest/key)).
- Edge Add-ons assigns its own ID, which can't be chosen.
- New add-ons on AMO must declare the data they collect in the manifest, from 2025-11-03 ([Mozilla: built-in data consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/), [MDN: browser_specific_settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)).

PO decisions:

- **2026-10-31:** publish in the Chrome Web Store, Edge Add-ons and AMO, with a setup step in the app that opens each browser's store page (#241). Not installed by Apollo Download Manager's installers: Firefox hasn't allowed that since Firefox 74, and Chrome and Edge on Windows need machine-wide keys and still ask the user.
- **2026-11-07:** the Firefox ID is `apollo-download-manager@singlbase.com`. The Chrome Web Store package carries no `key`: the store's ID becomes the extension's ID, and its public key goes into `branding.json` afterwards, as Google documents. The work lands in two PRs: what needs no store account first, then the store IDs and links after the uploads.

## Decision

**Singlbase publishes the extension in the Chrome Web Store, Edge Add-ons and AMO. The PO holds the store accounts and submits; the repository builds and checks the packages.**

- **Packages:** `pnpm package:extension` builds `apollo-download-manager-chrome-<version>.zip`, for the Chrome Web Store and Edge Add-ons, and `apollo-download-manager-firefox-<version>.zip`, for AMO. The Chrome package leaves out `key`; builds loaded by hand keep it. A test checks what each package's manifest holds (`scripts/extension-lib.test.mjs`).
- **Firefox:** ID `apollo-download-manager@singlbase.com`. The manifest declares `data_collection_permissions: { required: ["none"] }`: the extension sends links only to the app on this computer. Firefox 115 installs a package with this field, which Firefox 140 and later show at install.
- **Chrome and Edge:** each store's ID is added to `chromeExtensionIds` once it's known. The Chrome Web Store's public key replaces `chromeExtensionKey`, so builds loaded by hand get the store's ID.
- **Registrations already made:** the app rewrites a registration of its own host that allows other extension IDs than its build's, when it starts (`Locations::repair_moved_host`). The old placeholder IDs aren't kept: nobody owns `@velocity.local` on AMO, so another add-on could claim one.
- **Store links:** recorded in `branding.json`'s `extensionStoreUrls`, which #241's setup step uses.

## Options considered

| Option | For | Against |
|---|---|---|
| **The three stores (chosen)** | Ordinary users can install it; the stores update it | Store accounts and reviews, which take days or weeks |
| Loading by hand only, as until v0.2.0 | Nothing to set up | Firefox removes it on close; developer mode in Chromium browsers |
| Installed by Apollo DM's installers | One step | Not possible for Firefox; Chrome and Edge still ask, and need machine-wide keys |
| Files hosted by Singlbase | No store review | Chrome and Edge don't install extensions from elsewhere on Windows and macOS; Firefox needs AMO signing anyway |

## Consequences

- Each new Chrome, Edge or Firefox ID is a `branding.json` change with its tests, and a release.
- A user who registered Firefox with v0.1.x gets the registration rewritten when the new app starts, and installs the store's add-on.
- The listings' text and permission justifications live in `browser-extension/store/`, and the PO's steps for each store in [BROWSER_EXTENSION.md](../BROWSER_EXTENSION.md#publishing-in-the-stores).
