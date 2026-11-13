# The website

The product website (#353) is a static site on GitHub Pages, at <https://singlbase-technologies-limited.github.io/apollo-download-manager/> (the default Pages address, PO decision on #353). The developer site (#355) is under `/developers/` of the same site.

## What it is built from

| Page | Source |
|---|---|
| Home, FAQ, Support, Licence | `site/content/*.md` |
| Features, and the screens on every page | `site/content/screens.json`: each screen's label and description, the features, and which guide heading shows which screen |
| Screenshots | `site/screens/*.webp`, real screens of the app (below) |
| User guide (`/guide/…`) | [docs/user/](user/README.md), the same pages the app's user guide shows (#354) |
| Privacy | [PRIVACY.md](PRIVACY.md) |
| Developer pages (`/developers/…`) | Every document in `docs/`, in the order of `site/content/developers.json` (below) |
| Download | GitHub's releases, read when the site is built |
| Look | `site/style.css` and `scripts/site-layout.mjs` (#379): the app's colours from `src/index.css` and its font, Inter, the app's logo, and the frame every page shares |

The pages are never copied: `scripts/site-lib.mjs` renders them at build time through the same parser as the in-app guide (`scripts/guide-lib.mjs`, markdown-it). In `site/content/`, a link to `/x/` goes to the site's page `x`, an `https://` link goes out, and anything else becomes plain text. Raw HTML and images in a page fail the build: a screen on a guide page comes from `screens.json`, so the in-app guide stays text. A heading that file names and a guide doesn't have fails the build too.

## The developer pages

Each document in `docs/` is a page, rendered by `scripts/dev-site-lib.mjs`, except the user guides and the [documentation map](README.md). [START_HERE.md](START_HERE.md) is the first page. `site/content/developers.json` sets the sections and their order; a folder listed there adds its documents by itself.

A pull request that touches `docs/` builds the site, and the build fails on:

- a document missing from `developers.json`, or a file listed there that doesn't exist;
- a link to a heading that doesn't exist.

A link to another document stays a link on the site, one to a user guide goes to that guide's page, and one to any other file goes to it on GitHub. These pages may show images from `docs/images/`, and text such as `<Name>` stays text. The user guides allow neither.

## The screens

Every picture is the real window, not a drawing, with example downloads, and says so. `pnpm site:screens` retakes them all, in Microsoft Edge with Playwright: start the web server with `pnpm exec vite`, and the script answers the app's commands itself, with made-up downloads of free software, so it touches no real data. It stops if the list doesn't load. Retake the screens when a screen they show changes, and at each version, since the window shows its version number.

Each screen is saved at 2880 px (the window at twice its size) and as 720 and 1440 px copies (`<name>-720.webp`, `<name>-1440.webp`), and every `<img>` offers all three (`srcset`), so a phone fetches about a seventh of the full image and an ordinary screen about two fifths (#423). `pnpm site:screens -- --sizes-only` makes the copies again from the screens already there, without the app.

The numbers in a picture are examples, never a speed claim.

## The design (#379)

- **The logo** is the one on the app's loading screen and Get started. `scripts/site-layout.mjs` makes `logo-light.svg` and `logo-dark.svg` from `src/components/BrandLogo.tsx` at build time, so the two can't differ.
- **The colours** are the app's tokens from `src/index.css`; a test fails if they drift.
- **Light by default** (PO, 2026-11-06): the site never follows the system's dark mode. Dark is a switch in the header, remembered in that browser only.
- **Two page shapes:** a product page, and a document with a grouped sidebar, its contents ("On this page") and previous and next links. The user guide's groups are in `scripts/site-lib.mjs`; the developer sections are in `site/content/developers.json`.
- **Documents give their tables the width** (#422). "On this page" is a box at the top of the document, and becomes a column on the right only on a screen 1600 px wide or more. Text keeps a 760 px line; a table may use the whole column. On a phone or tablet (900 px or narrower) a table is as wide as its cells need, each at most `min(30em, 80vw)`, and scrolls sideways in its own box, never the page. Measured over every guide page (#422): cells taller than 8 lines at 1440 px fell from 644 to 283, and on a phone from 2093 to 430.
- **On a phone** the header and the document sidebar fold into menus, which work without a script.
- **Features** show the part of a screen they describe: `focus` in `screens.json` says where, in percent, and how far in.
- **macOS isn't mentioned** (PO, 2026-11-06).

## Private by design

Every page is plain HTML and one stylesheet, with the site's own copy of the Inter font and its own screenshots: **no tracking, no analytics and nothing from another site**, so a visit asks nothing of anyone but GitHub Pages.

The site has two small scripts of its own:

- **`site/theme.js`** on every page (PO decision on #379): the theme switch. The choice stays in the browser and is sent nowhere. Without scripts the switch is hidden and the page is light. On the home page it also fetches the dark screenshot when the switch is pointed at or focused, and the light one stays until the dark one has loaded, so the switch never shows an empty frame; a visitor who never switches never downloads it (#423). While a screenshot loads, its frame shows the app's surface colour. The page script also marks the page as scripted (`js` on `<html>`) at once, so the switch keeps its place in the header from the first paint. The font is preloaded and used only if it arrives in time (`font-display: optional`), so a late font never re-wraps the page (#423).
- **`site/developers/search.js`** on the developer pages (PO decision on #355) and, since the PO's brief of 2026-11-09 (#422), the user guide's pages: the search box above the documents list, with a placeholder saying what to search. Each guide loads its own `search-index.json` (`developers/`, `guide/`), so a search finds pages of that guide only, when someone first types. Without scripts the box stays hidden. Offline, a browser shows what it has cached; there's no service worker.

The screen switcher, the FAQ's answers and the phone menus are HTML and CSS. Tests (`scripts/site-lib.test.mjs`, `scripts/dev-site-lib.test.mjs`) fail if a page loads any other script, or anything from another address. Each page has a title, a description, its canonical address and sharing (Open Graph) tags; `sitemap.xml` lists every page and `robots.txt` points to it.

## Building it

```sh
pnpm site                                  # site-out/, the download page linking to GitHub's releases
pnpm site -- --releases releases.json      # with the download page made from a saved releases answer
```

`site-out/` is git-ignored. `releases.json` is the answer of `gh api repos/Singlbase-Technologies-Limited/apollo-download-manager/releases`. The download page shows the newest published release: its Windows installer, `.deb` and `.rpm` with their sizes, its `SHA256SUMS`, and a "test release" label for a pre-release; Without releases it links to GitHub's releases page.

`scripts/site-lib.test.mjs` checks the escaping, each page's head, the download choice and every link and heading anchor between the pages, in `pnpm test:focused -- scripts`.

`pnpm site:check` (#379) opens the built site in Microsoft Edge with Playwright, served as GitHub Pages serves it, and checks every page in the sitemap at phone, tablet and desktop widths, with the system set to dark:

- that each page opens light, shows the logo and has one `h1`;
- text contrast on every page in both themes: at least 4.5:1, or 3:1 for large text (#353, [ACCESSIBILITY.md](ACCESSIBILITY.md));
- the keyboard: Tab starts at the skip link, reaches the home page's links and buttons, and every one shows its focus outline;
- no sideways scroll, broken image, image without `alt`, console error or failed request;
- every internal link;
- the menus, the theme switch and that it's remembered, the screen switcher, the FAQ, and previous and next;
- both searches (#422): the label, the typed text and the documents list share one left edge; the box has a placeholder; a result opens the right page by mouse and by keyboard alone (focus, type, Tab, Enter); and no match says "Nothing found.";
- tables at desktop width (#422): no cell wraps to more than 8 lines. The pages whose tables hold paragraphs rather than values are listed in `TALL_TABLES` in `scripts/site-check.mjs`, for the content audit (#425) to rewrite; a page leaves the list once it passes.
- names in tables (#485), at every width: no file, folder or crate name in a table cell breaks between two letters or digits. The site lets code break only after `/`, `\`, `.`, `_` or `:`, and a table too wide for the page scrolls in its own box.
- the home page on a slow line (about 1.6 Mbit/s, 150 ms latency, #423): a placeholder in the screenshot's frame while it loads, a screenshot (never an empty frame) 100 ms after the theme switch, and the dark one once it arrives; on a fast line, the dark screenshot within 100 ms of the switch; a phone fetching the 720 px copy; and, on a phone on the same slow line, a layout shift (CLS) under 0.01.

`pnpm site:check -- --shots <folder>` also saves full-page screenshots to look at. It runs locally, before a change to the site's look is pushed.

## Publishing

The *Website* workflow ([`site.yml`](../.github/workflows/site.yml)) runs when the site's sources change:

- **On a pull request** it builds the site with a read-only token, so a broken page or link fails the PR.
- **On `main`** it builds the site and deploys it. Only the deploy job may write to Pages (`pages: write`, `id-token: write`), in the `github-pages` environment.
- **When a release is published** it rebuilds `main`'s site, so the download page names the new files. The workflow can also be run by hand; it deploys only from `main`.

**Repository settings it needs** (the PO's, [REPOSITORY_SETTINGS.md](REPOSITORY_SETTINGS.md#github-pages)): Pages turned on with GitHub Actions as its source, and the `github-pages` environment allowing deployments from `main` and from `v*` tags, since a release's run starts from its tag.
