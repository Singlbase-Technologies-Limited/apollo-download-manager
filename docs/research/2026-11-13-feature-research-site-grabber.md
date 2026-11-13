# Site grabber research (#427 scope B)

An appendix of the [feature research report](2026-11-13-feature-research.md) (#427), on the site grabber. It is the research agent's catalogue as written; the report checks and ranks it.

Input for the #427 report, not a decision. All sources were checked on 2026-11-13.

- **VERIFIED** means the official documentation (or the repository) says it.
- **REPORTED** means a third-party source or general knowledge, not confirmed in official docs.
- **NOT FOUND** means the official docs we could reach don't say.

## 1. How existing grabbers work

### 1.1 Summary table

| Product | Kind | Depth and domain limits | Filters | Preview before download | Duplicates | Login and cookies | robots.txt | Politeness and rate | JavaScript pages |
|---|---|---|---|---|---|---|---|---|---|
| IDM Site Grabber | App-side recursive crawl with a 4-step wizard and templates | Levels for the current site and, separately, for other sites. Options: "explore all sites within the main domain", "don't explore parent directories" (VERIFIED) | Extensions with wildcards; include and exclude URL patterns with `*` for both pages to explore and files to download; minimum and maximum file size (VERIFIED) | Yes: explore first, then check files in a list and site tree, or "start downloading all matched files at once" (VERIFIED) | "Hide duplicate files found in different locations": same name and size (VERIFIED) | A login and password on step 1, or a login page opened in a browser window so the user logs in; logout pages to avoid (VERIFIED) | NOT FOUND | How many files to explore and download at once (VERIFIED); no delay setting found | "Can run a Java script on a page and parse the results", "use with caution" (VERIFIED) |
| JDownloader LinkGrabber and LinkCrawler | Paste or clipboard links into a staging list; plugins and "deep decrypt" read the HTML behind a URL for more links | `maxDecryptDepth` in a LinkCrawler rule (VERIFIED as a field, meaning not documented) | Linkgrabber filters (hide) and views (show), on type, size, host plugin, account, online status; wildcards or regex (VERIFIED) | Yes: the Linkgrabber is a staging list; links are checked online before download (VERIFIED for filters needing online status) | NOT FOUND in the articles read; JDownloader is widely reported to warn about links already in the list (REPORTED) | Per-rule `cookies` (VERIFIED as a field); accounts per host (VERIFIED as a filter condition) | NOT FOUND | NOT FOUND | Site plugins, not a browser; a DEEPDECRYPT rule applies a regex (`deepPattern`) to the raw HTML (VERIFIED) |
| Free Download Manager | 3.9 (legacy) had an "HTML Spider" for whole sites and a "Site Explorer" for a site's folders (VERIFIED, legacy feature page). Current FDM 6 has no documented grabber; "download all links" is offered by third-party FDM extensions (REPORTED) | NOT FOUND | NOT FOUND | NOT FOUND | NOT FOUND | NOT FOUND | NOT FOUND | NOT FOUND | NOT FOUND |
| DownThemAll! 4 | Extension, current page (or all tabs in the window) only; no following of links | None needed: one page | Custom filters, fast filtering with wildcards and regular expressions (VERIFIED for 3.0 docs, REPORTED for 4) | Yes: a selection window lists links and media; OneClick reuses the last filters (VERIFIED) | NOT FOUND | The browser's own downloads, so the browser's session applies (REPORTED) | Not applicable (no crawl) | "Custom network limits" in preferences (VERIFIED, no detail) | Reads the rendered DOM, so JS-built pages work (REPORTED; follows from being an extension) |
| "Image Downloader"-type extensions | Extension, current page's images | One page | Width, height, type, URL; presets such as "large only" (REPORTED, store listings) | Yes: thumbnail grid with selection (REPORTED) | REPORTED: dedupe by URL | Browser session | Not applicable | None | Rendered DOM |
| GNU Wget | CLI recursive crawl | `-r` with "default maximum depth is 5"; `--mirror` = `-r -N -l inf --no-remove-listing`; `-np` never ascends to the parent; `-H` must be given to span hosts; `-D` sets domains and "does not turn on -H" (VERIFIED) | `-A`/`-R` suffixes or patterns, `--accept-regex`/`--reject-regex` on the full URL (VERIFIED) | No | `-nc` refuses newer copies; `-N` timestamping (VERIFIED) | `--load-cookies`, `--user`/`--password` (VERIFIED) | Obeyed in recursive mode by default; `-e robots=off` turns it off (VERIFIED in the manual, reached through search; the gnu.org pages timed out from here) | `-w` wait, `--random-wait` (0.5 to 1.5 times the wait), `--limit-rate`, `-Q` quota (VERIFIED) | No JavaScript (the manual never mentions it; VERIFIED by absence) |
| HTTrack | CLI and GUI website copier | `-rN` depth (default 9999), `%eN` external depth (default 0), travel modes `-S -D -U -B`, host scope `-a -d -l -e` (default `-D -a`: down only, same address) (VERIFIED) | `+pattern` / `-pattern`, later rules win (VERIFIED) | No | Cache and update modes; `%n` don't re-download files deleted locally (VERIFIED) | `-b1` accepts cookies by default (VERIFIED) | `-s2` always obeys by default (VERIFIED) | `-c8` connections, `%c10` connections per second, `-A` rate, `-M`/`-m` size caps, `-E` time cap (VERIFIED) | `%P` heuristic link extraction from scripts, on by default; imported `.js` files not searched (VERIFIED) |

### 1.2 What they have in common

1. **Two families.** Page extractors (DownThemAll!, image downloaders, #426) read the current page in the browser. Crawlers (IDM Site Grabber, Wget, HTTrack, legacy FDM) fetch pages themselves and follow links.
2. **Selection before download is standard for interactive tools.** IDM explores, then lets you check files. JDownloader stages everything in the Linkgrabber. Only the CLI tools download without a preview.
3. **Filters are the core of the user value:** file extension with wildcards, include and exclude URL patterns, size range. Regex is offered but every product treats it as an expert option.
4. **Every crawler has bounds:** depth, host scope (same host by default, other hosts opt-in), "don't go to the parent", and total size or time caps (HTTrack, Wget quota).
5. **Politeness is only in the CLI tools:** robots.txt on by default (Wget, HTTrack), wait between requests, connections per second. IDM's docs say nothing about robots.txt or delays.
6. **JavaScript pages:** crawlers don't run JavaScript (Wget) or guess links from script text (HTTrack, IDM's optional script run, JDownloader's regex on HTML). Only browser extensions see the rendered page.
7. **Logins:** crawlers need their own login handling (IDM opens a browser to log in; Wget loads a cookie file). An extension that hands links to an app loses the browser's cookies unless it sends them.

## 2. What fits Apollo DM

### 2.1 Facts from the repository (VERIFIED)

- The extension's permissions are `downloads`, `nativeMessaging`, `storage`, `contextMenus`, `scripting`, with `<all_urls>` optional and asked only for magnet capture (`scripts/extension-lib.mjs:18-19`; `docs/BROWSER_EXTENSION.md`, Permissions). It never sends cookies, page content or logins (`docs/BROWSER_EXTENSION.md`).
- The native message carries one link per `download.add`; messages are capped at 64 KiB (`MAX_MESSAGE_BYTES`, `crates/velocity-core/src/browser/protocol.rs:24`); the bridge refuses more than 30 messages in 10 s (`RATE_LIMIT`, `RATE_WINDOW`, `bridge.rs:32-33`). The Add dialog takes up to 500 links (`MAX_ADD`, `src/features/add/addLogic.ts:7`). Note for #426: 500 URLs of up to a few KiB each can exceed 64 KiB, so `download.addMany` needs its own count and byte caps, or chunks.
- Links from the browser that resolve to local or private addresses wait for the user; the check is on the address libcurl actually connected to, so DNS rebinding is caught. Typed links are never checked (`docs/SECURITY.md`, "Links, redirects and local addresses"; ADR-0006).
- Redirects are followed by the engine itself, `http`/`https` only, at most 10, with https→http needing confirmation (`docs/SECURITY.md`).
- There is a precedent for the app fetching a small non-download resource: `.torrent` links go through the engine, capped at 16 MiB and 60 s, and must parse (`docs/SECURITY.md`; `MAX_TORRENT_BYTES` in `crates/velocity-core/src/manager/adding.rs`).
- The libcurl layer sends no `Accept-Encoding` (test `sends_the_requested_range_and_no_accept_encoding`, `crates/velocity-curl/tests/curl_loop.rs:83`), so there's no automatic decompression today.
- `html5ever` 0.39 and `dom_query` 0.28 are already in `Cargo.lock`, pulled in by `tauri-utils` (`cargo tree -i html5ever`). Using them directly would still be a new direct dependency needing PO approval (`docs/DEPENDENCIES.md`).
- #426 (open, v0.3.0) already plans: content script scanning `a[href]` and media sources with the existing rules (`rules.ts`), dedupe by URL, `MutationObserver`, a floating button in a closed Shadow DOM, a panel with checkboxes, type filter and search, sending as one batch through a new `download.addMany`. Site grabbing is out of its scope and points to #427.

### 2.2 Platform facts (VERIFIED)

- **Chrome `activeTab`:** temporary access to the current tab "when the user invokes the extension" (toolbar action, context menu, keyboard command, omnibox); "displays no warning message" at install; with `scripting` it allows `scripting.executeScript()` on that tab. https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
- **Firefox:** `activeTab` exists with the same purpose ("act on the current page when the user asks, without requesting broad host permissions"); `optional_host_permissions` are asked at run time. https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/permissions
- **Chrome Web Store policy:** "Request access to the narrowest permissions necessary". https://developer.chrome.com/docs/webstore/program-policies/permissions
- **robots.txt (RFC 9309):** applies to "automated clients", i.e. crawlers; cache at most 24 h; parse at least 500 KiB; 4xx means allowed, 5xx means "complete disallow"; "not a form of access authorization". https://www.rfc-editor.org/rfc/rfc9309.html

### 2.3 Candidate HTML parser crates (for scope b or c)

Checked on crates.io and OSV on 2026-11-13 (VERIFIED):

| Crate | Latest | Licence | Last release | Notes | OSV advisories |
|---|---|---|---|---|---|
| `html5ever` (Servo) | 0.40.1 | MIT OR Apache-2.0 | 2026-09-14 | The WHATWG-conformant parser; low-level tree-sink API. 0.39 already in the build through Tauri | None |
| `scraper` | 0.29.0 | ISC (allowed, permissive) | 2026-10-21 | html5ever plus `selectors`, a simple CSS-selector API; both already transitive | None |
| `dom_query` | 0.29.0 | MIT | 2026-10-23 | html5ever-based, jQuery-like; 0.28 already in the build through `tauri-utils` | None |
| `lol_html` (Cloudflare) | 3.0.3 | BSD-3-Clause | 2026-10-28 | Streaming rewriter with bounded memory; good for "extract hrefs from a capped stream" | GHSA-c3x7-354f-4p2x ("panics on certain HTML inputs", fixed in later versions; check before adoption) |
| `tl` | 0.7.8 | MIT | 2024-01-29 | Fast, not spec-conformant, no release in almost 3 years | None |
| `texting_robots` (robots.txt) | 0.2.2 | MIT OR Apache-2.0 | 2023-03-29 | Only needed for scope c | Not checked |

If the PO allows scope b, `scraper` or `dom_query` (html5ever underneath) is the least new code in the tree; `lol_html` is the bounded-memory option but brings a crate not yet in the lock file.

### 2.4 Three scopes compared

| | (a) Extension only: current page | (b) App fetches one page and lists its links | (c) Recursive crawler with limits |
|---|---|---|---|
| **What the user gets** | Every file on the page they're looking at, including JS-built pages and pages behind their login (the DOM is already rendered). Covers release pages, course PDFs, image galleries | Paste a URL into the app (no browser needed) and get its files; useful for open directory listings (`Index of /`) and for Linux users without the extension | Whole trees: nested directory listings, multi-page galleries, site mirrors |
| **JavaScript pages** | Work | Don't: the app sees only the server's HTML | Don't |
| **Pages needing login** | Work for listing; the downloads themselves still go without cookies (#426 out of scope; #249 login flow applies) | Only with the app's own login (#249) | Same, multiplied per page |
| **Complexity** | S on top of #426 (filters, presets) | M: fetch through the engine with caps, parse, base URL resolution, a new list UI in the Add flow, tests with fixtures | L: queue, scope rules, depth, dedupe, robots.txt, politeness, cancellation, progress UI, persistence of a project, update/sync |
| **New dependencies** | None | One HTML parser crate (PO approval) | Parser plus robots.txt parser, maybe a public-suffix list for "same site" (PO approval each) |
| **Security surface** | Page URLs and names are untrusted; already validated in the core (#426). Never render page text as HTML | Untrusted HTML parsed in the core process (parser bugs, deep nesting, huge documents); SSRF: a page can list `http://192.168.1.1/...` or `http://localhost:...` links, so found links must be treated like browser links (ADR-0006 check on connect), not like typed links; redirects as today; size and time cap like `.torrent` fetches (for example 4 MiB, 30 s) and no `Accept-Encoding` so no decompression bomb | All of (b), plus: unbounded crawl (traps such as calendars, session IDs in URLs), request amplification against third parties, disk exhaustion; needs hard caps on pages, depth, hosts, total bytes and time |
| **Store impact** | None if it reuses optional `<all_urls>` (#426's plan). A popup-only "Find files on this page" could use `activeTab` instead: a new permission line but no install warning; still a re-review on Chrome/Edge and a source upload on AMO | None | None |
| **Legal and politeness** | Low: the user is on the page and picks files | Low to medium: one fetch the user asked for | Medium to high: a crawler is an automated client in RFC 9309's sense, so robots.txt should be obeyed by default; site terms can forbid scraping; needs rate limits per host (#325 pacing could be reused) |

## 3. Recommendation

**Smallest useful scope: (a), built as #426 plus a few grabber features, and no crawler.** The value users name for a site grabber is "get all the PDFs/ISOs/images on this page with a filter", which the extension does better than the app because it sees the rendered page and the user's logged-in view.

What it adds on top of #426 (each S, no new dependency):

1. **Pattern filters** in the panel: wildcards on name or URL (`*.iso`, `*amd64*`), include and exclude, and a size range when the link or a HEAD answer says so. Regex only as an advanced option, as JDownloader and DownThemAll! do.
2. **Saved filter presets** ("Images", "Archives", the last used), like DownThemAll!'s OneClick.
3. **"All tabs in this window"** as a source, like DownThemAll!.
4. **Keep the site's folders** (optional): save under subfolders taken from the URL path, as IDM's "original subfolder structure" does. Path containment rules from SECURITY.md apply.
5. **Popup entry without page access:** a toolbar-popup "Find files on this page" through `activeTab` (no install warning, user gesture only), so users who never grant `<all_urls>` still get the feature. This is the "toolbar popup only" alternative already listed in #426. Needs a PO decision because it adds a permission line to the store listings.
6. **Duplicate warning** in the list for links already in the app (the core already knows them; "a link added before still asks" in #426).

**Later, only on PO decision:** scope (b) limited to **open directory listings**, one level at a time, user-initiated, with every found link treated as a browser link for ADR-0006, a size and time cap like `.torrent` fetches, and one parser crate (`scraper` or `dom_query`, both on html5ever already in the build). Scope (c), a recursive crawler, is not recommended now: L complexity, robots.txt and politeness obligations, and the largest new attack surface, for a niche need that Wget and HTTrack already serve.

### PO decisions this raises

- Add `activeTab` for a popup-only entry (store re-review), or rely on optional `<all_urls>` only?
- Scope (b) at all, and if yes, which parser crate?
- Confirm no recursive crawler in the roadmap (priority 3, "don't" for now).

## Sources (all checked 2026-11-13)

- IDM Site Grabber overview: https://www.internetdownloadmanager.com/support/idm-grabber/idm_grabber.html
- IDM Grabber wizard: https://www.internetdownloadmanager.com/support/idm-grabber/grabber_wizard.html
- IDM Grabber main dialog: https://www.internetdownloadmanager.com/support/idm-grabber/grabber_main_dialog.html
- IDM Grabber settings: https://www.internetdownloadmanager.com/support/idm-grabber/grabber_settings.html
- IDM Grabber scheduler (periodic sync): https://www.internetdownloadmanager.com/support/idm-grabber/grabber_scheduler.html
- JDownloader knowledge base index: https://support.jdownloader.org/en/knowledgebase
- JDownloader Linkgrabber filters and views: https://support.jdownloader.org/en/knowledgebase/article/linkgrabber-filters-and-views
- JDownloader LinkCrawler DIRECTHTTP example: https://support.jdownloader.org/en/knowledgebase/article/linkcrawler-example-directhttp
- JDownloader LinkCrawler DEEPDECRYPT example: https://support.jdownloader.org/en/knowledgebase/article/linkcrawler-example-deepdecrypt
- FDM features (legacy 3.9 HTML Spider, Site Explorer): https://www.freedownloadmanager.org/features.htm
- DownThemAll! 4: https://about.downthemall.org/4.0/ ; 3.0 (fast filtering, regex): https://about.downthemall.org/3.0
- GNU Wget manual (Debian man page, wget 1.21): https://manpages.debian.org/bookworm/wget/wget.1.en.html ; robot exclusion: https://www.gnu.org/software/wget/manual/html_node/Robot-Exclusion.html (timed out from here; content seen through search)
- HTTrack options guide: https://www.httrack.com/html/fcguide.html
- Image downloader extensions (REPORTED, store listings): https://chromewebstore.google.com/detail/image-downloader/ecfcbefpijaambckbnfcglfhnijakdbn
- Chrome activeTab: https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
- MDN permissions: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/permissions
- Chrome Web Store permissions policy: https://developer.chrome.com/docs/webstore/program-policies/permissions
- RFC 9309: https://www.rfc-editor.org/rfc/rfc9309.html
- crates.io API (`/api/v1/crates/<name>`) and OSV (`api.osv.dev/v1/query`) for html5ever, scraper, lol_html, dom_query, tl, texting_robots

## Not done

- No product was installed or tried; nothing here is "tried".
- JDownloader's duplicate handling and `maxDecryptDepth` meaning, IDM's robots.txt and delay behaviour, and FDM 6's current state weren't found in official docs.
- Firefox's `activeTab` install-warning behaviour wasn't confirmed on its own MDN page.
