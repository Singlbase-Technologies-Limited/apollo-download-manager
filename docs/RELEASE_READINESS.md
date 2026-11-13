# Release readiness

Passing tests isn't the same as being ready to release. This checklist covers everything else a release depends on: security, licences, signing, the release pipeline, field testing, privacy, documentation, rollback and known limits (#78). It is the gate before 1.0.0, and it's brought up to date before each release, starting with 0.2.0. Which version closes each gap, and what else 1.0.0 needs, is in [the road to 1.0.0](ROADMAP_TO_1.0.md) (#461).

**How to read it:**

- **Status:** each item is PASS, FAIL, NOT RUN or BLOCKED, from evidence that can be checked: a closed issue, a document, or a command with its result. An item without that evidence is never PASS.
- **Owner:** the **PO** decides and holds accounts. The **agent** keeps the evidence current.
- **Gaps:** every item that isn't PASS is also in [Gaps for the PO](#gaps-for-the-po). The PO accepts each gap or asks for it to be fixed; nothing is accepted on the PO's behalf.
- **Scope:** Windows and Linux. macOS isn't planned, and V1 parity acceptance (#85) was closed as not planned (PO decision, 2026-11-05).

**Last reviewed:** 2026-11-10, for v0.2.0: on `main` at `7dce4d1`, and the advisory check again with #446 in, on the branch for #450.

## Security

| Item | Owner | Status | Evidence |
|---|---|---|---|
| Dependency advisories (#75) | Agent | PASS | `pnpm check:advisories` with #446 in: Rust PASS, npm PASS. RUSTSEC-2026-0459 (SQLite, Medium), found by this review, was fixed in #446; the rest are fixed or accepted in the register ([SECURITY.md](SECURITY.md#the-register)) |
| TLS verification on every backend (#69) | Agent | PASS | #69 closed; [SECURITY.md](SECURITY.md#tls-verification-69) |
| Links, redirects and local addresses (#67) | Agent | PASS | #67 closed; [SECURITY.md](SECURITY.md#links-redirects-and-local-addresses-67) |
| Secrets kept out of storage (#70), and the leak scan (#71) | Agent | PASS | #70 and #71 closed; [SECURITY.md](SECURITY.md#secrets-70) |
| Files and folders (#72) | Agent | PASS | #72 closed; [SECURITY.md](SECURITY.md#files-and-folders-72) |
| The browser bridge (#65) | Agent | PASS | #65 closed; [SECURITY.md](SECURITY.md#the-browser-bridge-65) |
| Fuzzing of the protocol parsers (#73) | PO | NOT RUN | #73 closed as not planned (2026-11-05) |
| Recovery from a full disk, interrupted writes and crashes (#74) | Agent | PASS | #74 closed |
| Load, stress and long runs (#77, #337) | PO | NOT RUN | #77 closed as not planned (2026-11-05); the load and long-run field test is #337, in v0.3.0 |

## Licences

| Item | Owner | Status | Evidence |
|---|---|---|---|
| Apollo Download Manager's own licence | PO | PASS | GPL-3.0-only ([ADR-0017](decisions/0017-gpl-3-licence.md), #86) |
| Third-party notices and licence closure (#76) | Agent | PASS | `pnpm check:notices` on `7dce4d1`: "THIRD_PARTY_NOTICES.md is up to date: 6 native libraries, 578 crates, 62 npm packages" |
| Legal review of the licensing | PO | NOT RUN | [LICENSING.md](LICENSING.md): "No legal review was done for this decision" |
| Legal review of the Contributor Licence Agreement | PO | NOT RUN | [OPEN_SOURCE.md](OPEN_SOURCE.md): `CLA.md` is a draft until reviewed by a lawyer |
| Trademark and intellectual-property due diligence (#441) | PO | NOT RUN | #441 open, in v0.3.0; the PO is arranging the trademark searches with a lawyer |

## Packaging and signing

| Item | Owner | Status | Evidence |
|---|---|---|---|
| Windows installer, with install, upgrade and uninstall beside V1 (#81) | Agent | PASS | #81 closed; [PACKAGING.md](PACKAGING.md) |
| Linux deb and rpm, installed in clean containers (#82) | Agent | PASS | #82 closed; the container install tests in [PACKAGING.md](PACKAGING.md) |
| Windows code signing | PO | NOT RUN | The installer isn't signed, so SmartScreen warns on first run ([PACKAGING.md](PACKAGING.md#signing)). The decision is #428, the workflow #429, both in v0.3.0 |
| Linux package and checksum signing | PO | NOT RUN | Releases carry `SHA256SUMS` and GitHub artifact attestations ([RELEASE_PROCESS.md](RELEASE_PROCESS.md#making-the-release)); the checksums aren't signed (#428, #429) |
| macOS | PO | Not in scope | Not planned (PO decision, 2026-11-05) |

## Release pipeline

| Item | Owner | Status | Evidence |
|---|---|---|---|
| Release-candidate builds (#17) | Agent | PASS | *Release candidate* runs for `v0.1.0-rc.1` (2026-10-31) and `v0.1.1-rc.1` (2026-11-04): success |
| The release workflow, gated on the PO (#18) | PO | PASS | *Release* runs for `v0.1.0` and `v0.1.1`: success. The `release` environment has a required reviewer |
| Versions, changelog, provenance and checksums (#84) | Agent | PASS | #84 closed; [RELEASE_PROCESS.md](RELEASE_PROCESS.md) |
| `main` and release tags protected | PO | PASS | The repository rulesets "Main" and "Release Tags" are active |
| Side by side with V1: identity, data and registrations (#11, #27) | Agent | PASS | #11 and #27 closed; [COEXISTENCE.md](COEXISTENCE.md) |

## Field testing and candidate feedback

| Item | Owner | Status | Evidence |
|---|---|---|---|
| The installed app with real downloads (#262) | PO and agent | PASS | #262 closed (2026-11-04); its session reports are comments on #262 ([TESTING.md](TESTING.md#the-field-test-262)) |
| Feedback on the candidates | PO | PASS | 0.1.0 and 0.1.1 were released from their candidates on the PO's acceptance, as pre-releases |
| Ramp and speed field testing (#330) | Agent | NOT RUN | #330 open, in v0.3.0 |

## Privacy and accessibility

| Item | Owner | Status | Evidence |
|---|---|---|---|
| No telemetry or analytics | Agent | PASS | [PRIVACY.md](PRIVACY.md): "Apollo Download Manager has none" |
| Accessibility and keyboard use (#66) | Agent | PASS | #66 closed; [ACCESSIBILITY.md](ACCESSIBILITY.md) |

## Documentation

| Item | Owner | Status | Evidence |
|---|---|---|---|
| User guides (#79) | Agent | PASS | #79 closed; [docs/user/](user/README.md), also in the app |
| Engine internals and data (#80) | Agent | PASS | #80 closed; [ENGINE_INTERNALS.md](ENGINE_INTERNALS.md), [DATA_AND_MIGRATIONS.md](DATA_AND_MIGRATIONS.md) |
| Audit of the guide and the developer site (#425) | Agent | NOT RUN | #425 open, in v0.3.0 |

## Browser extension

| Item | Owner | Status | Evidence |
|---|---|---|---|
| Chrome Web Store | PO | PASS for 0.2.0 | The item is ready to publish; the PO publishes it with v0.2.0. The app allows its ID and links to it (#240, PR 445) |
| Microsoft Edge Add-ons | PO | BLOCKED | The store account isn't approved yet (#240) |
| Firefox Add-ons | PO | PASS for 0.3.0 | Approved on 2026-11-12 and public ([listing](https://addons.mozilla.org/firefox/addon/apollo-download-manager/)). The app links to it from 0.3.0 (#240) |

## Rollback

- **Before a release is public:** the release workflow makes a **draft**, and only the PO publishes it ([RELEASE_PROCESS.md](RELEASE_PROCESS.md#making-the-release)). A wrong draft is never published; the fix goes into a new candidate.
- **After a release:** the fix ships in a later version ([Choosing the next version](RELEASE_PROCESS.md#choosing-the-next-version)). For users, going back to the earlier version, with their data, follows [Going back to an earlier version](RELEASE_CANDIDATES.md#going-back-to-an-earlier-version). A database that a newer version upgraded is refused by an older one unchanged, and the backup made before the upgrade restores it ([DATA_AND_MIGRATIONS.md](DATA_AND_MIGRATIONS.md)).
- **The browser extension:** each store keeps its own versions. A bad extension version is replaced by a new upload. The app accepts the store's extension ID, which doesn't change between versions.

## Known limitations

What users meet in this version, with where it is documented:

- **The Windows installer isn't signed:** SmartScreen warns on first run ([PACKAGING.md](PACKAGING.md#signing)).
- **The extension is only in the Chrome Web Store** in 0.2.0. Edge and Firefox users load it by hand until their stores approve it ([Browser integration](user/browser.md#installing-the-extension)). Firefox Add-ons approved it on 2026-11-12, and the app links to it from 0.3.0.
- **Nothing is imported from V1** ([V1 and Apollo Download Manager](user/v1-and-v2.md)).
- **Protocols:** FTP and SFTP use one connection each, and SFTP and torrents can't use an HTTPS proxy ([Protocols](user/protocols.md#not-supported)).
- **Torrents through a proxy** have limits ([Torrents](user/torrents.md#not-yet-or-different-from-v1)).
- **Snap and Flatpak browsers** may not be able to start the browser connection. Settings, Browser warns beside such a browser; the user guide doesn't mention it yet.
- **On Linux,** browser registrations must be removed before the package ([Installing](user/installing.md#removing-apollo-download-manager)).
- **No macOS build.**

## Gaps for the PO

Each item here needs the PO's decision before the release it blocks: accept it for that release, or have it fixed. Nothing here is accepted yet.

| Gap | Blocks | PO decision |
|---|---|---|
| No fuzzing (#73) | 1.0.0 | Open |
| No load, stress or long-run test (#77, #337) | 1.0.0 | Open |
| No legal review of the licensing or the CLA | 1.0.0; the CLA also blocks the first outside contribution ([OPEN_SOURCE.md](OPEN_SOURCE.md)) | Open |
| Trademark and IP due diligence (#441) | 1.0.0 | Open |
| Unsigned Windows installer and unsigned Linux checksums (#428, #429) | 1.0.0 | Open |
| Ramp and speed field testing (#330) | 1.0.0 | Open |
| Guide and developer-site audit (#425) | 1.0.0 | Open |
| Edge store listing (#240, #241); Firefox's is public since 2026-11-12 | Not 0.2.0 (PO decision, 2026-11-10); 1.0.0 | Open |
