# Engine tests

How the transfer engine is tested, and what it doesn't do yet. Part of the engine's internals, with [ENGINE_INTERNALS.md](ENGINE_INTERNALS.md) (protocols), [ENGINE_SCHEDULER.md](ENGINE_SCHEDULER.md) and [ENGINE_PERSISTENCE.md](ENGINE_PERSISTENCE.md); split from ENGINE_INTERNALS.md by #425. The test levels for the whole repository are in [TESTING.md](TESTING.md).

## Tests

- **Fixtures:** [`crates/velocity-transfer/tests/download.rs`](../crates/velocity-transfer/tests/download.rs) runs the real engine against the local test server ([`velocity-test-http`](../crates/velocity-test-http/src/lib.rs)), whose options make it misbehave on demand. There is one test per row of report section 5.1's table, each checking the file's bytes, the number of GETs and the wasted bytes. A further test slows one connection so that a split happens, and checks that the old request stops at the boundary.
- **Properties:** [`crates/velocity-transfer/tests/scheduler.rs`](../crates/velocity-transfer/tests/scheduler.rs) runs 3,000 generated scenarios of a simulated transport through the scheduler, with `proptest`. The scenarios mix random requests, chunk sizes, splits, refused answers, duplicate and late callbacks, cancellations, syncs, crashes that keep only D, and new epochs. After every event it checks I1 to I7 and that every covered byte equals the source. At the end it checks that the finished file is the source. Breaking the scheduler on purpose is caught: a split that doesn't shrink the old lease, accepting bytes at any offset, and a failed lease that doesn't give its bytes back each fail it.
- **Persistence fixtures:** `tests/download.rs` also covers:
  - checkpoints of synced bytes, the probe's included;
  - a pause and a resume from the last checkpoint, fetching only what was missing;
  - a file that changed on the server, which starts over;
  - checkpoints that don't fit, which aren't trusted;
  - a missing or discarded part file;
  - a file created at the destination mid-download, never replaced;
  - the sparse part file.

  `tests/engine_contract.rs` checks pause, resume and cancel in both engine modes.
