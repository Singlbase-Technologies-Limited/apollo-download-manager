# Engine: connections

How many connections a direct download uses, and what was measured ([engine internals](ENGINE_INTERNALS.md); split by #425).

## Connections (#47)

How many connections a download uses, and how they are shared. The PO decisions are on #47.

### What a download may use

A download's connections are the tightest of these, from the outside in:

| Limit | Where it comes from | Shown as |
|---|---|---|
| What it asked for | `TransferSpec::max_connections`, or `set_connections` later, at least 1 and at most the per-host cap | `requested` |
| Its share of the per-host cap and the shared budget | The engine, max-min fairly between the running transfers ([`budget.rs`](../crates/velocity-transfer/src/budget.rs)) | `perHostCap`, `sharedBudget` |
| A throttling server | A `429` or `503` halves the connections, keeps no more than the server was serving, down to one (#48, #247); remembered for the host while the engine runs | `serverThrottling` |
| What helps | Opening a step at a time ([Opening](#opening-247)), then the adaptive ramp ([`adaptive.rs`](../crates/velocity-transfer/src/adaptive.rs)) | `rampingUp`, `noGain`, `speedLimit` |
| What is left to split | No remainder of at least 2 × `min_split` | `fileSize` |

Snapshots carry the connections in use now (`Progress::connections`) and `connectionDetail`: `requested`, `allowed` and the tightest limit, `limitedBy` ([CONTRACTS.md](CONTRACTS.md)).

### Live changes

- **`set_connections`** changes the count while the transfer runs, without a restart: no new probe, and the part file and its coverage stay as they are.
- **More** take new leases at the next step of the download, splitting a live lease when nothing is unassigned.
- **Fewer** stop the newest requests. Each stops at its next write (`stop_at(0)`), the bytes it already delivered are kept, and the rest of its lease is leased again. The fixture checks that its changes waste no byte.
- **A paused transfer** keeps the count for when it resumes.

### Budgets and fairness

- **Per host:** at most 8 connections to one host name and port, shared by every transfer to it. libcurl's `CURLMOPT_MAX_HOST_CONNECTIONS` is set to the same 8, as the backstop: a fetch past it waits for a free connection.
- **Shared budget:** at most 48 connections across all transfers.
- **Max-min fair:** the engine shares both again whenever a transfer starts, ends or changes its count. Connections go one per transfer per round, so no transfer gets more while another that wants more has fewer; a small download's unused share goes to the others.
- **One each:** every running transfer keeps one connection, even past the caps, as a download makes no progress without one. How many transfers run at once is the queue's job (#50).
- **The budget always applies,** to a count set by hand too (PO decision on #47; V1 let a hand-set count ignore it).

### Adaptive connections

The asked-for count is the most a download may use, not a must (PO decision on #47). A download opens every connection it may use, a step at a time ([Opening](#opening-247)), and drops the ones that don't help (PO decision on #221):

- **Windows:** the ramp measures the body bytes received over a window of max(2 s, 4 × RTT). RTT is the shortest wait seen between a request and its answer.
- **Each count is measured for 2 windows,** and judged by their average speed. The first window after the count is set from outside (a new download, a ceiling that rose or fell) isn't measured: it holds the connections' start, and a test server's first burst once made every drop look like a loss (batch run 41178941474).
- **Drop while the speed holds:** the first count measured sets the speed to keep. The ramp then drops one connection, and if the speed without it stays within 10% of the best average at a higher count, it drops the next.
- **Bring back the one that helped, and judge it again:** when the speed without a connection falls by 10% or more, that connection comes back. The speed with it is measured afresh for 2 windows, then it is dropped and judged again. If the speed falls by 10% again, it stays and the ramp stops (`noGain`). If not, the first loss was a slow stretch, and the ramp goes on dropping (#281). At one connection it stops too.
- **Why it judges twice:** on CI's Windows runner, both windows without the 8th of 8 streams came in 15% slow, at a server where the count made no difference. The 8th came back, and the ramp held all 8 for the whole 128 MiB download (main run 41637850734). A connection that helps now costs 4 more windows before it is kept.
- **Noise keeps connections:** a slow measurement can only make the ramp keep one more, never lose one that helps. Since #281 a count must measure slow twice to be kept that way. Likewise, since #432, one more tried from a remembered count must measure fast twice before the ramp takes every connection.
- **Why it changed:** #47 started with one connection and added one per window while each added 10%, and stopped for good at the first window that didn't. Normal internet variation could stop it below the count asked for. On 2026-10-30 the app took 319 s for the 2.9 GB Ubuntu 26.04.1 server image, the engine with a fixed 8 connections 294 s, and V1 286 s (one run each, #221).
- **No decision** while fewer requests run than the ramp wants, at a file's tail for example: that speed says nothing about the count.
- **A lower ceiling** (the budget, the user, a throttling server) applies at once. **A higher one,** such as a count the user raised, is taken at once, and the ramp judges again (PO decision on #221).
- **While it tries fewer,** the download shows `rampingUp`, a name from #47's climbing ramp.
- **Example:** asked for 8, from a server that gives one client no more than 3 connections' worth, a download drops to 2, brings the 3rd back, drops it again to judge it a second time, keeps 3, and shows `noGain`.
- **Under a speed limit** (PO decision on #278), any count that reaches the limit gives the same speed, so the ramp halves the count at each step instead of dropping one: 8, 4, 2, 1. A halving that loses speed brings the dropped ones back, and from then on it drops one at a time, judging twice as above. With 8 asked for and 1 MiB/s, one at a time took about 39 s to reach 1 connection on releases.ubuntu.com (one run, 2026-11-03); halving takes 3 judgments instead of 7.
- **The limit as the reason:** once the ramp stops at a count whose fastest window came within 10% of the tightest limit, the download's own or the global one, it shows `speedLimit`, not `noGain`. A limit it doesn't reach, because the server is slower, leaves `noGain`. A global limit shared by several downloads gives each less than the limit, so they show `noGain`.
- **A changed limit** (set, lifted, raised or lowered) takes every connection again and judges again: a download held at 1 by a limit would otherwise stay at 1 once the limit is lifted.

`DownloadOptions::adaptive` is `None` for a fixed count, which the CLI uses to compare fixed plans.

### What a server allowed (#325)

What a download learns about its server outlives it, so the next download from that server starts at the right pace, after a restart too.

- **What is learned:** the count the adaptive ramp settled at when more connections stopped helping (`Tuning::NoGain`), and the most connections the server served before it throttled (#247). A count a speed limit chose says nothing about the server, and isn't kept. Keyed by the host and port libcurl counts connections by (`host_of`).
- **Where it goes:** the engine keeps both per host and sends `HostLearned`; the app keeps them in its database (`host_memory`, [DATA_AND_MIGRATIONS.md](DATA_AND_MIGRATIONS.md)) for 7 days, and gives them back with `set_host_memory` when it starts. The supervisor gives a restarted engine what it last had.
- **How a download uses it:** its ramp starts at the remembered count instead of at every connection it may use (`Ramp::starting_at`), and still judges from there. Before it settles at that count it tries one more, once: if that helps by `help_percent` in two measurements in a row, the server gives more now, and it takes the whole ceiling and judges again from the top. One measurement isn't enough (#432): on a busy CI runner a single fast stretch took a download remembered at 2 to all 4, the same noise #281 guards against when a connection is dropped. A remembered count can't hold a download below what the server now gives, and a server that still caps costs one extra count measured.
- **Measured (2026-11-06, Windows 11, local per-IP-throttled server that gives no more after 2 connections, 4 asked for, 3 runs each):** started fresh, the download kept 2 connections, ran at most 4 requests at once, and settled after 27.8 s in each run; started from a remembered 2, it kept 2, ran at most 3 at once (the one extra it tries), and settled after 24.2 to 24.3 s. The speed is the server's cap either way: what remembering saves here is connections and about 3.6 s of judging, not download time (`a_remembered_count_starts_the_download_there_and_one_more_is_tried_once` and `adaptive_connections_stop_below_the_cap_when_more_stop_helping` print these). A server that throttles is where it matters more: its count now outlives a restart, so the first download after one isn't refused again (#247); that case wasn't timed.

### Opening (#247)

A download doesn't ask for all its connections at once (PO decision on #247):

- **Doubling:** after the probe it opens one request, then 2, 4 and 8, each step once every request opened so far has received a byte. A fixed count and the CLI open the same way.
- **Fresh ranges, no splits:** leases are sized for the count the download is heading for, so a later step takes unassigned bytes instead of splitting a running request, and each request ends at its own end.
- **At the first `429` or `503`,** the download keeps no more connections than the requests the server was still serving (at least one), and opens no more ([Retries](ENGINE_RETRIES_LIMITS.md#retries-waits-and-stalls-48)).
- **Remembered per host:** the engine keeps that count, by host name and port, while it runs. A restart, a resume or another download from that host starts there, never asks for more, and asks once for the rest of each share.
- **Few requests once a server throttles:** after its first `429` or `503`, each connection asks once for the rest of its share (`Scheduler::ask_once`), and so does every later download from that host. With 32 MiB leases a 1 GB file took about 32 requests one after another, and proof.ovh.net refused about every second one, then this computer, after about 20 (2026-11-03). V1, on the same file and PC, made about 8 requests (the whole file, then 7 equal parts, as seen against the local test server) and wasn't refused. Other servers keep 32 MiB leases: on the Ubuntu image Apollo Download Manager with them took 294 s and 326 s, V1 363 s, and Apollo Download Manager without a cap 385 s (#247).
- **Connections of their own once an HTTP/2 server throttles:** from then on each request gets a connection of its own (`Multiplex::Chosen(true)`), not a stream of the shared connection. proof.ovh.net answers `429` to a stream that comes while another is being answered on the same HTTP/2 connection, and serves the same requests on connections of their own: 4 ranges at once on 4 connections got four `206`s, and the same 4 as streams of one connection got `429`s (2026-11-04). Before this, the retries went on as streams of the shared connection, were refused, and the server blocked the computer.
- **Why:** proof.ovh.net serves one request per client at a time, answers the rest `429` within about 200 ms, and blocks a client for about 10 minutes after roughly 6 to 9 refusals in a few seconds. The old opening, all 8 at once after the probe, got the field-test PC blocked on its own (#247, 2026-11-02). Doubling costs a server like that one refusal.
- **The cost on other servers:** about three round trips to reach 8 connections. Not yet measured against the earlier timings (#221); it is to be measured on the Ubuntu ISO.

### TLS sessions (#327)

A download's extra connections, and later downloads from the same server, resume the first connection's TLS session instead of doing a full handshake. libcurl does this by itself: the engine runs every transfer on one `Multi` ([`fetch.rs`](../crates/velocity-curl/src/fetch.rs)), and libcurl 8.23.0 shares its TLS session cache among the easy handles of one `Multi`. No share handle is needed (PO decision on #327).

- **Verified (2026-11-06):** `later_connections_to_a_server_resume_its_tls_session` in [`crates/velocity-curl/tests/tls.rs`](../crates/velocity-curl/tests/tls.rs) makes 4 requests, each on a new connection of its own, to the TLS test front. The first is a full handshake and the other 3 resume, with TLS 1.3, on Windows (Schannel) and on Linux (OpenSSL 3.5, WSL2). The test guards it across libcurl updates.
- **Not tested here (libcurl's documented behaviour):** a session is offered only to the host, port and TLS settings it was made with, so a session from one server is never offered to another. Sessions live in memory only; nothing about them is written to disk.

### HTTP/2

- **Multiplexing first:** requests to one host wait for the connection being set up (`CURLOPT_PIPEWAIT`), and share it as streams if it speaks HTTP/2.
- **Then connections of their own, once:** when the ramp finds that more streams stop helping (`noGain`, not `speedLimit`: under a limit a faster way can't show), the download tries requests on connections of their own (`CURLOPT_FRESH_CONNECT` and `CURLOPT_FORBID_REUSE`), starting again with every connection it may use. Not after the server throttled the download: the restart would ask while the stopped streams are still being answered, and be refused (#247).
- **The faster way is kept:** connections of their own stay only if their best speed beats the best multiplexed one by 10%. Otherwise the download goes back to the multiplexed count. Changing the way stops every request first, so each way is measured on its own.
- **`DownloadReport::own_connections`** says which way was kept.
- **A split** resets only its stream; the connection stays.
