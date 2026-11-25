# Engine: scheduler and connections

How the transfer engine shares a file between connections, how many it uses, how it retries, waits and limits speed. Part of the engine's internals, with [ENGINE_INTERNALS.md](ENGINE_INTERNALS.md) (protocols), [ENGINE_PERSISTENCE.md](ENGINE_PERSISTENCE.md) (persistence and integrity) and [ENGINE_TESTS.md](ENGINE_TESTS.md) (its tests); split from ENGINE_INTERNALS.md by #425.

Retries, stalls and speed limits are in [ENGINE_RETRIES_LIMITS.md](ENGINE_RETRIES_LIMITS.md).

Connections, their budgets and the measurements are in [ENGINE_CONNECTIONS.md](ENGINE_CONNECTIONS.md).

## Later segments: the range scheduler (#42)

After a probe that gave a total, the rest of the file is fetched with leases from the range scheduler ([`scheduler.rs`](../crates/velocity-transfer/src/scheduler.rs), report section 5.2). The downloader's thread owns it and makes every change; no lock is held across I/O.

### Leases

A lease owns `[cursor, end)` of the file alone; `[start, cursor)` is already written. Its id is never reused within a download.

| State | Meaning |
|---|---|
| Assigned | The request `Range: bytes=start-(end−1)` was made; no answer yet |
| InFlight | The answer was checked and accepted in the header callback (`check_segment`) |
| Completed | `cursor == end` |
| Failed | It ended early; the rest of its range is unassigned again |
| Revoked | It was cancelled; the rest of its range is unassigned again |

