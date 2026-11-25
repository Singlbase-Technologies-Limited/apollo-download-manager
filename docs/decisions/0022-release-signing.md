# ADR-0022: Windows releases stay unsigned for now; Linux users check a GPG signature

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
- **SignPath Foundation** signs open-source projects for free ([terms](https://signpath.org/terms)), but "The code signing certificate is issued to _SignPath Foundation_", so SignPath Foundation is shown as the publisher. Every release needs a manual approval, the home and download pages need a "Code signing policy", the project may have no "commercial dual-licensing", every team member uses multi-factor login, and the Foundation may decline a project.

PO decisions on 2026-11-25:

- **Windows:** "no paid option please", then "Stay unsigned for now" (rather than SignPath Foundation).
- **Linux:** "GPG-sign SHA256SUMS + the rpm".
- **The GPG key:** "You create it; GitHub secret": the PO creates the key and keeps an offline backup; the release workflow reads it from a secret.

## Decision

**Windows releases stay unsigned for now. Linux users check a release with a project GPG key: `SHA256SUMS` gets a detached signature, and the `.rpm` is signed with the same key.**

- **Windows:** no change. The installer and its files stay unsigned, and the SmartScreen steps stay in the user guide. Revisit before 1.0.0 (#78).
- **Linux:** each release adds `SHA256SUMS.asc`, a detached, ASCII-armoured signature over `SHA256SUMS`, which lists every file of the release, the Windows installer included. The `.rpm` carries an rpm signature by the same key, checked with `rpm -K`. The `.deb` gets no signature of its own: `apt` doesn't check one on a downloaded file, and `SHA256SUMS.asc` covers it.
- **The key:** the PO creates it and keeps the only offline backup. Its private part is a GitHub secret of the `release` environment, which only `release.yml` on a release tag can read, never a pull request's workflow. Its public part and fingerprint are published in the repository and on the website.
- **A signing failure fails the release.** No release is published half-signed.
- **The attestations stay.** They show which workflow built a file; the GPG signature lets users check it without a GitHub account or `gh`.
- **No apt or dnf repository** for now. Revisit if users ask for updates through their package manager.

## Options considered

| Option | For | Against |
|---|---|---|
| **Windows unsigned for now (chosen)** | No cost, nothing to renew, no outside approval | The SmartScreen warning stays; some antivirus products flag unsigned programs |
| Azure Artifact Signing | Singlbase's name as publisher; no key file; UK companies qualify | A monthly bill; identity check; still builds reputation over weeks |
| SignPath Foundation | Free | SignPath Foundation shown as publisher; manual approval per release; rules on licensing and the website; may be declined |
| A bought OV or EV certificate | Singlbase's name | Paid; the key in a hardware module or cloud HSM; renewal at most every 460 days; EV no longer skips SmartScreen |
| **Linux: GPG on `SHA256SUMS` and the rpm (chosen)** | Standard tools (`gpg`, `rpm -K`); covers every file | A key for the PO to keep safe and back up |
| Linux: attestations only | Nothing new to keep | Users need `gh` and GitHub to check |
| Linux: signed apt and dnf repositories | Updates through the package manager | Hosting and upkeep for a repository |

## Consequences

- **Linux users can check a download** with `gpg --verify SHA256SUMS.asc SHA256SUMS`, then `sha256sum -c`, and an rpm with `rpm -K`.
- **The PO keeps a key safe:** losing it means a new key and a notice to users; a leak means revoking it at once.
- **Windows users still see SmartScreen**, and the user guide keeps explaining it.
- **#429** builds the Linux part in `release.yml`, documents the user's check in [RELEASE_PROCESS.md](../RELEASE_PROCESS.md) and the user guide, and publishes the public key. Its Windows part waits for a new decision.

## Follow-up

- #429: GPG signatures in the release workflow, once the PO has created the key and stored the secret.
- Revisit Windows signing before 1.0.0 (#78), or sooner if users are blocked by SmartScreen or antivirus products, or if a free option names Singlbase as publisher.
