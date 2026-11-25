# Troubleshooting

## Setup

Start with `pnpm check:prereqs`. It names each missing prerequisite and prints the fix.

| Symptom | Cause | Fix |
|---|---|---|
| `pnpm setup` changes your shell profile instead of checking prerequisites | `setup` is a built-in pnpm command | Use `pnpm check:prereqs` |
| `pnpm: command not found`, or the wrong pnpm version | pnpm is missing, or Corepack isn't enabled | `corepack enable`, or `npx get-pnpm`; the pinned version is in [`package.json`](../package.json) → `packageManager` |
| `cargo: command not found` just after installing Rust | The terminal was opened before rustup updated `PATH` | Open a new terminal. `pnpm check:prereqs` also looks in `~/.cargo/bin` |
| `link.exe` not found or `LNK1181` on Windows | Microsoft C++ Build Tools are missing, or the Rust toolchain is GNU instead of MSVC | Install the "Desktop development with C++" workload; check that `rustup show` lists `x86_64-pc-windows-msvc` |
| `webkit2gtk-4.1` not found on Linux | WebKitGTK development files are missing | Install the apt packages in [DEVELOPMENT.md](DEVELOPMENT.md#linux-debianubuntu) |
| `Port 1430 is in use` | Another Apollo DM dev server is already running | Stop it. V1's dev server uses port 1420, so it doesn't conflict |
| Every file shows as modified after cloning on Windows | Line endings were converted | `.gitattributes` stores text with LF; run `git add --renormalize .` and check that you aren't overriding `core.autocrlf` per repository |
| The first `pnpm dev` seems stuck | It is compiling every Rust dependency (about 4–5 minutes on the reference machine) | Wait; later runs take seconds |
| The window heading shows "Could not reach the native shell" | The UI was opened in a browser (`pnpm dev:web`), where Tauri commands don't exist | Use `pnpm dev` |

## Downloads

Every message a download can show, with what it means and what to do, is in the user guide's [Download messages](user/download-messages.md) (moved there by #425). What the engine does in each case is in [ENGINE_INTERNALS.md](ENGINE_INTERNALS.md#retries-waits-and-stalls-48).

What lies behind the messages, for a bug report or a developer build:

| Message | Behind it |
|---|---|
| "The server name could not be resolved. …" | No address for the name. An IPv6-only server (`AAAA` record) on a network without IPv6 gets none from Windows' resolver either, as `curl.exe` shows (#250). `Resolve-DnsName <host>` (Windows) or `dig <host> A AAAA` shows the name's addresses. Each start retries inside the download; a start that never reached the server isn't started again on its own (#245) |
| "This computer has no network connection to the server. …" | The OS reports the network down or unreachable (`WSAENETUNREACH` and similar, read from libcurl's `CURLINFO_OS_ERRNO`); never taken for a server refusing this computer (#335). A download that had bytes is ridden out for about 5 minutes (#317) |
| The four "security certificate" messages | The TLS backend's refusal, by kind: expired or not yet valid (OpenSSL's "certificate has expired", Schannel's `SEC_E_CERT_EXPIRED`); another host (`SEC_E_WRONG_PRINCIPAL`, "no alternative certificate subject name matches"); no trusted issuer (`SEC_E_UNTRUSTED_ROOT`, "unable to get local issuer certificate"); anything else, such as revoked (Schannel checks revocation; OpenSSL without a CRL doesn't, #69). Verification is never turned off (#252) |
| "The file wasn't found on the server." / "The server refused the login. …" / "The server doesn't let this user read the file." | FTP's `550`; `530` (`CURLE_LOGIN_DENIED`), which opens the login window (#249); `CURLE_REMOTE_ACCESS_DENIED`, or SFTP's permission denied, which doesn't |
| "The server can't encrypt the connection, …" | The FTP server refused `AUTH TLS`; the login was never sent |
| "There is not enough disk space." / "… isn't allowed to write to that location." | Kept what was downloaded (#74) |
| The engine is unavailable (`ENGINE_UNAVAILABLE`) | It crashed more than 5 times in 5 minutes |
| The engine is missing (`ENGINE_MISSING`) or doesn't match the app (`ENGINE_INCOMPATIBLE`); the torrent helper the same | `velocity-transfer` or `velocity-torrent` isn't beside the app, or is from another build. In development, `pnpm dev` builds the engine first (`pnpm dev:engine`), and the helper once libtorrent is built ([BUILDING_NATIVE.md](BUILDING_NATIVE.md#libtorrent)) |
| Settings, Browser says the browser connection program isn't installed | `velocity-native-host-v2` isn't beside the app. In development, `pnpm dev:engine` builds it |
| The extension says "The connection to Apollo DM is not set up" | The native host isn't registered with that browser, or for another copy ([BROWSER_EXTENSION.md](BROWSER_EXTENSION.md#registering-with-each-browser)) |
| The extension says "Apollo Download Manager is not running" | The native host starts the app in the tray (#322) and waits up to 10 seconds; it found no app beside it, or the app didn't answer |
