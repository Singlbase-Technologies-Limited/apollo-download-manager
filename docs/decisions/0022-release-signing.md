# ADR-0022: Windows releases are signed through SignPath Foundation; Linux users check a GPG signature

- **Status:** Accepted
- **Date:** 2026-11-25
- **Decided by:** the Product Owner
- **Issue:** #428 (and #429, which builds it)

## Context

Apollo Download Manager's Windows installer is unsigned. On first run, Windows SmartScreen warns "Windows protected your PC", and the user has to click **More info**, then **Run anyway** ([PACKAGING.md](../PACKAGING.md#signing)). The Linux `.deb` and `.rpm` carry no package signature. Each release already has a `SHA256SUMS` and GitHub build-provenance attestations, made by [`release.yml`](../../.github/workflows/release.yml) and checked with `gh attestation verify` ([RELEASE_PROCESS.md](../RELEASE_PROCESS.md#the-release-environment)).

Facts verified on 2026-11-25:

- **No certificate removes the warning on day one.** Microsoft's [SmartScreen reputation page](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation): "EV certificates no longer bypass SmartScreen". A signed file is still flagged "until its hash or publisher certificate accumulates sufficient evidence of positive reputation", which "can take several weeks and hundreds of clean installs". Reputation carries to new releases only under "the same publisher identity".
- **A bought certificate's key must be in hardware.** The CA/Browser Forum's [Code Signing Baseline Requirements](https://cabforum.org/working-groups/code-signing/requirements/) (3.11.0), §6.2.7.4.1: since 1 June 2023 the key sits in a hardware module (FIPS 140-2 Level 2 or Common Criteria EAL 4+) or a signing service. §6.3.2: a certificate issued from 1 March 2026 lasts at most 460 days.
- **Azure Artifact Signing** (formerly Trusted Signing) is a paid Azure subscription, Basic with 5,000 signatures a month ([pricing](https://azure.microsoft.com/en-us/pricing/details/artifact-signing/); the amount didn't render, so it wasn't recorded). Public-trust certificates are available to organisations in the United Kingdom, among others ([quickstart](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart)). Its certificates last three days, so every signature must be timestamped ([FAQ](https://learn.microsoft.com/en-us/azure/artifact-signing/faq)). Its [GitHub action](https://github.com/Azure/artifact-signing-action) runs only on Windows runners and signs in through OpenID Connect.
- **SignPath Foundation** signs open-source projects for free ([terms](https://signpath.org/terms)), but "The code signing certificate is issued to _SignPath Foundation_", so SignPath Foundation is shown as the publisher. Its conditions: "an OSI-approved Open Source license without commercial dual-licensing for all components"; no proprietary component; "Binary artifacts must be built from source code in a verifiable way"; "Every release needs manual approval for signing"; a "Code signing policy" on the home and download pages, with its credit line; multi-factor login for every team member on SignPath and GitHub. The Foundation is "under no obligation to accept your project". Its [GitHub integration](https://docs.signpath.io/trusted-build-systems/github) signs an artifact the workflow uploaded, and for open-source projects every job leading to the request must run on GitHub-hosted runners.
- **signtool alone isn't signing that Windows trusts.** The Windows SDK's signtool applies a signature with whatever certificate it is given; every option here uses it. A self-signed certificate is free but chains to no trusted root, so Windows still shows an unknown publisher and the SmartScreen warning.
- **The contributor agreement allows closed licences.** [`CLA.md`](../../CLA.md) §2 lets Singlbase license contributions "under any licence terms Singlbase chooses, including … licences that aren't open source" ([ADR-0017](0017-gpl-3-licence.md)): the commercial dual-licensing SignPath Foundation excludes, if Singlbase used it.

PO decisions on 2026-11-25:

- **Windows:** "no paid option please". The PO first chose "Stay unsigned for now"; then, after asking whether signtool could be used, "Reconsider SignPath (free)"; and on the dual-licensing condition, "Apply; no closed licences while signed".
- **Linux:** "GPG-sign SHA256SUMS + the rpm".
- **The GPG key:** "You create it; GitHub secret": the PO creates the key and keeps an offline backup; the release workflow reads it from a secret.

## Decision

**Singlbase applies to SignPath Foundation, and once accepted, the Windows releases are signed through it. Linux users check a release with a project GPG key: `SHA256SUMS` gets a detached signature, and the `.rpm` is signed with the same key.**

- **Windows:** the app's programs, the installer and its uninstaller are signed with SignPath Foundation's certificate and timestamped, from the release workflow. SignPath Foundation is shown as the publisher. The PO approves each signing request on SignPath.
- **No closed licences while signed:** Singlbase offers Apollo Download Manager under no licence that isn't open source for as long as SignPath Foundation signs it. The CLA's permission stays as it is; using it for a closed licence would first need a new decision and an end to SignPath signing.
- **Until SignPath accepts the project,** releases stay unsigned, as today. If it declines, Windows releases stay unsigned and this decision is revisited.
- **Linux:** each release adds `SHA256SUMS.asc`, a detached, ASCII-armoured signature over `SHA256SUMS`, which lists every file of the release, the Windows installer included. The `.rpm` carries an rpm signature by the same key, checked with `rpm -K`. The `.deb` gets no signature of its own: `apt` doesn't check one on a downloaded file, and `SHA256SUMS.asc` covers it.
- **The GPG key:** the PO creates it and keeps the only offline backup. Its private part is a GitHub secret of the `release` environment, which only `release.yml` on a release tag can read, never a pull request's workflow. Its public part and fingerprint are published in the repository and on the website. SignPath's API token is held the same way.
- **A signing failure fails the release.** No release is published half-signed.
- **The attestations stay.** They show which workflow built a file; the signatures let users check it without a GitHub account or `gh`.
- **No apt or dnf repository** for now. Revisit if users ask for updates through their package manager.

## Options considered

| Option | For | Against |
|---|---|---|
| Windows unsigned | No cost, nothing to renew, no outside approval | The SmartScreen warning stays; some antivirus products flag unsigned programs |
| signtool with a self-signed certificate | No cost | Windows doesn't trust it: an unknown publisher and the warning stay |
| Azure Artifact Signing | Singlbase's name as publisher; no key file; UK companies qualify | A monthly bill; identity check; still builds reputation over weeks |
| **SignPath Foundation (chosen)** | Free; a trusted signature, so reputation can build under one publisher | SignPath Foundation shown as publisher; manual approval per release; no closed licences; a policy section on the website; may be declined |
| A bought OV or EV certificate | Singlbase's name | Paid; the key in a hardware module or cloud HSM; renewal at most every 460 days; EV no longer skips SmartScreen |
| **Linux: GPG on `SHA256SUMS` and the rpm (chosen)** | Standard tools (`gpg`, `rpm -K`); covers every file | A key for the PO to keep safe and back up |
| Linux: attestations only | Nothing new to keep | Users need `gh` and GitHub to check |
| Linux: signed apt and dnf repositories | Updates through the package manager | Hosting and upkeep for a repository |

## Consequences

- **Windows users get a signed installer** once SignPath accepts the project. SmartScreen still warns at first, until the publisher builds reputation with downloads.
- **Singlbase gives up closed licences** of Apollo Download Manager while SignPath signs it.
- **The PO's work:** the SignPath application, an Approve click per release, two-factor login on GitHub and SignPath, and the GPG key and its backup. Losing the GPG key means a new key and a notice to users; a leak means revoking it at once.
- **The website** gets a "Code signing policy" section on its home and download pages, with SignPath's credit line, the team's roles and a privacy statement.
- **The Windows build order changes:** the programs are signed before the installer packs them, then the installer and uninstaller. Tauri's `bundle.windows.signCommand` or a signing step in the workflow does it; #429 chooses.
- **#429** builds both parts in the release workflow, documents the user's check in [RELEASE_PROCESS.md](../RELEASE_PROCESS.md) and the user guide, and publishes the public key.

## Follow-up

- The PO applies to SignPath Foundation; #429's Windows part starts once accepted.
- #429: the GPG signatures in the release workflow, once the PO has created the key and stored the secret.
- If SignPath declines or revokes, or Singlbase wants to offer a closed licence, this decision is revisited.
