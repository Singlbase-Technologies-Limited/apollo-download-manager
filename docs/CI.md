# CI design

Apollo Download Manager's CI runs on GitHub Actions. Since 2026-10-31 the repository is public, owned by Singlbase Technologies Limited, and GitHub's standard runners are free for public repositories ([billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)). It was designed for a private repository with a monthly quota of minutes, so every design choice below still keeps runs short: the checks that matter run on every change, and nothing runs twice. The cost figures below are from those private months.

Caching and the costs of CI runs are in [CI_COSTS.md](CI_COSTS.md).

This page is the design. The workflows are written in #13, #14, #16 to #19 and #91. Every figure below is labelled as **measured** or **assumed**. Assumed CI times get replaced by measured ones as the jobs start running (#14).

## History: CI by hand only (2026-10-24 to 2026-10-31)

To save Actions minutes while the repository was private, CI was paused (2026-10-24, #173), then run only by hand, once per batch of five issues on a `batch/` branch, with no tests on the developer's machine (2026-10-30, #204), then not at all while Apollo Download Manager was made ready to publish (2026-10-31). On 2026-10-31 the repository went public, so its minutes are free, and the triggers below came back (#236). The batch runs are cited in some PRs and code comments by their run numbers.

## Tiers

| # | Event | What runs | Platforms | Purpose | Built in |
|---|---|---|---|---|---|
| 1 | `pull_request` into `main` (opened, synchronised, reopened) | L1 for the selected areas, plus L2 for those areas. Docs-only changes run only the docs job | Linux | Fast feedback before review. One aggregate check, `ci-required`, summarises it | #13, #14, #91 |
| 2 | `push` to `main` (that is, after a squash merge) | Selected like the PR tier, against the commit `main` was at before the push ([`main.yml`](../.github/workflows/main.yml)). **Linux:** the L1 checks the merge needs (`check:pr`), then save the Rust cache. **Windows:** every L1 check (`check:fast`) when Windows-relevant paths changed (below). The docs and guidance checks always. A red run opens the tracking issue ([below](#when-main-breaks)) | Linux, Windows | Catch what the PR tier deliberately left out, on Windows too, before a release candidate is built from `main`, and keep the PR caches warm | #14, #16 |
| 3 | `workflow_dispatch` on a commit, or a `v*-rc.*` tag | Everything runnable (`check:full` and the L2 suites) plus installers | Linux, Windows; macOS once #83 establishes it | A downloadable, labelled release-candidate build from a verified `main` commit | #17 |
| 4 | `v*` tag (not `-rc`) | The release gate: it rechecks that the tag's commit passed tier 3, then builds artefacts with provenance into a **draft** release | Linux, Windows | Prepare a release the PO publishes by hand | #18 |
| 5 | `schedule` (weekly) and `workflow_dispatch` | L4: everything on Linux and Windows. Later also fuzzing, stress and extended benchmarks. macOS on demand only | Linux, Windows; macOS manual | Catch slow drift and run what's too expensive per change | #19 |

**The website** has a workflow of its own, [`site.yml`](../.github/workflows/site.yml): it builds the site on pull requests that change its sources, and builds and deploys it on `main` and when a release is published ([WEBSITE.md](WEBSITE.md#publishing)).

**No `develop` or `staging` tiers.** All work merges into `main`, and releases are tags on verified `main` commits ([DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md)).

**Required checks.** The *Main* ruleset requires a pull request and linear history, and blocks deleting `main` and force-pushing to it ([REPOSITORY_SETTINGS.md](REPOSITORY_SETTINGS.md#rules-for-the-main-branch)). `ci-required` becomes a required status check once PR checks have run on a pull request since they came back (#236): GitHub only offers a check it has seen. Until then:

- **"Required" means by convention:** the PO merges only when `ci-required` is green (docs/REVIEWING.md).
- **The release gate is a person:** only the PO pushes `v*` tags or starts a release run (an ask rule in [`.claude/settings.json`](../.claude/settings.json) stops the agent from doing it unprompted). The workflow creates a *draft* release, never a published one.
- **Next:** the PO adds `ci-required` as a required status check in the Main ruleset ([REPOSITORY_SETTINGS.md](REPOSITORY_SETTINGS.md#when-something-changes)).

## Selecting jobs

Selection extends the rules `pnpm check:pr` already uses, in [`scripts/checks-lib.mjs`](../scripts/checks-lib.mjs). The same code decides locally and in CI, so the two can't drift apart (#13).

- **Fail-safe:** these select everything:
  - lockfiles ([`Cargo.lock`](../Cargo.lock), [`pnpm-lock.yaml`](../pnpm-lock.yaml));
  - **native lock files anywhere**, even inside a crate (`*.lock`, `vcpkg.json`);
  - shared configuration ([`Cargo.toml`](../Cargo.toml), [`package.json`](../package.json), [`rust-toolchain.toml`](../rust-toolchain.toml)…);
  - the check scripts (`scripts/`), [`.github/`](../.github/) and [`.claude/`](../.claude/);
  - **any path no rule knows**, such as a `package-lock.json`, which Apollo Download Manager doesn't use.
- **Crates:** a change inside a crate selects that crate and every crate that depends on it.
- **Frontend:** frontend paths select `tsc`, ESLint and Vitest.
- **Docs only:** `docs/` and root `*.md` select only the docs job (`pnpm check:links`: relative links and heading anchors).
- **Native builds (#35):** the Windows native job runs only for the native inputs ([`scripts/native/`](../scripts/native/), [`crates/velocity-curl/`](../crates/velocity-curl/), [`.cargo/`](../.cargo/), and native lock files other than [`Cargo.lock`](../Cargo.lock) and [`pnpm-lock.yaml`](../pnpm-lock.yaml)), for [`.github/`](../.github/), and for paths no rule knows. On Linux, the `code` job builds the native libraries itself before its Rust checks. Other shared files, such as [`Cargo.lock`](../Cargo.lock) or another check script, don't select them: the builds take minutes, and Windows minutes bill double ([BUILDING_NATIVE.md](BUILDING_NATIVE.md)).
- **Windows-relevant paths (tier 2):**
  - every Rust crate, `src-tauri/`, [`Cargo.lock`](../Cargo.lock), [`rust-toolchain.toml`](../rust-toolchain.toml);
  - `scripts/`, since the check runner has Windows-specific code paths;
  - packaging configuration;
  - and, as always, unknown paths.

  Frontend-only and docs-only merges skip Windows, because a WebView difference is caught by the release-candidate tier instead.
- **Every selection prints its reasons** in the job log, as `check:pr` does locally. A job that wasn't selected is reported as **NOT RUN**, never as passed.

Saving minutes never removes a relevant correctness or security test. When in doubt, the selector selects more.

### How the PR tier applies it

The PR tier is implemented in [`.github/workflows/pr.yml`](../.github/workflows/pr.yml) (#13):

| Job | Runs when | What it does |
|---|---|---|
| `select` | Always | `node scripts/ci-select.mjs --base <PR base>` writes `rust`, `frontend`, `docs` and `native` flags to its outputs. It adds a table to the **run summary** with every job, *runs* or *skipped*, the reason for each, and the reason for each changed path. When docs are selected, the same job runs `node scripts/check-links.mjs` as a step |
| `select`: product-name step | Always | `node scripts/check-product-name.mjs` (#421, [TESTING.md](TESTING.md)): no `V2` for the product in what people read. Under a second, and a source change counts as much as a document, so it isn't selected by path |
| `select`: guidance step | Always | `node scripts/check-guidance.mjs` ([AGENT_GUIDANCE.md](AGENT_GUIDANCE.md)). Under a second, and any path can change its result (a deleted folder kills a rule's glob), so it isn't selected by path |
| `code` | Rust or frontend selected | `pnpm check:pr`, the same command as locally. With Rust, [`scripts/ci-sftp-server.sh`](../scripts/ci-sftp-server.sh) first installs OpenSSH if needed and starts the password-login SFTP server the SFTP tests use (#53). Tauri system packages and the pinned toolchain are installed only when Rust is selected. With Rust, `check:pr` builds the native libraries first (reused from the `target/` cache that `main` saves), and the job uploads `build-info-linux` |
| `native-windows` | Native inputs, CI files or unknown paths changed | On `windows-latest`: `node scripts/native/build.mjs` (verifies every source, builds, checks `curl -V` against the lock file), uploads `build-info-windows` (7 days), then `cargo test -p velocity-curl`, which links the build and runs the start check and the TLS tests, and then the Windows certificate-store test (`--test windows_store -- --ignored`), which needs the runner's administrator rights ([SECURITY_NETWORK.md](SECURITY_NETWORK.md#the-windows-certificate-store), #69). No cache |
| `ci-required` | Unless the run was cancelled (`if: ${{ !cancelled() }}`) | Passes only if `select` succeeded, and `code` and `native-windows` each succeeded or were skipped by the selection. It writes its own table to the run summary. A run superseded by a newer push is cancelled whole and reports nothing; `always()` would report a false failure there |

**Why so few jobs.** GitHub bills every job's time **rounded up to a whole minute** ([runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing)), and every job repeats checkout and setup. So Rust and frontend share the `code` job, and the one-second docs check runs inside `select`. A docs-only PR then costs 2 billed minutes (`select` and `ci-required`), and a code PR costs the `code` job plus 2.

**Skipped jobs and required checks.** A job skipped by an `if:` condition reports *Success*, while a workflow skipped by path filters leaves a required check *Pending* forever ([troubleshooting required checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks)). So the workflow never uses `on.paths`, and `ci-required` reports on every run that isn't cancelled. That keeps it usable as a required check if branch protection becomes available (#7).

**Selection errors fail the run.** If `ci-select.mjs` can't compute the change (for example, missing history), it exits non-zero rather than guessing, and `ci-required` fails.

## When main breaks

`main` must stay releasable (DEVELOPMENT_WORKFLOW.md):

- **Visible within the run:** a red `main` run opens the issue **"main is failing"**. It holds the failing checks with their first error, the run link and this policy ([`scripts/ci-main-status.mjs`](../scripts/ci-main-status.mjs)). While the issue is open, each further red run comments on it, and the next green run closes it.
- **The policy:** fix forward with a `fix/` PR, or revert the offending squash commit through a PR, within one working day (*project judgment*). The tracking issue is where that is coordinated.
- **A missing report counts as red:** if a run leaves no `ci-diagnostics` report, the issue still opens, saying so. A broken run is never silent.

## Cancelling and de-duplicating

- **Superseded PR runs are cancelled.** Each workflow sets `concurrency: { group: <workflow>-<PR or ref>, cancel-in-progress: true }` for pull requests ([concurrency](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs)). Runs on `main` and on tags are never cancelled: each commit's result matters.
- **No duplicate runs for one commit.** Pull-request checks trigger on `pull_request` only, and `push` triggers only for `main` and tags. A branch push therefore doesn't run CI a second time beside its PR.
- **Path filters live in the selector,** not in `on.paths`. Then the aggregate `ci-required` check always reports, instead of being missing when a workflow is skipped.

## Permissions and supply chain

GitHub's guidance is in [secure use](https://docs.github.com/en/actions/reference/security/secure-use):

- **Read-only by default.** Every workflow declares `permissions: contents: read`, and a job raises only what it needs (for example `contents: write` for the draft-release job in #18).
- **Pinned actions.** Third-party actions are pinned to a **full commit SHA**, with the version in a comment. GitHub's own `actions/*` are pinned the same way, for consistency.
- **Dependabot** updates the pins: [`.github/dependabot.yml`](../.github/dependabot.yml) checks the workflows and the composite action **monthly**, grouped into **one PR**, so an update costs one CI run. Each update is an ordinary PR the PO reviews. For Cargo and npm, Dependabot opens security-fix PRs only, no routine version updates (PO decision on #75); other dependency changes need PO approval (#9).
- **No `pull_request_target`** that checks out PR code. No secrets in PR workflows.
- **Untrusted text stays out of commands.** Titles, branch names and other user-controlled strings never go straight into `run:` scripts; they pass through environment variables.
- **Third-party notices** (#76): the Select jobs job of PR checks and Main checks runs `pnpm check:notices` whenever Rust is selected, which every lockfile change does, so a failure stops the run before the long checks. It fails on a licence outside the allowed list and on a [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) that no longer matches the dependency graphs ([LICENSING.md](LICENSING.md#third-party-notices)). Once, on Linux: the graphs cover every target platform. Dependabot's PRs fail it, because Dependabot doesn't regenerate the file; how they're handled is in [SECURITY.md](SECURITY_SUPPLY_CHAIN.md#dependency-advisories-75).
- **Self-hosted runners:** none. If one is ever added (PO decision), it never runs code from a fork.

## Collecting failures

Every run completes every check that can still run, and reports all failures in one place (#91). The details are in [CI_DIAGNOSTICS.md](CI_DIAGNOSTICS.md).

**The quick checks come first** (PO decision on #76, 2026-10-30). The docs, product-name, guidance and notices checks run in the `select` job and take about a minute. When one fails, the Linux and Windows jobs don't start, and the summary reports them BLOCKED by `select`. The run ends in about a minute instead of 30 to 40, so a broken link costs a minute to find, not a whole run. Fix it and run again; the code checks then run. Until #76, the code jobs ran even after a failed docs check, so that one broken link wouldn't hide every code failure (#91).

- **Checks run to completion:**
  - The check runner runs every check even after one fails.
  - Clippy uses `--keep-going` and `cargo test` uses `--no-fail-fast`.
  - Report and summary steps use `if: ${{ !cancelled() }}`.
  - Mandatory checks never use `continue-on-error`, which would turn a failure into a success.
  - Cross-platform matrices (#16, #17, #19) use `fail-fast: false`.
- **Infrastructure problems are reported as INFRA,** separately from code defects. That covers a failed checkout, toolchain install, cache restore or `pnpm install`, and a job that died before reporting. A check that couldn't run because its prerequisite failed is **BLOCKED**, with the prerequisite named.
- **One consolidated report.** `ci-required` (PRs) and the `main` job publish a table in the run summary and the `ci-diagnostics` artifact (`ci-diagnostics.json`). The run fails unless every mandatory check passed or was deselected. The `/ci-triage` skill reads it.
- **Gated jobs stay strict.** Packaging and release jobs (#17, #18) keep the default `needs` semantics, so nothing is built for release after a failed check.

## L4 schedule

| Run | When | Content | Platforms |
|---|---|---|---|
| Weekly full | Mondays 03:00 UTC, only if `main` changed since the last run | `check:full`, all L2 suites | Linux, Windows |
| Fuzzing, stress, extended benchmarks | Weekly, staggered, once the suites exist (#73, #77) | Time-boxed per target, with a fixed seed recorded | Linux |
| macOS | `workflow_dispatch` only | `check:full` | macOS (#83) |
| Advisories ([`advisories.yml`](../.github/workflows/advisories.yml), #75) | Mondays 04:00 UTC, and by hand (`workflow_dispatch`) | `pnpm check:advisories`: cargo-deny and pnpm audit against the lockfiles ([SECURITY.md](SECURITY_SUPPLY_CHAIN.md#dependency-advisories-75)) | Linux |

macOS minutes cost about 10 times Linux ($0.062 against $0.006 a minute), so macOS never runs on a schedule or per change until it's an established platform and the quota allows it.
