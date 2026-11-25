# Engine: retries and limits

How the transfer engine retries, waits out stalls, and keeps to speed limits without growing its buffers. Part of the engine's internals ([ENGINE_INTERNALS.md](ENGINE_INTERNALS.md)); split from ENGINE_SCHEDULER.md by #425.

## Retries, waits and stalls (#48)

A failure is classified first ([`failure.rs`](../crates/velocity-transfer/src/failure.rs)), and the retry policy then decides from its class alone ([`retry.rs`](../crates/velocity-transfer/src/retry.rs)). The messages use V1's words where V1 had them.

| Class | Examples | What happens |
|---|---|---|
| Transient | No answer, or a connection broken during the request; a name that doesn't resolve; no network on this computer; a refused connection; the 30 s connect timeout; a failed TLS handshake; `408`; other `5xx`; a stall | Retried after a wait |
| Throttled | `429`, `503` | Retried after at least what `Retry-After` asks for (seconds or an HTTP date), up to 10 minutes. Without `Retry-After`, at least 60 s, as in V1. The download's connections are halved, and kept to no more than the requests the server was still serving, down to one. The engine remembers that count for the host ([Opening](ENGINE_CONNECTIONS.md#opening-247)). From then on each connection asks once for the rest of its share (`Scheduler::ask_once`, #247). A wait of 30 s or less stays Downloading, with no error shown (PO decision on #247). When the server then refuses connections (the connection is refused or times out), the wait is 60 s, doubled for each refusal in a row, up to 10 minutes: "The server is refusing connections from this computer for now, after asking Apollo Download Manager to slow down." A name that doesn't resolve, or no network on this computer, is never taken for that refusal: it's retried as a transient failure (#335) |
| Permanent | `401`, `403`, `404`, `410`, other `4xx`; an untrusted certificate; too many redirects; a protocol outside the allowlist; an answer that contradicts itself; a full disk, or a folder Apollo DM may no longer write to | Never retried. A full disk or a refused write checkpoints what reached the disk when a sync still works, and keeps the part file whenever a checkpoint exists, so the user's retry, once it is fixed, resumes (#74) |

