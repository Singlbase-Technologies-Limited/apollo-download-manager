# Torrent peer discovery, trackers and performance (#352)

**Date:** 2026-11-06. **Question it answers:** how the app's torrents find peers and how fast they download today, measured, and which changes are worth trying next.

This is research, not a decision. It changes no engine behaviour. Each proposed change is its own issue, to be measured before and after.

**Code read at:** `92d626b` (`main`), with libtorrent-rasterbar 2.0.15. **Measured with:** the torrent helper built from that commit in release mode.

**How facts are marked:**

- **Code:** read in this repository at that commit.
- **libtorrent:** read in libtorrent 2.0.15's source (`src/settings_pack.cpp` at tag `v2.0.15`).
- **Measured:** from the runs in part D.
- **Assumed:** not checked; a reason to measure.

## Short answer

- **Small torrents are fast and steady.** Debian's 0.8 GB image finished in 88 to 95 s in all six runs, at 8.3 to 8.8 MiB/s.
- **Large ones are not.** Ubuntu's 2.9 GB image took 323 and 346 s in two runs of six, and 764 to 1321 s in the other four, at both times of day. The peak speed was the same each time, so something slows a long download down. The measuring tool only kept a summary, so it can't say when. That is the first thing to find out.
- **Peers are found quickly.** The first peer came within 0.5 to 5 s, and the metadata within 0.5 s, in all twelve runs.
- **Most of the engine runs on libtorrent's defaults.** The app sets discovery, ports, limits and the proxy; choking, piece picking, uTP and the disk are libtorrent's choices.
- **One privacy bug was found and fixed:** the Extra trackers setting reached private torrents (#377).

## A. What the app sets today

From `crates/velocity-torrent/src/engine.rs` (`session_config`) and `crates/velocity-lt/cpp/shim.cpp` (code):

| Setting | The app's value | Note |
|---|---|---|
| Listening | `0.0.0.0` and `[::]` on port 6890 | The user can change the port |
| DHT | On | Through a proxy, only with SOCKS5 |
| Peer exchange | On | Per torrent; libtorrent turns it off for private torrents |
| Local peer discovery | Off | Off through any proxy |
| Port mapping (UPnP, NAT-PMP) | Off | One setting for both; off through any proxy |
| DHT bootstrap nodes | libtorrent's own unless the user sets some | libtorrent's default is `dht.libtorrent.org:25401` (libtorrent) |
| Peers per torrent | 55 | `max_connections` per torrent |
| Global connections | Not set | libtorrent's default, 200 (libtorrent) |
| Rate limits | The user's | Global and per torrent |
| Queue (`active_downloads`, `active_seeds`, `active_limit`) | -1, no limit | The app schedules torrents itself |
| Proxy | Hostnames, peers and trackers all through it | |
| Extra trackers | The user's list, at most 64 | Added to every public torrent (#377) |

**Left to libtorrent 2.0.15** (libtorrent), with their defaults:

| Area | Default |
|---|---|
| Choking | `fixed_slots_choker`, 8 unchoke slots; seeding `round_robin` |
| uTP and TCP | Both on, incoming and outgoing; mixed mode `peer_proportional` |
| Connecting | 30 connection attempts a second, `torrent_connect_boost` 30, `peer_connect_timeout` 15 s |
| Peer timeouts | `peer_timeout` 120 s, `inactivity_timeout` 600 s, `min_reconnect_time` 60 s, `max_failcount` 3 |
| Peer list | 3000 per torrent, 1000 while paused |
| Requests | `request_queue_time` 3 s, up to 500 outstanding, `piece_timeout` 20 s, `request_timeout` 60 s, `strict_end_game_mode` on |
| Turnover | `peer_turnover` 4 % every 300 s, below 90 % of the limit |
| Disk | 10 I/O threads, 1 hashing thread, memory-mapped writes, the system's cache |
| Trackers | `announce_to_all_trackers` and `announce_to_all_tiers` off |

**After a restart:** a torrent's own trackers come back with its resume data. The user's extra trackers are added again from the settings when the torrent is restored (code).

## B. Public tracker lists

Some download managers add a long list of public trackers to every torrent, to find more peers. The options for the PO:

| Option | What it means | Cost |
|---|---|---|
| **1. None** (today) | A torrent's own trackers, DHT and peer exchange | Fewer peers for a poorly tracked torrent |
| **2. The user's own list** (today's Extra trackers) | The user pastes a list they trust | The user has to find and maintain one |
| **3. A list shipped with each release** | A list chosen and checked at release time | Goes stale between releases; the project vouches for those trackers |
| **4. A list fetched and refreshed online** | The app downloads a public list now and then | A network call beyond the downloads, which needs PO approval (AGENTS.md, "No telemetry"); the list's publisher decides what the app announces to |

