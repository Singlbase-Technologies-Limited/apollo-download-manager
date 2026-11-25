# Test fixtures and tools

The fixtures, servers and tools the tests use, the measured build and check times, and the special kinds of test: the engine's, the secret-leak scan, ramp timelines and the field test. The test levels and commands are in [TESTING.md](TESTING.md). Split from TESTING.md by #425.

## Fixture policy

- **Local only.** Every test talks to servers it starts itself on `127.0.0.1` (or `::1`), on a free port. A test's own libtorrent session listens on a port free for TCP and UDP (`velocity_torrent::engine::free_listen_port`, #438), never port 0: on Windows the system's free TCP port can be a reserved UDP one. No test contacts the public internet, a public tracker, the DHT or a CDN. A test that needs the network is a defect.
- **Seeded data.** Files are generated from a fixed seed with a known SHA-256. Every transfer test checks the SHA-256 of the result, not just "completed".
- **Deterministic timing.** Throttling and delays are controlled by the fixture, never by real network conditions. Timeouts are generous and bounded. A random seed is printed when a test fails.
- **Misbehaviour on purpose.** Fixtures expose switches for the server faults Apollo Download Manager must survive (below), so each test chooses its fault explicitly.
- **No secrets.** Test certificates, keys and passwords are generated for the test or committed as obviously fake fixtures, never real credentials.
- **Real components where it matters.** Fakes are fine at unit boundaries. Claims about the engine, processes, files or crash recovery use real libcurl, real processes and real files.

## Fixture servers Apollo Download Manager needs