**No network on this computer** (#335): libcurl reports every failed connect as error 7. The libcurl layer reads the OS error behind it (`CURLINFO_OS_ERRNO`). No route from this computer (`WSAENETDOWN`, `WSAENETUNREACH` or `WSAEHOSTUNREACH` on Windows; `ENETDOWN`, `ENETUNREACH` or `EHOSTUNREACH` on Linux and macOS) makes it `CurlFailure::NoNetwork`. A refusal, or no OS error at all, stays `Connect`. Verified on Windows 11 with the engine's command line: a link to `2001:db8::1`, on a network without IPv6, gives `NoNetwork`, and a closed local port gives `Connect`. Not verified on Linux or macOS.

### Inside a download

- **What is retried:** the probe, each range segment, each sequential range and the single stream.
- **A failed segment** frees its connection for the wait. A new lease then takes the rest, under a new id. The other connections go on in the meantime.
- **The wait:** it doubles from 1 s up to 60 s, with full jitter, which means a random wait between zero and that value (`fastrand`).
- **Bounded:** a download gives up after 5 failures in a row with no new byte in between. A retry that brings new bytes starts the count again, so every retry either makes progress or brings the end closer.
- **The probe:** a probe whose answer gave the file's total and was then cut off isn't retried. Its bytes are kept, and the range scheduler fetches the rest.
- **A connection cut after it brought bytes** isn't an anomaly and costs no retry: the rest of its lease is leased again at once (#333). Its bytes are progress, and a server reset can cut every connection at the same moment. Counted as an anomaly, as it was until #333, two cuts sent a 115 GiB download back to byte 0 as one stream, and its progress froze at 24.6 GB.
- **A connection cut before its first byte** is an anomaly, because nothing shows that ranges work there. A stall and a connection that fails before any answer count as failures, not anomalies.

### Stalls

- **The rule:** a stall is time in which a request brings too little from the network: no byte, or less than `RetryPolicy::least_rate_bps` (1 KiB/s) over the stall time, so 15 KiB in 15 s (#292, PO decision on #257). A connection that trickles a few bytes now and then is therefore stalled, as V1's `lowest_speed_limit_kib` had it. A slow but steady transfer above the floor is never reset.
- **Stalled after 15 s:** with too little, the download shows Stalled ("No data received"). With several connections, it shows Stalled only when every one of them brings too little. A few bytes don't end a stall; a request that brings the floor again does (`Segment::Moving`, `Control::moving`).
- **Reset after 30 s:** with too little, the request is cancelled and retried like any failure. These replace the prototype's fixed 60 s limit. The floor is a starting value, not a measurement; it isn't a setting.
- **A speed limit is never a stall:** while a speed limit applies to the download, its own or the global one, any byte counts as progress, so a request the user slowed is never reset. A limit set while a request runs applies to its next request.
- **Disk waits don't count:** the clock (`Slowness`) runs only while the forwarder or the single-stream reader waits for libcurl. Time spent waiting for a slow disk is never taken for a stall ([engine-mode-costs.md](research/engine-mode-costs.md) measured disk stalls of up to 57 s).

### The whole download

A download that still fails in a way worth retrying is started again by the engine (V1's `app_retries`):
- unless no try of that start reached the server: a name that didn't resolve, no network on this computer, or a connection refused or timed out. Those 5 tries are all, and the download fails (`DownloadError::Unreachable`, PO decision on #245). A server that accepts the connection and doesn't answer is still started again;
- at most 2 times; then, for a transient failure, again while it has had no new byte for less than 5 minutes (`RetryPolicy::ride_out`, PO decision on #317), at least every 60 s, so a Wi-Fi drop, a router restart or waking from sleep is ridden out;
- after 5 s and then 10 s, or 60 s and then 120 s when the server was throttling, never more than 15 minutes;
- from its last checkpoint when it has one (its part file was kept), otherwise from the start.

While it waits, the snapshot shows Retrying, with the failure's message and "Retrying automatically (1 of 2).", and past the 2 "Retrying automatically for up to 5 minutes.". A request's own retry within a start shows its failure too, with "Trying again (2 of 5).": the try that comes next, of the 5 a start makes (#245). Once bytes come again, the error is cleared. A cancel during the wait removes the kept part file. A permanent failure is never started again. Retrying by hand is the manager's, and never a second automatic retry ([ENGINE_CONTRACT.md](ENGINE_CONTRACT.md#retrying-removing-and-clearing-58)).

### The values

All of them are starting values to tune by measurement, not requirements (PO decision on #48). `RetryPolicy::DEFAULT` holds them, and the connect timeout is `LoopOptions::connect_timeout`. The user's engine settings replace them (`set_engine_settings`, transfer contract version 14; [SETTINGS.md](SETTINGS.md#engine), #30), for downloads that start or retry after a change. The engine in the app's process also takes a policy with `InProcessEngine::start_with`.

### Statuses

`Control::with_status` reports Retrying while a download waits, with when it tries again (#59), Stalled while no byte comes, and Downloading when bytes come again, each change once. With several connections, Retrying shows only when every connection waits, and its time is the first to try again. A restart of the whole download reports its own time, never the last request's. The engine puts them in the snapshot. An engine that hangs without exiting is the supervisor's ([ENGINE_PROTOCOL.md](ENGINE_PROTOCOL.md#supervisor)).

## Speed limits and back-pressure (#49)

### Speed limits

- **Two limits per transfer:** each transfer has its own limit (`TransferSpec::limits`, changed by `set_limits`), and every transfer also draws from the engine's global limit (`set_global_limits`). The lower of the two applies.
- **Sharing:** whatever the global allowance a transfer doesn't use goes to the others. With a global 4 MiB/s and one download held to 1 MiB/s, another download gets the remaining 3 MiB/s.
- **Token buckets** ([`rate.rs`](../crates/velocity-curl/src/rate.rs)): each limit is a token bucket, `RateLimit`. It refills at its rate, and keeps at most 250 ms of unused allowance (a starting value).
  - Each request of a download draws from its download's bucket and the global one.
  - When a bucket has no tokens, libcurl's write callback pauses the transfer (`CURL_WRITEFUNC_PAUSE`), and libcurl keeps the bytes.
  - The libcurl loop thread checks every 10 ms, and resumes the transfer once all its buckets have tokens again.
  - A write is taken whole while a bucket has any tokens. So a bucket owes at most one write (16 KiB), and later writes wait until it is paid back.
- **Fair turns:** resuming a transfer hands it libcurl's kept bytes at once. So the order of resuming turns each round, and no transfer always comes last to a shared bucket.
- **Live changes:** a limit's rate changes at once. The next write sees it, so a change applies within one loop round (10 ms).
- **Why not libcurl's own cap:** `CURLOPT_MAX_RECV_SPEED_LARGE` is "not an exact science" by its own documentation, and its documentation doesn't say whether it can change during a transfer (report open question 3).
- **The smallest limit is 1 KiB/s,** V1's unit. A lower one is refused with `INVALID_INPUT`. A low limit is bursty, as data arrives in writes of up to 16 KiB, but its average holds.
- **HTTP/2:** a paused stream may still receive up to one stream window of data, which libcurl keeps (curl_easy_pause documentation). The HTTP/2 policy is in [Connections](ENGINE_CONNECTIONS.md#connections-47).
- **After a restart:** the supervisor gives every new engine the global limit the old one had. A transfer's own limit is in its spec, which the app passes again when it resumes the transfer.

**Measured** on the local test server (Windows 11, `tests/limits.rs`):

| Case | Expected | Measured |
|---|---|---|
| Global 4 MiB/s, 3 downloads, over 10 s, 8 runs | 4.00 MiB/s | 3.997 to 4.003 MiB/s |
| The same over 30 s, by hand | 4.00 MiB/s | 4.000 MiB/s |
| 0.5 MiB/s raised to 4 MiB/s, the 2 s after the change, 5 runs | 4.00 MiB/s | 3.975 to 3.983 MiB/s |
| 1 MiB/s download under a global 4 MiB/s, 5 runs | 1.00 MiB/s | 1.022 to 1.031 MiB/s |
| The other download, 5 runs | 3.00 MiB/s | 2.972 to 2.978 MiB/s |

### Back-pressure

A slow disk slows the network instead of growing memory. This was built in #37 and #38 and is now measured:

- **Per request:** each request holds at most `LoopOptions::buffer_bytes_per_fetch` (1 MiB) for the writer. When that buffer is full, libcurl's write callback pauses the transfer, and the reader resumes it once half is free.
- **The queue:** at most 2 events per connection wait between the requests and the writer.
- **Measured:** `DownloadReport::peak_buffered_bytes` reports the most one request held at a time. The slow-writer test stalls the writer for 2 s, and checks that each buffer filled and never went past its cap by more than one 16 KiB write.
- **The kernel's share:** the sockets' own buffers belong to the kernel. They hold more, depending on the system, and on Windows they kept growing during a pause (#147, #150). Only Apollo Download Manager's own buffers are checked exactly.
