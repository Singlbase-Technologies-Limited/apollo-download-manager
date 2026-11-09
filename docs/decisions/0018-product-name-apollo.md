# ADR-0018: The released app is named "Apollo Download Manager"

- **Status:** Accepted
- **Date:** 2026-11-05
- **Decided by:** the Product Owner
- **Issue:** #346

## Context

[ADR-0016](0016-release-product-name-v2.md) named the released app "Velocity Download Manager V2", so that it would install beside V1 with its own folder and uninstall entry. The PO wants a distinctive name of its own for v0.2.0 (#346). "Velocity" is a common word in software and hard to search for, and the current name carries a version number.

The PO's direction for the name (on #346, 2026-11-05): a completely new name, not "Velocity" plus a word; every candidate ends with "Download Manager"; domain availability doesn't remove a name.

The [product name shortlist](../research/2026-11-05-product-name-shortlist.md) checked more than 150 first words, in five rounds. For "Apollo Download Manager" it found (2026-11-05):

- **No download manager or download app with the name,** on the web, on GitHub, in Firefox Add-ons or on Flathub. The nearest is "ApolloSource – Game Downloader", a Firefox add-on with 2 daily users.
- **The word "Apollo" is widely used in software:** Apollo GraphQL, Apollo.io and Apollo Auto, among 41,266 GitHub repositories with "apollo" in the name.
- **Domains and GitHub (information only):** apollodownloadmanager.com, .app, .io and .dev and the GitHub account `apollodownloadmanager` were unregistered.
- **Not run:** the official USPTO, EUIPO and WIPO trademark searches. These checks aren't legal advice; Singlbase Technologies Limited arranges the legal clearance.

## Decision

**The released app's product name is "Apollo Download Manager".** It replaces ADR-0016's "Velocity Download Manager V2" as the name of the install folder, the Apps & features entry, the Start menu shortcut and the window title, from the release that applies it (#347, planned for v0.2.0).

Everything in [ADR-0003](0003-v2-app-identity.md) other than the product name stands. The app identifier `com.velocity.downloadmanager.v2`, the data folders, the IPC and native-messaging host names and the extension IDs don't change, because they decide where users' data and registrations live.

## Options considered

The PO chose from these, on the multiple-choice question of 2026-11-05.

| Option | For | Against |
|---|---|---|
| **"Apollo Download Manager" (chosen)** | No download app with the name; a well-known word that reads the same in most languages; the full phrase is unique today | "Apollo" alone is used by many software products and is hard to search for on its own |
| "Astra Download Manager" | No download app with the name; full-phrase domains free | Many software products use "Astra" (a WordPress theme on 1.8 million sites); at least 7 live US class 9 ASTRA marks |
| "Sleek Download Manager" | A plain adjective; no live software mark on SLEEK found | Less distinctive as a brand |
| Keep "Velocity Download Manager V2" | No rename and no upgrade work | A common, hard-to-search name with a version in it |

Rejected during the research: Atlas (an active download manager already has that name) and Orion (a torrent client named Orion exists). The full list and the reasons are in the [shortlist](../research/2026-11-05-product-name-shortlist.md).

## Consequences

- **#347 applies the name:** logo, icons and colours, `branding.json`'s `releaseProductName`, `src-tauri/tauri.release.conf.json`, the window title, and the documents that describe the installer ([PACKAGING.md](../PACKAGING.md), [COEXISTENCE.md](../COEXISTENCE.md), [BROWSER_EXTENSION.md](../BROWSER_EXTENSION.md) and the [user guide](../user/README.md)). Until then they describe the current release and keep its name.
- **The upgrade from 0.1.x is the main risk.** Tauri's NSIS installer names the install folder and the uninstall key after the product name, so a renamed release would otherwise install a second copy. #347 must leave one Apps & features entry after the upgrade and keep all data, settings, history, browser registrations and keychain entries.
- **V1 and Apollo Download Manager still install side by side:** the new name differs from V1's, and the test in `crates/velocity-core/src/branding.rs` that keeps them apart stays.
- **The browser extension's release name** follows the product name; #356 redesigns the extension and #240 publishes it. The Firefox add-on ID is permanent once uploaded, so it is chosen with this name in mind.
- **The website (#353) and the developer site (#355)** use the new name.

## Follow-up

- **Singlbase's legal clearance** of "Apollo Download Manager" (official trademark searches in classes 9 and 42, and any filing) before the first public release under the name. If it finds a conflict, a new ADR replaces this one before #347 ships.
- **Not decided here, for #347:** the publisher name (today "Velocity Project"), and whether to register the domains and a GitHub organisation for the name.