- **Crash trials (L4):** `tests/crash_recovery.rs` kills a real engine (`kill -9`, `taskkill /F`) at a random moment, then resumes in a new one from the last checkpoint the first sent. Every trial checks four things:
  - nothing looks finished before the rename;
  - the file equals the source;
  - what wasn't durable at the kill is at most one checkpoint interval's worth;
  - the bytes fetched twice are at most that plus what was in flight.

  The same file kills the app too (#74): the test binary starts itself again as an app process (the manager over a database file, with its own child engine), kills it at a random moment, waits for its orphaned engine to stop, then opens the same database in a new manager, which brings the download back from its stored checkpoint and must finish it with the source's bytes.

  CI runs 3 trials of each. The full 100 run by hand with `VELOCITY_CRASH_TRIALS=100 cargo test -p velocity-transfer --test crash_recovery -- --nocapture` (PO decision on #43), and `VELOCITY_CRASH_SEED` repeats a run.
- **A full disk and a refused write (#74):** [`crates/velocity-transfer-h2c/tests/disk_faults.rs`](../crates/velocity-transfer-h2c/tests/disk_faults.rs), through the manager and the in-process engine. velocity-transfer's test-only `test-faults` feature makes the part file's writes fail after a chosen number of bytes, as a full disk (`StorageFull`) or a refused write (`PermissionDenied`) would; an optimised build refuses the feature, like `test-ca`. No real small drive is made (PO decision on #74). The fault strikes once inside the 4 MiB probe and once among the parallel segments, never on a chunk boundary, so the failing write is cut part-way, as an interrupted write is. Each case checks:
  - the download fails, as permanent, with "There is not enough disk space." or "Apollo Download Manager isn't allowed to write to that location.";
  - the part file and a checkpoint of what reached the disk are kept;
  - once the fault is cleared, the user's retry fetches only what was missing, and the file equals the source.
- **Changed-object fixtures (#45):** `tests/changed.rs` checks every request's `Range` and `If-Range` against a server whose file changes after a set number of GETs:
  - a new strong ETag starts over once and ends as the new file;
  - a dropped ETag counts as a change;
  - a weak ETag is never sent, and a strong date is;
  - a second change fails as retryable, with no part file left;
  - a resume whose ETag changed starts over;
  - the gap stream after ranges were lost, and a retried probe, are checked too;
  - an unasked encoding is stored as sent, a changed one starts over as one stream, and a resume needs its checkpoint's encoding;
  - a `403` after the first answer says the link expired.
- **Retry fixtures:** `tests/retries.rs` covers #48's acceptance fixtures:
  - a `429` with `Retry-After: 5` gets no request before 5 s;
  - a reset storm backs off within its bounds and recovers, and one that doesn't end fails after 5 tries;
  - a 20 KiB/s server is never reset;
  - a frozen connection shows Stalled, then is reset and retried;
  - a name that doesn't resolve is transient;
  - a `404` is permanent with its message;
  - a cancel during a wait ends at once.

  `tests/engine_retries.rs` covers starting a whole download again, keeping the bytes through an outage that fails a resumed start too, riding an outage out past the counted restarts (#317), giving up after the restarts, never restarting a permanent failure, a cancel during the wait, and Stalled in the snapshot. `tests/supervisor.rs` freezes a real engine process and checks it is restarted.
- **Limit fixtures:** `tests/limits.rs` measures the bytes written over a window: a global 4 MiB/s across 3 downloads, a change taking effect within 2 s, and a download limit under a higher global one, each within ±10% over 10 s. `VELOCITY_LIMIT_SECONDS=30 cargo test -p velocity-transfer --test limits -- --nocapture` runs the 30 s window of #49 by hand (PO decision on #49). `tests/engine_contract.rs` checks limits in both engine modes, and `tests/supervisor.rs` checks that the global limit survives a restart.
- **Connection fixtures (#47):** `tests/connections.rs` changes a download's count live (up and down, with no byte wasted and no second probe), holds it to the engine's allowance, reports when the file is too small for more, and runs the adaptive ramp against a per-connection and a per-IP throttle. `tests/engine_contract.rs` checks `set_connections`, the per-host share with Jain's index, and connection reuse in both engine modes. Since #154, so that slow machines don't fail them:
  - `tests/connections.rs` runs its tests one at a time, and so do the three in `tests/engine_contract.rs` that measure speed. At once, on 2 vCPUs, they stretched the ramp's windows to almost 3 s. Since #281, `velocity-transfer-h2c/tests/http2.rs` runs its tests one at a time too: its probe and split tests download at loopback speed, and slowed the ramp's measurements on CI's Windows runner;
  - the ramp fixtures use the engine's own policy, with its 2 s windows. With 1 s windows, noise passed for a 10% gain;
  - **#154's known failure is gone with #221:** about 1 run in 25 on 2 vCPUs, the per-IP fixture saw the climbing ramp try a 5th connection when noise passed for a gain. The ramp now starts at the count asked for and never adds beyond it, and noise can only keep a connection: the fixture asks for 4 and accepts 2 or 3 kept;
  - the ramp fixtures check "never more than asked" with the engine's own count, `DownloadReport::peak_requests`. A server counts a stopped request for a moment longer, because it writes the request's tail until it sees the connection close;
  - the fairness fixture measures once every download is downloading on its 2 connections. A download's allowance alone is set before it connects.
- **Integrity fixtures (#46):** `tests/integrity.rs` runs against the test server:
  - a correct checksum completes a download whose segments land out of order, with Verifying shown;
  - a wrong one fails with the part file kept and nothing renamed, and a resume from its last checkpoint downloads every byte again;
  - checksums on a single stream and an empty file;
  - Verified, Size verified and Not verified, for fresh and resumed downloads with and without a strong ETag;
  - a piece the server sends bad once (`ServerOptions::corrupt_once`) is fetched again alone;
  - a piece that stays bad fails after 2 re-fetches;
  - without ranges, a bad piece starts the download over once;
  - a piece list that doesn't fit fails;
  - after a piece is fetched again, the whole-file hash still matches.

  The unit tests in `integrity.rs` check the six algorithms against their standard test vectors, a frontier fed in reverse order, and the piece verifier. `tests/engine_contract.rs` checks checksums and piece hashes in both engine modes.
- **HTTP/2 fixtures (#47):** [`crates/velocity-transfer-h2c/tests/http2.rs`](../crates/velocity-transfer-h2c/tests/http2.rs) runs against the cleartext HTTP/2 server: #41's probe fixtures, #42's split that resets only its stream, and the multiplex policy against a server throttling each TCP connection and one throttling each stream. They need the `test-h2c` feature, which only test builds have ([TEST_FIXTURES.md](TEST_FIXTURES.md#fixture-servers-apollo-download-manager-needs)). They live in a test-only crate of their own (#46): a dev-dependency's features reach every example of its crate, so while they were in `velocity-transfer`, none of its examples could be built for release.
- **TLS fixtures (#69):** [`crates/velocity-transfer-h2c/tests/tls.rs`](../crates/velocity-transfer-h2c/tests/tls.rs) downloads in segments over HTTPS and over HTTP/2 negotiated through ALPN, and checks that a refused certificate fails permanently with nothing on disk. It needs the `test-ca` feature, so it lives in the same test-only crate. What each TLS backend accepts and refuses is in [SECURITY_NETWORK.md](SECURITY_NETWORK.md#tls-verification-69).
- **FTP fixtures (#51):** the FTP server in [`ftp.rs`](../crates/velocity-test-http/src/ftp.rs) is V1's test server ported to the standard library. It serves passive FTP with `SIZE`, `MDTM` and `REST`, explicit and implicit FTPS on a `TestPki`, and switches for no `SIZE`, no `REST`, no `MDTM` and a cut transfer. It records the logins, `RETR`s, `REST` offsets and which connections were encrypted.
  - [`crates/velocity-curl/tests/ftp.rs`](../crates/velocity-curl/tests/ftp.rs) checks the head built for each case in the table above, the login, a refused login, a cut, and FTPS: explicit, implicit, required from a plain server, and an untrusted certificate.
  - [`crates/velocity-transfer/tests/ftp.rs`](../crates/velocity-transfer/tests/ftp.rs) ports V1's tests: a whole file whose SHA-256 matches, a cut transfer resumed with `REST`, and a missing file. It adds a pause resumed from its checkpoint, a resume with and without `MDTM`, a file whose time changed, and a server without `REST`.
  - `tests/engine_contract.rs` downloads over FTP with a login in both engine modes, on one connection.
  - [`crates/velocity-transfer-h2c/tests/ftps.rs`](../crates/velocity-transfer-h2c/tests/ftps.rs) downloads over explicit and implicit FTPS on the test CA, and checks that requiring encryption from a plain server, and a refused certificate, fail at once without the login.
- **Unit tests:** the tests in `probe.rs`, `validator.rs`, `failure.rs`, `retry.rs`, `adaptive.rs`, `budget.rs`, the libcurl layer's `rate.rs`, `scheduler.rs`, `files.rs` and the libcurl layer's `tests/curl_loop.rs` (`FetchLimit`, the per-host cap) and `tests/http2.rs` cover each rule on its own.

## Not yet

- **Logins inside the engine:** the engine takes the login as plain strings for the transfer's life, copied out of its `Secret`s in `request_options`, because libcurl needs them so. Outside the engine they are `Secret`s, wiped when dropped ([SECURITY.md](SECURITY.md#secrets-70)).
- **A local Metalink file:** `metalink::read_file` exists, but no command calls it ([Metalink](ENGINE_METALINK_MIRRORS.md#adding-its-files)).
- **FTP over several connections:** one connection; whether more would help isn't measured.
- **Connection values:** the per-host cap and the smallest piece come from the performance profile (#57), and the budget from the user's engine settings ([SETTINGS.md](SETTINGS.md#engine), #30). The ramp's values are engine defaults, to tune by measurement (#77).
- **Learning per host:** what a host allowed isn't remembered between downloads (a non-goal of #47).
- **Throttling across downloads:** a `429` or `503` halves the connections of the download that got it, not of the other downloads already running to that host. Downloads that start later from that host start at the remembered count ([Opening](ENGINE_CONNECTIONS.md#opening-247)).
- **Retry settings:** the user's engine settings over `RetryPolicy::DEFAULT` ([SETTINGS.md](SETTINGS.md#engine), #30), read when a download starts or retries.
- **Integrity without the app:** a whole-file hash that a server gives (`Repr-Digest`) is deferred (report section 5.3).
- **Metalink in the app:** off by default, as in V1; the Settings screen's Advanced section turns it on (`advanced.enableMetalink`, #30).
- **Mirror health isn't remembered** between downloads, or between the engine's restarts of one download, like the per-host learning #47 left out.
- **Connections to mirrors** count against the first URL's host in the engine's budget (#47), so a download with mirrors never opens more connections than one without; they're only spread. Per-mirror budgets, and more connections across several hosts as aria2's `split` allowed, are #77's to measure.
- **Mirror values:** the cooldown, the failure limit and the scoring are starting values, not yet measured.
- **Folders a Metalink download creates** stay when it's cancelled or fails, even when empty. Only part files are removed.
- **A fuzz target for the Metalink parser** comes with #73, which brings the fuzzing tool.

## How the engine is tested

- **Scheduler logic without a network.** `velocity-transfer` runs against a **simulated transport**: random chunk sizes, delays, splits, cancellations, retries, duplicate and late callbacks, `200` substitutions and simulated crashes (runtime state dropped, durable coverage kept). After every simulated event, a property test asserts invariants I1–I7 and byte equality with the source.
- **Protocol behaviour with real libcurl.** `velocity-curl` and the engine run against the fixture servers above, so abort-at-boundary, HTTP/2 stream resets and libcurl's real callbacks are covered.
- **Acceptance rows.** Each row of the research report's section 5.4 becomes at least one named fixture test, checking the final SHA-256, the status shown and the wasted bytes.
- **Crash recovery.** `kill -9` at random points over 100 trials: always resumes; re-downloaded bytes are at most one checkpoint interval plus in-flight data (#43). The app killed the same way comes back from its database and finishes the right file (#74).
- **Disk faults.** A full disk or a refused write mid-download fails with its own message, keeps what reached the disk, and resumes once fixed (#74).

## Timelines in ramp tests (#257)

`velocity_test_http::timeline::Timeline` samples a line every interval while a test runs, and the test puts the lines in its failure message.
- **Why:** the adaptive-connection tests time the ramp. A loaded CI runner bends that timing in ways a local run doesn't show, even with the test pinned to one or two cores.
- **Where:** `adaptive_connections_stop_below_the_cap_when_more_stop_helping` ([`crates/velocity-transfer/tests/connections.rs`](../crates/velocity-transfer/tests/connections.rs)) and `a_server_that_throttles_each_connection_gets_separate_connections` ([`crates/velocity-transfer-h2c/tests/http2.rs`](../crates/velocity-transfer-h2c/tests/http2.rs)) record, every 500 ms, the requests running and the ramp's count and reason. A failure on CI then shows what the ramp did.
