# Dependency policy

Every third-party component Apollo Download Manager builds with or ships is approved, pinned, verified, recorded and credited in its notices. This page is the policy (#9). What the licences require is assessed in [LICENSING.md](LICENSING.md).

The register of approved dependencies and native libraries is in [APPROVED_DEPENDENCIES.md](APPROVED_DEPENDENCIES.md).

The rule in [AGENTS.md](../AGENTS.md#engineering) is short: **a new crate, npm package, native library, service or background process needs Product Owner approval.** This page says what that approval needs, and what happens afterwards.

## What counts as a dependency

| Kind | Examples | Pinned by |
|---|---|---|
| Rust crates | `tauri`, `serde`; later `curl`, `curl-sys` | [`Cargo.toml`](../Cargo.toml) (direct) and the committed [`Cargo.lock`](../Cargo.lock) (everything) |
| npm packages, installed with pnpm | `react`, `@tauri-apps/api`, `vite`, `vitest` | [`package.json`](../package.json) (direct) and the committed [`pnpm-lock.yaml`](../pnpm-lock.yaml); CI uses `pnpm install --frozen-lockfile` |
| Native libraries, linked or bundled | libcurl, nghttp2, zlib, a TLS library, possibly libssh2, libtorrent, Boost, OpenSSL | The native lock file [`scripts/native/deps.lock`](../scripts/native/deps.lock) (below; #35) |
| Toolchains | Rust 1.99.1, Node.js 24.12.0, pnpm 12.14.0 | [`rust-toolchain.toml`](../rust-toolchain.toml), `packageManager` in [`package.json`](../package.json), and the Node version in the workflows |
| GitHub Actions | `actions/checkout`, `actions/cache` | A full commit SHA in the workflows ([CI.md](CI.md#permissions-and-supply-chain)) |
| Developer tools, not shipped | cargo-deny 0.20.2 (MIT OR Apache-2.0, released 2026-07-09, Embark Studios; PO, #75) for `pnpm check:advisories` | The version in [`scripts/check-advisories.mjs`](../scripts/check-advisories.mjs) and [`.github/workflows/advisories.yml`](../.github/workflows/advisories.yml); installed with `cargo install cargo-deny --locked --version 0.20.2` |
| Services and background processes | The extension store accounts, held by the PO for Singlbase: the Chrome Web Store (publisher Singlbase Technologies Limited), Microsoft Edge Add-ons (Partner Center) and Firefox Add-ons (AMO). They publish the browser extension; the app talks to none of them, and only opens a store page when the user asks ([ADR-0020](decisions/0020-extension-store-distribution.md), #240) | The listings, and the IDs and links in [`branding.json`](../branding.json) |

## Approving a new dependency

**Who:** the Product Owner approves every new **direct** dependency, every new native library, toolchain, service or background process, and every exception to this policy. An agent or contributor proposes; the PO decides (AGENTS.md).

**When:** before the code that uses it is merged, in the issue or the PR that introduces it. A new major version of a direct dependency counts as a new approval.

**The request states:**

1. **Need:** what it's for, and why the current stack can't do it. Check first that nothing already in [`Cargo.lock`](../Cargo.lock) or [`pnpm-lock.yaml`](../pnpm-lock.yaml) does the job (AGENTS.md, "Reuse before you add").
2. **Licence:** the SPDX expression, and for an `OR` licence, the option Apollo Download Manager uses. Compare it with the allowed list below.
3. **Maintenance:** the latest release and its date, recent activity, and the maintainers.
4. **Security:** known advisories (RustSec, GitHub advisories, the vendor's own list such as curl's) and how fixes are released.
5. **Weight:** the transitive dependencies it adds (`cargo tree -p <crate>`, `pnpm why <package>`), and native build requirements.
6. **Platforms:** Windows, Linux and macOS support.
7. **For native libraries:** the exact source (official release URL), version, SHA-256, signature status and build options. A wrapper crate's version **doesn't prove** the native version it bundles: `curl-sys` 0.4.91 bundles curl 8.22.0 (research report, section 8.1).

**After approval:** add the dependency to the [register](APPROVED_DEPENDENCIES.md#approved-direct-dependencies) in the same PR.

**Transitive dependencies** don't need individual approval, but they must pass the licence rules below. The notices generator lists every one, and `pnpm check:notices` fails on any that don't ([LICENSING.md](LICENSING.md#third-party-notices), #76).

## Allowed licences

| Licence class | Licences | Rule |
|---|---|---|
| **Permissive: allowed** | MIT, MIT-0, Apache-2.0 (with or without LLVM-exception), BSD-2-Clause, BSD-3-Clause, ISC, Zlib, 0BSD, Unlicense, CC0-1.0, BSL-1.0, BlueOak-1.0.0, Unicode-3.0, the curl licence | Allowed; credited in the notices. MIT-0 and BlueOak-1.0.0 were added by the PO on #29 (2026-10-29) |
| **Fonts: allowed unmodified** | OFL-1.1 | Only for a font used as it is published. Its licence text goes in the notices. The font is never sold on its own, and a modified copy would need another name (PO decision on #29, 2026-10-29) |
| **Data for build tools: allowed** | CC-BY-4.0 | Only in a build tool's data that isn't shipped: today `caniuse-lite`, the browser data the CSS tools read (PO decision on #29, 2026-10-29) |
| **Build tools only: allowed** | PSF-2.0 | Only in a build tool that isn't shipped: today `argparse`, which reads the command line of `markdown-it`'s own tool, never run by Apollo DM (PO decision on #354, 2026-11-06) |
| **File-level copyleft: allowed unmodified** | MPL-2.0 | Allowed as a transitive dependency when used unmodified (today: Tauri's CSS stack), and as the test tool `axe-core`, unmodified and not shipped (PO decision on #426, 2026-11-17). Modifying one needs PO approval, and the changed files must be published |
| **Copyleft: PO approval required** | LGPL-2.1/3.0, GPL-2.0/3.0, AGPL-3.0, EPL, CDDL | Never added without explicit PO approval and a licensing note in [LICENSING.md](LICENSING.md). The website leaves out the ELK layout Mermaid bundles (EPL-2.0 OR GPL-3.0-or-later; PO decision on #484, 2026-11-25). For an `OR` licence offering a permissive option (for example `MIT OR Apache-2.0 OR LGPL-2.1-or-later`), Apollo DM uses the permissive option |
| **Unknown or custom** | A missing licence, "see LICENSE", a proprietary EULA | Treated as not allowed until the PO approves after review |

**No aria2:** Apollo Download Manager never includes aria2 or its source ([ADR-0001](decisions/0001-v2-direction.md)), so its GPL obligations don't arise for Apollo Download Manager.

## Pinning and updates

- **Lockfiles are committed and authoritative.** [`Cargo.lock`](../Cargo.lock) and [`pnpm-lock.yaml`](../pnpm-lock.yaml) change only in a PR that says why. Changing either selects every CI check ([CI.md](CI.md#selecting-jobs)).
- **Toolchains are pinned exactly.** A change is its own PR with a full `pnpm check:full` run.
- **GitHub Actions are pinned to full SHAs.** Dependabot proposes updates monthly, grouped into one PR ([CI.md](CI.md#permissions-and-supply-chain)).
- **Rust and npm updates aren't automated,** except Dependabot's security-fix PRs (PO decision on #75). Each update is a PR stating the reason (a fix, an advisory, a needed feature), with the full check level. Advisory monitoring and response times are in [SECURITY.md](SECURITY_SUPPLY_CHAIN.md#dependency-advisories-75).
- **Native libraries** are updated only by changing the native lock file, never by fetching "latest" at build time.
