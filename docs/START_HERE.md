# Start here

Apollo Download Manager is a desktop download manager for Windows and Linux. These pages are for people who build it. If you only want to use it, read the [user guide](user/README.md).

The app has a Tauri 2 shell, a React and TypeScript window, and Rust crates. Its own direct-download engine runs on libcurl and russh, and torrents run on libtorrent.

## Your first hour

1. Read the [architecture](ARCHITECTURE.md) to see the parts and who owns which state.
2. Use the [repository map](REPOSITORY_MAP.md) to find your way around the code.
3. Set up a clean clone and run the app with [development setup](DEVELOPMENT.md).
4. Learn the [test levels](TESTING.md), and how to run one area while you work.
5. Read [CONTRIBUTING.md](../CONTRIBUTING.md) before you open a pull request.

## Find a topic

- **Something fails on setup:** [troubleshooting](TROUBLESHOOTING.md).
- **A term you don't know:** the [glossary](GLOSSARY.md).
- **Why something is the way it is:** the [decision records](decisions/README.md).
- **Every document, with what it's for:** the [documentation map](README.md) lists them on GitHub, and the contents on this page follow the order a new contributor needs.

The pages here are built from the Markdown files in `docs/` each time `main` changes, so a document and its page never differ.
