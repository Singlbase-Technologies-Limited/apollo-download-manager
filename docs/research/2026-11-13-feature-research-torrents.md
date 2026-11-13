# Torrent clients: features and Apollo Download Manager's status (input for #427, scope D)

An appendix of the [feature research report](2026-11-13-feature-research.md) (#427), on torrent clients. It is the research agent's catalogue as written; the report checks and ranks it.

**Date:** 2026-11-13. **Repository read at:** `ddbf6b6` (`main`), libtorrent-rasterbar 2.0.15 in the torrent helper.
**Reuses:** `docs/research/2026-11-06-torrent-performance.md` (#352): what the engine sets, public tracker options (#385), port mapping (#384), long-torrent slowness (#386/#387), Linux baseline (#388). This file doesn't repeat those findings; it points to them.

**How facts are marked:**

- **VERIFIED:** read on the project's own site, docs, wiki or repository, checked 2026-11-13.
- **REPORTED:** third-party source, or inferred from repository signals.
- **Code:** read in Apollo DM's repository at `ddbf6b6`.
- **Assumed:** not checked.

Complexity is for Apollo DM: **S** (setting or command over something libtorrent already does, plus UI), **M** (new manager behaviour, persistence or UI view), **L** (new subsystem, new trust boundary or PO decision on legal/dependencies).

## 1. Clients

| Client | Platforms | Licence | Last release (as read 2026-11-13) | Engine | Mark |
|---|---|---|---|---|---|
| qBittorrent | Windows, Linux, macOS, FreeBSD, OS/2 | GPL-2.0-or-later (Assumed: licence not on the home page) | 5.3.0, 2026-10-19 (news page) | libtorrent 2.1.x by default, 1.2.x build kept | VERIFIED |
| Transmission | Windows (Qt), Linux (GTK), macOS (native), daemon | Open source (licence not named on the home page; GPL-2.0/3.0 with MIT parts, Assumed) | 4.1.4, 24 Oct (2026 by asset timestamps), security fixes | Own engine | VERIFIED |
| Deluge | Windows, Linux, macOS (daemon + GTK, Web and console clients) | GPL-3.0 (Assumed; site blocked the fetch) | Latest tag `deluge-2.2.0` (no GitHub releases; date not read) | libtorrent | VERIFIED (tags), site BLOCKED |
| BiglyBT | Windows, macOS, Linux (SWT), Android | GPL-2.0 | 4.1, 2026-05-19 (home page news) | Own Java engine (Azureus/Vuze lineage) | VERIFIED |
| Tixati | Windows, Linux, Android | Freeware, licence not named ("100% Free") | 3.44, 2026-06-21 | Own engine | VERIFIED |
| rTorrent / ruTorrent | Linux/Unix (terminal; ruTorrent is a PHP web UI) | GPL-2.0 (Assumed) | rTorrent 0.16.28, 11 Nov (year not shown; Assumed 2026) | libtorrent (rakshasa, not rasterbar) | VERIFIED |
| PicoTorrent | Windows | MIT | v0.25.0, 2021-05-12: effectively unmaintained | libtorrent-rasterbar | VERIFIED |
| Fragments | Linux (GNOME, Flatpak) | GPL-3.0-or-later | 3.0.1, 2024-05-30 | Transmission | VERIFIED |
| Free Download Manager (FDM) | Windows, macOS, Linux, Android | Freeware | 6.x (date not read) | Own (BitTorrent "supported"; details not documented) | VERIFIED (feature list), torrent details REPORTED |
| Motrix | Windows, macOS, Linux, headless | MIT | 2.4.1 (date not shown) | Own fork of aria2 | VERIFIED |

**Notes:**

- **qBittorrent 5.3.0** added I2P settings, IP range banning, session pause, RSS rule export/import, "match all share limits"; 5.2.0 added per-category share limits and WebUI API keys; 5.2.1 fixed an SSRF via HTTP redirect in the WebUI (VERIFIED, news page). A useful warning for Apollo DM: qBittorrent says libtorrent 2.1.x may read slower for heavy seeders.
- **Transmission 4.1.0** added sequential download; 4.1.3/4.1.4 fixed an RPC CORS nonce leak and hardened `torrent-add` (VERIFIED): a reminder of what a remote-control API costs in security.
- **Tixati 3.43** rewrote DHT with Sybil screening, added PCP and port mapping over VPN, and episode detection in RSS filters (VERIFIED).
- **Motrix** bundles an aria2 fork: a feature reference only; Apollo DM never uses aria2 (AGENTS.md).

## 2. Features

Columns: **Clients** uses qB = qBittorrent, Tr = Transmission, De = Deluge, Bi = BiglyBT, Tx = Tixati, rT = rTorrent/ruTorrent, Pi = PicoTorrent, Fr = Fragments, FDM, Mo = Motrix. **lt** says whether libtorrent 2.0 already does the work (VERIFIED from libtorrent.org unless marked).

| # | Feature | What it is | Clients | User problem | Benefit | Size (lt) | Depends on | Risks | Apollo DM status + evidence | Rec. | Prio |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Sequential download / streaming while downloading** | Pieces in order (with first/last piece first) so a video plays before completion | qB, Tr (4.1+), De (2.x), Bi ("play now"), Tx (adjustable aggressiveness), FDM (preview, REPORTED) | Wants to watch or check a video now, not in 40 minutes | Top-requested torrent feature in every client | S–M (lt: yes, `set_sequential_range`, `set_piece_deadline`, sequential flag) | #2 (preview) | Hurts swarm health if always on (REPORTED); keep per-torrent, off by default | **Missing:** the bridge has no sequential or deadline call (`crates/velocity-lt/src/lib.rs`, `ffi` functions list) | Yes | 1 |
| 2 | **Preview / open a file before it finishes** | Open the media file in the system player once the start is there | Bi, FDM (REPORTED for torrents), qB (via sequential + open) | Same as #1 | Turns #1 into a one-click action | M | #1, per-file progress (#4) | Opening a partly-written file in another app; only for media types | **Missing:** "Open file" exists only for done files (`src/features/downloads/menus.tsx`) | Yes | 2 |
| 3 | **File priority (high/normal/low), not just on/off** | Download some files first | qB, Tr, De, Bi, Tx, Pi | A season pack: wants episode 1 first | Control without dropping files | S (lt: 0–7 priorities; bridge already takes `u8`) | — | — | **Partial:** only skip (0) or normal (4) (`crates/velocity-lt/src/lib.rs` `AddParams.file_priorities` comment; `src/features/torrents/ChooseFilesDialog.tsx`) | Yes | 2 |
| 4 | **Selective files + per-file progress** | Choose files; see each file's progress | All | Which file is done? | Can open finished files early | S (lt: `file_progress`; bridge already reads `done`) | — | — | **Partial:** choosing files done (#63, `src/features/torrents/FileTree.tsx`); per-file progress read by the bridge (`crates/velocity-lt/cpp/shim.cpp` `file_progress`) but not shown (`docs/PARITY.md`, row "Torrents: file tree") | Yes (finish) | 2 |
| 5 | **Alternative speed limits by schedule** | A second limit set ("turtle mode") switched by time and day, or by a button | qB, Tr, De (Scheduler plugin), Tx (event scheduler), rT (Scheduler plugin) | Full speed at night, light during work or calls | Classic must-have; one click to "go slow" | M (lt: rate limits live; schedule is app logic) | Existing schedule code (`crates/velocity-core/src/manager/start_time.rs`, queue schedule) | Must cover direct downloads too for consistency | **Partial:** a start/stop window for downloads (`docs/user/settings.md` "Use the schedule"), global torrent limits (`docs/user/settings.md` BitTorrent); no second limit set, no time-based limits | Yes (for all downloads, not only torrents) | 1 |
| 6 | **Peers view and per-peer actions** | Peer list with client, country, flags, speed; ban/add peer | qB, De, Bi, Tx, rT (GeoIP) | Diagnose a slow torrent; ban a bad peer | Power users, support | S–M (lt: peer_info; `connect_peer` already bridged) | GeoIP needs a database (dependency, licence) | Country DB licence | **Partial:** connected peers listed (`src/features/torrents/TorrentSection.tsx`); `connect_peer` in bridge (`crates/velocity-lt/src/lib.rs`) but no UI "add peer", no ban | Maybe (add/ban: yes; GeoIP: PO) | 3 |
| 7 | **Connections settings** | Global connection limit, upload slots, uTP/TCP mode | qB, Tr, De, Tx | Router overload or too few peers | Tuning | S | #387 measurements | Bad defaults | **Partial:** peers per torrent 55 (`docs/user/settings.md`); global left at lt default 200 (performance research, part A) | After #387 | 3 |
| 8 | **Tracker management (edit/add/remove per torrent)** | Edit a torrent's tracker list | qB, Tr ("tracker editing"), De, Bi, Tx, rT | Dead tracker; tracker moved | Rescue stalled torrents | S (lt: `add_tracker`, `replace_trackers`) | Passkey redaction rules | Passkeys (already redacted in UI and log) | **Partial:** status per tracker + Re-announce (`src/features/torrents/TorrentSection.tsx`, `docs/user/torrents.md`); extra trackers global (`docs/user/settings.md`); no per-torrent edit | Yes | 2 |
| 9 | **Public tracker list auto-add** | Add a known list of public trackers to new public torrents | Mo (auto-updated list), rT (Retrackers plugin), qB (option, "Automatically add these trackers") | Poorly tracked torrent finds few peers | More peers on weak swarms | S–M | PO decision | Privacy, legal, network call | **Open decision #385**; user list exists (`docs/user/settings.md` "Extra trackers") | Per #385 | — |
| 10 | **Private trackers after restart** | Keep tracker URLs (with passkeys) across restarts | All clients do | Private torrent finds no peers after restart | Correctness for private-tracker users | M (secret storage) | Keychain (ADR-0015), PO | Passkeys are secrets | **Missing (known):** `docs/user/torrents.md` "Not yet"; `docs/TORRENTS.md` "Not yet" | Yes | 1 |
| 11 | **DHT, PEX, LSD** | Trackerless peer discovery | All | — | — | done | — | — | **Done:** settings `torrent.dht`, `peerExchange`, `localPeerDiscovery` (`docs/user/settings.md`; `crates/velocity-torrent/src/engine.rs` `session_config`) | — | — |
| 12 | **Magnets + OS magnet/.torrent handler** | Register as the system handler for `magnet:` and `.torrent` | qB, Tr, De, Bi, Tx, Pi, Fr (clipboard detection), Mo | Clicking a magnet in any browser or app does nothing | Expected desktop integration | M (Tauri deep-link / file associations; installer changes) | Packaging, coexistence with V1 (#11, #27) | Must not steal V1's or another client's registration silently: ask | **Partial:** magnets in Add dialog and the browser extension (`docs/user/torrents.md`, `docs/user/browser.md`); no OS handler or file association (`src-tauri/tauri.conf.json` has none, grep) | Yes | 1 |
| 13 | **Clipboard detection** | Offer to add a copied magnet/link | Fr, FDM, Mo (REPORTED) | Copy-paste friction | Convenience | S | — | Clipboard privacy: opt-in | **Missing** (no clipboard code in `src/features/add/`, Assumed from grep) | Maybe | 3 |
| 14 | **Torrent queue (active download/seed limits, stalled rule)** | Limit active torrents; don't count stalled ones | qB, Tr (stalled after 30 min), De, Bi | Many torrents fight; dead torrent blocks a slot | Throughput | S (app schedules itself) | Queue code | — | **Done/partial:** torrents share "Simultaneous downloads" and have a seeding limit (`docs/user/settings.md`, `docs/user/torrents.md`); no stalled-torrent rule (Assumed) | Stalled rule: yes | 3 |
| 15 | **Seeding limits: ratio, time, idle; action at limit** | Stop, pause or remove when reached; per category | qB (per-category, "match all"), Tr (idle limit), De, Bi, rT (Ratio groups) | Wants to give back without seeding forever | Fair sharing | S | — | — | **Done:** time, ratio, either, until stopped (`src/features/torrents/SeedingFields.tsx`, `docs/user/torrents.md`); **missing** idle limit and "remove at limit" | Idle: maybe | 3 |
| 16 | **Automatic torrent management (category save paths)** | Category decides folder; changing category moves files | qB, De (Label), rT (AutoTools) | Files land in the right place | Organisation | — | — | — | **Done:** categories with folders, a torrent moves on category change (`docs/user/categories.md`; `crates/velocity-core/src/manager/categories.rs` `move_storage`) | — | — |
| 17 | **Move on completion / incomplete folder** | Download to a temp folder, move when done | qB, Tr (incomplete dir), De, rT (AutoTools) | Media library apps see half-files | Clean libraries | S–M (lt `move_storage`, already bridged) | #16 | Moves across drives | **Missing** for torrents (category moves only on manual change, `docs/user/categories.md`) | Yes | 2 |
| 18 | **Run program / script on completion** | Run a command when a torrent finishes | qB, Tr, De (Execute), rT | Automations (unpack, notify, import) | Power-user automation | M | — | Executes user programs: argument list, never shell (AGENTS.md) | **Missing** (no such setting in `crates/velocity-core/src/settings.rs`) | Maybe (PO: security trade-off) | 3 |
| 19 | **Force recheck / verification** | Re-hash files against pieces | All | Files moved/edited; suspect corruption | Repairs without re-download | S (lt `force_recheck` **already in the bridge**) | — | — | **Partial:** `force_recheck` in `crates/velocity-lt/src/lib.rs` and `cpp/shim.cpp`, but no caller in `velocity-torrent`, core or UI (grep) | Yes | 2 |
| 20 | **Torrent creation** | Make a `.torrent` (v1, v2, hybrid), private flag, web seeds, piece size | qB (+ "ignore dotfiles"), Tr, De, Bi, Tx, rT (Create plugin), Pi | Share own files | Complete client | M (lt `create_torrent` covers v1/v2/hybrid, web seeds, private, piece size) | File-safety rules for walking folders (links) | Links/reparse points in source folder | **Missing** | Maybe | 3 |
| 21 | **Web UI / remote control** | Control from a browser or phone | qB (WebUI + API keys), Tr (RPC 9091), De (Web UI, thin client), Bi, rT/ruTorrent, Fr (remote Transmission) | Headless box, NAS, control from phone | Big for servers | L | Auth, TLS, CSRF, new listening port | Large new attack surface (see Tr 4.1.3 CORS nonce leak, qB 5.2.1 SSRF) | **Missing**; local control only | Not now (PO) | 3 |
| 22 | **IP filter / blocklists** | Block peer IP ranges (eMule/PeerGuardian formats), auto-updated list | qB (+ manual range bans 5.3), Tr (blocklist URL), De (Blocklist plugin), Tx | Avoid known bad peers | Privacy feel (effectiveness REPORTED as limited) | S–M (lt `ip_filter`) | Optional list download = network call (PO) | False sense of privacy | **Missing** (no ip filter in `velocity-lt` `SessionConfig`) | Yes (local file, no auto-fetch first) | 2 |
| 23 | **Encryption settings** | Allowed / preferred / required | qB, Tr (default preferred), De, Tx (RC4) | ISP throttling of BitTorrent | Some ISPs | S (lt `in_enc_policy`, `out_enc_policy`, `allowed_enc_level`) | — | "Required" shrinks the swarm | **Missing:** not in `SessionConfig` (`crates/velocity-lt/src/lib.rs`); lt default `pe_enabled` applies | Yes | 2 |
| 24 | **Anonymous mode** | Generic user agent, no client version in handshakes | qB (warns it is weak alone) | Fingerprinting | Minor privacy | S (lt `anonymous_mode`) | — | Users over-trust it; private trackers may reject | **Missing** (`SessionConfig` has no field) | Maybe | 3 |
| 25 | **I2P / Tor** | Anonymous networks | qB (I2P since 5.3), Bi (I2P, Tor plugins), Tx (REPORTED) | Strong anonymity | Niche | M–L (lt: I2P via SAM bridge; needs an I2P router installed) | External I2P router; PO | Legal/reputation; resume data I2P mode refused today (`docs/TORRENTS.md` resume checks) | **Missing** (deliberately refused in resume checks) | No (later, PO) | 3 |
| 26 | **Network interface binding (VPN-only)** | Bind listening and outgoing to one adapter, so traffic stops if the VPN drops | qB (interface + address), Tr (`bind_address_ipv4/6`), De, rT | Leaks real IP when VPN drops | High privacy value, cheap | S (lt `listen_interfaces` device names, `outgoing_interfaces`; Windows needs adapter GUID) | Adapter enumeration (Tauri/OS) | If the adapter vanishes, nothing connects: must be clearly shown | **Missing:** hard-coded `0.0.0.0:{port},[::]:{port}` (`crates/velocity-torrent/src/engine.rs:175`) | Yes | 1 |
| 27 | **Watched folder auto-add** | Add `.torrent` files dropped in a folder | qB, Tr, De (AutoAdd), rT | Other tools/scripts drop torrents | Automation | M | File-safety, polling vs watcher | Untrusted files (already parsed safely) | **Missing** (no setting in `crates/velocity-core/src/settings.rs`) | Yes | 2 |
| 28 | **RSS automation with filters** | Feeds, include/exclude/regex rules, episode detection, auto-download | qB (regex, rule import/export 5.3), De (YaRSS2 3rd-party, REPORTED), Bi (subscriptions), Tx (episode detection), rT (RSS plugin) | Follow podcasts, Linux ISOs, releases automatically | Strong automation | L (new parser, feed polling = network calls, rule engine) | PO (network calls beyond downloads), XML parser dependency | Store/legal perception; feed content untrusted | **Missing** | Maybe (PO); legal-neutral if user supplies feeds | 2 |
| 29 | **Search integration / plugins** | Search torrent sites from the app | qB (community Python plugins; repo disclaims legality; "not managed by the core team"), Bi (meta search), Tx (search), rT (ExtSearch) | Find content in-app | Convenience | L | Python or own scraper, third-party sites | **High legal and store-policy risk:** results point to infringing content; plugins are executable code; app stores and the browser stores may reject; qB itself keeps them out of the core | **Missing** | **No** | — |
| 30 | **Super-seeding (BEP 16)** | Initial seeding mode for the first seeder | qB, De, Bi, Tx, rT (REPORTED for some) | Original seeder with low upload | Spreads a new torrent faster | S (lt: super-seeding flag) | Torrent creation (#20) | Only useful to initial seeders | **Missing; refused** in resume checks (`docs/TORRENTS.md`) | No (until #20) | 3 |
| 31 | **Web seeds (BEP 17/19)** | HTTP mirrors inside a torrent | All lt clients; Bi | Torrents with HTTP mirrors finish faster | Automatic | — (lt does it) | — | — | **Done implicitly:** lt uses a torrent's web seeds; checked as `http`/`https` in resume data (`docs/TORRENTS.md`). Adding web seeds by hand: missing | — | — |
| 32 | **v2 / hybrid torrents** | BEP 52 | qB, De (2.1+, REPORTED), Bi (2.5+), Pi, Tr (not confirmed) | — | — | done | — | — | **Done:** v1, v2-only, hybrid, v2 magnets tested (`docs/PARITY.md` row "Torrent v1, v2-only, hybrid and magnet downloads") | — | — |
| 33 | **Port forwarding (UPnP, NAT-PMP, PCP)** | Router forwards the port | All; Tx added PCP and mapping over VPN | Few incoming peers | More peers | done | — | — | **Done, off by default; open decision #384** (`docs/user/settings.md`) | Per #384 | — |
| 34 | **Statistics** | All-time up/down, ratio, session totals, charts | qB, De (Stats plugin), Bi (country stats), Tx (charts), rT (Trafic plugin) | "How much did I share?" | Insight | S–M | Persist totals | — | **Partial:** per-torrent all-time up/down and ratio (`docs/user/torrents.md` seeding counts "over the torrent's whole life"); no global statistics view (no `statistics` in `src/features`, grep) | Yes (simple) | 3 |
| 35 | **Per-torrent limits** | Down/up limit, max connections per torrent | qB, Tr (4.1.4 fix), De, Tx | One torrent hogs the line | Control | S | — | — | **Partial:** per-torrent upload limit live (`TorrentSection.tsx`, `set_torrent_upload_limit`); bridge has `set_limits(upload, download)` but no per-torrent download limit in the UI (`crates/velocity-lt/src/lib.rs`) | Yes | 2 |
| 36 | **Tags / labels** | Free tags beside one category; filters; auto actions | qB (tags + categories), De (Label), Bi (tags with auto actions), rT (labels) | Organise beyond one category | Organisation | M | DB migration | — | **Missing:** categories only (`docs/user/categories.md`); no tags in `src/features` (grep) | Maybe (all downloads) | 3 |
| 37 | **Embedded tracker** | Built-in tracker | qB (off by default, port 9000) | Share in a LAN/group | Niche | M | Listening port | Exposure | **Missing** | No | — |
| 38 | **Share mode / light seeding** | Seed only demanded pieces / light seeding | Bi (light-seeding 2.7), lt share mode | Help swarms without full download | Niche | S (lt share mode) | — | Refused in resume checks | **Missing; refused** (`docs/TORRENTS.md`) | No | — |
| 39 | **Swarm merging** | Combine swarms with identical files | Bi | More sources for the same file | Niche | L | — | — | **Missing** | No | — |
| 40 | **Free-disk-space check / preallocation** | Show free space; full allocation | qB (status bar 5.2), rT (DiskSpace plugin) | Disk fills mid-download | Fewer failures | S | — | — | Not checked for torrents (Assumed missing) | Yes (verify) | 3 |
| 41 | **Session pause / start paused** | Pause all torrents at once, start paused | qB 5.3 | Quick stop for gaming/calls | Convenience | S | — | — | **Partial (Assumed):** pause per download; "pause all" behaviour not checked for torrents | Verify | 3 |
| 42 | **SSL torrents / PCP / mapping over VPN** | lt SSL torrents; port mapping over VPN | Tx (PCP, VPN mapping 3.43) | VPN users get no incoming peers | Better on VPN | S–M (lt supports PCP, VERIFIED features page) | #26, #384 | — | **Missing** (UPnP and NAT-PMP only, `SessionConfig`) | With #26 | 3 |

**Unpack after download** (ruTorrent Unpack, Deluge Extractor) and **media info** are general download-manager features; they belong to scope A/B of #427, not here.

## 3. Sources

All checked 2026-11-13.

**qBittorrent**

- https://www.qbittorrent.org/ — features list, platforms (VERIFIED)
- https://www.qbittorrent.org/news — 5.3.0 (2026-10-19), 5.2.x notes, libtorrent 2.1 warning (VERIFIED)
- https://github.com/qbittorrent/qBittorrent/wiki/Explanation-of-Options-in-qBittorrent — interface binding, watched folders, alt limits and scheduler, ratio action, IP filter, embedded tracker, external program, uTP mode (VERIFIED)
- https://github.com/qbittorrent/qBittorrent/wiki/Anonymous-Mode — what it does, "no strong privacy guarantees" (VERIFIED)
- https://github.com/qbittorrent/search-plugins and https://github.com/qbittorrent/search-plugins/wiki/Unofficial-search-plugins — plugins community-maintained, Python 3, "at your own risk", users responsible for copyright law (VERIFIED)

**Transmission**

- https://transmissionbt.com/ — features, platforms, 4.1.4 (VERIFIED)
- https://github.com/transmission/transmission/releases — 4.1.4 (24 Oct), 4.1.3 security fixes, sequential in 4.1.0 (VERIFIED)
- https://github.com/transmission/transmission/blob/main/docs/Editing-Configuration-Files.md — alt-speed schedule, blocklist, encryption, watch dir, scripts, ratio/idle, queue/stalled, bind address, LPD/PEX/DHT, port forwarding, sequential, RPC (VERIFIED)

**Deluge**

- https://deluge-torrent.org/ — blocked by bot protection (BLOCKED)
- https://deluge.readthedocs.io/en/latest/ — doc index: Web UI, RPC (VERIFIED); bundled plugins (Blocklist, AutoAdd, Scheduler, Label, Execute, Extractor, Stats) are from memory (REPORTED, not re-read)
- https://api.github.com/repos/deluge-torrent/deluge/tags — latest tag `deluge-2.2.0` (VERIFIED)

**BiglyBT**

- https://www.biglybt.com/ — swarm merging, I2P, meta search, tags, v2 (2.5), light seeding (2.7), 4.1 on 2026-05-19 (VERIFIED)
- https://github.com/BiglySoftware/BiglyBT — GPL-2.0, platforms (VERIFIED); Tor plugin, streaming, RSS subscriptions not on these pages (REPORTED)

**Tixati**

- https://www.tixati.com/ — features, platforms (VERIFIED)
- https://www.tixati.com/news/ — 3.44 (2026-06-21), 3.43 DHT/PCP/RSS changes (VERIFIED)
- https://support.tixati.com/sequential_downloading — sequential aggressiveness (REPORTED via search snippet)

**rTorrent / ruTorrent**

- https://github.com/rakshasa/rtorrent/releases — 0.16.28 (VERIFIED)
- https://github.com/Novik/ruTorrent/wiki/Plugins — AutoTools, Scheduler, Ratio, Throttle, RSS, ExtSearch, Create, Retrackers, Trafic, Unpack, GeoIP (VERIFIED)

**PicoTorrent**

- https://github.com/picotorrent/picotorrent — MIT, Windows, v1/v2/hybrid, DHT/PEX/LSD/UPnP (VERIFIED)
- https://api.github.com/repos/picotorrent/picotorrent/releases/latest — v0.25.0, 2021-05-12 (VERIFIED)

**Fragments**

- https://apps.gnome.org/Fragments/ — features, Transmission backend, 3.0.1 (2024-05-30) (VERIFIED)
- https://gitlab.gnome.org/World/Fragments — GPL-3.0-or-later (VERIFIED)

**Free Download Manager**

- https://www.freedownloadmanager.org/features.htm — "BitTorrent support", preview of audio/video before completion (not tied to torrents), platforms (VERIFIED); torrent-specific settings (REPORTED: not documented)

**Motrix**

- https://github.com/agalwood/Motrix — aria2 fork, tracker list auto-update, magnet/.torrent handlers, MIT, platforms (VERIFIED)

**libtorrent (what Apollo DM's engine can already do)**

- https://www.libtorrent.org/features-ref.html — sequential, super seeding (BEP 16), IP filter, encryption, web seeds, v2/hybrid, share mode, NAT-PMP/PCP/UPnP, LSD, DHT, PEX, BEP 53 (VERIFIED)
- https://www.libtorrent.org/reference-Settings.html — `anonymous_mode`, `outgoing_interfaces`, `listen_interfaces` device names (Windows GUID), encryption policies, I2P SAM settings, seed limits, `active_downloads` (VERIFIED; page is for the current release, Assumed same in 2.0.15)
- https://www.libtorrent.org/reference-Torrent_Handle.html — `set_piece_deadline`, `set_sequential_range`, `add_url_seed`, `add_tracker`/`replace_trackers`, `piece_priority`, `file_progress`, `move_storage`, `force_recheck` (VERIFIED)
- https://www.libtorrent.org/reference-Create_Torrents.html — v1-only/v2-only/hybrid, web seeds, private flag, piece size (VERIFIED, 2.1 docs)

**Apollo DM repository (Code, `ddbf6b6`)**

- `crates/velocity-lt/src/lib.rs`, `crates/velocity-lt/cpp/shim.cpp` — what the bridge exposes
- `crates/velocity-torrent/src/engine.rs` — session config, listen interfaces (line 175)
- `crates/velocity-core/src/settings.rs`, `crates/velocity-core/src/manager/categories.rs`
- `src/features/torrents/*`, `docs/user/torrents.md`, `docs/user/settings.md`, `docs/user/categories.md`, `docs/user/browser.md`, `docs/TORRENTS.md`, `docs/PARITY.md`
- Open issues linked: #384 (port mapping default), #385 (public trackers), #387 (long torrents), #388 (Linux baseline), #427 (this research)
