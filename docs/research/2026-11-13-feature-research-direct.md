# Direct download managers: feature catalogue and Apollo Download Manager's status

An appendix of the [feature research report](2026-11-13-feature-research.md) (#427), on direct download managers. It is the research agent's catalogue as written; the report checks and ranks it.

Research for #427, scope C (direct downloads). Checked 2026-11-13. Apollo Download Manager (Apollo DM) status is taken from the checked-out `main` at `ddbf6b6`.

**How to read the claims:**

- **VERIFIED:** the product's own site, help pages, README or release notes say so (URL in section 3).
- **REPORTED:** a third-party review, guide or forum says so, or the official source was not reachable. Treat as unconfirmed.
- **Apollo DM status:** **Done**, **Partial** or **Missing**, with the file or document that shows it. "Missing" means no code or doc found by search (`Grep` over `src/`, `src-tauri/src/`, `crates/*/src`, `browser-extension/src`, `docs/`).
- **Complexity** for Apollo DM: **S** (days, one layer), **M** (a week or two, several layers), **L** (a month or more, or a new subsystem).
- **Priority:** **1** essential for a credible direct-download manager, **2** later, **3** don't.

Product abbreviations: IDM, FDM, JD2 (JDownloader 2), MOT (Motrix), XDM, PER (Persepolis), GOP (Gopeed), ABDM (AB Download Manager), NDM (Neat Download Manager), UGET.

## 1. The products

| Product | Known for | Platforms | Licence | Latest release (checked 2026-11-13) | Evidence |
|---|---|---|---|---|---|
| **Internet Download Manager (IDM)** | The reference Windows accelerator: dynamic segmentation, deep browser takeover, video panel, site grabber, scheduler with queues | Windows only | Proprietary, paid (30-day trial) | 6.43 Build 18, 2026-11-04 | VERIFIED (features2.html, news.html) |
| **Free Download Manager (FDM)** | Free all-rounder: HTTP + BitTorrent, preview while downloading, remote control from Android, add-ons for sites | Windows, macOS, Linux (deb, Flathub), Android | Freeware (6.x closed; 3.9 legacy was open source) | 6.36.0 (date not shown); 6.34 announced 2026-05-19 | VERIFIED (features.htm, download.htm, blog) |
| **JDownloader 2 (JD2)** | One-click hoster downloads: LinkGrabber, hoster plugins, premium accounts, captcha, auto-extract, MyJDownloader remote, Event Scripter | Windows, macOS, Linux, Java JAR, NAS/Docker | Open source (GPL per project; the download page doesn't name it); Windows default installer carries optional offers | Rolling self-update; download page last edited 2025-04-23 | VERIFIED (jdownloader.org, support.jdownloader.org KB) |
| **Motrix (2.x "Turbo")** | Clean UI over aria2; 2.x adds a headless server with web UI, a JSON-RPC protocol (MDXP), a CLI, sandboxed plugins | Windows, macOS, Linux (AppImage, deb, rpm, Snap, Flatpak), Docker server | MIT | v2.4.1, 2026-11-09 | VERIFIED (GitHub README, releases API). Reference only: it bundles aria2 |
| **Xtreme Download Manager (XDM 9)** | IDM-like free alternative: video sniffing (HLS/DASH, mux without ffmpeg), bulk grab of a page, torrents, headless CLI | Windows (x64, ARM64), macOS, Linux (deb, rpm, Arch, tarball) | GPL-3.0 (app and extension) | v9.0.10, 2026-11-12 | VERIFIED (GitHub README, releases API) |
| **Persepolis** | Python/Qt GUI; 5.x replaced aria2 with its own engine (up to 64 connections); scheduler, queues, video finder | Linux, BSD, macOS, Windows | GPL-3.0 (REPORTED; site only says free/copyleft) | 5.2.0, July 2025 | VERIFIED (persepolisdm.github.io) |
| **Gopeed** | Go engine + Flutter UI; HTTP, BitTorrent, ed2k, FTP; REST API, CLI, web UI, webhooks, JS extensions, MCP endpoint | Windows, macOS, Linux, Android, iOS, Web, Docker | GPL-3.0 | v2.0.0-beta.4, 2026-11-03 (pre-release) | VERIFIED (GitHub README, releases API, gopeed.com/docs) |
| **AB Download Manager (ABDM)** | Fast-moving Kotlin desktop + Android app; queues, scheduler, per-host settings, themes, REST API, CLI | Windows, macOS, Linux, Android | Apache-2.0 | v1.11.4, 2026-11-03 | VERIFIED (GitHub README, CHANGELOG, releases API) |
| **Neat Download Manager (NDM)** | Small free IDM-like tool; dynamic segmentation, HLS merge, renews expired links | Windows, macOS | Freeware (licence not stated) | Windows 1.4 / macOS 1.3 (no date; site © 2023) | VERIFIED (neatdownloadmanager.com) |
| **uGet** | GTK manager with clipboard monitor, queues, batch patterns | Linux, Windows | LGPL-2.1 (REPORTED) | README: "not under active development" | VERIFIED (GitHub README); ugetdm.com unreachable 2026-11-13 |
| **Download Accelerator Plus, EagleGet** | Older Windows accelerators | Windows | Proprietary | No current release found | Not researched further: inactive or adware-associated (REPORTED) |

**Takeaways:** the active, popular field is IDM (paid, Windows), FDM, JD2, XDM 9, ABDM and Gopeed. The newest ones (Motrix 2, Gopeed 2, ABDM 1.10+) all add **automation surfaces**: REST API, CLI, web UI, webhooks. Every one of them except NDM has a **per-queue scheduler**; IDM, ABDM and FDM add **after-queue actions** (shutdown).

## 2. Feature catalogue

Columns: **Products** that have it; **Problem → benefit**; **Cx** = complexity for Apollo DM; **Deps** = new crates, plugins or permissions; **Risks**; **Apollo DM** status and evidence; **Rec** = recommend; **P** = priority.

### 2.1 Adding downloads

| # | Feature | Products | Problem → benefit | Cx | Deps | Risks | Apollo DM | Rec | P |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Clipboard monitoring** (copied link → offer to download) | IDM (VERIFIED, options.html, starting.html), JD2 (VERIFIED KB "clipboard observation"), XDM (VERIFIED README "clipboard import"), ABDM (VERIFIED 1.0.7, 1.10.2 tray import), uGet (REPORTED) | Users copy links from chat, mail, forums, not only browsers → no paste step | S–M | Clipboard read in native (Tauri `clipboard-manager` plugin or `arboard` crate: PO approval); Wayland limits background reads | Privacy (reads everything copied: must be opt-in, filter to URLs with known types, never log); Wayland can't watch the clipboard in the background | **Partial:** paste of magnet/.torrent outside a text field opens Add (`src/features/add/useAddEntryPoints.ts`, `docs/user/downloads.md`); no background monitoring | Yes, opt-in, off by default | 2 |
| 2 | **Batch / pattern download** (`file[001-100].zip`, letters, step) | IDM "Add batch download" (VERIFIED via help search; REPORTED detail), ABDM 1.1.0 (VERIFIED), uGet (REPORTED), FDM 3.9 (REPORTED) | Numbered series (images, parts, episodes) without typing each link → one entry expands to many | S | None | Abuse is low; must cap expansion (Add already caps 500 links) | **Missing** (Add takes one link per line, up to 500: `docs/user/downloads.md`) | Yes | 1 |
| 3 | **Import a list of links from a text file** | IDM (REPORTED "Import from text file"), ABDM 1.9.0 JSON import (VERIFIED), FDM (REPORTED), JD2 (REPORTED, DLC/CRAWLJOB) | Moving lists between machines or from scripts | S | None | Parse as untrusted input | **Partial:** paste up to 500 links; no file import | Yes | 2 |
| 4 | **Export / import the download list and settings** (backup, move to a new PC) | IDM Tasks→Export (REPORTED), ABDM 1.9.0 JSON (VERIFIED), JD2 backup (REPORTED) | New PC or reinstall without losing queue | M | None | Exports must exclude secrets (AGENTS.md: secrets never in files) | **Missing** | Yes | 2 |
| 5 | **Drag and drop links / drop target window** | IDM (VERIFIED), NDM macOS (VERIFIED), ABDM (REPORTED) | Drag a link from any app | S | None | None | **Partial:** dropping `.torrent` files only; other drops refused (`docs/user/downloads.md`) | Yes (links and `.metalink`) | 2 |
| 6 | **Download all links on a page / grab by type** | IDM "Download All" (VERIFIED), XDM 9 bulk (VERIFIED), FDM (REPORTED), JD2 LinkGrabber (VERIFIED) | A page with 40 PDFs → pick and send in one step | M | Extension `scripting`/`activeTab` permission | Store review of extension permissions | **Missing** — tracked as **#426** | Yes (via #426) | 1 |
| 7 | **Link checker before download** (online/offline, size, name: JD2 LinkGrabber) | JD2 (VERIFIED KB "Linkgrabber Filters", "links shown as offline") | Know size and availability before committing | M | None | Extra requests to servers | **Partial:** the Add dialog shows name, category, conflicts; no size/availability probe before adding | Yes (show size in Add) | 2 |
| 8 | **Folder watch** (drop a link file in a folder → download) | JD2 (VERIFIED KB "Folder Watch") | Automation from other tools | S | File watcher (`notify` crate) | Treat dropped files as untrusted | **Missing** | No (CLI/API covers it) | 3 |
| 9 | **Command line: add a URL** (`app.exe /d URL /p path /a`) | IDM (VERIFIED comand_line.html), XDM headless (VERIFIED), ABDM 1.10.0 (VERIFIED), Gopeed CLI (VERIFIED), Motrix CLI (VERIFIED) | Scripts, other apps, file managers hand off downloads | S–M | Single-instance argv already wired | Arguments are untrusted; no shell | **Partial:** single-instance plugin receives argv but uses it only for the browser-launch flag (`src-tauri/src/lib.rs`) | Yes | 1 |
| 10 | **Local REST / JSON-RPC API** | Gopeed (VERIFIED), Motrix MDXP (VERIFIED), ABDM REST + API key (VERIFIED 1.5.1, 1.10.0), JD2 (REPORTED local API), aria2 front ends | Automation, home-lab, other apps | M | HTTP server crate (PO approval) | New attack surface: local port, CSRF from web pages, auth token; ADR needed | **Missing** (browser bridge is native messaging only: `docs/BROWSER_EXTENSION.md`) | Later, with ADR | 2 |
| 11 | **Protocol handler** (`apollo://`, `magnet:` default handler, `.torrent` / `.metalink` file association) | Motrix (VERIFIED `motrix://`, magnet, .torrent), IDM (REPORTED), FDM (REPORTED) | Click a magnet anywhere → opens the app | S–M | Tauri deep-link plugin (PO approval); installer registration | Registering as default handler must be opt-in | **Missing** (no deep-link plugin in `src-tauri/Cargo.toml`) | Yes (magnet/.torrent first) | 2 |

### 2.2 Queues and scheduling

| # | Feature | Products | Problem → benefit | Cx | Deps | Risks | Apollo DM | Rec | P |
|---|---|---|---|---|---|---|---|---|---|
| 12 | **One global schedule window** (start/stop time, days) | IDM, FDM, ABDM, PER (all VERIFIED) | Download at night / off-peak | — | — | — | **Done:** Settings, Queue and performance, "Use the schedule" (`docs/user/settings.md`) | — | — |
| 13 | **Per-download start time** | IDM (REPORTED), ABDM (REPORTED) | One big file at 03:00 | — | — | — | **Done:** "Start at…" (`docs/user/downloads.md`) | — | — |
| 14 | **Multiple named queues**, each with its own schedule and "files at once" | IDM (VERIFIED idm_scheduler.html: per-queue files-at-once), ABDM (VERIFIED 1.0.0, 1.6.4), PER (VERIFIED), FDM (REPORTED) | "Work files now, big ISOs tonight, one-at-a-time host in its own queue" | M | DB migration | Complexity in UI; interacts with scheduler and limits | **Missing:** one queue (`crates/velocity-core/src/queue.rs`), ordering only | Yes | 2 |
| 15 | **After-queue / after-all actions:** shut down, sleep, hibernate, exit app | IDM (VERIFIED: turn off computer, hang up), ABDM 1.6.7 (VERIFIED auto shutdown), FDM (REPORTED), PER (REPORTED), Folx (VERIFIED, reference) | Leave the PC overnight; it turns off when done | S–M | Windows `ExitWindowsEx`/`shutdown.exe` with args; Linux logind D-Bus | Must count down and be cancelable; never lose data in other apps; never pass user input to a shell | **Missing** | Yes | 1 |
| 16 | **After-download: run a program / script** | IDM (VERIFIED "open a file or run a program"), Gopeed (VERIFIED post-download scripts, webhooks), JD2 Event Scripter (VERIFIED), FDM (VERIFIED "launching apps" in scheduler) | Post-process (move, transcode, notify) | M | None | Arbitrary code execution by design: argument list only, explicit opt-in, path validation | **Missing** | Later | 2 |
| 17 | **Keep the computer awake while downloading** | ABDM 1.6.7 (VERIFIED), Tixati (VERIFIED, reference), FDM (REPORTED) | Laptop sleeps mid-download overnight | S | Windows `SetThreadExecutionState`; Linux logind inhibitor (D-Bus) | Battery; must release on idle | **Missing** (no inhibitor found by search) | Yes | 1 |
| 18 | **Periodic synchronisation** (re-download a file when it changes on the server) | IDM (VERIFIED idm_scheduler.html) | Mirrors of nightly builds, data files | M | None | Overwrite rules conflict with "never overwrite" policy (`docs/user/downloads.md`) | **Missing** | No (niche; conflicts with policy) | 3 |
| 19 | **Download quotas** (X MB per hour for fair-use links) | IDM (VERIFIED features2.html, options.html) | Metered or capped ISP plans | S–M | None | — | **Missing** | Later | 2 |
| 20 | **Queue reordering, move to top/bottom** | IDM, ABDM, FDM | Control order | — | — | — | **Done** (`docs/user/downloads.md` "Acting") | — | — |
| 21 | **Start new downloads paused / add to queue without starting** | IDM `/a` (VERIFIED), ABDM | Collect now, start later | — | — | — | **Done:** "Add paused", "Start new downloads at once" off (`docs/user/settings.md`) | — | — |

### 2.3 Bandwidth and connections

| # | Feature | Products | Problem → benefit | Cx | Deps | Risks | Apollo DM | Rec | P |
|---|---|---|---|---|---|---|---|---|---|
| 22 | **Global speed limit** | All | Keep browsing usable | — | — | — | **Done** (`docs/user/settings.md`) | — | — |
| 23 | **Per-download speed limit, live** | NDM (VERIFIED), ABDM (REPORTED), IDM (REPORTED) | Throttle one big file | — | — | — | **Done** (details panel; `docs/PARITY.md` `set_download_speed_limit`) | — | — |
| 24 | **Time-based speed limits** (slow by day, full at night) | Motrix "multiple speed-limit profiles" (VERIFIED), FDM traffic modes (VERIFIED), qBittorrent alt-speed (reference) | Full speed only when nobody needs the line | S–M | None | — | **Missing:** schedule gates starting, not speed | Yes | 2 |
| 25 | **Speed profiles / traffic modes** (low/medium/high, quick toggle in tray) | FDM (VERIFIED "traffic usage modes"), Motrix (VERIFIED), ABDM 1.11.0 tray toggle (VERIFIED) | One click to free the line for a video call | S | None | — | **Missing** (one limit value; tray has no limiter toggle: `src-tauri/src/tray.rs`) | Yes | 2 |
| 26 | **"Limit while I use other apps" / adaptive to foreground use** | ABDM 1.11.0 (VERIFIED) | Auto-throttle when the user is active | M | OS idle detection | Heuristics can surprise | **Missing** | Later | 3 |
| 27 | **Connections per download, live change** | IDM, NDM, ABDM | Tune for a server | — | — | — | **Done** (`docs/user/downloads.md` details panel; profiles in `docs/user/settings.md`) | — | — |
| 28 | **Per-host / per-site rules** (max connections, limits, credentials for a domain) | IDM connection exceptions (VERIFIED idm_scheduler.html), ABDM 1.6.12 per-host settings (VERIFIED), JD2 Domain Rules (VERIFIED KB) | A host that bans >2 connections; a site needing a header | M | DB | — | **Partial:** learned per-server connection memory, 7 days (`docs/user/settings.md` Servers); no user rules | Yes | 2 |
| 29 | **Dynamic segmentation** (split the largest remaining part when a connection frees) | IDM (VERIFIED), NDM (VERIFIED) | Fast finish, no slow tail | — | — | — | **Done:** adaptive connections and splitting (`docs/ENGINE_INTERNALS.md`, `docs/user/protocols.md`) | — | — |
| 30 | **Multi-connection FTP / SFTP** | Gopeed 2.0 beta.4 FTP segmented (VERIFIED), IDM (REPORTED FTP) | Faster FTP servers | M | None | Server limits per login | **Missing:** "FTP and SFTP use one connection per download for now" (`docs/user/protocols.md`) | Yes | 2 |
| 31 | **Mirrors: download one file from several sources at once** | FDM 3.9 (VERIFIED), aria2 front ends (reference), Gopeed GitHub mirrors (VERIFIED) | One slow server isn't the bottleneck | M–L | None | Must verify identity of mirrors (checksum) | **Partial:** Metalink mirrors (`crates/velocity-core/src/metalink.rs`, `docs/user/protocols.md`); finding mirrors for a plain link is **#324** | Yes (#324) | 2 |
| 32 | **HTTP/3 (QUIC)** | none of the GUIs advertise it (curl supports it) | Lossy networks | M | libcurl built with ngtcp2/nghttp3 (native build change) | Build complexity | **Missing** (HTTP/2 done: `docs/user/protocols.md`) | Later | 3 |

### 2.4 Resume, recovery and links

| # | Feature | Products | Problem → benefit | Cx | Deps | Risks | Apollo DM | Rec | P |
|---|---|---|---|---|---|---|---|---|---|
| 33 | **Resume after pause, crash, power loss** | All (VERIFIED IDM, FDM, NDM) | Never lose progress | — | — | — | **Done** (`docs/user/downloads.md` "If Apollo Download Manager closes suddenly") | — | — |
| 34 | **Validator check on resume** (ETag / Last-Modified) | ABDM 1.0.8 (VERIFIED), aria2 | No corrupt mixes | — | — | — | **Done** (`docs/user/protocols.md`) | — | — |
| 35 | **Refresh / renew an expired link** (keep the bytes, give a new URL) | IDM "Refresh download address" (VERIFIED via IDM support pages), NDM "renews expired downloads" (VERIFIED), ABDM 1.4.2 edit download, refresh links (VERIFIED) | Signed CDN links expire mid-download; restarting a 20 GB file is painful | M | Extension can catch the new link and offer to attach it | Must check it is the same file (size, validators) | **Missing** (an expired link is a permanent failure: `crates/velocity-core/src/domain.rs` line 86) | Yes | 1 |
| 36 | **Auto retry with back-off; network-change resume** | ABDM 1.5.5 (VERIFIED), IDM (VERIFIED retries) | Flaky Wi-Fi | — | — | — | **Done** (`docs/user/downloads.md` statuses; `docs/user/settings.md` Advanced) | — | — |
| 37 | **Disk-full / missing-folder pause instead of fail** | XDM 9 (VERIFIED) | External drive unplugged | S | None | — | **Partial:** full disk is classified permanent (`crates/velocity-core/src/domain.rs`); preallocation full fails early | Yes | 2 |
| 38 | **Metalink** | aria2 front ends, FDM 3.9 (REPORTED) | Mirrors + checksums from one file | — | — | — | **Done** (off by default: `docs/user/protocols.md#metalink`) | — | — |
| 39 | **Redirect handling, HTTPS→HTTP downgrade prompt** | All follow redirects | Safety | — | — | — | **Done** (`docs/user/protocols.md`) | — | — |
| 40 | **Download with unknown size / streaming responses** | PER 5.1 (VERIFIED) | Dynamic pages and chunked responses | — | — | — | **Done (assumed)**: single-connection fallback; not separately documented, check `docs/ENGINE_INTERNALS.md` | — | — |

### 2.5 Verification, files and organisation

| # | Feature | Products | Problem → benefit | Cx | Deps | Risks | Apollo DM | Rec | P |
|---|---|---|---|---|---|---|---|---|---|
| 41 | **Checksum verification** (given hash) | XDM 9, ABDM 1.5.2, Gopeed 2.0 (all VERIFIED), JD2 SFV/CRC (VERIFIED KB) | Integrity | — | — | — | **Done** (MD5…SHA-512: `docs/user/downloads.md`) | — | — |
| 42 | **Compute hash of a finished file on demand / read `.sha256`, `.sfv` sidecar files** | XDM 9 "verify from completion window" (VERIFIED), JD2 SFV (VERIFIED) | Verify after the fact, or auto-find the published hash | S | Hash crates already in use | — | **Partial:** only a hash given before download | Yes | 2 |
| 43 | **Mark of the Web / quarantine flag** on finished files | XDM 9 (VERIFIED, can be turned off), browsers | Windows SmartScreen and Office protected view keep working on downloaded files | S | Write `Zone.Identifier` ADS on Windows | Security positive; must not break when on FAT/exFAT | **Missing** (no `Zone.Identifier` in code) | Yes | 1 |
| 44 | **Antivirus scan after download** | IDM (VERIFIED options.html, features2.html), XDM (VERIFIED optional) | Scan before opening | S | Run the configured scanner with an argument list; Windows AMSI/`MpCmdRun` | Running external programs; false "safe" impression | **Missing** | Later (MotW first) | 2 |
| 45 | **Auto-extract archives** | JD2 (VERIFIED), Gopeed (VERIFIED README) | Multi-part RAR from hosters | M–L | Archive crates (zip, 7z, rar licensing: unrar licence is restrictive) | Zip-slip path traversal, zip bombs, licence | **Missing** | No for now (security + licence cost; OS does it) | 3 |
| 46 | **Categories by file type with folders** | IDM, FDM, XDM, ABDM, Gopeed 2.0 beta.4 | Tidy folders | — | — | — | **Done** (`docs/user/categories.md`) | — | — |
| 47 | **Category rules by URL / site pattern** (not only extension) | ABDM 1.3.0 URL patterns (VERIFIED), XDM 9 rules (VERIFIED), JD2 Packagizer (VERIFIED) | "Everything from github.com → Dev" | S–M | None | — | **Missing** (extension-only: `docs/user/categories.md`) | Yes | 2 |
| 48 | **Rename rules / packagizer** (name templates, subfolders by site/date) | JD2 Packagizer (VERIFIED KB) | Bulk tidy naming | M | None | — | **Missing** | Later | 3 |
| 49 | **Duplicate detection** (same link, same file name) | IDM (REPORTED), ABDM 1.5.8 "update existing on duplicate" (VERIFIED) | No double downloads | — | — | — | **Done:** "A link added before" and name conflicts (`docs/user/downloads.md`) | — | — |
| 50 | **Detect files deleted from disk** in the list | ABDM 1.5.0 (VERIFIED) | List shows reality | S | — | — | **Partial:** Open folder handles a gone file (`docs/user/downloads.md` details); no list marker | Yes | 2 |
| 51 | **Preview audio/video while downloading** (sequential download) | FDM (VERIFIED), XDM torrent in-order (VERIFIED) | Check a file before it finishes | M | Sequential mode in engine | — | **Missing** for direct downloads | Later | 3 |
| 52 | **Partial ZIP download** (one file from a remote archive) | FDM 3.9 (VERIFIED) | Grab one file from a 10 GB zip | M | Range reads of the zip directory | — | **Missing** | No | 3 |
| 53 | **Write straight to the final file vs. part file option** | XDM 9 direct writes (VERIFIED), ABDM 1.6.3 optional `.part` (VERIFIED) | Fewer renames | — | — | — | **Done** by design (`.vdmpart` then rename: `docs/user/downloads.md`) | No change | 3 |

### 2.6 Authentication and networking

| # | Feature | Products | Problem → benefit | Cx | Deps | Risks | Apollo DM | Rec | P |
|---|---|---|---|---|---|---|---|---|---|
| 54 | **Site logins manager** (saved credentials per site/folder, reused automatically) | IDM "Site Logins" (VERIFIED options.html), JD2 accounts (VERIFIED), ABDM credential import/export (VERIFIED) | Private servers without retyping | M | Keychain already used | Credential leakage; sending creds to the wrong host after redirect | **Partial:** per-download login, optional keychain (`docs/user/downloads.md` Logins); no per-site store | Yes | 2 |
| 55 | **Cookies from the browser** (session-bound downloads) | IDM (REPORTED, sends browser cookies), XDM (REPORTED), FDM (REPORTED), JD2 cookie login (VERIFIED KB) | Downloads behind a login page fail today | M | Extension `cookies` permission | High: secret handling, store review, AGENTS.md "secrets never stored"; must be in-memory only, per download | **Missing by design:** "What it never sends: cookies" (`docs/user/browser.md`); manual header possible | Yes, PO decision needed | 1 |
| 56 | **HTTP auth schemes beyond Basic** (Digest, NTLM, Negotiate/Kerberos) | IDM (VERIFIED options.html), XDM 9 NTLM (VERIFIED), NDM Basic/Digest/NTLM (VERIFIED) | Corporate/IIS servers and proxies | S–M | libcurl already supports them (build flags) | Must not fall back to Basic over plain HTTP | **Partial:** Basic only (`crates/velocity-curl/src/fetch.rs` line 999) | Yes (Digest, NTLM) | 2 |
| 57 | **Proxy: HTTP/HTTPS/SOCKS5 with login** | All | Corporate networks | — | — | — | **Done** (`docs/user/settings.md` Proxy) | — | — |
| 58 | **System proxy, PAC/auto-config, bypass list** | IDM (VERIFIED), ABDM 1.5.2 (VERIFIED) | Works out of the box in companies | M | PAC evaluation needs a JS engine (`proxy` crates) | PAC is code execution | **Missing by decision:** "Only this proxy is used" (`docs/user/settings.md`) | Later (bypass list S, PAC no) | 2 |
| 59 | **Proxy per download / per site** | JD2 (REPORTED proxy rotation), IDM bypass list (VERIFIED) | Route one site through a proxy | M | None | — | **Missing** | Later | 3 |
| 60 | **Bind to a network interface / VPN only** (kill-switch for downloads) | qBittorrent (reference), JD2 (REPORTED) | Never leak downloads outside the VPN | S–M | libcurl `CURLOPT_INTERFACE` | Platform differences | **Missing** | Later | 2 |
| 61 | **DNS-over-HTTPS** | ABDM 1.10.2 (VERIFIED) | Censored/hijacked DNS | S | libcurl DoH | Another network endpoint; PO decision (telemetry rule: no extra calls) | **Missing** | Later | 3 |
| 62 | **Custom User-Agent, referrer, headers** | ABDM 1.5.3, Gopeed (VERIFIED) | Picky servers | — | — | — | **Done** (`docs/user/downloads.md`, `docs/user/settings.md` Advanced) | — | — |
| 63 | **Disable TLS verification** | ABDM 1.5.3 (VERIFIED) | Self-signed servers | — | — | Security control weakening | **Not offered by rule** (AGENTS.md; `docs/user/protocols.md`) | No | 3 |
| 64 | **Router reconnect / IP change** (to reset hoster waits) | JD2 (VERIFIED KB, 12 articles) | Hoster free-user wait times | M | Router scripts | Used to evade hoster limits: policy risk | **Missing** | No | 3 |

### 2.7 Browser integration and media

| # | Feature | Products | Problem → benefit | Cx | Deps | Risks | Apollo DM | Rec | P |
|---|---|---|---|---|---|---|---|---|---|
| 65 | **Take over browser downloads, rules by type/size/site** | IDM, FDM, XDM, ABDM, Motrix, Gopeed | Core integration | — | — | — | **Done** (`docs/user/browser.md`); store listings #240, in-app setup #241 | — | — |
| 66 | **Force/skip modifier keys** (Ctrl = force, Alt = let browser) | IDM (VERIFIED starting.html) | Per-click control | S | Extension only | — | **Missing** (modes are global: `docs/user/browser.md`) | Yes | 2 |
| 67 | **Video/audio sniffing on pages (IDM panel), HLS/DASH download and mux** | IDM (VERIFIED), XDM 9 (VERIFIED), NDM HLS (VERIFIED), ABDM 1.7.0 (VERIFIED), Gopeed HLS (VERIFIED), PER (VERIFIED) | The most-asked feature of IDM users | L | HLS/DASH parser, muxer or ffmpeg; extension `webRequest` | **Legal / store policy:** Chrome Web Store bans YouTube downloading; DRM circumvention illegal; separate PO decision **#253** | **Missing — PO decision #253** | Record only; decide in #253 | — |
| 68 | **Plain HLS (m3u8) of non-DRM streams** as a direct-download type | Gopeed, NDM, XDM | Lectures, livestream archives | M–L | m3u8 parser; concatenation without ffmpeg for TS | Same as 67, lower | **Missing** (part of #253 scope) | Decide with #253 | 2 |
| 69 | **Site grabber / spider** (mirror a site or a subset by filters) | IDM Grabber with scheduler (VERIFIED), FDM 3.9 HTML spider (VERIFIED) | Offline copy, all images from a gallery | L | HTML parser crate | Server load, robots, legal | **Missing** — in #427's own scope ("site grabber") | Research in #427 | 2 |
| 70 | **Click'n'Load / send from page to app** | JD2 (VERIFIED headline) | Hoster link containers | — | Local listener | Local port surface | Not applicable | No | 3 |
| 71 | **Premium hoster accounts, captcha solving, hoster plugins** | JD2 (VERIFIED KB: captcha, premium accounts, plugins) | One-click hosters | L | Plugin system | **High legal/policy risk:** hosters' terms, piracy association, captcha-service ToS; ongoing plugin maintenance | **Missing** | No | 3 |
| 72 | **Remote control from phone / web UI** | FDM Android remote (VERIFIED), JD2 MyJDownloader (VERIFIED), Motrix web UI (VERIFIED), Gopeed web (VERIFIED), ABDM QR link sharing (VERIFIED) | Queue downloads to the home PC from anywhere | L | HTTP server, auth, maybe relay service | Big attack surface; relay = a service and network calls (no-telemetry rule) | **Missing** | Later, needs ADR | 2 |
| 73 | **Headless / server / Docker mode** | Motrix server (VERIFIED), Gopeed Docker (VERIFIED), JD2 Docker (VERIFIED KB), XDM `--headless` (VERIFIED) | NAS and home servers | L | Core already separate from UI (`crates/velocity-core`) | Maintenance | **Missing** | Later | 3 |
| 74 | **Extensions / plugin SDK** (sandboxed JS) | Motrix QuickJS plugins (VERIFIED), Gopeed JS extensions (VERIFIED), JD2 plugins | Community adds site support | L | JS sandbox | Supply-chain, malicious plugins | **Missing** | No for now | 3 |
| 75 | **MCP / AI-agent endpoint** | Gopeed (VERIFIED) | Agents queue downloads | M | Depends on API (#10) | Same as API | **Missing** | Later, after API | 3 |
| 76 | **Webhooks on completion** | Gopeed (VERIFIED) | Notify home automation | S (after API) | HTTP client already present | Outbound calls only to user-set URL | **Missing** | Later | 3 |

### 2.8 App experience

| # | Feature | Products | Problem → benefit | Cx | Deps | Risks | Apollo DM | Rec | P |
|---|---|---|---|---|---|---|---|---|---|
| 77 | **Dark mode / themes** | IDM, ABDM (dark, light, black, twilight), Gopeed accents, Motrix | Comfort | — | — | — | **Done:** system/light/dark (`docs/user/settings.md` Appearance) | More themes: no | 3 |
| 78 | **Notifications** (complete, failed) | All | Know when done | — | — | — | **Done** (`docs/user/settings.md` Notifications) | — | — |
| 79 | **Notification actions** (Open / Show in folder buttons) | Gopeed 2.0 beta.3 (VERIFIED) | One click from the toast | S | notification plugin actions | Platform support varies | **Missing** | Yes | 2 |
| 80 | **Sounds per event** | IDM (VERIFIED options.html), ABDM 1.9.1 (VERIFIED) | Audible completion | S | Audio playback | — | **Missing** | Later | 3 |
| 81 | **Download complete dialog** (Open, Open folder, Close) | IDM (VERIFIED completeD.html), ABDM 1.4.3 (VERIFIED) | Quick action | S | — | Pop-ups annoy: option | **Partial:** notification + details panel actions | Later | 3 |
| 82 | **History with search, retention** | IDM, ABDM | Find past files | — | — | — | **Done** (`docs/user/downloads.md` History) | — | — |
| 83 | **Interface languages** | IDM, FDM (24), Gopeed (20+), ABDM | Non-English users | L (ongoing) | i18n library (PO approval) | Translation maintenance | **Missing** (no i18n found in `src/`) | Yes, plan early | 2 |
| 84 | **Portable mode** (run from USB, data next to the exe) | JD2 (VERIFIED KB), FDM 3.9 (VERIFIED), ABDM 1.7.1 custom data dir (VERIFIED), PER Linux bundle | No install rights; USB stick | S–M | Detect a marker file next to the exe | Browser registration and autostart must not point to a removable path | **Partial:** `VELOCITY_V2_DATA_DIR` override exists "for tests and portable setups" (`crates/velocity-core/src/paths.rs`), not user-facing | Later | 2 |
| 85 | **In-app update check / auto-update** | IDM weekly check (VERIFIED), ABDM 1.5.0 (VERIFIED), JD2 | Users stay patched | M | Tauri updater plugin + signing (#428, #429) | Network call (no-telemetry rule needs PO approval); signing | **Missing** (no updater found) | Yes, after signing #428/#429 | 1 |
| 86 | **Tray: quick add from clipboard, stop all, speed toggle** | ABDM 1.10.2, 1.11.0, 1.11.2 (VERIFIED) | Act without opening the window | S | — | — | **Partial:** tray exists (`src-tauri/src/tray.rs`); extra actions not found | Yes | 2 |
| 87 | **Totals: selected count and size, speed graph** | ABDM 1.11.0 (VERIFIED), Motrix dashboard (VERIFIED) | Overview | S | — | — | **Partial:** status counts in navigation (`docs/user/downloads.md`) | Later | 3 |
| 88 | **Mobile companion / Android app** | FDM, ABDM, Gopeed (VERIFIED) | Phone downloads | L | New platform | Out of scope (AGENTS.md platforms) | **Missing** | No | 3 |
| 89 | **Feature voting for users** | FDM (VERIFIED blog 2026-05-19) | Prioritise roadmap | S | GitHub Discussions | — | Not a product feature | Note for PO | — |

## 3. Sources

All checked 2026-11-13.

### Internet Download Manager

- VERIFIED: https://www.internetdownloadmanager.com/features2.html (features, quotas, antivirus, dark theme, grabber, version 6.43 b18)
- VERIFIED: https://www.internetdownloadmanager.com/news.html (6.43 Build 18, 2026-11-04)
- VERIFIED: https://www.internetdownloadmanager.com/support/idm-scheduler/idm_scheduler.html (queues, files at once, periodic sync, after-done actions, retries, quotas)
- VERIFIED: https://www.internetdownloadmanager.com/support/using_idm/options.html (clipboard, site logins, proxy/PAC, auth schemes, sounds, antivirus)
- VERIFIED: https://www.internetdownloadmanager.com/support/using_idm/starting.html (ways to add; Ctrl/Alt keys; command line)
- VERIFIED: https://idm.internetdownloadmanager.com/support/comand_line.html (`/d /p /f /q /h /n /a /s`)
- VERIFIED (official mirror page, via search snippet): "Refresh download address" and "Tasks→Add batch download" menu items on IDM support pages (`aaa.internetdownloadmanager.com/register/new_faq/sites2_3.html`)
- REPORTED: import/export of the list, speed limiter menu, browser cookie handling (common reviews; not confirmed on an official page this session)

### Free Download Manager

- VERIFIED: https://www.freedownloadmanager.org/features.htm (remote control from Android, preview, traffic modes, scheduler with app launch, 3.9 legacy portable/spider/mirrors/partial ZIP)
- VERIFIED: https://www.freedownloadmanager.org/download.htm (6.36.0, platforms)
- VERIFIED: https://www.freedownloadmanager.org/blog/ (6.34 on 2026-05-19, feature voting page)
- REPORTED: prevent sleep, shutdown when done, list import/export (no official page found)

### JDownloader 2

- VERIFIED: https://jdownloader.org/ (open source, bandwidth limits, auto-extract)
- VERIFIED: https://jdownloader.org/download/index (platforms; Windows default installer carries optional offers)
- VERIFIED: https://support.jdownloader.org/en/knowledgebase (MyJDownloader, captcha, premium accounts, cookie login, LinkGrabber, extraction, SFV/CRC, reconnect, Event Scripter, Packagizer, LinkCrawler rules, Folder Watch, clipboard observation, Docker, portable)
- REPORTED: scheduler, proxy rotation, list backup (third-party guides: docs.ultra.cc, linuxtldr.com)

### Motrix (reference only: bundles aria2)

- VERIFIED: https://github.com/agalwood/Motrix (README: 2.x features, MDXP, CLI, web UI, plugins, MIT)
- VERIFIED: https://api.github.com/repos/agalwood/Motrix/releases/latest (v2.4.1, 2026-11-09)

### Xtreme Download Manager

- VERIFIED: https://github.com/subhra74/xdm (README: XDM 9 features, GPL-3.0)
- VERIFIED: https://api.github.com/repos/subhra74/xdm/releases (v9.0.10, 2026-11-12)

### Persepolis

- VERIFIED: https://persepolisdm.github.io/ (own engine since 5.0, 5.2.0 July 2025, features)
- REPORTED: licence GPL-3.0

### Gopeed

- VERIFIED: https://github.com/GopeedLab/gopeed (README: API, CLI, web UI, webhooks, scripts, extraction, MCP)
- VERIFIED: https://api.github.com/repos/GopeedLab/gopeed/releases (v2.0.0-beta.4 2026-11-03: FTP segmented, checksum, categories; beta.3: HLS, notification actions)
- VERIFIED: https://gopeed.com/docs/ (HTTP API, extensions)

### AB Download Manager

- VERIFIED: https://github.com/amir1376/ab-download-manager (README, Apache-2.0)
- VERIFIED: https://raw.githubusercontent.com/amir1376/ab-download-manager/master/CHANGELOG.md (feature history 1.0.0–1.11.3)
- VERIFIED: https://api.github.com/repos/amir1376/ab-download-manager/releases/latest (v1.11.4, 2026-11-03)

### Neat Download Manager

- VERIFIED: https://www.neatdownloadmanager.com/index.php/en/ (features, versions; no dates)

### uGet

- VERIFIED: https://github.com/ugetdm/uget ("not under active development")
- NOT REACHED: https://ugetdm.com/features/ (DNS failure 2026-11-13); clipboard monitor, batch patterns REPORTED from memory of earlier reviews

### Reference (non-download-manager)

- VERIFIED via search snippets: Folx scheduler (wiki.eltima.com), Tixati sleep inhibition (forum.tixati.com)

### Apollo DM evidence (repository, `main` at `ddbf6b6`)

`docs/user/downloads.md`, `docs/user/settings.md`, `docs/user/browser.md`, `docs/user/categories.md`, `docs/user/protocols.md`, `docs/PARITY.md`, `crates/velocity-core/src/paths.rs`, `crates/velocity-core/src/domain.rs`, `crates/velocity-core/src/queue.rs`, `crates/velocity-core/src/metalink.rs`, `crates/velocity-curl/src/fetch.rs`, `src/features/add/useAddEntryPoints.ts`, `src-tauri/src/lib.rs`, `src-tauri/src/tray.rs`, `src-tauri/Cargo.toml`. Open issues linked: #253, #240, #241, #324, #426, #427, #428, #429.