**For every option:**

- **Privacy:** each extra tracker learns the user's address and the torrent's info hash. [PRIVACY.md](../PRIVACY.md) would have to say so.
- **Private torrents never get them.** That rule is now enforced and tested (#377).
- **Dead trackers** cost an announce each and are retried; libtorrent backs off after failures (libtorrent's tracker back-off, assumed, not measured here).
- **Legal:** public trackers are used for all kinds of content. Whether the project should point users at any is for the PO and Singlbase.

**Not measured:** whether a public list finds more peers for the well-seeded torrents in part D. They already reached the 55-peer limit, so it likely wouldn't help there (assumed).

## C. Performance and reliability

Each item is a hypothesis with a way to test it.

| Area | What might help | How to test |
|---|---|---|
| **Long downloads slowing down** | Find where Ubuntu's slow runs lost speed: at the end (end-game), mid-way (peers lost), or on the disk | Record a time series per run (#386) |
| **Peers per torrent** | Above 55, if a torrent is limited by peers | Runs at 55 and at 100 on the same torrent; every run here already reached 51 to 55 peers |
| **Incoming connections** | Port mapping on, so peers behind other NATs can connect in | Runs with port mapping on and off, counting incoming peers |
| **Local peer discovery** | Peers on the same network | Only matters on a LAN with other clients; not worth measuring now |
| **uTP and TCP** | libtorrent's mixed mode defaults are tuned for being polite on a shared line | Leave as is unless a measurement points here |
| **Disk** | Memory-mapped writes are libtorrent 2.0's default | Watch the helper's memory and the disk queue in the time series |
| **Recovery** | Already tested: a killed helper is restarted and its torrents carry on (`crates/velocity-torrent/tests/lifecycle.rs`) | Field test R6 (`tests/field/CHECKLIST.md`) |

## D. Measurement

### The method

`crates/velocity-torrent/examples/torrent_baseline.rs`, run by hand, never in CI:

```sh
cargo build --release -p velocity-torrent --bin velocity-torrent --example torrent_baseline
target/release/examples/torrent_baseline target/release/velocity-torrent <.torrent file> <work folder> <runs>
```

- **Each run starts fresh:** a new helper with the app's default settings, in a new folder, so it remembers no peers or DHT nodes.
- **Only the port differs:** 6891, so it can't clash with a running app.
- **What it reports:** times to the metadata, the first peer and the first byte, and to completion; the mean speed from the first byte; the peak speed as the best 5 seconds, so one burst isn't called a speed; and the most peers and seeds seen.
- **It cleans up:** each run's download is deleted.
- **Its sums are tested:** `cargo test --no-default-features -p velocity-torrent --example torrent_baseline`.

### The torrents

| Torrent | Size | From |
|---|---|---|
| Debian 13.7.0 netinst, amd64 | 0.79 GB | `cdimage.debian.org/debian-cd/current/amd64/bt-cd/` |
| Ubuntu 26.04.1 live server, amd64 | 2.93 GB | `releases.ubuntu.com/26.04.1/`, the same file as the HTTP speed runs |

### The results, Windows 11, the PO's PC and connection

**Set 1, 2026-11-06 from 20:01** (measured):

| Run | Torrent | Metadata | First peer | First byte | Done | Mean | Peak | Peers |
|---|---|---|---|---|---|---|---|---|
| 1 | Debian | 0.5 s | 1.5 s | 4.5 s | 94 s | 8.43 MiB/s | 13.63 MiB/s | 51 |
| 2 | Debian | 0.5 s | 0.5 s | 3.5 s | 95 s | 8.29 MiB/s | 12.99 MiB/s | 55 |
| 3 | Debian | 0.5 s | 1.0 s | 7.5 s | 94 s | 8.78 MiB/s | 12.99 MiB/s | 55 |
| 1 | Ubuntu | 0.5 s | 2.0 s | 5.5 s | 1205 s | 2.33 MiB/s | 12.99 MiB/s | 55 |
| 2 | Ubuntu | 0.5 s | 5.0 s | 15.0 s | 1321 s | 2.14 MiB/s | 10.84 MiB/s | 55 |
| 3 | Ubuntu | 0.5 s | 1.5 s | 6.0 s | 323 s | 8.81 MiB/s | 13.72 MiB/s | 54 |

**Set 2, 2026-11-06 from 23:11** (measured):

| Run | Torrent | Metadata | First peer | First byte | Done | Mean | Peak | Peers |
|---|---|---|---|---|---|---|---|---|
| 1 | Debian | 0.5 s | 1.5 s | 3.5 s | 91 s | 8.67 MiB/s | 12.33 MiB/s | 54 |
| 2 | Debian | 0.5 s | 0.5 s | 2.5 s | 88 s | 8.83 MiB/s | 14.88 MiB/s | 46 |
| 3 | Debian | 0.5 s | 0.5 s | 3.0 s | 91 s | 8.62 MiB/s | 13.78 MiB/s | 54 |
| 1 | Ubuntu | 0.5 s | 2.0 s | 3.5 s | 346 s | 8.15 MiB/s | 12.63 MiB/s | 55 |
| 2 | Ubuntu | 0.5 s | 2.0 s | 28.6 s | 764 s | 3.80 MiB/s | 13.03 MiB/s | 52 |
| 3 | Ubuntu | 0.5 s | 2.0 s | 7.5 s | 1189 s | 2.36 MiB/s | 12.93 MiB/s | 55 |

**Spread over both sets** (measured): Debian 88 to 95 s, median 92 s. Ubuntu 323 to 1321 s, median 976 s; 2 of 6 runs near the direct-download time, 4 slow.

### What the numbers say

- **Repeatable for Debian:** all six runs within 7 s, at both times of day.
- **Not for Ubuntu:** the fast runs match Debian's speed, and the slow ones reached the same peak. It happened at both times of day, so it isn't only the hour. While watching run 1, its download was at 2.79 of 2.93 GB and gaining about 0.6 MB/s, so at least part of the time went at the end. That is one observation, not a measurement.
- **Against direct downloads:** single HTTP downloads of the same Ubuntu file took 286 s in V1 and 294 to 319 s in the app on this connection (2026-10-30, one run each). Ubuntu run 3, at 323 s, is close to that. The two slow runs are not.

## E. The plan

In the order recommended, each its own issue. Which release each goes in is the PO's choice.

| Issue | Change | Expected benefit | Risk | Size | How it's measured |
|---|---|---|---|---|---|
| #386 | The measuring tool records a time series: speed, peers, seeds and pieces every half second | Shows where long downloads lose speed | None: a tool only | Small | It finds the slow stretch in a repeat of the Ubuntu runs |
| #387 | Then, depending on what #386 finds: end-game settings, peer turnover, or request timeouts | Long downloads as steady as short ones | Medium: libtorrent settings change for everyone | Medium | Ubuntu runs before and after, at least 3 each, at two times of day |
| #384 | Port mapping: decide its default (PO) | More peers can connect in | Opens a port on the router | Small | Incoming peer counts with it on and off |
| #385 | Public tracker list: decide among part B's options (PO) | More peers for poorly tracked torrents | Privacy, legal | Depends on the option | Peers found on a poorly tracked torrent with and without |
| #388 | Linux: repeat the method there | Shows whether the slow stretch is the same on Linux | None | Small | The same tool |

**Not proposed:** changing the peer limit, uTP or the disk settings. Nothing measured points there yet.
