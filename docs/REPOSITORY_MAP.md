# Repository map

Where everything lives. The rules for what each layer may do are in [AGENTS.md](../AGENTS.md#architecture), and how the parts work together is in the [architecture](ARCHITECTURE.md).

## The app

| Folder | What it holds |
|---|---|
| `src/` | The window: React and TypeScript. It reaches native code only through typed commands and events |
| [`src/features/`](../src/features/) | One folder for each part of the window, such as `add`, `downloads`, `torrents`, `settings` and `help` |
| [`src/app/`](../src/app/), [`src/components/`](../src/components/), [`src/layout/`](../src/layout/) | The shell, shared components and the panels |
| [`src/test/`](../src/test/) | The test setup and the fake backend the window's tests run against |
| `src-tauri/` | The desktop shell. Its commands check their input and pass the work to the core |

## Rust crates

| Crate | What it does |
|---|---|
| [`crates/velocity-core`](../crates/velocity-core/) | Domain logic: the manager, policy, validation and persistence |
| [`crates/velocity-transfer`](../crates/velocity-transfer/) | The direct-download engine |
| [`crates/velocity-curl`](../crates/velocity-curl/) | The libcurl layer, the only code that calls libcurl |
| [`crates/velocity-sftp`](../crates/velocity-sftp/) | The SFTP layer, the only code that calls russh |
| [`crates/velocity-torrent`](../crates/velocity-torrent/) | The torrent engine and its helper process |
| [`crates/velocity-lt`](../crates/velocity-lt/) | The bridge to libtorrent, the only code that calls it |
| [`crates/velocity-child`](../crates/velocity-child/) | The child-process layer both engines share |
| [`crates/velocity-native-host`](../crates/velocity-native-host/) | The native messaging host the browser extension talks to |
| [`crates/velocity-test-http`](../crates/velocity-test-http/), [`crates/velocity-transfer-h2c`](../crates/velocity-transfer-h2c/) | Test servers |

The crates keep the working name `velocity`.

## Everything else

| Folder | What it holds |
|---|---|
| `browser-extension/` | The browser extension: its source, store listings and tests |
| `docs/` | The documents behind this site, the [user guide](user/README.md) and the [decision records](decisions/README.md) |
| `site/` | The website's own pages, stylesheet and screens ([how it's built](WEBSITE.md)) |
| `scripts/` | The `pnpm` commands: checks, builds, packaging and the agent guard, with their tests |
| `tests/` | End-to-end and field tests, and the shared fixtures |
| [`.github/`](../.github/) | CI workflows and the issue and pull request templates |
| [`.claude/`](../.claude/) | The rules and skills for AI agents ([agent guidance](AGENT_GUIDANCE.md)) |