| Fixture | Fault switches (research report section 5.4) | Used by | Built in |
|---|---|---|---|
| HTTP/1.1 range server ([`crates/velocity-test-http`](../crates/velocity-test-http/), standard library only) | **Built:** ranges honoured, Range ignored (`200`), `200` for a non-zero range, malformed `Content-Range`, short `206`, unknown total (`*/`), multipart, cut and overrunning bodies, throttling per connection and per IP (all connections together; a response held back catches up no more than 50 ms, #281), configured redirects with a body, `Content-Disposition` (#40), connections closed without an answer, a cut first answer, one byte sent flipped once (`corrupt_once`, #46), and counters for connections, GETs, HEADs, body bytes, `Range` and `If-Range` headers, every request's path and headers (#40), request times and responses sent at once | Probe, scheduler, retries, connections, redirects and file names | **#37** (first modes), extended by #40, #41, #42, #45, #46, #47 and #48 |
| Changed-object modes | **Built** (#45): `ETag`, `Last-Modified` and `Date` sent as configured, `If-Range` honoured as RFC 9110 §13.1.5 says, and a file that changes after a set number of GETs. That one change covers a new strong ETag, a dropped ETag and content changed with the ETag kept. Weak-ETag-only and Last-Modified-only files are configurations | Validators, resume | **#45** |
| Throttle and politeness modes | Speed limits (#49) need no server mode: the server sends as fast as asked, and the engine paces itself. **Built** (#48): `429` and `503` with `Retry-After` on the first requests, a slow but healthy 20 KiB/s stream, a frozen later range. **Built** (#247): `limit_answering`, an error status for any request beyond N being answered at once, over HTTP/1.1 and HTTP/2, as proof.ovh.net does. `freeze_process` freezes a whole engine process for the supervisor's hang test | Retries, stall detection, limits | **#48**, #49 |
| Encoding modes | **Built** (#45): `Content-Encoding` sent without encoding anything, so the stored bytes can be compared, and changed between responses with a file change | Range safety | #41, **#45** |
| TLS front with a test CA (`velocity_test_http::tls::TlsFront`, on rustls, ring and rcgen) | **Built:** terminates TLS for the HTTP/1.1 or HTTP/2 server, whose modes and counters work unchanged; a fresh CA per front; leaves that are valid, without an extended key usage, client-auth or code-signing only, from an untrusted issuer, for another host, expired or revoked; a CRL served on a fresh port, so Schannel can check revocation; ALPN `http/1.1` or `h2`; the TLS version and ALPN of each session. Clients trust the CA through velocity-curl's test-only `test-ca` feature ([SECURITY_NETWORK.md](SECURITY_NETWORK.md#how-the-tests-trust-a-test-ca)) | TLS rules, HTTP/2 over TLS | **#69** |
| HTTP/2 over cleartext (`Http2Server` in [`crates/velocity-test-http`](../crates/velocity-test-http/), on `h2` and tokio) | **Built:** the HTTP/1.1 server's range modes as concurrent streams, throttling per stream or per TCP connection, a slowed first later range, and counters for TCP connections, streams and stream resets. libcurl reaches it with prior knowledge through the `test-h2c` feature of `velocity-curl`, which only test builds have: an optimised build with it doesn't compile (PO decision on #47). The engine's HTTP/2 tests are in the test-only crate [`crates/velocity-transfer-h2c`](../crates/velocity-transfer-h2c/), so `velocity-transfer`'s examples build without the feature (#46) | Multiplexing policy, probe and split over HTTP/2 | **#47** |
| Redirects across origins | Cross-host redirect with credentials and cookies, https→http, redirect to `file:` or `sftp:` | Credential and protocol rules | **#40**, #67, #70 |
| FTP and FTPS (`velocity_test_http::ftp::FtpServer`, standard library, with rustls for FTPS) | **Built** (#51), ported from V1's FTP test server: passive mode (`EPSV`, `PASV`), a required login, `SIZE`, `MDTM`, `REST`, a missing file; switches for no `SIZE`, no `REST`, no `MDTM`, a cut transfer and throttling; a file replaced with another time; explicit FTPS (`AUTH TLS`, `PBSZ`, `PROT P`) and implicit FTPS on a `TestPki` leaf with its revocation list; a record of logins, commands, `RETR`s, `REST` offsets and encrypted connections | FTP, FTPS, resume with `REST`, the cleartext rules | **#51** |
| SFTP (`velocity_test_http::ssh::SshServer`, the installed OpenSSH) | **Built** (#53): the machine's `sshd`, started unprivileged on a free port for the user running the tests, with throwaway host keys (Ed25519, ECDSA or RSA), key logins (one key with a passphrase) and `internal-sftp`; a cut (sshd and its sessions killed) and a restart with the same or a new host key. Without `sshd`, NOT RUN; with `VELOCITY_REQUIRE_SSHD`, as on CI, a failure. **Known flake on Windows** (#62): the unprivileged `sshd`'s SFTP child process sometimes never answers after the login, or ends the session at once. The fetch then fails with a timeout or an interrupted connection, and the test fails. It failed one Windows `check:fast` run on 2026-10-26 and none of the 10 runs of the SFTP tests alone just after; with 4 test binaries at a time it came back 1 to 2 times in 60 runs, and it was worse for a while after heavy repeated load. The server log, which a failing test prints, shows the subsystem starting and no SFTP data. Password logins need a root `sshd`, which CI's Linux job provisions ([`scripts/ci-sftp-server.sh`](../scripts/ci-sftp-server.sh), `VELOCITY_SFTP_PASSWORD_SERVER`), and which WSL gets once through `sudo bash scripts/local-sftp-server.sh` (#176; [platform-verify reference](../.claude/skills/platform-verify/reference.md#local-sftp-password-login-server)); NOT RUN on Windows | Host keys, logins, resume, failures | **#53** (OpenSSH installed by the PO: Windows OpenSSH Server, `openssh-server` in WSL) |
| Proxy (`velocity_test_http::proxy`: `HttpProxy`, `Socks5Proxy`, standard library only) | **Built** (#192): an HTTP proxy that only tunnels (`CONNECT`) and refuses any other request, and a SOCKS5 proxy that resolves names, mapping test names to 127.0.0.1; each with an optional required login, and a record of the targets asked for, the logins given, the refusals and the plain requests | Proxy support: libcurl, SFTP, torrents, the leak scan | **#192** |
| Mirrors and Metalink | **Built** (#46): wrong piece hashes, as piece lists the tests supply, with a byte sent flipped once. **Built** (#54): a Metalink corpus ([`crates/velocity-core/tests/fixtures/metalink/`](../crates/velocity-core/tests/fixtures/metalink/): RFC 5854's example, Metalink 4 with subfolders and sources Apollo DM can't use, Metalink 3) with malicious documents in the unit tests (entity bombs, external entities, unsafe and duplicate names, oversized documents), the HTTP server's `Content-Type` (`FileHeaders::content_type`), and an end-to-end test of a followed link whose file gets one bad piece. **Built** (#55): mirrors as several local servers in [`crates/velocity-transfer/tests/mirrors.rs`](../crates/velocity-transfer/tests/mirrors.rs): one missing the file, one dead (a closed port), one with other bytes of the same size, a throttled one beside a fast one, ETags that do or don't match, and the requests a mirror received (no login, no custom header) | Failover, integrity | #46, #54, #55 |
| BitTorrent tracker and peers | Local tracker, libtorrent seeders and leechers; DHT, LPD and peer exchange off | Torrents | **#62** |
| Fake desktop IPC and browser harness | Malformed messages, the app unavailable, wrong caller | Native host, extension | **#65**, #64 |
| Disk and crash faults | **Built:** a full disk and a refused write, simulated by velocity-transfer's test-only `test-faults` feature (no real small drive, PO decision on #74); the engine (#43) and the app (#74) killed at random points ([ENGINE_TESTS.md](ENGINE_TESTS.md#tests)) | Recovery | **#74**, #43 |
| Benchmark server | Byte and request counters, throttle modes, h2 and TLS, kill and resume | Apollo DM's own benchmarks, later (ADR-0009) | #77 |

## More than 1024 files open (#337)

[`crates/velocity-curl/tests/fd_limit.rs`](../crates/velocity-curl/tests/fd_limit.rs), on Linux only: it raises the open-file limit to the hard limit, holds 1,100 files open so the next sockets are numbered past 1024, and downloads from the test server. `select()` can't watch a socket past `FD_SETSIZE`. The libcurl layer waits with `curl_multi_poll` (curl's `poll_7_68_0` feature), and it doesn't build without it, so no `select()` path exists; the test keeps it so. It runs in a test binary of its own, so the files it holds touch no other test. On Windows it compiles to nothing.

## The secret-leak scan (#71)

`velocity_test_http::leaks::LeakScan` looks for a test's known secrets everywhere Apollo Download Manager writes or shows something. A test that uses a login, a cookie, a key's passphrase or a tracker passkey runs it at the end:

- **Where it looks:** every file under the folders the test gives it (the database and its WAL, checkpoints, part and finished files), files in the system's temporary folder changed since the test began (three levels deep), texts such as the app's log, the diagnostics export and what the details panel shows, and a running child process's arguments and environment.
- **In what forms:** each secret as written, percent-encoded, and in base64 at each of its three possible alignments, so a `Basic` login or an encoded link is caught too. A secret must be at least 8 bytes, so it can't match by chance.
- **A running child, on Linux only:** it reads `/proc/<pid>/cmdline` and `environ` of the engine and the torrent helper. On Windows that part prints NOT RUN, and `secret_leaks.rs` checks the command a child is started with instead: one fixed argument and a cleared environment (PO decision on #71).
- **Where it runs:** [`crates/velocity-transfer/tests/secret_leaks.rs`](../crates/velocity-transfer/tests/secret_leaks.rs) (HTTP login and cookie and FTP login through the child engine; SFTP key and password logins) and [`crates/velocity-torrent/tests/manager.rs`](../crates/velocity-torrent/tests/manager.rs) (a private tracker's passkey, through the manager and the torrent helper). The scan's own tests plant each kind of leak and check it is found.

## The field test (#262)

The installed app, built from `main`, used the way a person uses it: real links from real servers, pause and resume, closing and killing the app mid-download, torrents. `pnpm field` drives the real window through Playwright and records each download every few seconds, with what is on disk and the app's connections. Every problem becomes an issue in epic #1. It runs by hand on Windows, before each release candidate, never in CI, and never against the public internet in automated tests (the fixture policy above still holds).

How to run a session, what it may download and how links are kept private: [tests/field/README.md](../tests/field/README.md). The scenarios: [tests/field/CHECKLIST.md](../tests/field/CHECKLIST.md). Session reports are comments on #262.

## Test-only dependencies

Test tools are dependencies too. Each needs PO approval before it's added ([DEPENDENCIES.md](DEPENDENCIES.md)), recorded in the issue that first needs it. These are expected:

| Tool | For | Issue |
|---|---|---|
| A property-testing crate (for example `proptest`) | Scheduler invariants | #42 |
| `cargo-fuzz` and libFuzzer | Fuzz targets | #73 |
| Testing Library (`@testing-library/react`, `dom`, `user-event`) and jsdom (**approved**, test-only) | UI tests | #29 |
| Playwright (`@playwright/test`, **approved**, test-only) | The layout test (#59); browser end-to-end next | #59, #64 |
| OpenSSH server (**installed**, a platform tool; Windows feature and Ubuntu package) | SFTP fixtures | #53 |
| `h2`, tokio, `http` and `bytes` (**approved**, test-only) | The HTTP/2 fixture server | #47 |
| rustls, tokio-rustls, ring and rcgen (**approved**, test-only) | The TLS fixture | #69 |

Without approval, a hand-written seeded generator or a Node built-in module is the fallback.

## Build times

The two tables below were measured on 2026-10-21, before the #3 profile change ([check timings](#check-timings) has the current figures).

Windows 11 (build 26200), Intel Core i7-13620H (16 logical CPUs), 15.7 GiB RAM, NVMe SSD, Rust 1.99.1, Node.js 24.12.0, pnpm 12.14.0:

| Step | Time |
|---|---|
| First `cargo build --workspace` from an empty `target/` | 278 s |
| `pnpm check:fast`, first run (clippy compiles its own artefacts) | 128 s |
| `pnpm check:fast`, warm | 7 s |
| `cargo build --workspace` with no changes | 3 s |
| Rebuild after a one-line change in [`crates/velocity-core`](../crates/velocity-core/) | 19 s |
| Rebuild after a one-line change in `src-tauri` | 17 s |
| Vite dev server start | 0.23 s |

Linking the desktop executable dominates incremental rebuilds. Issue #3 tuned this (see [check timings](#check-timings)).

Linux: Ubuntu 24.04.4 LTS under WSL2 (kernel 6.6.87.2) on the same PC, limited to 2 vCPUs and 1.9 GiB RAM, with the same tool versions:

| Step | Time |
|---|---|
| First `cargo build --workspace` from an empty `target/` | 413 s |
| `pnpm check:fast`, first run | 191 s |
| `pnpm check:fast`, warm | 8 s |
| `cargo build --workspace` with no changes | < 1 s |
| Rebuild after a one-line change in [`crates/velocity-core`](../crates/velocity-core/) | 17 s |

| Platform | Clean-clone run |
|---|---|
| Windows 11 | **PASS** (2026-10-21, machine above) |
| Linux (Ubuntu 24.04, WSL2/WSLg) | **PASS** (2026-10-21). WSL is a real Linux kernel and userland, but not a native desktop install; WebKitGTK rendered through WSLg |
| macOS | **NOT RUN**: no macOS machine was available |

### Check timings

Measured 2026-10-21 for #3 on the two machines above. Each figure is the median of `node scripts/check-fast.mjs` wall time after one warm-up run. "One-file change" means appending a comment line to [`crates/velocity-core/src/lib.rs`](../crates/velocity-core/src/lib.rs) before each run. That rebuilds the core and the desktop shell that depends on it.

| `pnpm check:fast` | Before tuning | After tuning |
|---|---|---|
| Windows, no-op | 9.2 s | 8.9 s |
| Windows, one-file change | 20.9 s | 14.0 s |
| Linux (WSL2, 2 vCPU, 1.9 GiB), no-op | 6.1 s | 5.5 s |
| Linux (WSL2, 2 vCPU, 1.9 GiB), one-file change | 66.7 s (18–123 s) | 7.0 s |

- **Windows:** 5 runs on each side, with the same scripts and only the [`Cargo.toml`](../Cargo.toml) profile change reverted for "before". A first measurement on `main`'s scripts, with 3 runs, gave 7.5 s and 25.8 s.
- **Linux:** 3 runs before, on `main`, and 5 runs after.
- **Where the time goes:** in a no-op run, mostly ESLint (about 4.5 s on Windows, 3 s on Linux). After a Rust change, mostly `cargo test`, which re-links the desktop shell. Before tuning, that link wrote a staticlib of about 660 MB on Linux; it is now about 140 MB. Under WSL's 1.9 GiB of memory, the link time varied a lot.

`pnpm check:full` on Windows: 249 s, of which the Rust release build took 232 s. Linux (WSL2): 224 s across the checks, of which the Rust release build took 215 s.
