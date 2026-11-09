# ADR-0017: V2 is licensed GPL-3.0-only, owned by Singlbase Technologies Limited, with contributions under a CLA

- **Status:** Accepted
- **Date:** 2026-10-31
- **Decided by:** the Product Owner
- **Issue:** #86

## Context

Apollo Download Manager couldn't be distributed or made public without a licence of its own (#86). The PO wants Apollo Download Manager open-sourced before its first release, so that it stays open and its CI minutes become free (#90), and wants it owned by the company.

- **Third-party components:** everything Apollo Download Manager ships is under a permissive licence, or MPL-2.0 used unmodified ([LICENSING.md](../LICENSING.md), [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md)). OpenSSL 3.5 is under Apache-2.0, which GPL-3.0 accepts. With aria2 gone (ADR-0001), nothing constrains Apollo Download Manager's own choice.
- **Not verified:** no legal review was done. The options were explained to the PO in plain words as the common understanding of each licence, not as legal advice.

## Decision

- **Licence:** the GNU General Public License, version 3 only (SPDX `GPL-3.0-only`). Anyone who distributes a changed Apollo Download Manager must publish its source under the same licence.
- **Copyright holder:** Singlbase Technologies Limited. The notice reads `Copyright (C) 2026 Singlbase Technologies Limited`.
- **Version 3 only,** not "or later": Singlbase, not the Free Software Foundation, decides whether a future GPL version applies.
- **Contributions** from outside Singlbase come under a Contributor Licence Agreement with Singlbase (`CLA.md`, #90), so Singlbase keeps the right to offer Apollo Download Manager under other terms as well.
- **Where it is stated:** `LICENSE` (the licence's full text), `package.json` and the workspace `Cargo.toml` (`license`), the packages' metadata, the installers (which install `LICENSE`), the app's About screen (the notice GPL-3.0's section 5(d) asks an interactive program to show), and the README.

## Options considered

| Option | For | Against |
|---|---|---|
| A. MIT | The most permissive and simplest | Anyone may make a closed product from Apollo DM; no patent terms |
| B. Apache-2.0 | Permissive, with a patent grant | As MIT: Apollo DM could be closed by others |
| C. **GPL-3.0** | Every distributed change stays open; patent terms | Companies that want closed products avoid it, so fewer may contribute |
| D. MPL-2.0 | Changes to Apollo DM's own files stay open | Apollo DM could be part of a closed product |
| E. GPL-3.0-or-later | The FSF's recommendation | Hands the choice of future terms to the FSF |
| F. DCO instead of a CLA | Lighter for contributors | Singlbase couldn't offer other terms once others' code is in |

## Consequences

- **Apollo Download Manager can be published,** and distributed as free software, once #90's checks are done.
- **A distributed Apollo Download Manager must offer its source:** the repository, once public, is that offer. Installers carry `LICENSE`, and the About screen says where the licence is.
- **Every library added later** must be under a licence GPL-3.0 accepts; [DEPENDENCIES.md](../DEPENDENCIES.md)'s allowed list already holds only those.
- **Contributors sign the CLA** before their first contribution is merged ([CONTRIBUTING.md](../../CONTRIBUTING.md)).
- **Closed source is no longer Apollo Download Manager's default:** the README's "All rights reserved until then" is replaced.

## Follow-up

- #90: the CLA, the community files and the checks before publication.
- A legal review of the CLA's wording before the first outside contribution is merged.
