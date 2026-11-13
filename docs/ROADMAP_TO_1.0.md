# The road to 1.0.0

**Date:** 2026-11-13. **Issue:** #461. **Status:** agreed with the PO on 2026-11-13; each condition has an issue, or is one of the issues named in it.

This plan says what must be true before Apollo Download Manager 1.0.0, the first stable release, and which version meets each condition. It builds on:

- the [release-readiness checklist](RELEASE_READINESS.md) (#78) and its [gaps for the PO](RELEASE_READINESS.md#gaps-for-the-po);
- the [version plan](RELEASE_PROCESS.md#choosing-the-next-version);
- the [feature research](research/2026-11-13-feature-research.md) (#427), and the PO's decisions on it;
- what users say makes them trust or drop a download manager ([user wishes](research/2026-11-13-feature-research-user-wishes.md), sections 3 and 4).

**What 1.0.0 promises:** a user can rely on it for daily downloads on Windows and Linux. It doesn't lose or corrupt a download. It's safe to install from a signed source. It's in the browser stores. And it's backed by a project that answers reports. After 1.0.0, breaking changes need a MAJOR version (SemVer).

## The conditions

Each condition has a measurable test. "Owner" says who does it: the **agent**, the **PO**, or someone **outside**. **Version** is the suggested one; the PO decides. The numbers in the tests are proposals for the PO (decisions below).

### 1. Safety and security

| # | Condition | Test | Owner | Today | Version |
|---|---|---|---|---|---|
| 1.1 | **Signed Windows installer, signed Linux checksums** | Windows shows the publisher on install, with no "unknown publisher" warning; `SHA256SUMS` carries a signature that the guide shows how to check | PO (certificate), agent (workflow) | Not signed; #428 (decision), #429 (workflow) | v0.3.0 |
| 1.2 | **Fuzzing of the parsers** (#73) that read untrusted input: links, `Content-Disposition`, Metalink XML, browser messages, the helper protocol, torrent metadata | A fuzz target for each; a weekly CI run of at least 1 hour per target with no crash; every crash found gets a regression test | Agent | None: #73 closed as not planned (2026-11-05) | v0.4.0 (PO decision, 2026-11-13: "Reopen for v0.4.0") |
| 1.3 | **An outside security review** of the trust boundaries: the browser bridge and native host, the helper processes, file handling, secrets, the release pipeline | A written report from a reviewer outside the project; every High or Critical finding fixed, the rest fixed or accepted by the PO | — | None | **Not planned** (PO decision, 2026-11-13: "Automated score only"). 1.4 is the security gate instead |
| 1.4 | **OpenSSF Scorecard** for the repository (#473): the security gate in place of an outside review | Score of 7 or more, with the low checks explained | Agent | Not measured | v0.4.0 |
| 1.5 | **No unaccepted advisories** | `pnpm check:advisories` passes; every accepted one is in the register with a reason | Agent | PASS (2026-11-10); minimatch accepted until ESLint allows the fix | Every release |
| 1.6 | **Mark of the Web** on Windows | #469's acceptance criteria | Agent | Missing | v0.3.0 (#469) |
| 1.7 | **A security response promise** (#476) (PO decision, 2026-11-13) | `SECURITY.md` states: an answer to a report within 7 days, and a fix for a serious hole within 30 days | Agent | Private reporting is on; no times stated | v0.4.0 |

### 2. Reliability: no lost or corrupt downloads

| # | Condition | Test | Owner | Today | Version |
|---|---|---|---|---|---|
| 2.1 | **Load and long runs** | #337: 200 files, 20 at once, an overnight run of at least 8 hours. Every file's checksum matches; memory at the end is no more than 20 % above its level after the first hour | Agent and PO | NOT RUN (#337) | v0.3.0 |
| 2.2 | **Crashes and power loss** | 20 forced kills (Task Manager or `kill -9`) during downloads and torrents. Every download resumes, and every checksum matches | Agent | Recovery is tested (#74); not under load | v0.4.0 |
| 2.3 | **Upgrades from every released version** | An automated upgrade test from each released 0.x (0.1.0, 0.1.1, 0.2.0, …) to the candidate, on Windows and Linux: data, settings, history and browser registrations kept | Agent | From 0.1.1 only, in the packaging workflows | v0.4.0 |
| 2.4 | **Measured speed and resource use** | Published numbers: speed against the browser on the reference download (#221), memory and CPU while idle and while downloading | Agent | Speed partly measured (#221, #330); memory not published | v0.4.0 |
| 2.5 | **The ramp and speed field test** | #330's acceptance criteria | Agent | NOT RUN | v0.3.0 |

### 3. Field testing

| # | Condition | Test | Owner | Today | Version |
|---|---|---|---|---|---|
| 3.1 | **One thorough field-test session before 1.0.0** (PO decision, 2026-11-13: "a proper 1 session field test before 1.0.0 instead of waiting all this time") | One session on the installed release candidate, on Windows and Linux: every protocol (HTTP, HTTPS, FTP, SFTP, Metalink), links from Chrome and Firefox, torrents (magnets, private and public), pause, resume, restart and upgrade. Bugs that lose data or block a download are fixed before 1.0.0; the rest go to later releases | PO and agent | Sessions 1 to 4 (#262) for 0.1.x | On the 1.0.0 candidate |
| 3.2 | **Browser capture survives browser updates** | Capture checked in Chrome, Edge and Firefox before each release: the extension's end-to-end runs pass on the current stable browsers | Agent | End-to-end runs exist (`pnpm test:e2e:chromium`, `firefox`) | Every release |
| 3.3 | **Outside testers, by an open call** (PO decision, 2026-11-13) | The candidate is announced on the website and GitHub (and Reddit if the PO wants); at least 10 people try it for 2 weeks and report on GitHub. No blocker open at the end | PO | None | 1.0.0-rc |

### 4. Distribution and updates

| # | Condition | Test | Owner | Today | Version |
|---|---|---|---|---|---|
| 4.1 | **The browser stores** | The extension is public in the Chrome Web Store, Firefox Add-ons and Edge Add-ons, and the app links to each | PO | Chrome and Firefox public; Edge account waiting (#240, #241) | Edge when approved. 1.0.0 doesn't wait for it (PO decision, 2026-11-13: "Yes, Edge can follow"); until then the guide points Edge users to the Chrome Web Store |
| 4.2 | **Flatpak on Flathub** | Listed on Flathub, built from the release; installs and runs on Fedora and Ubuntu | Agent, PO (Flathub account) | None (PO decision, 2026-11-13: before 1.0) | v0.5.0 |
| 4.3 | **Updates** (#474) | Full auto-update (PO decision, 2026-11-13: "Full auto-update"): the app finds, downloads and installs a signed update, and refuses one whose signature doesn't verify | Agent | Nothing in the app | After signing (1.1); v0.5.0 suggested |
| 4.4 | **No bundled offers, ever** | Stated in `README.md` and the site; the installers' contents check (already in packaging) shows nothing but Apollo Download Manager's files | Agent | True; not stated | v0.3.0 |

### 5. Legal

| # | Condition | Test | Owner | Today | Version |
|---|---|---|---|---|---|
| 5.1 | **Trademark and IP due diligence** | #441's report, and the lawyer's answer on the name | PO, outside | In progress (#441) | v0.3.0 |
| 5.2 | **Legal review of the licence and the CLA** | A lawyer's sign-off; `CLA.md` no longer a draft | PO, outside | NOT RUN | Before 1.0.0-rc |
| 5.3 | **The Chrome Web Store publisher status** | Trader with a business number, or Non-trader confirmed by the lawyer | PO | Non-trader for now | With 5.1 |

### 6. The product

| # | Condition | Test | Owner | Today | Version |
|---|---|---|---|---|---|
| 6.1 | **The guide and developer site audit** | #425's acceptance criteria | Agent | NOT RUN | v0.3.0 |
| 6.2 | **New users find the main features** | The guide after Get started (#463) and the tips (#460) | Agent | Missing | v0.3.0 |
| 6.3 | **The features chosen for 1.0.0** | v0.3.0's seven research items (#466 to #472), then the v0.4.0 list in the research, and the later items the PO picks | Agent | Planned | v0.3.0 to v0.5.0 |
| 6.4 | **Accessibility re-checked** | The keyboard and screen-reader checks of #66, repeated on the 1.0.0 candidate, including the new guide and tips | Agent | PASS for 0.1.x (#66) | 1.0.0-rc |
| 6.5 | **Known limitations accepted** | The checklist's list, each one accepted by the PO or fixed | PO | 8 listed | 1.0.0-rc |
| 6.6 | **Interface languages** (#475) | **After 1.0.0** (PO decision, 2026-11-13), with an issue filed now | Agent | English only | After 1.0.0 |

### 7. The project

| # | Condition | Test | Owner | Today | Version |
|---|---|---|---|---|---|
| 7.1 | **A visible release rhythm** | A release at least every 6 weeks until 1.0.0, each with a changelog | PO and agent | 0.1.0, 0.1.1 and 0.2.0 in 11 days | Ongoing |
| 7.2 | **A support channel** (#476) (PO decision, 2026-11-13) | GitHub Issues for bugs, GitHub Discussions for questions, stated in the README and the app's Help | Agent | Issues; Discussions is on but not pointed to | v0.4.0 |
| 7.3 | **Rollback tested** | Going back from the candidate to the previous release, with the backup, done once on each platform | Agent | Documented; not tested for 0.2.0 | 1.0.0-rc |

## The versions on the way

| Version | Features | Conditions it meets |
|---|---|---|
| **v0.3.0** | Its milestone: stores (#240, #241), mirrors (#324), the ramp (#330), long runs (#337), files on a page (#426), the guide and tips (#460, #463), fixes (#459, #464), and the seven research items (#466 to #472) | 1.1 signing, 1.6, 2.1, 2.5, 4.4, 5.1, 6.1, 6.2 |
| **v0.4.0** | The research's v0.4.0 list: command line, opening magnets and `.torrent` files from the system, time-based speed limits, integrity checks, torrent file priority | 1.2 fuzzing, 1.4, 1.7, 2.2, 2.3, 2.4, 7.2 |
| **v0.5.0** | The later items the PO picks from the research (for example named queues, rules per site, Digest and NTLM logins, clipboard monitoring). **Feature freeze** for 1.0.0 after it | 4.2 Flathub, 4.3 auto-update |
| **1.0.0-rc** | Fixes only | 3.1 the field-test session, 3.3 outside testers, 5.2, 6.4, 6.5, 7.3; every condition PASS or accepted by the PO |
| **1.0.0** | The candidate, unchanged, after 2 weeks with no blocker | Published as a full release, not a pre-release |

No dates: each version ships when its conditions pass. The rhythm in 7.1 is the target.

## Decisions for the PO

**Decided on 2026-11-13:** no outside security review, OpenSSF Scorecard instead (1.3, 1.4); fuzzing reopened for v0.4.0 (1.2); 1.0.0 doesn't wait for Edge (4.1); full auto-update (4.3).

**Decided later on 2026-11-13:** one thorough field-test session on the 1.0.0 candidate instead of a 4-week campaign (3.1); outside testers by an open call (3.3); languages after 1.0.0 (6.6); security answers within 7 days and fixes within 30, with Issues for bugs and Discussions for questions (1.7, 7.2).

Nothing is open in this plan now.
