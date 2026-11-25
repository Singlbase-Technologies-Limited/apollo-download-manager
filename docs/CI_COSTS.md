# CI costs and caching

What CI caches, and what its runs cost in minutes and storage. How CI selects and runs its jobs is in [CI.md](CI.md). Split from CI.md by #425.

## Caching

The repository gets **10 GB of Actions cache**, separate from artifact storage. GitHub evicts the least recently used entries above that ([billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)).

| Cache | Key | Contents | Size | Reasoning |
|---|---|---|---|---|
| Rust (Linux) | OS + toolchain + [`Cargo.lock`](../Cargo.lock) hash | Compiled **dependencies** only (`~/.cargo/registry`, `target/` without workspace crates) | **Measured in CI:** 319 MiB as saved (1.1 GiB of `target/` plus a 201 MiB registry before compression); locally 365 MiB with gzip | A cold build is most of a cold job (**measured:** 571 s for the clippy and test builds on 2 vCPUs). Workspace crates rebuild in seconds, so caching them would only add upload time and size |
| Rust (Windows) | Same | Same | **Assumed:** similar to Linux (not measured) | Windows minutes cost more ($0.010 against $0.006 a minute), so a cache hit saves more |
| Native libraries (#205), per OS | OS + hash of `scripts/native/**` (the build scripts, the lock file and the vcpkg manifest and ports) | [`target/native`](../target/native/): libcurl and its libraries, and libtorrent, Boost and OpenSSL from vcpkg | **Not measured yet** | Building Boost and libtorrent from source takes a large part of a job, so they are kept on their own, and saved even after a red run |
| pnpm store | — | **Not cached** | 147 MiB (Linux) | `pnpm install --frozen-lockfile` took **4 s** in CI (PR #104), less than a cache restore and save would cost (PO decision on #14) |

**Caching rules:**

- **Budget:** about 0.6 GB a platform when compressed, so Linux and Windows, with one previous key each during a lockfile change, use about 2.5 GB of the 10 GB.
- **Save on `main` only;** pull requests restore. A PR branch's cache is visible only to that branch, so saving it there would fill the 10 GB with copies.
- **Keys change only when the toolchain or lockfile changes,** so a cache uploads rarely.
- **No cache for Tauri system packages** (`apt`): they installed in **35 s** in CI (PR #104), about what restoring a cache of them would take.

**How it's wired (#14):**

- **Action:** GitHub's own `actions/cache/restore` and `actions/cache/save`, pinned by SHA. No third-party cache action is used, because any third-party action is a dependency that needs PO approval (AGENTS.md).
- **Setup:** the shared composite action [`.github/actions/setup`](../.github/actions/setup/action.yml) restores the cache for every job that builds Rust. When the exact key is missing, it falls back to the newest older key (`restore-keys`), so a dependency bump starts mostly warm.
- **Saving:** only [`main.yml`](../.github/workflows/main.yml), the Linux checks after each merge to `main`, saves the cache. It does so after a fully green run, when the exact key isn't cached yet, and after removing the workspace crates' artefacts.
- **The native libraries (#205):** a composite action of their own, [`.github/actions/native`](../.github/actions/native/action.yml), called by the setup action and by PR checks' Windows native job, restores [`target/native`](../target/native/). Only when that misses does it set up vcpkg: a clone of `microsoft/vcpkg` at the `builtin-baseline` commit of [`scripts/native/vcpkg/vcpkg.json`](../scripts/native/vcpkg/vcpkg.json), bootstrapped with `-disableMetrics`, with `VCPKG_DISABLE_METRICS=1`. Every job that builds them saves them right after its checks, whatever their result, so a rerun on the same branch skips the build. A cold build of Boost and libtorrent is why the Rust jobs may run up to 90 minutes (Windows Main checks 120); a warm one takes far less. GitHub restores a cache only on the branch that saved it or from the default branch, so a new branch builds them once unless a run on `main` saved them.
- **Cache scopes (#82):** the *Linux packages* workflow builds on Ubuntu 22.04, while the checks run on `ubuntu-latest`. Libraries built on the newer Ubuntu can need a newer glibc than 22.04 has, so its jobs pass the setup action's `cache-scope` input, and their keys read `rust-v1-Linux-ubuntu22.04-…` and `native-v1-Linux-ubuntu22.04-…`. It saves its native libraries as the *Windows installer* workflow does, one more native cache in the 10 GB (size not measured yet), and saves no Rust cache ([PACKAGING.md](PACKAGING.md#the-linux-packages)).
- **Release candidates use no cache (#233):** their packaging runs restore no Rust or native cache and save none (the setup action's `cold` input), so nothing an earlier run saved can reach an installer. CodeQL's cache-poisoning rules flagged the warm build. A candidate takes longer, about 30 to 60 minutes instead of 10 to 20 (an estimate from the cold native build of #205; not measured yet), and candidates are rare (PO decision, 2026-10-31). A packaging run started by hand still uses and saves the caches.
- **No incremental compilation in CI:** `CARGO_INCREMENTAL=0` keeps the cache smaller and CI builds faster.

**Runner disk.** A hosted Linux runner has about 14 GB free. A cold build of Boost and libtorrent plus `check:fast`'s debug build filled it twice (#76), so the Linux jobs that build Rust first delete toolchains Apollo Download Manager never uses (.NET, the Android SDK, GHC and CodeQL), about 20 GB.

### The post-merge tier

[`main.yml`](../.github/workflows/main.yml) has four jobs (#16):

| Job | Runs when | What it does |
|---|---|---|
| `select` | Always | `node scripts/ci-select.mjs --base <github.event.before>`: the same selection as a pull request, for what the merge changed. Also `check:links`, `check:product-name` and `check:guidance` |
| `linux` | Rust or frontend selected | With Rust, the SFTP test servers ([`scripts/ci-sftp-server.sh`](../scripts/ci-sftp-server.sh), #53). `check:pr --base <before>`, which runs the native build before any Rust check, then saves the Linux Rust cache when Rust ran and its key is new |
| `windows` | Windows-relevant paths changed (Rust, `scripts/`, CI files, unknown paths) | The OpenSSH Server feature if the image lacks it (#53), then `check:fast` on `windows-latest`, with its own Rust cache (key `rust-v1-Windows-<hash>`). It doesn't depend on `linux`, so a Linux-only failure doesn't stop it (scenario B of #91) |
| `summary` | Unless the run was cancelled | Combines the job reports into the run summary and `ci-diagnostics`, then opens, comments on or closes the tracking issue. It's the only job allowed to write issues |

A docs-only merge runs only `select` and `summary`.

**Manual runs:** `gh workflow run main.yml --ref <branch> [-f base=<commit>] [-f tracking-title="<title>"]`. They're for trying a change to this workflow. Without `base`, a manual run checks everything. A tracking title is for test runs only: on `main` the title is always `main is failing`, so a test run never touches the real issue.

### Packaging and release candidates

Three workflows are started by hand only, and run on no push or pull request, and a fourth by a release tag. They aren't checks:

- **Windows installer** ([`package-windows.yml`](../.github/workflows/package-windows.yml)) and **Linux packages** ([`package-linux.yml`](../.github/workflows/package-linux.yml)) build and check the packages of the branch they are started on ([PACKAGING.md](PACKAGING.md)).
- **Release candidate** ([`release-candidate.yml`](../.github/workflows/release-candidate.yml)) verifies a `main` commit, calls both packaging workflows for it (`workflow_call`, with the commit as `ref`), and assembles the candidate ([RELEASE_CANDIDATES.md](RELEASE_CANDIDATES.md)). A `vX.Y.Z-rc.N` tag starts it too. It needs `actions: read`, to find the commit's Main checks run.
- **Release** ([`release.yml`](../.github/workflows/release.yml)), on a `vX.Y.Z` tag: publishes an accepted candidate's files as a draft release, after the PO's approval in the `release` environment ([RELEASE_PROCESS.md](RELEASE_PROCESS.md#making-the-release)). Only its `draft` job may write (`contents: write`); `assemble` signs a provenance attestation (`id-token: write`, `attestations: write`).
- **Strict needs** (#91): in these four, a job runs only when every job it needs succeeded. No job condition uses `always()`, `!cancelled()`, `failure()` or `cancelled()`, and nothing uses `continue-on-error`; tests read the four files ([`scripts/release-candidate-lib.test.mjs`](../scripts/release-candidate-lib.test.mjs), [`scripts/release-lib.test.mjs`](../scripts/release-lib.test.mjs)). A step may still save a cache after a failed step, as the native libraries' does.
- **A new one can't be tried on a branch:** GitHub starts a hand-started workflow only from a file already on `main`, so each is first run after it merges.

## Costs

**Measured locally** (docs/DEVELOPMENT.md, 2026-10-21). A cold dependency build takes 278 s on Windows (16 logical CPUs) and 413 s on Linux (WSL2, 2 vCPUs, similar to a 2-vCPU hosted runner). A warm `check:fast` takes 5.5–9 s. A full `check:full` takes 224–249 s, of which 215–232 s is the release build.

**Measured in CI** (`ubuntu-latest`, 2 vCPUs, 2026-10-21). Every run of the PR tier and the first `main` run so far. Billed minutes are each job rounded up to a whole minute ([runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing)); a skipped job costs nothing.

| Run | Change | Cache | Wall time | Jobs (s) | Billed |
|---|---|---|---|---|---|
| [39657529808](https://github.com/Singlbase-Technologies-Limited/apollo-download-manager/actions/runs/39657529808) | PR #104, everything | none | 542 s | select 14, code 519, docs 31, ci-required 4 | 12 min |
| [39663435122](https://github.com/Singlbase-Technologies-Limited/apollo-download-manager/actions/runs/39663435122) | PR #104, everything | none | 566 s | select 21, code 536, ci-required 4 | 11 min |
| [39666333757](https://github.com/Singlbase-Technologies-Limited/apollo-download-manager/actions/runs/39666333757) | PR #105, everything | none | 505 s | select 21, code 476, ci-required 3 | 10 min |
| [39669208703](https://github.com/Singlbase-Technologies-Limited/apollo-download-manager/actions/runs/39669208703) | `main` after #105, all L1, **saved the cache** | none | 453 s | linux 453 | 8 min |
| [39670447026](https://github.com/Singlbase-Technologies-Limited/apollo-download-manager/actions/runs/39670447026) | demo #106, docs only | — | 32 s | select 25, ci-required 4 (`code` skipped) | 2 min |
| [39670571690](https://github.com/Singlbase-Technologies-Limited/apollo-download-manager/actions/runs/39670571690) | demo #107, one crate | warm | 113 s | select 12, code 92, ci-required 4 | 4 min |
| [39670483912](https://github.com/Singlbase-Technologies-Limited/apollo-download-manager/actions/runs/39670483912) | demo #108, [`Cargo.lock`](../Cargo.lock) (everything) | warm, via the fallback key | 181 s | select 22, code 150, ci-required 4 | 5 min |

- **Medians:**
  - Successful PR runs: **343 s** (6 runs).
  - Cold PR runs: **542 s**, 11 billed minutes.
  - Warm code PR runs: 113–181 s, **4–5 billed minutes**.
- **A cold `code` job:** about 1 min of setup (Node 7 s, Tauri packages 35 s, toolchain 9 s, `pnpm install` 4 s), then about 7.5 min of compiling (clippy about 280 s, tests about 140 s).
- **With the cache restored:** clippy takes 2–3 s and the tests 3–6 s. The cache is **319 MiB** (key `rust-v1-Linux-<hash>`, saved by `main`).
- **The rest is the 3 billed minutes** of fixed cost per code run: `select`, the setup inside `code`, and `ci-required`.
- **Failure collection (#91) adds no billed minutes.** A warm run with everything selected cost 4 billed minutes before and after it: [39671582041](https://github.com/Singlbase-Technologies-Limited/apollo-download-manager/actions/runs/39671582041) (PR #109) against [39676944320](https://github.com/Singlbase-Technologies-Limited/apollo-download-manager/actions/runs/39676944320) (PR #110). `ci-required` grew from 5 s to 17–19 s (checkout, Node, downloading the reports), still within its one billed minute.

**Measured on the post-merge tier** (#16, 2026-10-22; manual runs of `main.yml` on demo branches; Windows minutes count double):

| Run | Change | Jobs (s) | Billed |
|---|---|---|---|
| [39775990305](https://github.com/Singlbase-Technologies-Limited/apollo-download-manager/actions/runs/39775990305) | One crate, with a deliberate Linux-only test failure | select 24, linux 96 (failed), **windows 1084 (cold, no Windows cache yet)**, summary 23 | 42 min (Windows 38) |
| [39778706769](https://github.com/Singlbase-Technologies-Limited/apollo-download-manager/actions/runs/39778706769) | Docs only | select 28, summary 25 (`linux` and `windows` skipped) | 2 min |

**Still assumed** (no runs yet):

| Job | Cache | Duration | Basis |
|---|---|---|---|
| Post-merge Linux, warm | warm | 4 min billed | The warm `code` job plus about 1 min of setup |
| Post-merge Windows | warm | about 10 min billed | The cold run measured above was 18 min; the warm figure waits for the first run after `main` saves the Windows cache |
| Release candidate (Linux + Windows, with installers) | warm | 40 min | Two `check:full` runs plus bundling |
| Weekly full (Linux + Windows) | warm | 30 min | Two `check:full` runs |

**Monthly estimate at the current pace.** One agent, about 4 merged PRs a working day, so about 80 a month. About 3 CI runs per PR after cancellation; about a quarter of PRs are docs-only.

| Item | Runs a month | Billed minutes each | Minutes a month |
|---|---|---|---|
| PR checks, code (measured 4–5, warm) | 60 PRs × 3 = 180 | 5 | 900 |
| PR checks, docs-only (measured) | 20 PRs × 3 = 60 | 2 | 120 |
| Post-merge Linux | 80 | 4 | 320 |
| Post-merge Windows (Windows-relevant merges, assumed half; #16) | 30 | 10 | 300 |
| Weekly full | 4 | 30 | 120 |
| Cold-cache penalty (new [`Cargo.lock`](../Cargo.lock) or toolchain, assumed 8; cold `main` and PR runs) | 8 | +6 | 48 |
| Cold Windows post-merge (new [`Cargo.lock`](../Cargo.lock) or toolchain, assumed 8; measured 38 billed, about 28 above warm) | 8 | +28 | 224 |
| Release candidates (assumed 2) | 2 | 40 | 80 |
| **Total** | | | **≈ 2,110** |

**That is slightly over the 2,000-minute quota** once the measured cold Windows runs are counted (#16). The PR tier still dominates. Ways to bring it under:

1. **Push to the PR branch less often:** batch fixes before pushing. Cancellation discards superseded runs (demonstrated on demo #107), but a started job still costs its minutes.
2. **Run Windows post-merge on a daily batch** of the merged commits, instead of per merge. This saves up to 300 minutes, at the cost of slower Windows feedback.
3. **PO decisions:** a payment method or plan change (then overage is billed instead of blocked), or making the repository public (standard runners are free; #90).

**Windows minutes:** the runner pricing page lists only dollar rates and states no multiplier against the included minutes. Until the first Windows run shows its effect on the usage report, budget Windows as if it counted double. Then the Windows line above becomes 600 minutes, and the total about 2,190, over the quota.

**Artifact storage is 500 MB** (shared with Packages). Retention is set per upload:

- 7 days for diagnostics and logs;
- 14 days for release-candidate installers;
- releases go to GitHub Releases, which don't count as Actions artifacts.

The repository default is 90 days ([retention](https://docs.github.com/en/organizations/managing-organization-settings/configuring-the-retention-period-for-github-actions-artifacts-and-logs-in-your-organization)) and is too long for 500 MB.

**Watching the quota:** check usage in the account's billing settings at least weekly while the CI tiers are new. #14 records the first measured month and updates the tables above.
