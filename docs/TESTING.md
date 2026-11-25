# Testing and verification levels

Apollo Download Manager replaces aria2 with its own transfer engine, so its correctness rests on its own tests. This page is the test strategy (#15):

The fixtures, test servers and tools, the special kinds of test, and the measured build times are in [TEST_FIXTURES.md](TEST_FIXTURES.md).

- **Levels L1–L5:** what each proves, and how long it takes.
- **The test pyramid,** and which issue builds each layer.
- **Fixtures:** the rules, and the local servers Apollo Download Manager needs.
- **Platform reporting:** how results are reported per platform.

All check commands run every check even after one fails, print a PASS/FAIL summary with timings, and exit non-zero if anything failed. They run tools directly, never through a shell.

## Levels and commands

| Level | Command | Scope | Typical duration | When it runs |
|---|---|---|---|---|
| **L1** | `pnpm check:fast` | Whole workspace: the native libraries (`native:build`, reused when up to date; [BUILDING_NATIVE.md](BUILDING_NATIVE.md)), `cargo fmt --check`, `cargo clippy --workspace --all-targets --keep-going -D warnings`, `cargo test --workspace --no-fail-fast`, the browser registration's tests as the installed app has them (`cargo test -p velocity-core --features release-identity --lib browser::registration`; #315), `tsc --noEmit`, ESLint (zero warnings), Vitest | **Measured:** 5.5–9 s warm, 14 s after a one-file Rust change (Windows; DEVELOPMENT.md). The first run after a clean clone takes 2–3 min | Locally before every PR; in CI on every merge to `main` |
| **L2** | `pnpm test:focused -- <area> [args]` | The tests of one area. A crate runs `cargo test -p <crate> [args]`, unit and integration tests; `frontend` runs `vitest run src`; `scripts` runs `vitest run scripts`; `extension` runs `vitest run browser-extension`. Protocol and fixture suites run here for their crate once they exist | Seconds for today's unit tests; protocol suites will be measured when they arrive | While iterating (Red–Green–Refactor); in CI as part of the selected areas |
| **L3** | `pnpm check:pr [--base <ref>]` | The L1 and L2 checks that the branch's changes need, selected from every path changed since the merge base with `origin/main` | **Measured in CI:** 2 billed min for docs-only, 4–5 for code with a warm cache; locally like L1 | Before pushing; CI's PR tier runs it ([CI.md](CI.md)) |
| **L4** | `pnpm check:full`; later the cross-platform, end-to-end, fuzz, stress and benchmark suites | Every L1 check, then `vite build` and `cargo build --workspace --release` (LTO, one codegen unit), and since #46 the engine's examples for release, so a test-only feature can't break them unseen. `pnpm test:e2e:layout` (#59): the window's layout in a real Chromium, run on its own. Later: browser end-to-end (#64), fuzzing (#73), stress and resource bounds (#77), benchmarks (#20, #21), macOS (#83) | **Measured:** 224–249 s locally, mostly the release build; suites to be measured | Before a release candidate, after build-setting changes, and weekly in CI (#19) |
| **L5** | Production acceptance (none yet) | Installed builds on real machines: install and upgrade beside V1 (#81), parity with V1 (#85), soak runs (research report section 7, at least 300 runs per key scenario), release-readiness review ([RELEASE_READINESS.md](RELEASE_READINESS.md), #78) | Hours to days | Before a release is published |

**In CI** ([CI.md](CI.md)): pull requests run `pnpm check:pr` for the selected areas, and every merge to `main` runs `pnpm check:fast`, `pnpm check:links`, `pnpm check:product-name` and `pnpm check:guidance` on Linux. Every run publishes one report with every failure ([CI_DIAGNOSTICS.md](CI_DIAGNOSTICS.md)).

For documentation, `pnpm check:links` checks that every relative link and heading anchor in the repository's Markdown files resolves. External links aren't fetched.

`pnpm check:product-name` (#421) fails when `V2`, the old working name, is used for the product in the documents, the README, [`SECURITY.md`](../SECURITY.md) (since #523), the website's content, the extension's pages or the window's source. Identifiers in code, BitTorrent v2, quoted issue titles, and decision records' titles and quotes may keep it; the list and its reasons are in [`scripts/product-name-lib.mjs`](../scripts/product-name-lib.mjs). It also fails on V1's full product name, and on the 0.1.x name that contains it (the pattern is `FULL_NAME` in the same file), in those files, code spans included, and in [`CHANGELOG.md`](../CHANGELOG.md), [`SECURITY.md`](../SECURITY.md), [`AGENTS.md`](../AGENTS.md) and the extension's store texts (#486). Decision records and research copies are checked too: they were reworded once, each with a dated note (PO decision on #486, 2026-11-13). [`CLA.md`](../CLA.md) waits for the legal review (#441). "velocity" alone, in crate names and identifiers, may stay. Every pull request and every merge to `main` runs it.

### Examples

```sh
pnpm test:focused -- velocity-core                 # cargo test -p velocity-core
pnpm test:focused -- velocity-core app_info        # only tests whose name contains app_info
pnpm test:focused -- scripts -t selectChecks       # Vitest, one describe block
pnpm test:watch                                    # Vitest in watch mode
cargo test -p velocity-core -- --nocapture         # cargo directly, with output
pnpm check:pr                                      # what this branch needs
pnpm check:pr --base HEAD                          # only the uncommitted changes
```

Areas for `test:focused` are the workspace crates (`velocity-core`, `velocity-desktop-v2`), `frontend`, `scripts` and `extension` (the browser extension, #64). An unknown area prints the valid ones.

## How `check:pr` selects checks

The rules live in [`scripts/checks-lib.mjs`](../scripts/checks-lib.mjs) and are unit tested in [`scripts/checks-lib.test.mjs`](../scripts/checks-lib.test.mjs). The CI change detection (#13) reuses them, so local and CI selection can't drift apart. The first matching rule wins:

| Changed path | Selects |
|---|---|
| Lockfiles and shared configuration: [`Cargo.lock`](../Cargo.lock), [`Cargo.toml`](../Cargo.toml), [`pnpm-lock.yaml`](../pnpm-lock.yaml), [`package.json`](../package.json), [`rust-toolchain.toml`](../rust-toolchain.toml), `.gitattributes`, `.editorconfig`, `.gitignore`, [`.cargo/`](../.cargo/), and `scripts/` (the check machinery) | **Everything** |
| Inside a workspace crate (`crates/<name>/`, `src-tauri/`) | Rust checks for that crate **and every crate that depends on it** (read from `cargo metadata`), plus `cargo fmt` |
| Frontend: `src/`, `public/`, [`index.html`](../index.html), [`tsconfig.json`](../tsconfig.json), [`vite.config.ts`](../vite.config.ts), [`eslint.config.js`](../eslint.config.js) | `tsc`, ESLint, Vitest |
| Documentation: `docs/`, root `*.md` | No code checks |
| **Any other path** | **Everything** |

Selecting too little would let a broken change through, so anything shared or unknown selects everything. A new top-level directory needs a rule in `checks-lib.mjs` (with a test) before it can select less.

## Build settings for fast feedback

These settings were measured in #3. The timings are in [DEVELOPMENT.md](TEST_FIXTURES.md#check-timings).

- **Dependencies are built with `opt-level = 1` and no debug info.** The app runs at a usable speed, and dependencies are compiled once.
- **Workspace crates are built with `debug = "line-tables-only"`.** Backtraces keep file and line numbers. The Tauri shell's library is also built as a `staticlib` and a `cdylib` for mobile targets. With full debug info, every test run re-linked several hundred megabytes. To debug with variables in a debugger, override it for that build: `CARGO_PROFILE_DEV_DEBUG=true cargo build`.
- **The release profile** (LTO, one codegen unit, `opt-level = "s"`) applies only to `--release` builds and never to development.

Two other settings were measured and rejected:

- **`tsc --incremental`** was slower: 1.3–1.6 s against 0.9 s, because writing the build-info file costs more than it saves on a project this size. Revisit when the frontend grows.
- **ESLint `--cache`** was rejected for correctness. The configuration uses type-aware rules, and ESLint caches results per file. A type change in one file can change the lint result of another file whose cache entry is still valid, so a cached run could pass when a fresh one fails.

## The test pyramid

From most numerous and fastest to fewest and slowest. Each layer proves what the one below can't.

| Layer | What it proves | Tool and location | Level | Built in |
|---|---|---|---|---|
| **Unit** | One function or type in isolation: parsing, validation, naming, status mapping, error classification | Rust `#[cfg(test)] mod tests` beside the code; Vitest `*.test.ts(x)` next to the module | L1 | Every issue |
| **Property** | Invariants over many generated inputs: the scheduler's **I1–I7** (partition, exclusivity, acceptance, monotonic coverage, durability, completion, conservation; research report section 5.2), range arithmetic, header parsing | A seeded generator in the crate's tests. A property-testing crate such as `proptest` needs PO approval first ([DEPENDENCIES.md](DEPENDENCIES.md)) | L1 and L2 | #42, #41, #45 |
| **Protocol fixtures** | The engine against **real libcurl** and a local server that misbehaves on purpose (table below): every row of the research report's section 5.4, checked by SHA-256, the status shown and the wasted bytes | [`crates/velocity-transfer/tests/`](../crates/velocity-transfer/tests/), [`crates/velocity-curl/tests/`](../crates/velocity-curl/tests/) ([ADR-0002](decisions/0002-engine-crate-layout.md)) | L2 | #41–#51, #53 |
| **Integration** | The manager, persistence and engine together: lifecycle, queue, pause and resume, checkpoints after `kill -9`, migrations; since #58, every direct-download command on the real supervised engine, the completion gate, a crashed or unavailable engine, and the app starting again (`velocity-transfer` `tests/manager.rs`), and torrents through the manager with a real helper (`velocity-torrent` `tests/manager.rs`) | [`crates/velocity-core/tests/`](../crates/velocity-core/tests/), [`crates/velocity-transfer/tests/`](../crates/velocity-transfer/tests/) | L2 | #26, #43, #50, #58 |
| **UI** | What the user sees and does, against a fake native backend; only the Tauri boundary is mocked | Vitest in jsdom with Testing Library, against Tauri's own `mockIPC` (`@tauri-apps/api/mocks`) through [`src/test/fakeBackend.ts`](../src/test/fakeBackend.ts) | L1 and L2 | #29, #59–#61 |
| **Layout** | The window in a real browser: dragging the navigation and the list's column edges with a real pointer (a live preview, one save on release), a reload restoring them, and no overflow at the smallest window, in both themes | `pnpm test:e2e:layout` ([`tests/e2e/layout/`](../tests/e2e/layout/layout-e2e.mjs), V1's): Playwright's Chromium against the window with Tauri's IPC mocked (`harness.tsx`), served by Vite. `-- --shots <dir>` saves screenshots. The browser, about 120 MB, comes from `pnpm exec playwright install chromium` once per machine, into the user's Playwright cache, never the repository; `CHROMIUM_PATH` uses another | L4 | #59 |
| **Native host and browser** | Message validation in the host; the real extension, host and app in real Chromium and Firefox | Host: [`crates/velocity-native-host/tests/host_e2e.rs`](../crates/velocity-native-host/tests/host_e2e.rs), the real host against a real local listener. Browser: `pnpm test:e2e:chromium` (Playwright's Chromium, Windows and Linux) and `pnpm test:e2e:firefox` (geckodriver, Linux), with V1's extension installed too ([BROWSER_EXTENSION.md](BROWSER_EXTENSION_BUILD.md#tests)) | L2 (host), L4 (browser) | #64, #65 |
| **Security** | TLS certificate rules per backend, redirect and credential rules, secret-leak scans, filesystem attacks, fuzzed parsers | Fixture suites plus `cargo-fuzz` targets (needs approval) | L2, plus L4 for fuzzing | #67, #69–#73 |
| **End-to-end and platform** | The packaged app installed on Windows, Linux and macOS; install and upgrade beside V1 | Installer tests, real machines | L4 and L5 | #81–#83 |
| **Field test** | The installed app used as a user uses it, with real downloads from real servers and real settings: what fixtures can't show, such as servers that cut connections, long downloads, pause, resume and crashes | `pnpm field` ([`tests/field/`](../tests/field/README.md)), by hand on Windows, never in CI | L5 | #262 |
| **Benchmarks** | Apollo DM's own speed, resource use and reliability, measured once the engine and app exist. No aria2 comparison for now ([ADR-0009](decisions/0009-no-aria2-benchmark-gate.md)) | To be designed then | L4 | #77 |

## How the frontend is tested

- **Only the native boundary is mocked:** the UI is rendered in jsdom (the `ui` project in [`vite.config.ts`](../vite.config.ts)) against a fake backend built on Tauri's own `mockIPC` ([`src/test/fakeBackend.ts`](../src/test/fakeBackend.ts)), which answers with the contract fixtures and records every call. Events are sent with Tauri's `emit`. Components, hooks and state are real ([UI_ARCHITECTURE.md](UI_ARCHITECTURE.md#testing)).
- **Clicks and typing** go through Testing Library's `user-event`; a drag goes through pointer events. The assertions read roles, names, text and attributes directly, without extra matchers.
- **Contract fixtures:** the shapes the Rust side sends are generated from Rust into [`tests/fixtures/contract/`](../tests/fixtures/contract/) and validated by the UI's strict schemas, so neither side can drift ([CONTRACTS.md](CONTRACTS.md)).
- **What the user sees:** tests check text, roles and actions, not component internals.
- **Keeping `findByRole` fast (#371):** it styles every element on the page to see whether it's hidden, and that was most of an app test's time. Cost grows with the page's elements and CSS rules, so [`src/test/setup.ts`](../src/test/setup.ts) removes the toast library's stylesheet and clears its toasts after each test. Without that, a file's later tests redrew every earlier toast.

## Reporting results per platform

- **Every check, per platform:** PASS, FAIL, BLOCKED or NOT RUN, with the exact command. A pass on one platform says nothing about another (AGENTS.md, "Reporting").
- **NOT RUN needs a reason,** for example "no Mac available" (the PO accepted macOS as NOT RUN for #2) or "OpenSSH not available on Windows".
- **CI results:** reported only after seeing them. A job the selector didn't choose is NOT RUN, not PASS. CI's own statuses (FAILED, INFRA, BLOCKED, CANCELLED…) are explained in [CI_DIAGNOSTICS.md](CI_DIAGNOSTICS.md).
- **Platform runs** use `/platform-verify` (Windows natively, Linux in the WSL clean clone).

## Writing tests

- **Test first:** write the failing test, make it pass with the smallest change, then refactor. Bug fixes get a regression test. `/tdd-change` walks through it.
- **Never weaken a test to get a pass:** don't delete, skip or weaken it.
- **Location:** Rust unit tests live next to the code in `#[cfg(test)] mod tests`. Integration and fixture tests go in a crate's `tests/` directory. Frontend tests are `src/**/*.test.ts(x)`, and script tests are `scripts/**/*.test.mjs`. Names follow [CONVENTIONS.md](CONVENTIONS.md).
- **Determinism:** tests don't use the public network, uncontrolled timing or shared global state (see the fixture policy above).
- **Wait for what you expect, not for a fixed time.** A test that needs a message or a state waits until it arrives, bounded by a generous deadline, and only then checks that nothing more happens. A fixed window fails when the whole machine pauses: a 1 s freeze of the test process failed the manager's snapshot timing test 4 times in 16, and none of 380 runs under CPU load did (#188).
