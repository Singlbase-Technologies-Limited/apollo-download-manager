# The website

The product website (#353) is a static site on GitHub Pages, at <https://singlbase-technologies-limited.github.io/apollo-download-manager/> (the default Pages address, PO decision on #353). The developer site (#355) is under `/developers/` of the same site.

## What it is built from

| Page | Source |
|---|---|
| Home, FAQ, Support, Licence | `site/content/*.md` |
| Features, and the screens on every page | `site/content/screens.json`: each screen's label and description, the features, and which guide heading shows which screen |
| Screenshots | `site/screens/`, real screens of the app (below) |
| User guide (`/guide/…`) | [docs/user/](user/README.md), the same pages the app's user guide shows (#354) |
| Privacy | [PRIVACY.md](PRIVACY.md) |
| Developer pages (`/developers/…`) | Every document in `docs/`, in the order of `site/content/developers.json` (below) |
| Download | GitHub's releases, read when the site is built |
| Look | `site/style.css`: the app's colours, light and dark, and its font, Inter |

The pages are never copied: `scripts/site-lib.mjs` renders them at build time through the same parser as the in-app guide (`scripts/guide-lib.mjs`, markdown-it). In `site/content/`, a link to `/x/` goes to the site's page `x`, an `https://` link goes out, and anything else becomes plain text. Raw HTML and images in a page fail the build: a screen on a guide page comes from `screens.json`, so the in-app guide stays text. A heading that file names and a guide doesn't have fails the build too.

## The developer pages

Each document in `docs/` is a page, rendered by `scripts/dev-site-lib.mjs`, except the user guides and the [documentation map](README.md). [START_HERE.md](START_HERE.md) is the first page. `site/content/developers.json` sets the sections and their order; a folder listed there adds its documents by itself.

A pull request that touches `docs/` builds the site, and the build fails on:

- a document missing from `developers.json`, or a file listed there that doesn't exist;
- a link to a heading that doesn't exist.

A link to another document stays a link on the site, one to a user guide goes to that guide's page, and one to any other file goes to it on GitHub. These pages may show images from `docs/images/`, and text such as `<Name>` stays text. The user guides allow neither.

## The screens

Every picture is the real window, not a drawing, with example downloads, and says so. `pnpm site:screens` retakes them all, in Microsoft Edge with Playwright: start the web server with `pnpm exec vite`, and the script answers the app's commands itself, with made-up downloads of free software, so it touches no real data. It stops if the list doesn't load. Retake the screens when a screen they show changes, and at each version, since the window shows its version number.

The numbers in a picture are examples, never a speed claim.

## Private by design

Every product page is plain HTML and one stylesheet, with the site's own copy of the Inter font and its own screenshots: **no scripts, no analytics and nothing from another site**, so a visit asks nothing of anyone but GitHub Pages.

The developer pages have one exception, a PO decision on #355: `site/developers/search.js`, the site's own small script for the search box. It loads `search-index.json` from the site when someone first types. Without scripts the box stays hidden and the pages work. Offline, a browser shows what it has cached; there's no service worker.
 The screen switcher on the home page is radio buttons and CSS. Tests (`scripts/site-lib.test.mjs`, `scripts/dev-site-lib.test.mjs`) fail if a product page loads a script, or any page loads anything from another address. Each page has a title, a description, its canonical address and sharing (Open Graph) tags; `sitemap.xml` lists every page and `robots.txt` points to it.

## Building it

```sh
pnpm site                                  # site-out/, the download page linking to GitHub's releases
pnpm site -- --releases releases.json      # with the download page made from a saved releases answer
```

`site-out/` is git-ignored. `releases.json` is the answer of `gh api repos/Singlbase-Technologies-Limited/apollo-download-manager/releases`. The download page shows the newest published release: its Windows installer, `.deb` and `.rpm` with their sizes, its `SHA256SUMS`, and a "test release" label for a pre-release; macOS says "Not available yet". Without releases it links to GitHub's releases page.

`scripts/site-lib.test.mjs` checks the escaping, each page's head, the download choice and every link and heading anchor between the pages, in `pnpm test:focused -- scripts`.

## Publishing

The *Website* workflow ([`site.yml`](../.github/workflows/site.yml)) runs when the site's sources change:

- **On a pull request** it builds the site with a read-only token, so a broken page or link fails the PR.
- **On `main`** it builds the site and deploys it. Only the deploy job may write to Pages (`pages: write`, `id-token: write`), in the `github-pages` environment.
- **When a release is published** it rebuilds `main`'s site, so the download page names the new files. The workflow can also be run by hand; it deploys only from `main`.

**Repository settings it needs** (the PO's, [REPOSITORY_SETTINGS.md](REPOSITORY_SETTINGS.md#github-pages)): Pages turned on with GitHub Actions as its source, and the `github-pages` environment allowing deployments from `main` and from `v*` tags, since a release's run starts from its tag.
