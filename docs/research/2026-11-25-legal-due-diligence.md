# Legal due diligence: evidence and questions before wider public release (#441)

- **Date:** 2026-11-25, at `main` commit `47f6510`.
- **Requested by:** the PO, 2026-11-10 (#441).
- **Written by:** the AI agent account. **This is not legal advice.** It collects evidence and questions for a qualified lawyer; the PO, or counsel the PO appoints, makes every legal judgement.
- **Changes nothing:** no code, licence, legal document or feature is changed here. Corrections are the follow-up issues in [the remediation plan](#13-remediation-plan).

## How to read this report

Each finding is one of four kinds:

- **Fact:** confirmed in the repository or an official source.
- **Risk:** a potential risk that needs more investigation.
- **Docs:** a documentation inconsistency.
- **Counsel:** a question for a qualified lawyer.

**Severity:** Critical, High, Medium, Low. **Likelihood:** High, Medium, Low, Unknown. **Confidence:** Confirmed, Strong indication, Preliminary concern, Requires legal interpretation.

**Jurisdictions:** Kenya (KE), the United States (US), the European Union (EU) and the United Kingdom (UK), as #441 requires. The company's place of registration isn't stated in the repository ([M1](#m-publisher-identity-and-international-distribution)), so no jurisdiction is treated as home. One country's rules are never presented as universal.

### Limits

- **An investigation can't prove that a risk is absent.** Areas where nothing was found say what was searched.
- **Sources:** on 2026-11-25, several official sites refused automated reading: EUR-Lex, Kenya Law, gnu.org, Cornell LII and eCFR. On 2026-11-26 the PO collected those texts from the official sites, as PDFs or copied text, and the quotes below come from them. The copies are kept outside the repository. Sources still marked **not read here** weren't collected; this report doesn't paraphrase them from memory.
- **Not reachable by the agent:** V1's repository (`Singlbase-Technologies-Limited/velocity-download-manager`, private; the agent account gets HTTP 404), the GitHub organisation's settings, the store dashboards, and any contract, assignment or company registration.

### Sources read

| Source | Used for |
|---|---|
| [`LICENSE`](../../LICENSE) (the GNU GPL v3 text) | Corresponding Source (§1), conveying object code (§6) |
| [UK CDPA 1988 s.9](https://www.legislation.gov.uk/ukpga/1988/48/section/9) and [s.178](https://www.legislation.gov.uk/ukpga/1988/48/section/178) | Computer-generated works |
| [UK CDPA s.296ZB](https://www.legislation.gov.uk/ukpga/1988/48/section/296ZB) and [s.296ZD](https://www.legislation.gov.uk/ukpga/1988/48/section/296ZD) | Circumvention devices and services |
| [US Copyright Office, *Copyright and Artificial Intelligence, Part 2*](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf) (29 January 2025) and [*Thaler v. Perlmutter*](https://media.cadc.uscourts.gov/opinions/docs/2025/03/23-5233.pdf) (D.C. Cir., 18 March 2025) | Authorship of AI-assisted code (A1) |
| [17 U.S.C. §102](https://www.copyright.gov/title17/92chap1.html#102) and [§1201](https://www.copyright.gov/title17/92chap12.html#1201) | What copyright protects; circumvention (G2) |
| [*MGM Studios v. Grokster*, 545 U.S. 913 (2005)](https://supreme.justia.com/cases/federal/us/545/913/) | Inducement (F) |
| [Kenya Copyright Act (Cap. 130)](https://new.kenyalaw.org/akn/ke/act/2001/12/eng@2022-12-31), [Data Protection Act 2019](https://new.kenyalaw.org/akn/ke/act/2019/24), [Computer Misuse and Cybercrimes Act 2018](https://new.kenyalaw.org/akn/ke/act/2018/5), all as at 31 December 2022 | Authorship (A1), circumvention (G2), data protection (I), unauthorised access (G3) |
| [GPL FAQ](https://www.gnu.org/licenses/gpl-faq.html) and [the free software definition](https://www.gnu.org/philosophy/free-sw.en.html) (through the Internet Archive; gnu.org didn't answer) | Licensing (D4) |
| [Regulation (EU) 2024/2847, the Cyber Resilience Act](https://eur-lex.europa.eu/eli/reg/2024/2847/oj/eng), and [the Commission's CRA FAQ](https://ec.europa.eu/newsroom/dae/redirection/document/122331) | N2 |
| [CJEU C-610/15, *Stichting Brein v Ziggo*](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62015CJ0610) and [Directive 2001/29/EC](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32001L0029) | F, G2 |
| [15 CFR 742.15](https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-742/section-742.15) and [734.3](https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-734/section-734.3) (eCFR, up to date as of 24 November 2026) | N1 |
| [Firefox data consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/) and the [policies taking effect on 1 December 2026](https://extensionworkshop.com/documentation/publish/add-on-policies-preview-2026-12/) | H |
| [Chrome Web Store program policies](https://developer.chrome.com/docs/webstore/program-policies/policies), [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use), [User Data FAQ](https://developer.chrome.com/docs/webstore/user_data) | Extension disclosures |
| [Firefox add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/) | H: the full text, copied by the PO on 2026-11-26 |
| [Microsoft: SmartScreen reputation](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation), [Azure Artifact Signing](https://learn.microsoft.com/en-us/azure/artifact-signing/faq), [SignPath Foundation terms](https://signpath.org/terms), [CA/Browser Forum code-signing requirements](https://cabforum.org/working-groups/code-signing/requirements/) | Signing (#428, ADR-0022, in PR 518) |

## Critical and High matters that need counsel

| ID | Matter | Severity | Why now |
|---|---|---|---|
| [C1](#c-trademark-apollo-download-manager) | **No trademark clearance is recorded** for "Apollo Download Manager", which has been public since v0.2.0 (2026-11-10) and is in the Chrome Web Store | High | The name is already in use; the stores and the website add to the exposure every week |
| [A1](#a-copyright-ownership-and-provenance) | **About 98% of the code was written by an AI agent.** Whether it is protected by copyright, and who owns it, decides what the GPL and the CLA can do | High | It bears on enforcement of the GPL, on the CLA's relicensing right, and on any sale of a licence |
| [A2](#a-copyright-ownership-and-provenance) | **Code was ported from V1,** whose repository is private, with no licence GitHub recognises, and whose ownership records aren't in this repository | High | The chain of title for the ported parts rests on documents outside GitHub |
| [B1](#b-contributor-licence-agreement) | **The CLA is an unreviewed draft** that grants closed relicensing and a patent licence; agreement is collected by a comment only | High (before any outside contribution) | No outside contribution has been merged yet, so it is still cheap to fix |
| [F1](#f-bittorrent-and-copyright-infringement-exposure) | **BitTorrent uploads while it downloads, and the app doesn't tell the user** in the guide or the app | High | Users can be identified and pursued for what they upload; the publisher's exposure depends on disclosure and marketing |
| [I1](#i-privacy-and-data-protection) | **"Connects only to the servers you download from" is probably untrue:** the torrent helper starts with the app, with DHT on | Medium–High | A privacy statement that the code contradicts is the kind of claim regulators act on |

## 1. Legal risk register

| ID | Finding | Kind | Severity | Likelihood | Confidence | Jurisdictions | Counsel |
|---|---|---|---|---|---|---|---|
| A1 | 222 of 227 commits are by the AI agent account; 534+ carry a Claude co-author line | Fact, Counsel | High | Unknown | Requires legal interpretation | US, UK, EU, KE | Yes |
| A2 | V1 code ported into `velocity-core` (at least 22 places say so); V1 is private, licence `NOASSERTION` | Fact, Counsel | High | Low | Confirmed (porting); ownership unknown | All | Yes |
| A3 | CONTRIBUTING says the agent account's work "is Singlbase's already" | Counsel | Medium | Unknown | Requires legal interpretation | All | Yes |
| A4 | The logo and icons were drawn by the agent; the wordmark is the Outfit font converted to outlines | Fact, Risk | Low | Low | Confirmed | All | With C1 |
| B1 | CLA is an unreviewed draft; closed relicensing; patent termination clause | Fact, Counsel | High | Medium | Confirmed | All | Yes |
| B2 | No workflow records CLA agreement; it is a pull-request comment checked by hand | Fact | Medium | Medium | Confirmed | All | Yes |
| B3 | No outside contribution merged yet (PRs: 233 by the agent, 2 by the PO, 4 by Dependabot) | Fact | — | — | Confirmed | — | No |
| B4 | CLA still gives Apollo DM's 0.1.x name, which public texts have dropped (#486) | Docs, Counsel | Low | Low | Confirmed | All | Yes |
| B5 | The CLA's closed-licence right conflicts with SignPath Foundation's terms; the PO chose no closed licences while signed (PR 518) | Fact | Medium | Medium | Confirmed | — | Yes |
| C1 | No trademark clearance recorded; the name is public | Fact, Counsel | High | Unknown | Confirmed (no record) | All | Yes |
| C2 | Technical identifiers still say "velocity" (`com.velocity.downloadmanager.v2`, `com.velocity.download_manager_v2`, `velocity-*` crates) | Counsel | Medium | Unknown | Requires legal interpretation | All | Yes |
| D1 | `LICENSE`, `LICENSE` and notices installed with every package; licence reports attached to releases | Fact | — | — | Confirmed | — | No |
| D2 | Corresponding Source: the release page has GitHub's source archives of the tag, but the native sources and crates come from other servers; the website links `main`, not the version | Risk, Counsel | Medium | Low | Strong indication | All | Yes |
| D3 | Release candidates are workflow artifacts for the PO only, so they aren't conveyed to the public | Fact | Low | Low | Confirmed | — | No |
| D4 | Offering a closed licence alongside GPL needs every copyright holder's permission, and third-party licences allowing it | Counsel | Medium | Low | Requires legal interpretation | All | Yes |
| E1 | `docs/LICENSING.md` says no licence has been chosen and `package.json` says `UNLICENSED`; both are wrong | Docs | Medium | High | Confirmed | — | No |
| E2 | `docs/LICENSING.md`'s "356 Rust crates" is stale; the notices list 577 | Docs | Low | High | Confirmed | — | No |
| E3 | MPL-2.0, OpenSSL's Apache-2.0, BSL-1.0 and OFL-1.1 shipped with GPL-3.0-only code | Counsel | Medium | Low | Requires legal interpretation | All | Yes |
| E4 | `pnpm check:notices` passes: 6 native libraries, 577 crates, 62 npm packages | Fact | — | — | Confirmed | — | No |
| F1 | No user-facing statement that BitTorrent uploads while downloading | Fact, Risk | High | Medium | Confirmed | All | Yes |
| F2 | DHT and peer exchange on by default; seeding after download off; port mapping off; no upload limit | Fact | Medium | Medium | Confirmed | All | Yes |
| F3 | No copyright-complaint contact or policy | Fact, Risk | Medium | Medium | Confirmed | US, EU, UK, KE | Yes |
| G1 | No extractor, HLS/DASH or DRM code; video sites are the open decision #253 | Fact | — | — | Confirmed absent | — | No |
| G2 | An extractor such as yt-dlp would raise anti-circumvention and site-terms questions | Counsel | High (if built) | Unknown | Requires legal interpretation | All | Yes, before #253 |
| G3 | The page-files button (#426) reads a page's links in the user's browser, on by default | Counsel | Medium | Low | Requires legal interpretation | All | Yes |
| H1 | The store listing says "Data collected: none"; the extension passes links, referrers, names, sizes and types to the app, and keeps 5 recent sends | Risk | Medium | Medium | Strong indication | Store policies | Yes |
| H2 | Chrome requires disclosure "even when data is processed or stored locally" | Fact | Medium | Medium | Confirmed (policy text) | Chrome Web Store | No |
| I1 | The torrent helper starts with the app with DHT on, so DHT contacts and a listening port exist with no torrent | Risk, Docs | Medium–High | High | Strong indication (not measured) | EU, UK, KE | Yes |
| I2 | The support page asks users to attach diagnostics to public GitHub issues | Risk | Low | Medium | Confirmed | EU, UK, KE | Yes |
| I3 | Peers' IP addresses shown and processed in the app, kept in memory only | Fact | Low | Low | Confirmed | EU, UK, KE | Yes |
| J1 | `docs/DIAGNOSTICS.md` lists the secret-leak scan (#71) as "Not here yet"; it exists | Docs | Low | High | Confirmed | — | No |
| K1 | Installers unsigned; SignPath Foundation chosen, pending acceptance (PR 518) | Fact | Medium | Medium | Confirmed | All | No |
| K2 | Security reports through GitHub only; "acknowledge within 7 days" promised | Fact | Low | Low | Confirmed | All | No |
| L1 | No terms of use or EULA, no acceptable-use or copyright policy, no publisher address | Fact, Counsel | High | Medium | Confirmed | All | Yes |
| M1 | The company's registration country, number and address aren't stated anywhere | Fact, Counsel | Medium | Medium | Confirmed | EU, UK, KE, stores | Yes |
| M2 | `SECURITY.md` still calls the product `V2` in three places | Docs | Low | High | Confirmed | — | No |
| N1 | Encryption export: OpenSSL, ring and RustCrypto ship in the app | Counsel | Medium | Low | Requires legal interpretation | US, EU, KE | Yes |
| N2 | EU Cyber Resilience Act: obligations depend on whether distribution is a "commercial activity" | Counsel | Medium | Unknown | Requires legal interpretation | EU | Yes |
| N3 | Performance claims ("kept only while they make it faster") | Risk | Low | Low | Preliminary concern | US, EU, UK, KE | No |

## A. Copyright ownership and provenance

**What was found (A1):** `git log` at `47f6510`:

```text
$ git log --format='%an' | sort | uniq -c | sort -rn
    222 velocity-claude-agent
      2 dependabot[bot]
      2 Vincent Arisa
      1 vincentarisawork
$ git log --format='%b' | grep -ic "co-authored-by: claude"
      766
```

- **The first commit:** `9bb9f1c`, 2026-10-21, by the PO's account. The three commits by the PO's accounts are the bootstrap (#2).
- **The rest:** every feature commit is by `velocity-claude-agent`, written by an AI model (Claude) working under the PO's instructions, with the PO's decisions recorded in issues and ADRs.

**The legal concern:**

- **US: read.**
  - **The Copyright Office's conclusions** (Part 2, 29 January 2025):
    - "Copyright does not extend to purely AI-generated material, or material where there is insufficient human control over the expressive elements."
    - "prompts do not alone provide sufficient control."
    - Human authors are entitled to copyright in "the creative selection, coordination, or arrangement of material in the outputs, or creative modifications of the outputs".
  - **Its footnote 60** quotes a court: "Providing sketches, ideas or supervision over copyrightable material is not sufficient to make one a joint author."
  - **17 U.S.C. §102(b):** protection never extends to "any idea, procedure, process, system, method of operation, concept, principle, or discovery". So the PO's architecture choices are evidence of human control, not protected expression in themselves.
  - ***Thaler v. Perlmutter*** (D.C. Cir., 18 March 2025): "the human authorship requirement does not prohibit copyrighting work that was made by or with the assistance of artificial intelligence"; the author must be "the person who created, operated, or used artificial intelligence".
  - **For counsel:** how much of Apollo Download Manager's code reflects enough human control.
- **UK:** **read.** CDPA s.9(3) makes "the person by whom the arrangements necessary for the creation of the work are undertaken" the author of a computer-generated work, and s.178 defines one as generated "in circumstances such that there is no human author". Whether Singlbase or the PO made "the arrangements", and how s.9(3) applies to AI-assisted code, needs counsel.
- **EU:** protection needs the author's own intellectual creation (CJEU case law, not read here). How far AI output qualifies is unsettled.
- **Kenya: read** (the Act as at 31 December 2022). Section 2 defines the "author":
  - of "a literary, dramatic, musical or artistic work or computer program which is computer generated", as "the person by whom the arrangements necessary for the creation of the work were undertaken";
  - of "a computer programmer", as "the person who exercised control over the making of the program".

  A work is eligible only if "sufficient effort has been expended on making the work to give it an original character" (s.22(3)), and rights "accrue to the author automatically" (s.22(5)). No court has yet applied these to AI-assisted code, and later amendments aren't in this copy.

**Why it matters:**

- **The GPL:** where code isn't protected by copyright, the GPL can't be enforced on it, and anyone could reuse it without the GPL's conditions.
- **The CLA and closed licences:** Singlbase can sell only what it owns or is licensed to relicense.
- **Owning versus using:** owning copyright, having permission to use code, and being able to relicense it are three different things. The repository shows only who committed what.

**External evidence needed:**

- The terms under which the PO and Singlbase use the AI service, including who owns its output.
- Any employment or contractor agreement with the PO, assigning their work to Singlbase.
- A record of how the work was directed: the issues, ADRs and PO decisions are in GitHub and support the human contribution.

**A2: V1.**

- **What the code says:** at least 22 places in `crates/` and `docs/PARITY.md` say code was ported from V1. Examples:
  - `crates/velocity-core/src/browser/bridge.rs:1`
  - `crates/velocity-core/src/browser/ipc.rs:1`
  - `crates/velocity-core/src/browser/protocol.rs:2`
  - `crates/velocity-core/src/browser/registration.rs:1`
  - `crates/velocity-core/src/naming.rs:2`
- **V1's licence:** V1 is `Singlbase-Technologies-Limited/velocity-download-manager`, private, licence `NOASSERTION` (#441's preliminary finding 4). The agent account can't read it here (HTTP 404).
- **What is needed:**
  - V1's contributor list and how it was written (by people, by AI, or both);
  - assignments to Singlbase from each V1 contributor;
  - confirmation that V1 holds no third-party code under an incompatible licence (V1 bundled aria2, which Apollo Download Manager never uses: [ADR-0001](../decisions/0001-v2-direction.md)).

**A3:** [`CONTRIBUTING.md`](../../CONTRIBUTING.md) line 60 says "Work by Singlbase's staff and its AI-agent account is Singlbase's already". That is a legal conclusion the repository can't support by itself (see A1).

**A4:** the brand assets in [`assets/brand/`](../../assets/brand/README.md) were made in commit `45e39bf` (#347) by the agent account. The wordmark is the Outfit font converted to outlines. Outfit is under OFL-1.1, which allows such use in artwork; counsel can confirm this with C1. A mark's registrability doesn't depend on copyright, but its protection as artwork does (A1).

## B. Contributor Licence Agreement

**What was found:**

- **B1:** [`CLA.md`](../../CLA.md) line 3: "**Draft, version 1.0 (2026-10-31).** This agreement hasn't been reviewed by a lawyer yet." [ADR-0017](../decisions/0017-gpl-3-licence.md) line 13 says "no legal review was done", and line 45 makes a review a condition before "the first outside contribution is merged". The CLA grants:
  - **Copyright licence** (line 14): "under any licence terms Singlbase chooses, including the GNU General Public License and licences that aren't open source".
  - **Patent licence** (line 18), ending for anyone who starts patent litigation over the contribution or the Project.
- **B2:** agreement is a pull-request comment, "I have read the CLA Document and I hereby sign the CLA" ([`CONTRIBUTING.md`](../../CONTRIBUTING.md) lines 56–58). Maintainers check it by hand (line 60). No workflow in [`.github/workflows/`](../../.github/workflows/) records it.
- **B3:** of every pull request, 233 are by the agent account, 2 by the PO and 4 by Dependabot (`gh pr list --state all`). **No outside contribution has been merged**, so nothing was merged before the CLA or without it.
- **B4:** line 5 still gives the project's 0.1.x name, "until version 0.2.0", which every other public text has dropped (#486). The PO's question (on #441, from #486): should that change, and does a change affect agreements already signed? None have been signed (B3).
- **B5:** SignPath Foundation excludes "commercial dual-licensing" ([terms](https://signpath.org/terms)). The PO decided on 2026-11-25 that Singlbase offers no closed licence while SignPath signs (ADR-0022, PR 518). The CLA's right stays, unused.

**Questions for counsel:**

- Does a CLA that allows closed relicensing suit a GPL-3.0-only project, and do contributors understand what they grant? The CONTRIBUTING summary says "It lets Singlbase also offer the project under other terms".
- Is a pull-request comment a valid agreement in KE, US, EU and UK? Does an organisation's employee bind the organisation by it (§1 "You")?
- Does the patent termination clause work as intended, and does it interact with GPL v3 §11?
- Is the CLA enforceable in consumer-protection terms for an individual contributor in the EU or UK?
- Should a CLA bot record agreement? That would add a dependency and needs PO approval.

## C. Trademark: "Apollo Download Manager"

**What was found (C1):**

- **The searches weren't run.** [ADR-0018](../decisions/0018-product-name-apollo.md) line 21: "**Not run:** the official USPTO, EUIPO and WIPO trademark searches." Line 52 requires "Singlbase's legal clearance … before the first public release under the name".
- **The name is already public:** in v0.2.0 (released 2026-11-10, `gh release list`), on the website and in the Chrome Web Store.
- **The PO's arrangements:** the PO is arranging the official searches with a lawyer, separately (comment on #441, 2026-11-10). No result is recorded in the repository.
- **No document claims a clearance** that hasn't happened. The [product-name shortlist](2026-11-05-product-name-shortlist.md) says its checks "aren't legal advice".
- **The full name:** the PO's rule since 2026-11-05 is the full name, never "Apollo" alone. Whether that lowers the risk against existing "Apollo" marks in classes 9 and 42 is for counsel: "Apollo" is a common name for software products.

**The official searches still required** (classes 9 and 42, and 35 and 38 if counsel advises):

| Jurisdiction | Official database |
|---|---|
| Kenya | Kenya Industrial Property Institute (KIPI) |
| US | USPTO Trademark Search |
| EU | EUIPO eSearch, and TMview for the national offices |
| UK | UK IPO trade mark search |
| International | WIPO Global Brand Database (Madrid filings) |

**C2:** the PO's question (on #441, 2026-11-13). Another product may share V1's full name. Do technical names that carry "velocity" have to change? These are:

- the app identifier and data folder, `com.velocity.downloadmanager.v2`, in [`branding.json`](../../branding.json) line 5 and [`src-tauri/tauri.release.conf.json`](../../src-tauri/tauri.release.conf.json) line 4;
- the native-host name, `com.velocity.download_manager_v2`, in `branding.json` line 7;
- the `velocity-*` crates.

They aren't shown as a product name, but a user sees the data folder, and the browser stores show the host name to reviewers. Changing them needs a data migration and a new browser registration, so counsel's answer decides whether that work is needed.

## D. GPL-3.0-only compliance

**What ships, at v0.2.0** (`gh release view v0.2.0`):

- `…-windows-x64-setup.exe`, `…-linux-amd64.deb` and `…-linux-x86_64.rpm`;
- `…-build-info.json` and two licence reports (`…-licence-report-linux.json`, `…-licence-report-windows.json`);
- `SHA256SUMS`;
- GitHub's automatic "Source code" archives of the tag.

**D1, notices: Fact.** Every package installs `LICENSE`, `THIRD_PARTY_NOTICES.md` and `build-info.json` ([`src-tauri/tauri.release.conf.json`](../../src-tauri/tauri.release.conf.json) lines 29–32). A test checks what the packages hold ([`scripts/package-lib.test.mjs`](../../scripts/package-lib.test.mjs)). The installer metadata says `"license": "GPL-3.0-only"` and "Copyright (C) 2026 Singlbase Technologies Limited" (lines 22–25).

**D2, Corresponding Source: Risk.**

- **What GPL v3 §1 requires** ([`LICENSE`](../../LICENSE) lines 134–145): "all the source code needed to generate, install, and (for an executable work) run the object code and to modify the work, including scripts to control those activities", except System Libraries.
- **What §6(d) allows** (lines 275–287): the source may be on "a different server (operated by you or a third party)", "provided you maintain clear directions next to the object code". Also: "you remain obligated to ensure that it is available".
- **Where the source is today:**
  - **The project's own code:** on the release page, as the tag's archives.
  - **The six native libraries:** curl, nghttp2, zlib and OpenSSL are downloaded from their projects' servers by `pnpm native:fetch`, pinned by SHA-256 and signature ([`scripts/native/deps.lock`](../../scripts/native/deps.lock)). libtorrent and Boost are built with vcpkg ([`crates/velocity-lt/build.rs`](../../crates/velocity-lt/build.rs) lines 1–5).
  - **The 577 crates:** from crates.io, by `Cargo.lock`.
  - **The website:** its [licence page](../../site/content/licence.md) links the repository's `main`, not the released version.
- **The concern:** third-party servers may stop hosting old versions, and the "clear directions next to the object code" are a link to the repository, not to each version's sources.
- **The question for counsel:** whether that meets §6(d) for each channel, or whether each release should attach (or mirror) the third-party sources. The lowest-risk option is to attach them, at the cost of release size.

**D3, release candidates: Fact.** [`docs/RELEASE_CANDIDATES.md`](../RELEASE_CANDIDATES.md) line 3: a candidate "isn't a release: nothing is signed, tagged or published by it". Its files are a workflow artifact for the PO's testing. Whether a workflow artifact on a public repository is "conveyed" is a narrow point for counsel; candidate tags (`v0.2.0-rc.1` to `rc.3`) exist, and their source is the tag.

**D4, closed licences: Counsel.** Offering Apollo Download Manager under a closed licence besides GPL v3 needs every copyright holder's permission (the CLA for contributors; A1 for the AI-written code) and third-party licences that allow it. The permissive ones do; whether MPL-2.0 files and OFL fonts do is in E3. The PO has decided against it while SignPath signs (B5).

## E. Third-party dependencies and licence compatibility

```text
$ pnpm check:notices
THIRD_PARTY_NOTICES.md is up to date: 6 native libraries, 577 crates, 62 npm packages.
```

- **E1, Docs, confirmed:** [`docs/LICENSING.md`](../LICENSING.md) line 7 says "Apollo Download Manager's own licence hasn't been chosen (#86 …). There is no `LICENSE` file … [`package.json`] says `UNLICENSED`". In fact [`LICENSE`](../../LICENSE) is GPL v3, and `package.json` line 5 and `Cargo.toml` line 8 say `GPL-3.0-only` ([ADR-0017](../decisions/0017-gpl-3-licence.md)). Line 8 also says "Nothing has been distributed", but three releases are public.
- **E2, Docs, confirmed:** line 15's "356 third-party crates" is a count of the app alone on 2026-10-22. The notices list 577 crates: the app, the engine, the torrent helper and the native host, on every target.
- **E3, Counsel:** licences that need an opinion on compatibility with GPL-3.0-only:
  - MPL-2.0 (`cssparser`, `cssparser-macros`, `selectors`, `dtoa-short`, `option-ext`, through Tauri);
  - Apache-2.0 (OpenSSL 3.5.9, on Linux; compatible with GPL v3 in the FSF's published view, not read here);
  - BSL-1.0 (Boost 1.91.0);
  - BSD-3-Clause (libtorrent 2.0.15);
  - OFL-1.1 (the Inter font, which ships in the app).
- **E3, linking:** the native libraries are linked statically into the shipped programs ([`docs/BUILDING_NATIVE.md`](../BUILDING_NATIVE.md); `cargo:rustc-link-lib=static` in `crates/velocity-lt/build.rs` line 59), so they form one combined work with GPL code. For permissive licences that is normally fine with their notices kept, which they are (D1). Counsel should confirm it.
- **E4, Fact:** the notices are generated (`pnpm notices`), checked in CI (`pnpm check:notices`) and shipped (D1). The allowed licences are in [docs/DEPENDENCIES.md](../DEPENDENCIES.md#allowed-licences).
- **Development dependencies** (Vite, ESLint, Playwright, markdown-it, Mermaid on the website) aren't in the app. Mermaid is served on the website only, which doesn't convey the app; whether the website itself carries Mermaid's notice wasn't checked.

## F. BitTorrent and copyright-infringement exposure

**What the code does by default** ([`crates/velocity-core/src/torrent_engine.rs`](../../crates/velocity-core/src/torrent_engine.rs) lines 205–222, [`seeding.rs`](../../crates/velocity-core/src/seeding.rs) lines 42–43):

| Setting | Default |
|---|---|
| DHT | On, with libtorrent's own bootstrap nodes |
| Peer exchange | On |
| Local peer discovery | Off |
| Port mapping (UPnP, NAT-PMP) | Off (#384 is the open decision) |
| Upload limit | None (0) |
| Seeding after download | Off (`SeedPolicy::Never`) |
| Private torrents | Never use DHT or peer exchange |

**F1, Fact and Risk:** BitTorrent uploads pieces to other peers while it downloads; that's how the protocol works. "Seeding is off" is accurate, but it can read as "nothing is uploaded". The user guide ([`docs/user/torrents.md`](../user/torrents.md)) never says the app uploads during a download, or that peers see the user's IP address. Rights holders identify users by joining swarms, so users carry the direct risk.

**The publisher's exposure** depends on intent, marketing and disclosure, not on the feature existing:

- **US: read.** *MGM Studios v. Grokster*, 545 U.S. 913 (2005), held: "One who distributes a device with the object of promoting its use to infringe copyright, as shown by clear expression or other affirmative steps taken to foster infringement, going beyond mere distribution with knowledge of third-party action, is liable for the resulting acts of infringement by third parties using the device, regardless of the device's lawful uses". No text found in the app, guide, website or store listing promotes infringement (searched for this report). That should be kept so (N3), and counsel should review the marketing.
- **EU: read.** The CJEU's *Stichting Brein v Ziggo* (C-610/15, 14 June 2017) ruled that "communication to the public" covers "the making available and management, on the internet, of a sharing platform which, by means of indexation of metadata relating to protected works and the provision of a search engine, allows users of that platform to locate those works and to share them". Apollo Download Manager indexes nothing, has no search and runs no tracker.
- **UK:** CDPA s.16(2) (authorising infringement) and s.97A injunctions against service providers. Not read here.
- **Kenya: read in part.** The Copyright Act s.35(1) makes infringement an act done "without the license of the owner of the copyright"; it has no provision found on authorising or inducing another's infringement. Counsel should confirm whether Kenyan law has secondary liability for a tool's publisher.

**F2:** DHT and peer exchange on by default are V1's defaults (PO decisions on #62) and normal for a general-purpose client. Seeding off by default lowers what a user uploads after a download completes.

**F3, Fact:** there is no copyright-complaint address or process. The app hosts no content, so takedown regimes such as DMCA §512 don't obviously apply. Counsel should advise whether a contact for complaints about the website and listings is needed.

**Recommendations, for counsel's review:**

- A short notice in the guide and the first torrent's dialog: torrents upload while they download, and peers see your IP address.
- Keep the marketing to lawful uses.
- Decide #384 (port mapping) with this in view.

## G. Video, audio, streaming, DRM and a future extractor

**G1, confirmed absent.** A search of `crates/`, `src/`, `src-tauri/`, `browser-extension/` and `scripts/` finds no yt-dlp, youtube-dl, HLS or DASH parser, and no DRM code. **What the app does support:**

- **Direct media links:** downloaded like any file.
- **The browser's own downloads and the context menu:** these send the link, the referrer, the file name, size and type ([`browser-extension/src/shared/protocol.ts`](../../browser-extension/src/shared/protocol.ts) lines 16–23).
- **Headers:** custom headers and a login per download, which the user types.
- **Cookies:** the extension sends no cookies.

**G2, if an extractor is added (#253): Counsel, before any implementation.**

- **Anti-circumvention:** the laws differ:
  - **US: read.** 17 U.S.C. §1201(a)(2): "No person shall manufacture, import, offer to the public, provide, or otherwise traffic in any technology, product, service, device, component, or part thereof", that is "primarily designed or produced for the purpose of circumventing a technological measure that effectively controls access to a work", or has "only limited commercially significant purpose or use other than to circumvent", or is marketed for circumvention. §1201(b)(1) does the same for measures protecting a copyright owner's rights. Distribution free of charge is still "offer to the public".
  - **EU: read.** Directive 2001/29/EC art. 6(2): Member States protect against "the manufacture, import, distribution, sale, rental, advertisement for sale or rental, or possession for commercial purposes of devices, products or components" that are "promoted, advertised or marketed for the purpose of circumvention", have "only a limited commercially significant purpose or use other than to circumvent", or are "primarily designed, produced, adapted or performed for the purpose of enabling or facilitating the circumvention of, any effective technological measures".
  - **UK:** CDPA s.296ZB and s.296ZD, **read**. s.296ZB makes it an offence to sell or distribute, in the course of business, a device "primarily designed, produced, or adapted for the purpose of enabling or facilitating the circumvention of effective technological measures". s.296ZD gives rights holders civil remedies against such devices.
  - **Kenya: read.** Copyright Act s.35(3): copyright is infringed by a person who "(a) circumvents any effective technological protection measure designed to protect works; or (b) manufactures or distributes devices which are primarily designed or produced for the purpose of circumventing technological protection measures". Circumvention is permitted only "in limited circumstances as set out in the Second Schedule" (s.26B).
- **The boundaries counsel should review:**
  1. any code that decrypts, or obtains keys for, protected streams (Widevine, PlayReady, FairPlay): never, on any reading;
  2. signature or token "deciphering" that a site uses to restrict access, which is the core of the yt-dlp disputes;
  3. downloading unprotected HLS or DASH streams;
  4. using the user's cookies to reach subscription content;
  5. whether bundling yt-dlp (Unlicense) or running a copy the user installs changes Singlbase's position;
  6. platform terms of service, which bind the user, and whether a tool's publisher can be pursued over them.

**G3, page files (#426): Counsel.** The PO's questions are recorded on #441 (2026-11-17).

- **What the code does:** the extension reads the `href` and `src` of the page's links and media elements in the user's own browser, lists those that look like files, and shows a button. `pageButton: true` by default ([`browser-extension/src/shared/settings.ts`](../../browser-extension/src/shared/settings.ts) line 43). It needs the optional `<all_urls>` permission ([`scripts/extension-lib.mjs`](../../scripts/extension-lib.mjs) line 19).
- **What it doesn't do:** it makes no requests of its own and follows no links.
- **Unauthorised-access laws** (US CFAA, UK Computer Misuse Act 1990, Kenya Computer Misuse and Cybercrimes Act 2018) concern access without authorisation. Kenya's s.14(1), **read**: an offence is committed by a person who "causes … a computer system to perform a function, by infringing security measures, with intent to gain access, and knowing such access is unauthorised". The extension infringes no security measure. Reading links the browser has already loaded, in the user's own session, is unlike scraping a server. Counsel should confirm this, and whether on-by-default matters.

## H. Browser extension: privacy, permissions and store compliance

**What the extension does:**

- **Permissions:** `downloads`, `nativeMessaging`, `storage`, `contextMenus` and `scripting`, with `<all_urls>` optional and asked at use ([`scripts/extension-lib.mjs`](../../scripts/extension-lib.mjs) lines 18–19).
- **Reads from pages:** with that permission, the links and media addresses of the page, for page files (G3). Never cookies or history: no `cookies` or `history` API is used (searched `browser-extension/src`).

The three kinds of data, kept apart:

| Data | Where it goes |
|---|---|
| **Accessed or stored locally** | Settings, and the popup's last 5 sends (file name, host, sent or failed, time) in `storage.local` ([`browser-extension/src/shared/recent.ts`](../../browser-extension/src/shared/recent.ts)) |
| **Sent to the desktop app** | The link, the referrer, the file name, size and type, through native messaging to the app on the same computer, which refuses remote clients ([docs/PRIVACY.md](../PRIVACY.md)) |
| **Sent off the computer** | Nothing by the extension. The app then downloads the link, which is the user's request |

**H1 and H2, against the stores' policies:**

- **Chrome Web Store, read:**
  - The User Data FAQ says extensions must disclose data handling "even when data is processed or stored locally".
  - "Web browsing activity" is user data, and its collection "is prohibited, except to the extent required for a user-facing feature" (Limited Use).
  - The FAQ exempts transmission to "a native program on the same computer" only from the secure-handling requirement, not from disclosure.
  - So the listing's "Data collected: none" ([`browser-extension/store/README.md`](../../browser-extension/store/README.md) line 46) may need to become a disclosure of web-browsing activity (the links), handled for the user-facing feature and sent only to the app on the same computer.
  - Chrome also requires an affirmative Limited Use statement.
- **Firefox:**
  - The manifest declares `data_collection_permissions: { required: ["none"] }` ([`scripts/extension-lib.mjs`](../../scripts/extension-lib.mjs) line 76).
  - **The policy, read** (the current text and the one taking effect on 1 December 2026 say the same):
    - "data transmission refers to any data that is collected, used, transferred, shared, or handled outside of the add-on or the local browser";
    - "If the add-on uses native messaging, the Add-on Policies (including those related to user consent and control) apply to any data sent to the native application as well";
    - "The transmission of browsing activity is only permitted as part of the add-on's primary function".
  - **The data-consent page** lists `browsingActivity` as "Information about the websites users visit, such as specific URLs".
  - **What follows:** "none" was wrong, and the declaration becomes `browsingActivity` (#522, PR 529, ADR-0023).
- **Edge: read** at its current address ([developer policies](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies)), §1.5.1: an extension "may collect, access, use, or transmit personal information (including web browsing activity) only if required by and only for use in a prominently disclosed, user-facing feature". That is #522.

## I. Privacy and data protection

- **I1: Risk and Docs, a strong indication, not measured.**
  - **The claims:** [`docs/PRIVACY.md`](../PRIVACY.md) line 7: "connects to the servers, mirrors, trackers and peers of the downloads you add, and to nothing else". The website's home page: "It connects only to the servers you download from" ([`site/content/home.md`](../../site/content/home.md) line 25).
  - **The code:** the torrent helper starts with the app ([`src-tauri/src/downloads.rs`](../../src-tauri/src/downloads.rs) lines 115–132), with DHT on by default (F). libtorrent then joins DHT through its default bootstrap nodes and listens on a port, with no torrent added.
  - **What to do:** measure it (a packet capture of a fresh start with no torrents), then either start DHT with the first torrent, or say so in the privacy page.
- **The law:**
  - **EU and UK:** GDPR and UK GDPR art. 3 reach a publisher only where it processes personal data. A local app that sends nothing to Singlbase processes little, but the website, the GitHub issues and any support e-mail do.
  - **Kenya: read.** The Data Protection Act 2019 applies to processing "by a data controller or data processor who (i) is established or ordinarily resident in Kenya and processes personal data while in Kenya; or (ii) not established or ordinarily resident in Kenya, but processing personal data of data subjects located in Kenya" (s.4). Under s.18, "no person shall act as a data controller or data processor unless registered with the Data Commissioner", with thresholds the Commissioner sets.
  - **For counsel:** which of these apply to Singlbase, given M1. The GDPR and UK GDPR texts weren't collected.
- **I2: Risk.** The [support page](../../site/content/support.md) line 12 asks users to attach a diagnostics report to a public GitHub issue. The report names no download, link or folder, and removes logins, cookies, keys and tokens ([docs/DIAGNOSTICS.md](../DIAGNOSTICS.md)). But users may attach screenshots or logs with personal data, and a public issue is published worldwide. Consider a warning there, and a private channel for reports with personal data.
- **I3: Fact.** Peers' IP addresses are shown in the torrent details ([`src/features/torrents/TorrentSection.tsx`](../../src/features/torrents/TorrentSection.tsx) lines 122–124) and kept in memory only. Torrent resume data is kept "without trackers" ([docs/PRIVACY.md](../PRIVACY.md)).
- **What holds up:**
  - logins are kept only in the system keychain, on request ([ADR-0015](../decisions/0015-keychain-with-consent.md));
  - no telemetry and no crash reports;
  - links in the history are kept without logins;
  - history retention is the user's choice.

## J. Diagnostics, logs and information disclosure

- **J1: Docs, confirmed.** [`docs/DIAGNOSTICS.md`](../DIAGNOSTICS.md) lines 84–87 list "The automated secret-leak scan … (#71)" under "Not here yet". The scan exists ([`crates/velocity-transfer/tests/secret_leaks.rs`](../../crates/velocity-transfer/tests/secret_leaks.rs)) and is described in [docs/TEST_FIXTURES.md](../TEST_FIXTURES.md).
- **Redaction** is tested; the export counts downloads by status only ([docs/PRIVACY.md](../PRIVACY.md), "Diagnostics you share"). No legal gap was found beyond I2.

## K. Security-related legal exposure

- **K1:** installers aren't signed today. SignPath Foundation is chosen, pending its acceptance; Linux gets a GPG signature (ADR-0022, PR 518; #429). An unsigned installer isn't a legal breach, but users can't check its publisher. That matters for the store-like trust a website download implies.
- **K2:** [`SECURITY.md`](../../SECURITY.md) promises an acknowledgement within 7 days, and has GitHub's private reporting only. #476 (v0.4.0) plans the full promise. Promises in a security policy can be relied on, so keep them achievable.
- **Ordinary weaknesses versus obligations:** this report found no security claim the code contradicts. TLS verification is always on, and the advisory register is current (`pnpm check:advisories` passes at `47f6510`). The EU Cyber Resilience Act is N2.

## L. Product terms, notices and policies

**What exists:**

- `LICENSE` (GPL v3, which carries its own warranty disclaimer and limitation of liability, §15–16);
- `THIRD_PARTY_NOTICES.md`;
- the privacy page, from [`docs/PRIVACY.md`](../PRIVACY.md);
- the website's [licence page](../../site/content/licence.md);
- `SECURITY.md`, `SUPPORT.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md` and `CLA.md`.

**L1, missing before wider distribution** (what each must cover is for counsel; none is written here):

| Document | Why it may be needed |
|---|---|
| **Terms of use** for the website, and whether the app needs an EULA beyond the GPL | The GPL covers copying and changing, not use of the website or the publisher's support |
| **Acceptable-use and copyright statement** | Sets out lawful use, especially for torrents (F) and a future extractor (G) |
| **Copyright-complaint contact and process** | F3 |
| **File-sharing disclosure** | F1 |
| **Publisher identity and legal contact** | M1, consumer and platform rules |
| **Trademark notice** | After C1's clearance |
| **Support and availability statement** | What "only the latest release gets security fixes" means for users |

The GPL's own disclaimer (§15–16) is not assumed to protect the company in every jurisdiction. Consumer law in the EU, UK and Kenya limits what a publisher can exclude. That is a question for counsel.

## M. Publisher identity and international distribution

- **Consistent:** "Singlbase Technologies Limited" is named the same way in:
  - the installer metadata ([`src-tauri/tauri.release.conf.json`](../../src-tauri/tauri.release.conf.json) lines 22–23);
  - the README's copyright line (line 81);
  - `CLA.md`;
  - the website's licence page;
  - the GitHub organisation.
- **M1, missing everywhere:** the company's country of registration, registration number, registered address and a legal contact. The EU's Digital Services Act and consumer rules, the UK's, and the stores' own publisher or trader declarations may require some of them. Counsel should say which, for each channel.
- **M2, Docs:** [`SECURITY.md`](../../SECURITY.md) lines 13, 22 and 24 call the product `V2`, against the product-name rule. `pnpm check:product-name` checks only V1's full name, so it passes.

## N. Patents, export controls and other risks

- **Patents:** no patent search was done; one needs counsel. GPL v3 §11 and the CLA §3 grant patent licences from contributors. Apache-2.0 dependencies (OpenSSL) carry their own patent grants. Download managers and BitTorrent clients are long-established; that isn't freedom to operate.
- **N1, encryption export: Counsel.** The app ships OpenSSL 3.5.9 (Linux), ring and RustCrypto (SFTP through russh), and Schannel through the system (Windows).
  - **US: read** (eCFR, up to date as of 24 November 2026).
    - 15 CFR 742.15(b)(1): "publicly available … encryption source code classified under ECCN 5D002 is not subject to the EAR".
    - A note to that section: "Publicly available encryption object code 'software' classified under ECCN 5D002 is not subject to the EAR when the corresponding source code meets the criteria specified in § 742.15(b)".
    - A notification to BIS is needed only for source code that "provides or performs 'non-standard cryptography'" (742.15(b)(2)). Apollo Download Manager uses standard algorithms through OpenSSL, ring and RustCrypto.
    - **For counsel:** confirm the classification, and that nothing in the app is "non-standard cryptography".
  - **EU:** the dual-use regulation (EU) 2021/821 has a public-domain note.
  - **Kenya:** not researched.
- **Sanctions:** GitHub and the stores apply their own; Singlbase distributes through them. Counsel should say whether the company has its own obligations.
- **N2, EU Cyber Resilience Act, Regulation (EU) 2024/2847: Counsel.** It applies to products with digital elements made available on the EU market in a commercial activity. **Read.**
  - **Dates:** Article 71(2): "This Regulation shall apply from 11 December 2027. However, Article 14 shall apply from 11 September 2026".
  - **Scope:** "making available on the market" means supply "in the course of a commercial activity, whether in return for payment or free of charge" (Article 3).
  - **Recital 18:** free and open-source software "not monetised by their manufacturers should not be considered to be a commercial activity", and "the mere presence of regular releases" doesn't make it one.
  - **Recital 15:** "Accepting donations without the intention of making a profit should not be considered to be a commercial activity"; donations exceeding costs, paid support beyond cost, or "an intention to monetise" would be.
  - **What the PO decided:** Singlbase stays non-commercial (#530, ADR-0024, PR 531). As long as that holds, Apollo Download Manager isn't made available on the market under the CRA.
- **Accessibility:** the European Accessibility Act covers listed products and services; a free download manager isn't obviously among them. No obligation is assumed; counsel can confirm.
- **Other projects' trademarks:** libcurl, OpenSSL and libtorrent are named in the docs for what they are, and not used in the product name or the logo. That is normal nominative use, and no issue was found.
- **N3, claims:**
  - **Performance:** "kept only while they make it faster" (home page line 8) describes how the engine works (#330) and is tested. "Up to 8 by default" matches the engine.
  - **Privacy:** "Private by design … connects only to the servers you download from" is I1.
  - Keep claims to measured behaviour, as AGENTS.md requires.

## O. Repository-wide sweep

- **Former names:** `V2` in `SECURITY.md` (M2) and V1's name in `CLA.md` (B4). The identifiers with "velocity" (C2) are recorded, not a breach.
- **Conflicting legal documents:** `docs/LICENSING.md` against `LICENSE` (E1).
- **Undocumented network contacts:** DHT bootstrap at start (I1). Mirror lists are fetched only on a click and are documented (#324).
- **External executables:** none beyond the app's own three programs (`velocity-transfer`, `velocity-torrent`, `velocity-native-host-v2`, in `externalBin`).
- **Earlier accepted-risk decisions** that still hold: RUSTSEC-2023-0071 in `rsa` (accepted, #53) and the glib advisory (#184), both in [SECURITY_SUPPLY_CHAIN.md](../SECURITY_SUPPLY_CHAIN.md#the-register). Neither is a legal matter.

## 13. Remediation plan

Proposed follow-up issues, most urgent first. The PO decides which are filed. Each is marked **Legal** (needs counsel or a PO decision with legal input) or **Engineering**.

| # | Issue to file | Kind | Counsel | Area |
|---|---|---|---|---|
| 1 | Trademark clearance of "Apollo Download Manager" in KE, US, EU, UK and WIPO; record the result in ADR-0018's follow-up | Legal | Yes | C1 |
| 2 | Chain of title: V1's contributors and assignments, the PO's assignment to Singlbase, and the AI service's output terms; an opinion on AI-written code under the GPL and the CLA | Legal | Yes | A1–A3, D4 |
| 3 | CLA review before the first outside contribution; decide how agreement is recorded; fix the V1 name | Legal | Yes | B1, B2, B4 |
| 4 | Tell users torrents upload while they download, and that peers see their IP address (guide, first-torrent dialog) | Engineering | Review wording | F1 |
| 5 | Measure DHT and the listening port at start; start them with the first torrent, or correct the privacy page and the home page | Engineering | No | I1 |
| 6 | Store disclosures: web-browsing activity handled locally and sent only to the app; Chrome's Limited Use statement; check AMO's and Edge's wording at submission (#240) | Engineering | Review | H1, H2 |
| 7 | Terms of use, acceptable-use and copyright statement, complaint contact, publisher identity on the website | Legal | Yes | L1, M1, F3 |
| 8 | Corresponding Source per release: an opinion on §6(d), then attach or mirror the native and crate sources if advised; link each version's source from the website | Legal, then Engineering | Yes | D2 |
| 9 | Fix `docs/LICENSING.md` (licence chosen, distribution started, crate count), `docs/DIAGNOSTICS.md` (#71 exists) and `SECURITY.md` (`V2`) | Engineering | No | E1, E2, J1, M2 |
| 10 | Warn on the support page before attaching diagnostics to a public issue; offer a private route | Engineering | No | I2 |
| 11 | Encryption export classification and any BIS notification | Legal | Yes | N1 |
| 12 | Cyber Resilience Act: commercial activity or not, and what follows before 11 December 2027 | Legal | Yes | N2 |
| 13 | Before #253: an opinion on extractors, with the boundaries in G2 | Legal | Yes | G2 |
| 14 | Page files on by default: an opinion (#426) | Legal | Yes | G3 |
| 15 | Whether the "velocity" identifiers must change | Legal, then Engineering | Yes | C2 |

## Commands run for this report

At `47f6510`, on Windows 11:

```text
$ git log --format='%an' | sort | uniq -c | sort -rn
$ git log --format='%b' | grep -i "co-authored-by" | sed 's/<.*//' | sort | uniq -c
$ gh pr list --state all --limit 600 --json author
$ gh release list; gh release view v0.2.0 --json assets
$ gh api repos/Singlbase-Technologies-Limited/velocity-download-manager   # HTTP 404 for the agent
$ pnpm check:notices      # 6 native libraries, 577 crates, 62 npm packages: up to date
$ pnpm check:advisories   # PASS
$ grep -rn "ported from V1" crates/ …; grep -rn "cookies\|history" browser-extension/src
```