- **Assignment:** a free connection gets the front of the unassigned bytes, an equal share per free connection. The share is rounded up to `align` and is at most `max_lease`; `Scheduler::ask_once` lifts that cap once a server throttled (#247). Sharing spreads a file over the connections without splits.
- **Acceptance:** bytes are accepted only from the lease that is in flight, at its cursor, and only up to its *current* end. Bytes for a lease that isn't live (ended, revoked, unknown), at another offset, or past its end are dropped and counted as wasted. They enter coverage only once the write to the part file has returned.
- **Split (work-stealing):** a free connection with nothing unassigned takes half of the live lease with the largest remainder. The remainder must be at least `2 × min_split`, and the midpoint is rounded down to `align`.
  - The old lease shrinks to end at the midpoint.
  - Its request is told to stop there: `FetchLimit::stop_at` in the libcurl layer delivers bytes up to the limit, then stops the transfer, and reports that as a completed fetch, not an error.
  - Over HTTP/1.1 its connection closes. Over HTTP/2 only the stream is reset, and the connection is kept (tested in #47).
- **Retries:** a lease that ends before its end fails, and the rest of its range is handed out again under a new id. A late callback from the old request carries the old id and is refused.

| Size | Value | Where it comes from |
|---|---|---|
| `max_lease` | 32 MiB | Report section 5.2, a hypothesis. Kept after #247 measured no cap (2026-11-04, the Ubuntu 26.04.1 server image, 2.9 GB): 294 s and 326 s with the cap, 385 s without, where the ramp settled on 1 connection because each connection it added had to split a running request. A server that throttled is asked once per connection for the rest instead (`Scheduler::ask_once`) |
| `min_split` | 1 MiB (a remainder of at least 2 MiB splits) | A starting value; the report names no number |
| `align` | 64 KiB | Report section 5.2 |

### Answers that aren't what was asked

Each answer is checked in the header callback (`check_segment`):

- **Ranges lost:** a `200` is aborted before its body is written. When the live leases end, the rest of the file comes as one stream that writes only the missing bytes, so the file is never mixed.
- **Anomaly:** an answer that contradicts its request, such as a wrong or malformed `Content-Range`, a length that disagrees with it, or a multipart body. It also covers:
  - a body cut off before its first byte;
  - a chunked body that stopped short of its `Content-Range`;
  - a body that ran past its range.

  The first anomaly is tolerated, and the lease's rest is leased again. At the **second in a row** (`MAX_ANOMALIES`), no more leases are handed out, and the rest comes as one stream that writes only the missing bytes (`RangesLost`). A request that brings good bytes clears the count, so anomalies far apart on a long download never add up (#333). The stream starts at byte 0, so it reads everything already on disk before it can fill a gap, and shows `noRanges` meanwhile.
- **Short answers:** a `206` with fewer bytes than asked is honest (RFC 9110 §14.2). Its lease fails, and only the remainder is leased again.
- **Failure:** an error status, or an answer about another file ([changed files](ENGINE_PERSISTENCE.md#changed-files-45)). An error status worth retrying frees the connection for a wait, and the rest of the lease is leased again after it ([retries](ENGINE_RETRIES_LIMITS.md#retries-waits-and-stalls-48)).

### Invariants

Checked after every change in debug builds (`Scheduler::check`), and by the property tests:

- **I1 Partition:** the coverage C, the live leases' `[cursor, end)` and the unassigned bytes U are disjoint and make up `[0, T)`.
- **I2 Exclusivity:** no two live leases overlap, and none overlaps C.
- **I3 Acceptance:** a byte at offset p is written only by the live lease whose cursor is p.
- **I4 Monotonic coverage:** C only grows within an epoch; `new_epoch` starts again from an empty C.
- **I5 Durability:** the durable coverage D is part of C and was synced before it was recorded (`synced`). Saving D in a checkpoint is #43.
- **I6 Completion:** C covers the file and no lease is live (`is_complete`).
- **I7 Conservation:** bytes received = growth of C + wasted bytes.

## Accounting

Every received byte is either written into the part file once, or counted in `wasted_bytes`. That includes bytes past a lease's end, bytes for a lease that isn't live, bytes the single stream sends again, bytes already covered, and the bytes of a piece that failed its hash and was fetched again ([integrity](ENGINE_INTEGRITY.md#piece-hashes)). Progress counts written bytes only. A server that ignores ranges costs exactly one GET with no wasted bytes, which a fixture test checks.

**Progress and speed (#246).**
- **When progress is sent:** the engine sends a progress snapshot for every 256 KiB written (`PROGRESS_STEP`), and at once when the count goes down because the download started over.
- **The speed:** the snapshot's download speed is the bytes written over the last 3 seconds (`SpeedMeter` in [`crates/velocity-transfer/src/speed.rs`](../crates/velocity-transfer/src/speed.rs)). That's a measurement, not an estimate. The list, the details panel, the time left and the status bar's total all show this figure.
- **Measuring starts again** at the first report after a start or resume, and when the count goes down. So the bytes already on disk never count as received.
- **No figure** is shown until 0.5 s has been measured.
- **Why 3 seconds:** a change in speed, such as a new speed limit, shows half within 1.5 s and fully within 3 s. A pause in one connection barely moves the figure.
- **Before #246,** the speed was measured over a single 256 KiB step, about 80 ms at 3 MiB/s, and it jumped between KiB/s and GiB/s.

## Connection values

All are starting values, not yet tuned by measurement (#77, which was to measure them, was closed as not planned); the user can change them ([SETTINGS.md](SETTINGS.md#engine), #30).

| Value | Starting value | Where it comes from |
|---|---|---|
| Per-host cap | The performance profile's: 8 for Balanced, 2 to 16 for the others ([SETTINGS.md](SETTINGS.md#performance)) | Report section 5.5 (8, at most 16); PO decisions on #47 and #57. `set_engine_limits` changes it while transfers run, and libcurl's own per-host cap (`CURLMOPT_MAX_HOST_CONNECTIONS`) with it: with many small downloads at once, each keeping one connection, that is what bounds a host |
| Smallest piece (`Sizes::min_split`) | The profile's: 1 MiB for Balanced | PO decision on #57 |
| Shared budget (`CONNECTION_BUDGET`) | 48 | V1's `connection_budget`; PO decision on #47 |
| Window | max(2 s, 4 × RTT) | Report section 5.5 |
| Windows per count | 2, averaged | #47's 2 flat windows (report section 5.5); #221 |
| Loss that brings a connection back | 10% | #221: the gain #47 needed to add one; one connection of 8 that carries its share is worth 12.5%. 5% let noise keep a connection that didn't help on CI's Windows runner |
| Windows not measured after the count is set from outside | 1 | #221 |
| HTTP/2: gain that keeps connections of their own | 10% | Report section 5.5 |

**Measured** on the local test servers (Windows 11), with #47's climbing ramp. These check behaviour, not speed: no speed claim is made without a measurement (PO decision on #47; #77 was closed as not planned). #221 changed the ramp and its fixtures, and these rows haven't been measured again:

| Fixture | Expected | Observed |
|---|---|---|
| 4 downloads from one host, 8 asked for each, 2 MiB/s per connection | 2 each (`perHostCap`); Jain's index ≥ 0.9 | 2 each; Jain's index 1.000 in both engine modes |
| 1 MiB/s per connection, 8 asked for | Ramps up to 8 | 8 |
| 1 MiB/s per connection, 3 MiB/s per client, 8 asked for, 5 runs | Stops below the cap | Kept 3, at most 4 at once, every run |
| HTTP/2, 1 MiB/s per TCP connection, 5 runs | Connections of their own | 9 or 10 connections, 6 to 8 at once |
| HTTP/2, 1 MiB/s per stream, 5 runs | One multiplexed connection | 1 connection, 8 streams |
| 40 small files from one host | Reuse | 1 connection one by one; at most 8 at once |

The "at once" counts above are the server's. Since #154, the ramp fixtures check the engine's own count instead, `DownloadReport::peak_requests`.
