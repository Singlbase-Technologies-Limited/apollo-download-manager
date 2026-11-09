# Product name shortlist (#346)

**Date:** 2026-11-05. **Question it answers:** which new product names are worth choosing between for the app, and what a first check of each one found.

**The PO's direction** (on #346, refined the same day):

- A completely new name, not "Velocity" plus a word.
- The feel of speed and motion, an invented word, or plain and descriptive.
- **Every name ends with "Download Manager"**, as in "Fast Download Manager" (an example of the form, not a candidate).
- **Domain availability doesn't remove a name.** Domains are reported, but only as information.

This is research, not a decision. **Outcome:** the PO chose "Apollo Download Manager" on 2026-11-05, recorded in [ADR-0018](../decisions/0018-product-name-apollo.md). **These checks aren't legal advice.** An empty search doesn't make a name safe to use; Singlbase Technologies Limited arranges the legal trademark clearance.

**Short answer:** with "Download Manager" at the end, the first word is what tells the app apart, so the checks that matter are: does a download manager with that name already exist, and is the first word a software trademark? Six candidates pass the first check. No download manager or download app was found under any of them: **Peregrine**, **Kestrel**, **Jetstream**, **Spry**, **Pullwing** and **Arrowdrop**. The real words (Peregrine, Kestrel, Jetstream) read best, but each already has several live US trademarks in class 9, held by companies outside downloads. The invented compounds (Pullwing, Arrowdrop) had no trademark record at all in the sources searched. A [second round](#second-round-plain-adjectives-and-short-invented-words) of plain adjectives and short invented words adds **Sleek**, **Nippy**, **Deft**, **Dashi** and **Zyvo**. Sleek and Nippy had no live software trademark on the word in the sources searched.

## How it was checked

| Check | How | Status |
|---|---|---|
| An existing download manager with the name | Web search for the exact phrase "<Name> Download Manager"; `gh api search/repositories` for it in repository names and descriptions | PASS (web and GitHub) |
| Existing software and brands using the first word | Web search for the word with "app", "software" or "trademark" | PASS (web search only) |
| Trademarks on the first word (classes 9 and 42) | Web search, which reached trademark aggregator sites (Justia, Markinton, TrademarkDir, GleanMark, TrademarkElite) that mirror USPTO and some Canadian data | PASS (aggregators only) |
| USPTO, EUIPO, WIPO official databases | Their search sites refuse automated searches: TMview answered "Request Rejected", and the USPTO search endpoint refused the request | NOT RUN |
| Firefox Add-ons and Flathub | Their public search APIs | PASS, for Pullwing and Arrowdrop only |
| Apple App Store, Google Play, Microsoft Store, Chrome Web Store | No direct search; only what the web search showed | NOT RUN directly |
| Domains (.com, .app, .io, .dev) and GitHub account | RDAP lookups and `gh api users/<name>`, for the first word alone | PASS; information only, per the PO |
| Meaning in other languages | Own knowledge of English, French, German, Spanish, Italian and Latin; not checked with native speakers | Assumed, not verified |

Search links for the trademark checks still to run: [USPTO Trademark Search](https://tmsearch.uspto.gov/), [EUIPO eSearch plus](https://euipo.europa.eu/eSearch/), [TMview](https://www.tmdn.org/tmview/) (the EU and many national offices) and [WIPO Global Brand Database](https://branddb.wipo.int/).

## The shortlist

### Peregrine Download Manager

- **Meaning:** the peregrine falcon, the fastest animal (over 300 km/h in a dive). From Latin *peregrinus*, "a traveller from abroad", which fits files travelling to you.
- **Other languages:** Spanish *peregrino* and Italian *pellegrino* mean "pilgrim"; French *pèlerin*. All positive or neutral.
- **Download managers:** none found with this name. Search results only showed Persepolis Download Manager, a different product.
- **Trademarks (aggregators):** crowded. At least 5 live US registrations of PEREGRINE in class 9, none for download software: MindPoint Group (cybersecurity software, 2025), Rajant (2025), Kymeta (2024), Shearwater Research (2021), Near Earth Autonomy (2020); also PEREGRINE CONNECT (integration software, 2024). The old Peregrine Systems marks are dead.
- **Domains and GitHub:** peregrine.com, .app and .dev and the GitHub account are taken; peregrine.io is too (information only).

### Kestrel Download Manager

- **Meaning:** a small falcon known for hovering still, then diving fast.
- **Other languages:** an English bird name; reads neutrally elsewhere.
- **Download managers:** none found. Other "Kestrel" software exists: Microsoft's ASP.NET web server is called Kestrel, and Kestrel GX is a photo editor.
- **Trademarks (aggregators):** crowded. Kymeta holds KESTREL in class 9 in the US (registration 8161509) and Canada. Live class 9 registrations are also held by Nielsen-Kellerman (Kestrel weather meters), Canary ProAudio and JDL Innovations, and US applications covering classes 9 and 42 are pending from Lumi AI Solutions and Kestrel 360.
- **Domains and GitHub:** kestrel.io is registered (all four taken); GitHub account taken.

### Jetstream Download Manager

- **Meaning:** the fast, high-altitude wind current. Easy to understand in most languages, because it's widely borrowed from English.
- **Download managers:** none found. Other uses exist: Jet-Stream (a video streaming platform), Leica JetStream (point-cloud software), and an old Mac download manager called "Jet It!".
- **Trademarks (aggregators):** not searched separately; the other uses above suggest a crowded register.
- **Domains and GitHub:** not checked (information only).

### Spry Download Manager

- **Meaning:** "spry" means lively and quick on your feet. A plain adjective, the same form as "Fast Download Manager".
- **Other languages:** a less common English word; non-native speakers may not know it.
- **Download managers:** none found.
- **Trademarks:** not searched. From memory, not verified: Adobe had a JavaScript framework called Spry, discontinued around 2012.
- **Domains and GitHub:** not checked (information only).

### Pullwing Download Manager

- **Meaning:** invented: "pull" (what a download does) and "wing" (flight, speed).
- **Other languages:** in French "un pull" is a jumper (German "Pulli"). Harmless.
- **Download managers:** none found; the word itself appears nowhere on the web, on GitHub, in Firefox Add-ons or on Flathub.
- **Trademarks (aggregators):** no record found.
- **Domains and GitHub:** pullwing.com, .app, .io and .dev and the GitHub account are all unregistered (information only).

### Arrowdrop Download Manager

- **Meaning:** invented: an arrow (fast, straight to its target) and a drop (the file lands).
- **Download managers:** none found; no software uses the word. Nearby names are in other kinds of software (Microsoft's Arrow launcher, Apple's AirDrop).
- **Trademarks (aggregators):** no record found. The closest is an ARROWTETHER application in class 9 (2026).
- **Domains and GitHub:** .app, .io and .dev unregistered; arrowdrop.com is for sale on the Atom name marketplace; GitHub account free (information only).

## Second round: plain adjectives and short invented words

The PO asked for more names, in two directions: plain adjectives (like "Fast") and short invented words. 55 more first words were checked the same way. The ones worth choosing from:

### Sleek Download Manager

- **Meaning:** smooth, streamlined and fast-looking; a plain adjective.
- **Download managers:** none found.
- **Trademarks (aggregators):** no live SLEEK word mark for software in class 9 found. Live nearby marks are for phone cases (SLEEK LINK and SLEEKBAND, Spigen Korea); a SLEEK application for software as a service (classes 35 and 42) is pending. Sleek is also a Singapore company-services firm.

### Nippy Download Manager

- **Meaning:** British English for "quick and nimble" (a nippy little car). It also means "chilly" in British English.
- **Other languages:** little known outside British English; may read as playful.
- **Download managers:** none found.
- **Trademarks (aggregators):** the only US class 9 NIPPY mark (Nippy LLC, 2019) is dead.

### Deft Download Manager

- **Meaning:** quick and skilful ("deft hands"). A plain adjective.
- **Other languages:** a less common English word.
- **Download managers:** none found.
- **Trademarks (aggregators):** most class 9 DEFT marks are dead. Live: DEFTPDF (document software, SICTEC Infotech) and DEFT GLOBAL (software, 2018).

### Dashi Download Manager

- **Meaning:** invented here from "dash" (to move fast). It is also the Japanese word for a soup stock, a friendly, everyday word in Japan.
- **Download managers:** none found; no software or app company with the name found.
- **Trademarks:** not searched.

### Zyvo Download Manager

- **Meaning:** invented; no meaning of its own.
- **Download managers:** none found.
- **Other uses:** Zyvo is a small Dutch HR-assessment company (founded 2014). No software product found.
- **Trademarks:** not searched.

Domains and GitHub accounts for all five first words are taken (information only).

**Set aside in this round:**

- **Download managers already use the name:** Quick (QDM), Clear, Kinetic, Prime, Instant, Lightning, Express. Simple has 191 GitHub matches.
- **Close to an existing download manager:** Speedy (Speed Download, a Mac download manager) and Steady (Steadyflow, a Linux download manager).
- **Snappy:** the early name of Ubuntu's Snap package system, which a Linux user would notice.
- **Established software or app brands:** Keen (Keen Games, Keen.io), Rivo (a Shopify loyalty app with 11,000 merchants, and an EHS software company), Quva (manufacturing software), Zipo (ZipoApps, a large Google Play publisher).
- **From memory, not verified:**
  - Lumo is Proton's AI assistant.
  - Ryze is DJI's drone brand.
  - Fyre is the failed festival.
  - Torq, Quix, Vyro and Ziva are software companies.
  - Fleet was JetBrains' editor.
  - Calm and Sonic are famous brands.
- **Weak meaning:**
  - Hasty means careless.
  - Agile is a common software term.
  - Vexa reads as "vex", to annoy.
  - Smooth, Solid, Bold, Vivid, Bright and Lively don't suggest speed.

## Astra Download Manager (the PO's suggestion)

The PO asked for this name to be researched after the second round.

- **Meaning:** Latin for "stars" (plural of *astrum*), as in *ad astra*, "to the stars". Reads easily in most European languages. Well known as a car model (Opel and Vauxhall Astra) and from AstraZeneca.
- **Download managers:** none found. The exact phrase "Astra Download Manager" gave no results on the web or on GitHub (0 repositories); search results showed AB Download Manager, a different product.
- **Firefox Add-ons and Flathub:** the only add-on called "Astra" is a colour theme with 0 daily users; no Flathub app has the name.
- **Other software called Astra:** crowded.
  - **Astra WordPress theme:** by Brainstorm Force, on over 1.8 million websites.
  - **DataStax Astra DB:** a cloud database service.
  - **On GitHub:** 33,347 repositories have "astra" in the name, the largest `flipkart-incubator/Astra` with 2,674 stars.
  - **From memory, not verified:** Astra Linux, a Russian Linux distribution used by Russian government bodies, and Astra Security, a penetration-testing company. A Linux user may connect "Astra" with the first.
- **Trademarks (aggregators):** at least 7 live US registrations of ASTRA in class 9:
  - Brainstorm Force US LLC (no. 6727370, 2022; the Astra theme's owner);
  - Distributed Creation (no. 6878307, 2022, music software);
  - Candelis (no. 4363025, classes 9 and 42, renewed 2023);
  - Wyatt Technology (no. 2337628, renewed 2020);
  - Sajo (ASTRA IPT, 2024);
  - Wide Swath Research (radar and radio software, 2025);
  - Hydra Technologies de Mexico (ASTRA SYSTEMS, navigation software, 2026).

  None is for download software. The Brainstorm Force mark is the one to look at first, because it is a software mark held by a large software brand.
- **Domains and GitHub (information only):** astra.com, .app, .io and .dev and the GitHub account `astra` are taken. astradownloadmanager.com, .app, .io and .dev and the GitHub account `astradownloadmanager` are unregistered; so are astradm.app, .io and .dev and the account `astradm` (astradm.com is registered).
- **Searchability:** "Astra" alone is hard to search for, because of the theme, the car and AstraZeneca. "Astra Download Manager" as a whole phrase is unique today.

## Orion, Atlas and Apollo Download Manager (the PO's suggestions)

The PO asked for these three to be checked before choosing between them and Astra. The same checks were run; trademarks on these words were not searched separately, because each is already a large software brand.

| | Orion | Atlas | Apollo |
|---|---|---|---|
| **Meaning** | The hunter constellation | The Titan who holds up the sky; a book of maps | The Greek god of light; the Moon missions |
| **"<Name> Download Manager" already used?** | Not as that exact name, but **Orion – Torrent Client & Streamer** is on Snap and Flathub, and lists a multi-threaded download manager among its features | **Yes:** `xkam7ar/atlas-download-manager`, a Python terminal download manager (started July 2026, last push September 2026, with a Homebrew tap). Also **FileAtlas – Smart Download Manager**, a Chrome extension | **No.** Nearest: "ApolloSource – Game Downloader", a Firefox add-on with 2 daily users |
| **Other software with the name** | Kagi's Orion web browser, which has its own built-in download manager; 20,836 GitHub repositories | ChatGPT Atlas (OpenAI's browser), MongoDB Atlas, Atlas OS (22,024 GitHub stars); 102,996 repositories | Apollo GraphQL, Apollo.io, an Android music player called Apollo, Apollo Auto (26,889 stars); 41,266 repositories |
| **Domains and GitHub for the full phrase (information only)** | `oriondownloadmanager` .com, .app, .io, .dev and GitHub all unregistered | `atlasdownloadmanager` all unregistered | `apollodownloadmanager` all unregistered |

**Reading:** Atlas clashes directly with an existing download manager of the same name. Orion clashes with a torrent client, which is close to what Apollo Download Manager does, and with a browser that manages downloads. Apollo is the only one of the three with no download app nearby, though the word itself is heavily used in software, much like Astra.

## Names set aside, and why

| Name | Why |
|---|---|
| Swift, Rapid, Bolt, Flux, Surge, Cheetah, Slipstream, Falcon | GitHub already has download-manager projects with these names (for example Rapid-Download-Manager, Bolt-Download-Manager, Cheetah-Download-Manager, flux-download-manager). Swift is also Apple's. |
| Brisk, Hyper, Chrono, Turbo, Ninja, Neat, Grabline | Existing download managers: Brisk Download Manager, Hyper Download Manager, Chrono Download Manager, Turbo Download Manager, Ninja Download Manager, Neat Download Manager, Grabline (open source, with a Firefox add-on). |
| Nimbus | A download-manager library for Kotlin is called Nimbus; also Nimbus FTP Client. |
| Comet | Perplexity's web browser is called Comet; BitComet is a well-known torrent client. |
| Fetch… (Fetchwing and others) | FETCH is a live US class 9 registration (no. 4390408, Fetch Softworks) for software that moves files over FTP and SFTP. |
| Zephyr | The Zephyr Project (a Linux Foundation operating system) and Zephyr test-management software are well-known software brands (from memory, not verified); a Tauri app called Zephyr also exists. |
| Tempo, Glide, Tailwind, Nimble | Well-known software brands (Tempo for Jira, Glide no-code apps, Tailwind CSS, Nimble CRM), so the first word wouldn't stand out (from memory and search results, not verified as marks). |
| Pulldart | Google holds DART in class 9 (US registration 4280053) for its programming language. |
| Zippy | Associated with Zippyshare, a file host that closed. |
| Haste, Stride, Swallow, Hurlo, Windhaul | No download manager found, but weaker: "Swallow Download Manager" reads as swallowing downloads; Hurlo sounds like Italian *urlo* ("a scream"); Windhaul and Haste carry less meaning; Stride was an Atlassian chat product. Kept here in case the PO wants them. |

## Findings across all names

- **Almost every speed word is used by someone in software.** Short real words have live class 9 marks, though usually for different goods (antennas, security tools, weather meters). Whether a mark for a download manager can coexist with those is for the legal clearance.
- **The download-manager market already uses many speed adjectives:** Brisk, Hyper, Turbo, Rapid, Bolt, Swift and Fast variants all exist.
- **Invented compounds come out cleanest:** Pullwing and Arrowdrop had no record anywhere searched.

## What changes with the name, and what doesn't

From #346 and [ADR-0016](../decisions/0016-release-product-name-v2.md), for the PO's information when choosing:

- **Changes (#347):** the product name in the window, installer and docs; the Windows install folder (`%LOCALAPPDATA%\<product name>`), the Apps & features entry and the Start menu shortcut. An upgrade from 0.1.x has to leave one entry and keep all data.
- **Stays (ADR-0003):** the app identifier `com.velocity.downloadmanager.v2`, the data folders, the IPC and native-messaging host names and the extension IDs.
- **Before #240:** the Firefox add-on ID is permanent once uploaded, so the name should be settled first.

## Still to do before the name is final

1. Done: the PO chose "Apollo Download Manager" on #346, and [ADR-0018](../decisions/0018-product-name-apollo.md) supersedes ADR-0016's product name.
2. Singlbase runs the official trademark searches (USPTO, EUIPO, WIPO, classes 9 and 42) and any legal clearance, for the chosen name.
