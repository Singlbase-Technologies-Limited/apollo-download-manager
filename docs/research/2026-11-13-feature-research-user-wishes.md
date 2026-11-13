# What users wish for in a download manager and torrent client

An appendix of the [feature research report](2026-11-13-feature-research.md) (#427), on what users wish for. It is the research agent's catalogue as written; the report checks and ranks it.

Research for issue #427, scope F. All entries are **reported claims** by users, not verified facts. Checked 2026-11-13.

## 1. Method

**Sources searched**

- **GitHub issue trackers** (GitHub search API, read-only, as `velocity-claude-agent`):
  - The 20 to 25 most-upvoted issues in each of Motrix, XDM, AB Download Manager (ABDM), Gopeed, Persepolis, qBittorrent and Transmission.
  - The 15 most-commented issues in each of Motrix, XDM and ABDM.
  - In total I read the title and the 👍 and comment counts of about 220 issues. The counts below are 👍 reactions, written `👍N`, and comments, written `Nc`.
  - **Keyword counts in issue titles** across the five download-manager repos (Motrix, XDM, ABDM, Gopeed, Persepolis), with `is:issue in:title <word>`. A count is a rough signal of how many issues mention the word, not how many are distinct requests.
- **Reddit:** reddit.com and old.reddit.com refuse automated fetches, so I used the Arctic Shift archive API (`arctic-shift.photon-reddit.com`).
  - I pulled the post lists for "download manager" and "IDM" in r/software, r/DataHoarder, r/linux, r/windows, r/Windows11, r/qBittorrent and r/torrents. The API timed out for r/opensource, r/linuxquestions and r/Piracy.
  - I read the comments of 32 threads. 6 of them turned out to be removed by moderators, which leaves **26 threads with real discussion**.
  - The scores (`sN`) are as archived, so they may be lower than the live values.
- **Hacker News** (Algolia API): story search for "download manager", "IDM alternative", "JDownloader", "Motrix" and "qBittorrent". I read the top-level comments of 5 threads.
- **Lemmy:** 1 thread on an open-source IDM alternative (58 upvotes).
- **AlternativeTo:** the review pages of Free Download Manager (FDM), Internet Download Manager (IDM) and JDownloader.
- **News and security reporting:** reports of security incidents in the download-manager field, read for what users react to; the products concerned aren't named here. Also the vendor FAQ on IDM's Chrome integration.
- **Not reachable:**
  - Live Reddit (blocked).
  - The ghacks comments (HTTP 403).
  - The Chrome Web Store and Microsoft Store reviews. I did not attempt these in the end, so they are NOT RUN.

**Volume:** about 26 Reddit threads with comments, 5 HN threads, 1 Lemmy thread, 3 AlternativeTo pages and 4 news items, which comes to about 39 discussions read in full. On top of these, I scanned about 220 GitHub issues by title and reaction count. Many GitHub issues are counted only by title and reactions; I did not read their bodies.

**Caveats**

- Reddit threads about download managers are mostly small, with 5 to 60 comments. The biggest signal comes from GitHub reaction counts.
- Many recent r/software posts announce new open-source tools, often vibe-coded ones. Their comment threads still reveal wishes, through what people ask: "Firefox?", "expired links?", "torrents?".
- The two "Video" wishes (stream grabbing, YouTube) are very frequent. They may fall outside the scope of Apollo Download Manager, so they are flagged rather than dropped.

## 2. Ranked wishes

The ranking weighs the number of distinct threads and issues, the size of the reaction counts, and whether the wish came up unprompted in "which download manager?" threads.

| # | Wish | Category | Frequency evidence | Example sources | Notes |
|---|---|---|---|---|---|
| 1 | **Browser capture that just works.** A click in the browser is caught automatically, in every browser (Firefox, Zen, Helium and Brave included), without the browser downloading the file as well, and it survives browser updates. | browser | ≥18 issues and threads. "extension" appears in 169 issue titles and "capture" in 50. | Reddit 1iqoirl: "IDM catches links, setting it up in others has been abysmal" (s5). Reddit 1xn0vux: the top comment is "A Firefox extension is missing" (s18). Reddit 1oc8tmx: the poster says browser integration is the most important feature. Lemmy 177124: an auto-capture, Firefox-first wish list (58 up). XDM #918 (👍17, 29c), #454 "Add-on disabled by Firefox" (👍8, 37c), #1015 and #1096 (removed from the Chrome Web Store). Motrix #2521 and #2477 (Chrome downloads the file before Motrix takes over), #2487 and #2467 (the extension disconnects, or several browsers can't connect at once). ABDM #109 (👍6), #342 (👍6), #654 (👍6). Gopeed #136 (👍7), #1373 (the latest Chrome can't intercept). | The single most decisive factor in the "IDM vs X" threads. People forgive a lot when capture is reliable. |
| 2 | **Resume a download after its link expires,** by giving it a fresh link and continuing from the bytes already downloaded. | direct | 8 dedicated threads and issues. Title counts: "refresh link" 15, "expired" 8. | XDM #1105 "Manually edit download link and resume" (👍12), #79 "Download session has expired" (15c), #1437 (2026). Motrix #2504 "Renew expired downloads" (2026). Reddit 1p4kj8j: the whole post is about this (s6, 23 comments). Reddit 1xn0vux: "what if download link expires?" (s7). Reddit 10zpy7n: resuming Google Drive files (10 comments). | Asked unprompted of every new tool. |
| 3 | **Speed:** many connections per file, a configurable connection cap, and no long "merging parts" wait at the end (write in place, or preallocate). | direct | 9 threads and issues. | Reddit 1nbn30k: FDM's 20-connection cap limits a 1 Gbps line (post s3). Reddit 1sjodaz: IDM's part-joining on a 40 GB file "takes A LOT of time" (s3). Reddit 1wt7u0u: IDM's space allocation causes a delay (s2). Reddit k7yzyb: "64 connections, maxes out the seedbox" (s2). ABDM #1523 skip "Creating file" (5c), #1540 (disable dynamic threads), #238 (slows near the end, 16c). Gopeed #1652. | Several users note that the server caps speed, so measured, honest speed claims matter. |
| 4 | **Video and stream grabbing:** a download button on videos, and HLS or m3u8 merging. | browser/direct | Very frequent. Title counts: "youtube" 97, "m3u8" 28. | ABDM #9 (👍28, 37c), #1299 yt-dlp (👍13), #1372 (👍6), #599 (👍6). Motrix #403 (👍17), #864 (👍6). Gopeed #618 and #773. Reddit 1peonii (m3u8 is IDM's gap), 1kpb6jn (missing IDM's download bar, s3), 1npmr2i, 1jl8deh and 1mkp0vj (IDM breaks on YouTube every few weeks). Lemmy 177124. | **Scope question for the PO.** Many people mean this when they say "download manager". It is also a cat-and-mouse maintenance burden (YouTube changes). |
| 5 | **Proper Linux packages:** Flatpak or Flathub, AppImage, RPM and Debian packages. | platform | ABDM alone has 6 issues with 👍81 between them. Title counts: "flatpak" 19, "appimage" 26. | ABDM #175 (👍21, 32c), #838 (👍16), #30 (👍13), #12 (👍13), #709 (👍10), #776 (👍8). Persepolis #818 and #1107. Gopeed #250. XDM #283 (XDG directories), #1122 (ARM64). Reddit 1wt7u0u: "Give an AppImage", "zip format please". | The top platform ask. The "no good IDM on Linux" posts (r/linux 1r1ta2w, 1nn292m, 1kgdncw) show the demand, though they were removed for karma or format. |
| 6 | **Free with no nags:** no trial, no subscription, no account, and no pop-ups. | trust | 8 threads. | Reddit 1xn0vux: the post's premise is "no trial timer, no account, no telemetry" (s197, 94 comments, the most popular post found). Reddit 1wtim2r: "IDM's trial running out", and FDM "without any nagging notifications". Reddit 17id870: "IDM subscription worth paying?" (17 comments, mostly no). Reddit 1uud4k8: lifetime-licence confusion. Reddit 1mkp0vj: IDM pops up on YouTube uninvited. Lemmy: "no freemium". | Several IDM users say they would pay, but the free and open-source crowd treats a nag as a dealbreaker. |
| 7 | **All-in-one: torrents in the same app.** | torrent | 6 issues and threads. | ABDM #301 (👍20), #215 (👍12), #835 (👍11), #829 (👍7). Reddit 1xnfkql: "does it support torrent?" Reddit k7yzyb: "Can it handle torrents?" Reddit 184ekdg: "I prefer one program for downloads and torrents, but [FDM] is buggy". | Counter-signal: r/torrents users steer people to qBittorrent because all-in-one torrent support is often weak (184ekdg, top comment s18). The torrent side must be as good as a real client's. |
| 8 | **An actively maintained project** that is not abandoned. | trust | 11 issues and threads, some among the most upvoted in their repos. | Motrix #1396 (👍43, its #1 issue), #1379 (32c), #1656 long-term fork (👍32), #1805. XDM #1218 "dead?" (👍8), #638 (20c), #1260 (18c). Transmission #7058 "abandoned?" (👍25, 66c), #701 (👍36). Reddit 1kpb6jn and 1k4vumu: "XDM is not updated anymore". | People check the release dates before they adopt a tool. |
| 9 | **A modern but compact UI,** with a dark theme, scaling or font size, and no clutter. | UI | ≥14 issues and threads, including the most upvoted issue found anywhere. | qBittorrent #6434 Dark Theme (👍375, 194c), #11917 (👍88), #17081 (👍61). Transmission #644 (👍46), #463 (👍31). Reddit 1eavbp7: a concept redesign of IDM (s66). A Hacker News thread criticises an established manager's UI. Reddit 1em70ho and 1xn0vux: JDownloader is "ugly" and "convoluted". XDM #22, #62 "interface is too small" (18c). ABDM #10 font size (👍6), #1067 (19c), #444 "Search is ugly" (16c). Lemmy: "compact layout like IDM". | Users want IDM's density with a current look. |
| 10 | **Lightweight:** low RAM and CPU, fast start, not Electron. | UI/trust | 10 issues and threads. | Motrix #1606 "Migrate UI to Tauri" (👍14). Reddit 1xn0vux: "Tauri instead of Electron, good job" (s4). Reddit 1wt7u0u: the web-stack start time, XDM's memory in the tray, and FDM as heavy. Reddit 1p4kj8j: "FDM is heavy for my laptop". Reddit 1peonii: IDM "stays under 10MB". ABDM #123 memory (17c). Gopeed #1621 (8% CPU when idle). Persepolis #1130 (out-of-memory kill). | Apollo Download Manager's Tauri shell is an advantage worth stating, but only with measured numbers. |
| 11 | **Queues, concurrency limits, batch add, select all and batch delete.** | direct/UI | Title counts: "queue" 55, "batch" 22. 7 threads and issues. | Reddit 1sety9x: "a download manager that can queue sequential downloads" (11 comments; "a queue system would save so much time"). Reddit 1s60o9s: single download with URL queuing. Motrix #27 batch delete (👍8, 13c), #270 "max tasks = 1 ignored" (18c). Persepolis #405, #379. Gopeed #823 select all (👍4). Reddit 1xbj9u1: "can it pull multiple links?" | |
| 12 | **Integrity checks:** checksums, verifying after a resume, and re-checking like Steam does. | direct/trust | 6 threads and issues. | Reddit 1vov19y: "no download manager has integrity check" (8 comments). Reddit 1vge159: a 20 GB zip was corrupt after a power-cut resume. Persepolis #346 (👍3). r/DataHoarder 1xbt6nb and 1xav5wk: new tools advertise verification. | Under-served, and a natural differentiator. |
| 13 | **Actions after a download:** shut down or sleep, notifications, open the file or folder. | UI | Title counts: "shutdown" 10, "notification" 30. 9 issues. | Motrix #1375 (👍6), #550 (👍5), #823 (👍4). ABDM #58 (👍6). Gopeed #571 "completion pop-up" (👍6). XDM #1430, #1431, #1420. | |
| 14 | **Proxy and VPN binding:** HTTP, SOCKS5 or PAC proxies, and binding to a network interface. | direct/torrent/trust | Title count "proxy" 51. 7 issues and threads. | ABDM #27 (👍11). Motrix #2500 (PAC). Transmission #338 "Bind to an interface" (👍58), #1250 SOCKS5 (👍23). A Hacker News thread on traffic leaking outside a VPN. Reddit 1xnfkql: "Can we bind it to a VPN?" | |
| 15 | **Categories and automatic sorting by file type,** with custom folders that the app remembers. | UI | Title count "category" 25. 6 issues. | Gopeed #899 (👍9). ABDM #17 (👍6), #1524. Transmission #79 tags and categories (👍53). qBittorrent #15946 (👍82, 138c). XDM #1426 (doesn't remember the location). Persepolis #1119. | |
| 16 | **Speed limits,** global and per task. | direct/torrent | Title count "speed limit" 25. | Gopeed #879 (👍8), #406 (👍5). Persepolis #508 (👍6), #1106. qBittorrent #25264 (limits ignored in 5.3.0). | |
| 17 | **Tray and background behaviour:** close to the tray, start minimised, autostart, and an option to really exit. | UI | Title count "tray" 55. | Persepolis #530, #477, #60, #1111. Gopeed #394. ABDM #1526 (exit on close), #126 (tray unsupported on the platform, 15c). XDM #1442. Reddit k7yzyb: "being able to close the browser without cancelling". | |
| 18 | **Bypass or confirm:** a modifier key to skip capture, ask before taking over, and a minimum size to capture. | browser | 5 issues. | ABDM #757 Alt+click bypass (👍9). Motrix #995 "confirmation before downloading from Chrome" (👍8). Persepolis #803 "only for downloads > x MB", #850. | Pairs with wish 1. Capture must be controllable, not grabby (XDM #1057 "captures random files"). |
| 19 | **Logged-in and hoster downloads:** cookies or auth from the browser, captcha-gated hosts, Google Drive and MEGA. | browser/direct | 8 issues and threads. Title count "cookies" 10. | ABDM #1532 (pass the browser's cookies). Reddit 1oc8tmx (RapidGator captcha). Reddit 1em70ho: JDownloader is unmatched for hosters. Persepolis #559 Google Drive (👍10). Motrix #692 (👍7), #1257 MEGA (👍8). | Credentials must stay out of storage (AGENTS.md). |
| 20 | **Torrent power features:** remember sequential and first/last-piece options, anti-leech peer blocking, BT v2, seeding and removal rules, RSS, file selection, moving data. | torrent | High reaction counts in qBittorrent and Transmission. | qBittorrent #9746 (👍62) plus HN 41723876 (sequential not remembered), #10258 block Thunder (👍86), #453 RSS (👍99), #439 relocate (👍85), #9063 (👍96). Transmission #458 BT v2 (👍96), #217 remove when finished (👍31), #597 sequential (👍28). Motrix #570 anti-leech (👍8), #757 and #1282 seeding control (👍11, 👍10), #168 select files. Gopeed #859 (👍7), #578 RSS (👍5). | See also the torrent-clients research file in this folder. |
| 21 | **Remote control or a web UI, a CLI, an RPC or API,** and a headless mode. | platform | Title counts: "rpc" 22, "command line" 13. | qBittorrent #5191 thin client (👍67), #3327 (👍85). Transmission #717 (👍24). Gopeed #594 aria2-compatible RPC (👍10). XDM #83 CLI (9c). Persepolis #514, #244. Reddit 1sety9x: JDownloader in Docker driven by the browser plugin. | |
| 22 | **A portable version.** | platform/trust | Title count "portable" 16. | Persepolis #279 (👍9). Gopeed #1629. AlternativeTo FDM: "weaker portability". | |
| 23 | **Disk-space checks before starting.** | direct/torrent | 1 issue, but highly upvoted. | qBittorrent #10645 (👍110). | |
| 24 | **Export and import of settings.** | UI | 1 issue, but highly upvoted. | qBittorrent #6236 (👍80). | |
| 25 | **Correct file names:** non-Latin characters, colons, auto-naming. | direct | Title count "rename" 22. | XDM #143. Lemmy 177124. ABDM #1544 (colon). AlternativeTo FDM (manual renaming needed). Reddit 1oc8tmx: "changing names of downloaded files". | |

## 3. Pain points and dealbreakers

| Pain point | Frequency evidence | Sources | What it implies |
|---|---|---|---|
| **Malware and supply-chain compromise** of the official download | 2 incidents in the field (2023 and 2026), each with a large public discussion | Security reporting and Hacker News discussions | Signed releases, reproducible or verified builds, and published checksums. One commenter asked when artifacts would finally be signed |
| **Adware or bundleware installers** | A recurring complaint about installers that carry third-party offers | User reviews and forum threads | One clean installer, no offers. |
| **Capture breaks** after browser, extension-store or site changes | ≥10 | XDM was disabled by Firefox (#454, 37c) and removed from the Chrome Web Store (#1015, #1096). IDM's YouTube panel breaks repeatedly (Reddit 1npmr2i, 1jl8deh, 1ddurqt). IDM's Chrome FAQ. Reddit 1iqoirl: users unhappy with a Chrome extension's changes. Gopeed #1373. | Store-policy compliance, MV3 readiness, and fast updates. |
| **Abandonment** | 11 (see wish 8) | Motrix, XDM, Transmission (in its 2018 and 2024 eras). | A visible release cadence. |
| **Paid licence, trial or subscription** | 6 | IDM (Reddit 17id870, 1wtim2r, 1uud4k8). FileCentipede's freemium model (Lemmy). | — |
| **Windows-only, or no Linux or macOS build** | 5 | IDM is Windows-only (AlternativeTo; Reddit 1peonii wants macOS). r/linux "no IDM alternative" posts. Lemmy. | Apollo Download Manager is on Windows and Linux; macOS is out of scope (PO decision). |
| **Heavy, slow or Electron-based** | 10 (see wish 10) | Motrix (about 100 MB with Electron, per a DEV article), FDM "heavy", XDM's memory use, ABDM's RAM use. | — |
| **Long merge or "creating file" step** for big downloads | 4 | IDM (Reddit 1sjodaz, 1wt7u0u). ABDM #1523. | — |
| **Stuck at 99%, corrupt output, failed append** | ≥5 | XDM #69 (42c), #192 (16c), #1419 (8c), #1424. ABDM #1531. Gopeed #1648 (the MD5 differs on every download). Reddit 1vge159. | Integrity checks; never report done before the file is verified. |
| **Antivirus false positives** | 3 | Gopeed #929 (👍6, 11c). HN 27958432: "Windows Defender blocks qBittorrent" (333 points, 2021). Reddit 16uzo11 (a Defender warning with IDM). | Code signing and reputation. |
| **Security bugs in the client itself** | 1 major discussion | A long-standing TLS certificate-checking flaw in a popular client, discussed widely in 2024; users said they uninstalled over it | Never disable TLS verification, which matches AGENTS.md. |
| **VPN or IP leaks** in torrent clients | 1 thread | A Hacker News discussion of a client sending traffic outside the VPN despite its bindings | Interface binding (wish 14). |
| **Pop-ups and uninvited launches** | 2 | Reddit 1mkp0vj: IDM opens itself on YouTube, and the user dislikes the "little pop-ups". Reddit 1wtim2r: FDM praised for "no nagging notifications". | — |
| **Distrust of new, AI-built tools** | 3 threads | Reddit 1xn0vux ("AI slop", "no policy for labeling vibe-coded software", s7). Reddit 1xnfkql, 1xbj9u1: "the 5th brand new downloader this month". | Credibility comes from track record, tests and transparency, not from feature lists. |
| **"Why use a download manager at all?"** | 5 threads | Reddit 17id870, k7yzyb and 1eavbp7. Two Hacker News discussions. | The counter-argument: big files, unreliable links, slow or unreliable connections (load-shedding in 1vge159), bulk downloads, and closing the browser (k7yzyb, 1uud4k8). |

## 4. Trust signals people look for

| Signal | Evidence |
|---|---|
| **Fully open source**, not only partly | Reddit 1xn0vux, 1wtim2r and 1k4vumu: "open source" is the first thing people ask about or advertise. Users question products that are only partly open source, or that moved to closed source. Lemmy 177124: "Is FDM open source?" |
| **No telemetry, no account, no ads** | Reddit 1xn0vux: the most-upvoted post found (s197) leads with "no account, no telemetry". Reddit 1wtim2r (Swoop): "No ads, no tracking, no account". HN 41723876: the qBittorrent story is framed as "No Ads". |
| **Signed binaries and updates; a clean, official installer** | In the discussions of the incidents above, signed updates were what reassured users. |
| **Distribution through trusted channels** (official stores, distro repos, Flathub) | Users point to unofficial package repositories as a way in for compromised packages. ABDM: the Flathub and Flatpak issues (wish 5). XDM: the store removals hurt trust. |
| **Active maintenance and a responsive developer** | Wish 8. Reddit 1uud4k8: IDM "constantly updated". Reddit 1xnfkql: the developer answering crash reports earns goodwill. |
| **Portable, and doesn't litter the system** | Persepolis #279 (👍9). XDM #271 ("javasharedresources" folder in the home directory, 14c), #283 (XDG directories). Reddit 1wt7u0u: "people don't want to install apps in the system". |
| **No false-positive antivirus warnings** | Gopeed #929. HN 27958432. |
| **Native, not Electron** | Reddit 1xn0vux (praise for Tauri). Motrix #1606. |

## 5. Sources

All checked 2026-11-13. The Reddit dates are post dates; the GitHub dates are when each issue was opened.

### Reddit (via the Arctic Shift archive; the canonical URL is `https://www.reddit.com/r/<sub>/comments/<id>/`)

- r/software 1xn0vux "Built a free, open-source download manager… no account, no telemetry" (2026-11-03, s197, 94 comments)
- r/software 1kpb6jn "What Download Manager Should I Get?" (2025-05-18, s18, 36 comments)
- r/software 1iqoirl "Best download manager?" (2025-02-16, 24 comments)
- r/software 1p4kj8j "…resume downloading after long time of pause" (2025-11-23, 23 comments)
- r/software 1k4vumu "Why is IDM the Best Download Manager?" (2025-04-22, 19 comments)
- r/software 1xnfkql "Mister Download Manager: open-source IDM alternative" (2026-11-04, s43, 19 comments)
- r/software 1peonii "Does IDM still do anything better than modern/FOSS alternatives?" (2025-12-05, 14 comments)
- r/software 1wtim2r "what is the best internet download manager alternative?" (2026-09-29, 14 comments)
- r/software 1wt7u0u "I made oxdm…" (2026-09-29, s15, 14 comments)
- r/software 1npmr2i "IDM stopped showing download panel on YT" (2025-09-24, 10 comments)
- r/software 1oc8tmx "Simple download manager with good browser integration?" (2025-10-21, 6 comments)
- r/software 1sjodaz "Free, reliable download manager?" (2026-04-12, 9 comments)
- r/software 1s60o9s "Download Manager (single download, url queuing)" (2026-03-28, 9 comments)
- r/software 1uud4k8 "Do people actually still use IDM?" (2026-07-12, 7 comments)
- r/software 1vov19y "A download manager that has file integrity check functionality" (2026-08-15, 8 comments)
- r/software 1vge159 "…check files integrity like steam" (2026-08-05, 4 comments)
- r/software 1nbn30k "…a way to increase connection count" (2025-09-08, 6 comments)
- r/software 1mkp0vj "Latest version of IDM launches by itself whenever I visit youtube" (2025-08-08, 6 comments)
- r/software 1xbj9u1 "I wanted a better download manager, so I built one" (2026-10-21, 8 comments)
- r/software 1jl8deh "IDM keeps faltering on Youtube" (2025-03-27, 6 comments)
- r/DataHoarder 1em70ho "Need Download Manager Recommendations!" (2024-08-07, 18 comments)
- r/DataHoarder 1sety9x "…download manager that can queue sequential downloads" (2026-04-07, 11 comments)
- r/DataHoarder 10zpy7n "Download manager for google drive files with resume" (2023-02-11, 10 comments)
- r/DataHoarder 1ddurqt "IDM stopped detecting YouTube MKV" (2024-06-12, 15 comments)
- r/DataHoarder 1xbt6nb and 1xav5wk (verification-focused tool launches, 2026-10-21 and 2026-10-20; titles only)
- r/windows 17id870 "Is IDM subscription worth paying?" (2023-10-28, 17 comments)
- r/windows k7yzyb "AM Downloader…" (2020-12-06, s40, 11 comments)
- r/Windows11 1eavbp7 "[Concept] IDM Redesign – Fluent UI" (2024-07-24, s66, 11 comments)
- r/torrents 184ekdg "Is FDM good for torrenting?" (2023-11-26, s14, 18 comments)
- Titles only, removed by moderators: r/linux 1r1ta2w (2026-02-11), 1nn292m (2025-09-21), 1kgdncw (2025-05-06), 1mwklep (2025-08-21); r/windows xvldha (2022-10-04); r/torrents u7l660 (2022-04-20).

### Hacker News

- https://news.ycombinator.com/item?id=41723876 qBittorrent, no ads (2024-10-02, 73 points, 30 comments)
- https://news.ycombinator.com/item?id=24141480 PyIDM (2020-08-13, 104 points, 28 comments)
- https://news.ycombinator.com/item?id=27958432 Windows Defender blocks qBittorrent (2021-07-26, 333 points; title only)

### Other forums and reviews

- Lemmy: https://lemmy.linuxuserspace.show/post/177124 (about 3 years old; 58 up)
- AlternativeTo:
  - https://alternativeto.net/software/free-download-manager/about/ (3.7 rating, 35 ratings)
  - https://alternativeto.net/software/internet-download-manager/about/ (4.2 rating, 17 ratings)
  - https://alternativeto.net/software/jdownloader/about/ (3.7 rating, 47 ratings; reviews from Dec 2025 to Jul 2026)
- News and security:
  - IDM's Chrome integration FAQ: https://mirror5.internetdownloadmanager.com/register/new_faq/bi9.html
  - DEV article: https://dev.to/soroushpng/best-download-managers-in-2026-macos-windows-linux-opb (2026; Motrix "Heavy (Electron ~100MB)")

### GitHub issues

`https://github.com/<repo>/issues/<n>`; the dates are when each issue was opened.

- **agalwood/Motrix:**
  - #1396 (2023-03-05, 👍43), #553 (2020, 👍35, ed2k), #1656 (2024-04-12, 👍32), #403 (2019, 👍17), #1606 (2023-12-19, 👍14), #757 (2020, 👍11), #1309 (2022, 👍10, Safari)
  - #1282 (2022, 👍10), #570 (2020, 👍8), #27 (2019, 👍8), #995 (2021-06-29, 👍8), #1257 (2022, 👍8), #692 (2020, 👍7), #168 (2019, 👍6)
  - #1375 (2023, 👍6), #864 (2021, 👍6), #550 (2020, 👍5), #1020 (2021, 👍5), #823 (2020, 👍4), #1379 (2023, 32c), #270 (2019, 18c)
  - #2521 (2026-11-13), #2504 (2026-11-05), #2500 (2026-11-04), #2487 (2026-11-01, 11c), #2477 (2026-10-31), #2467 (2026-10-30)
- **subhra74/xdm:**
  - #918 (2022-10-25, 👍17, 29c), #1105 (2023-07-11, 👍12), #454 (2021-01-12, 👍8, 37c), #1218 (2024-04-01, 👍8), #1015 (2023, 👍6), #638 (2021, 👍5, 20c), #934 (2022), #1057 (2023)
  - #22 (2019), #283 (2020), #1122 (2023), #143 (2020), #83 (2020, 9c), #401 (2020), #69 (2020, 42c), #192 (2020, 16c), #79 (2020, 15c), #62 (2020, 18c), #271 (2020, 14c), #1260 (2024, 18c)
  - #1096 (2023), #1419 (2026-11-04), #1424 (2026-11-05), #1426, #1430, #1431, #1420, #1437 (2026-11-10), #1442 (2026-11-13)
- **amir1376/ab-download-manager:**
  - #9 (2024-08-05, 👍28, 37c), #175 (2024-11-10, 👍21, 32c), #301 (2024-12-14, 👍20), #838 (2025-09-18, 👍16), #30 (👍13), #12 (👍13), #1299 (2026-06-24, 👍13), #215 (👍12), #27 (👍11), #835 (👍11)
  - #709 (👍10), #757 (2025-08-08, 👍9), #776 (👍8), #829 (👍7), #599, #1372, #17, #10, #58, #109, #342, #654 (each 👍6)
  - #123 (17c), #126 (15c), #238 (16c), #444 (16c), #1067 (19c), #1523, #1524, #1526, #1531, #1532 (2026-11-09), #1540 (2026-11-11), #1544
- **GopeedLab/gopeed:**
  - #594 (2024-06-29, 👍10), #899 (👍9), #879 (2025-01-17, 👍8), #136 (👍7), #859 (👍7), #571 (👍6), #929 (2025-02-11, 👍6, 11c), #578 (👍5), #406 (👍5)
  - #618, #773, #823, #394, #250, #1373 (2026-05-07), #1621, #1629, #1648, #1652
- **persepolisdm/persepolis:**
  - #559 (2018, 👍10), #279 (2017, 👍9), #244 (👍7), #508 (👍6), #818 (👍4), #405, #514, #346, #530, #850 (each 👍3), #379, #477, #60, #803
  - #1106, #1107, #1111, #1119, #1130 (2026-08-28)
- **qbittorrent/qBittorrent:**
  - #6434 (2017, 👍375, 194c), #10645 (2019, 👍110), #453 (👍99), #9063 (👍96), #11917 (👍88), #10258 (👍86), #439 (👍85), #3327 (👍85), #15946 (👍82, 138c), #6236 (👍80)
  - #5191 (👍67), #9746 (👍62), #17081 (👍61), #25264 (2026-11-12)
- **transmission/transmission:**
  - #2462 (👍146), #47 (👍130), #458 (👍96), #338 (👍58), #79 (👍53), #644 (👍46), #2261 (👍45), #701 (👍36), #463 (👍31), #217 (👍31), #597 (👍28)
  - #7058 (2024, 👍25, 66c), #717 (👍24), #1250 (👍23)
