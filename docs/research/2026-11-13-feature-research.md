# Feature research: what to build next, and in which version

**Date:** 2026-11-13. **Issue:** #427. **Repository read at:** `ddbf6b6` (`main`).

This report is an **input, not a decision** ([research README](README.md)). It answers the PO's brief of 2026-11-13, in the PO's words: "investigate and research the next features as many as possible the ones our download manager does not have that other download managers have and even things people always wish in a download manager", and "Research everywhere including online and places like reddit". After the PO's review, the accepted items become issues, and the rejected ones are recorded here with the reason.

## What was researched

| Area | Appendix | What it covers |
|---|---|---|
| Direct download managers | [Direct downloads](2026-11-13-feature-research-direct.md) | 10 products (IDM, FDM, JDownloader 2, Motrix, XDM, Persepolis, Gopeed, AB Download Manager, Neat Download Manager, uGet), 89 features, with Apollo Download Manager's status for each |
| Torrent clients | [Torrents](2026-11-13-feature-research-torrents.md) | 10 clients (qBittorrent, Transmission, Deluge, BiglyBT, Tixati, rTorrent, PicoTorrent, Fragments, FDM, Motrix), 42 features. Builds on the [torrent performance research](2026-11-06-torrent-performance.md) |
| What users wish for | [User wishes](2026-11-13-feature-research-user-wishes.md) | 39 discussions read in full (26 Reddit threads, 5 Hacker News, Lemmy, AlternativeTo reviews, news), and about 220 feature requests on 7 open-source projects, ranked by reactions |
| Site grabber | [Site grabber](2026-11-13-feature-research-site-grabber.md) | How IDM, JDownloader, DownThemAll!, HTTrack and Wget grab sites, and what fits Apollo Download Manager |

**How to read the evidence:**

- **VERIFIED:** the product's own site, documentation or release notes say so.
- **REPORTED:** what users or third-party reviews say, unconfirmed. All of the user wishes are REPORTED.
- **Apollo DM's status:** taken from the code and documents at `ddbf6b6`. The appendices name the file for each one. I spot-checked these four "missing" claims in the code:
  - an expired link is a permanent failure (`crates/velocity-core/src/domain.rs:86`);
  - HTTP logins are Basic only (`crates/velocity-curl/src/fetch.rs:999`);
  - there's no Mark of the Web and nothing keeps the computer awake;
  - there's no translation support.
- **Limits:**
  - Live Reddit refuses automated reads, so threads were read through an archive, whose scores can be lower than the live ones.
  - Store reviews weren't read.
  - No product was installed or tried.
  - Each appendix lists its own gaps.

## What users want most, and where Apollo Download Manager stands

The ranking comes from the [user wishes](2026-11-13-feature-research-user-wishes.md#2-ranked-wishes), by how often each wish came up and how many reactions it got.

| # | What users want | Apollo DM today |
|---|---|---|
| 1 | **Browser capture that just works,** in every browser, without the browser downloading too, and still working after browser updates | **Mostly done:** the extension takes downloads in Chrome, Edge, Brave and Firefox; it's in the Chrome Web Store and on Firefox Add-ons; Edge's store waits (#240). Whether capture survives browser updates is a field-test question (#337) |
| 2 | **Resume after the link expires,** by giving it a fresh link | **Missing:** an expired link is a permanent failure |
| 3 | **Speed:** many connections, no slow merge at the end | **Done:** adaptive connections and splitting, no merge step (`docs/ENGINE_INTERNALS.md`). Field-tested ramp: #330 |
| 4 | **Video and stream grabbing** (YouTube, m3u8) | **Missing; the PO's decision #253,** waiting for the legal assessment (#441) |
| 5 | **Proper Linux packages** (Flatpak or Flathub, AppImage) | **Partial:** deb and rpm. No AppImage until its bundled LGPL libraries get a licence review (PO decision on #82). No Flatpak |
| 6 | **Free, with no nags,** accounts or telemetry | **Done** by design (AGENTS.md, no telemetry) |
| 7 | **Torrents in the same app** | **Done** (libtorrent). Users warn that all-in-one apps are often weak at torrents, so torrent quality matters |
| 8 | **An actively maintained project** | **A trust signal:** visible releases and changelogs, see [inputs for #461](#inputs-for-the-road-to-100-461) |
| 9 | **A modern, compact UI,** dark theme | **Done:** light, dark, system; compact layout (#363) |
| 10 | **Lightweight,** not Electron | **Done:** Tauri. Measured memory use isn't published yet |
| 11 | **Queues, limits, batch add and delete** | **Partial:** one queue with order, a schedule, batch actions. **Missing:** several named queues |
| 12 | **Integrity checks,** checksums and a re-check | **Partial:** a checksum given before the download. **Missing:** verifying a finished file, reading `.sha256` files, and a torrent re-check |
| 13 | **Actions after a download:** shut down, notify, open | **Partial:** notifications. **Missing:** shut down or sleep when the queue finishes |
| 14 | **Proxy and VPN binding** | **Partial:** proxy with login. **Missing:** binding to the VPN's network adapter |
| 15 | **Categories and automatic sorting** | **Done:** by file type, with folders. **Missing:** rules by site |

## Ranked roadmap

**v0.3.0 is already large.** It holds the stores (#240, #241), mirrors (#324), the ramp (#330), long runs (#337), the docs audit (#425), files on a page (#426), signing (#428, #429), the legal review (#441), the SFTP fix (#459), tips (#460), the 1.0 plan (#461), the guide (#463) and the list fix (#464). So this roadmap adds only small, high-value items to v0.3.0, and spreads the rest over the next versions. The version names are suggestions for the PO and for #461.

**Size:** S is days in one layer; M is a week or two across layers; L is a month or more, or a new subsystem.

### Priority 1: suggested for v0.3.0

In order of user value for the effort:

| # | Feature | Why | Size | Needs |
|---|---|---|---|---|
| 1 | **Refresh an expired link:** give a download a fresh link and keep the bytes, after checking it's the same file (size, validators) | Users' wish #2, and IDM's best-known recovery feature. A 20 GB download no longer starts over | M | Nothing new. Later: the extension can offer the fresh link when the user clicks again |
| 2 | **Shut down or sleep when the queue finishes,** with a countdown that can be cancelled; **keep the computer awake while downloading** | Users' wish #13. Overnight downloads no longer stop when a laptop sleeps | S–M | System calls with argument lists only (Windows power API, Linux logind) |
| 3 | **Pattern downloads:** `file[001-100].zip` becomes 100 links, within the Add dialog's 500 | Numbered series without typing each link | S | Nothing new |
| 4 | **Mark of the Web:** finished files on Windows are marked as from the internet, so SmartScreen and Office's protected view still warn | Security: today a file from Apollo DM opens with fewer warnings than one from the browser | S | Nothing new |
| 5 | **Torrents: download in order,** to watch a video while it downloads | The top torrent gap; libtorrent already does it, and nothing calls it | S–M | Nothing new |
| 6 | **Torrents: bind to one network adapter,** so nothing leaks if the VPN drops | Users' wish #14, from privacy-minded torrent users | S | Nothing new; the listen address is fixed today (`crates/velocity-torrent/src/engine.rs:175`) |
| 7 | **Private torrents keep their trackers after a restart** | A known gap (`docs/TORRENTS.md`, "Not yet"): today a private torrent finds peers after a restart only through DHT or extra trackers | M | Tracker addresses can carry a passkey, so they would go in the keychain, which ADR-0015 limits to downloads' logins: **PO decision** |

### Priority 1: suggested for v0.4.0

| Feature | Why | Size | Needs |
|---|---|---|---|
| **Command line:** `apollo-download-manager <link>` adds a download | Other apps, scripts and file managers can hand off downloads; the app already receives its arguments (`src-tauri/src/lib.rs`) | S–M | Arguments are untrusted input |
| **Open magnet links and `.torrent` files from the system,** opt-in | Click a magnet anywhere and Apollo DM opens it | M | Tauri's deep-link plugin (**PO approval**); must not take over V1's registration |
| **Time-based speed limits, and a speed switch in the tray** | Full speed at night, slow during the day, one click to free the line for a call; for direct downloads and torrents | M | Nothing new |
| **Integrity:** verify a finished file, read published `.sha256` and `.sfv` files, torrent **force recheck** | Users' wish #12, which few tools offer; libtorrent's recheck is already in the bridge | S–M | Nothing new |
| **Torrents: per-file progress and file priority** (high, normal, low) | The bridge already reads per-file progress | S | Nothing new |

### Priority 2: later versions, before 1.0.0

| Feature | Size | Needs, or why later |
|---|---|---|
| Several named queues, each with its own schedule and number of files at once | M | A database migration |
| Rules per site (connections, login, category by link) | M | Builds on the learned per-server memory (#325) |
| Clipboard monitoring, off by default | S–M | A clipboard crate (**PO approval**); privacy: it reads everything copied |
| Digest and NTLM logins for HTTP | S–M | libcurl has them; must never fall back to Basic over plain HTTP |
| Several connections for FTP and SFTP | M | Server login limits |
| Interface languages | L, then ongoing | A translation library (**PO approval**); plan early, because every new text adds to it |
| In-app update check | M | Signing first (#428, #429), and a network call beyond downloads (**PO approval**) |
| Flatpak, or AppImage after the licence review | M | **PO decision**; Flathub is a trust signal users name |
| Export and import of the download list and settings, without secrets | M | Nothing new |
| Saved logins per site | M | Uses the keychain already in place |
| Torrents: IP blocklist from a local file, encryption settings, watched folder, move when finished | S each | libtorrent supports them; downloading a blocklist automatically would be a network call (**PO approval**) |
| Notification buttons (Open, Show in folder), extension modifier keys (hold a key to skip capture once) | S each | Nothing new |
| Portable mode | S–M | Browser registration and start-up must not point to a removable drive |

### Priority 2: after 1.0.0, each needs a decision first

| Feature | Why it waits |
|---|---|
| **Cookies from the browser,** for downloads behind a login page | **PO decision.** The extension never sends cookies today, by design (`docs/user/browser.md`). It would need the `cookies` permission, a new store review, and cookies kept in memory only, per download |
| **A local API, remote control from a phone or a web page** | A new attack surface (a local port, requests from web pages, authentication); needs an ADR |
| **RSS feeds with filters for torrents** | Polling feeds is a network call beyond the downloads (**PO approval**) |
| **Video and streams (HLS)** | #253, after #441's legal assessment |
| **Running a program after a download** | Runs code by design; argument lists only, opt-in |

### Priority 3: recommended not to build

| Feature | Reason |
|---|---|
| Premium hoster accounts, captcha solving, router reconnect | Legal and store-policy risk, constant plugin upkeep |
| Built-in torrent search | Legal and store-policy risk; qBittorrent keeps its search plugins out of the core for this reason |
| Automatic archive extraction | Path-traversal and archive-bomb risks, and unrar's restrictive licence; the system already opens archives |
| A plugin system | Supply-chain risk and upkeep |
| A recursive site crawler | See [the site grabber](#site-grabber) |
| Turning off certificate checks | Forbidden by AGENTS.md |
| I2P or Tor, swarm merging, an embedded tracker | Niche, with large security or upkeep costs |
| An Android app, Docker server mode | Outside the supported platforms |
| Periodic re-download when a file changes | Conflicts with the "never overwrite" rule |

## Site grabber

**Recommendation:** grab from the page the user is on, inside the browser extension, on top of #426. Don't build a crawler. The details are in [the appendix](2026-11-13-feature-research-site-grabber.md).

- **In the extension (size S, nothing new):** pages built by scripts, and pages behind the user's login, already work, because the extension reads the page as the browser shows it. DownThemAll! works this way. On top of #426 it adds:
  - filters by name or link, to include or exclude, with a size range;
  - saved filters;
  - all tabs in the window;
  - keeping the site's folders;
  - a warning for links already in the app.
- **The app fetching one page itself (size M), later, on a PO decision:** only for open directory listings. It needs an HTML parser crate (**PO approval**). Every link found is treated as a browser link, so local addresses wait for the user (ADR-0006).
- **A recursive crawler (size L): not now.** It would have to follow robots.txt, limit its request rate and guard against crawl traps, and it would be the largest new attack surface, for a need Wget and HTTrack already serve.
- **A limit #426 must design for:** a browser message is capped at 64 KiB, but the Add dialog takes 500 links (noted on #426).

## Inputs for the road to 1.0.0 (#461)

What makes users trust or drop a download manager, from [the user wishes](2026-11-13-feature-research-user-wishes.md):

- **Dealbreakers:**
  - compromised official downloads (FDM's Linux package was backdoored from 2020 to 2022, and JDownloader's site was breached in 2026);
  - adware in installers;
  - capture that breaks after browser updates;
  - abandoned projects;
  - nags and paid licences;
  - security bugs in the client itself (qBittorrent ignored certificate errors for 14 years).
- **Trust signals:** fully open source, no telemetry or account, signed releases, official store and Flathub listings, visible maintenance, a portable build, a native app.

For #461 this means: signed releases (#428, #429), verifiable checksums, no bundled offers ever, an outside security review, and a visible release rhythm all count as 1.0 conditions, not extras.

## Decisions for the PO

1. **Which Priority 1 items go into v0.3.0:** all seven above, a subset, or none, keeping v0.3.0 as it is.
2. **Cookies from the browser:** keep "never", or allow them in memory, per download, with the extension's `cookies` permission.
3. **Private torrents' trackers:** whether the keychain may also hold tracker passkeys (ADR-0015 limits it to downloads' logins today).
4. **New dependencies:**
   - Tauri's deep-link plugin, for magnet links and `.torrent` files;
   - a clipboard crate;
   - a translation library;
   - later, an HTML parser crate.
5. **Linux packages:** Flatpak or Flathub, and whether to start AppImage's licence review.
6. **Network calls beyond downloads:** an update check, blocklist downloads, RSS.
7. **The site grabber's scope:** the extension only (recommended), or app-side page fetching later.
