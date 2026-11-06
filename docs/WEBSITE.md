# The website

The product website (#353) is a static site on GitHub Pages, at <https://singlbase-technologies-limited.github.io/apollo-download-manager/> (the default Pages address, PO decision on #353). A developer site (#355) is planned under `/developers/` of the same site.

## What it is built from

| Page | Source |
|---|---|
| Home, FAQ, Support, Licence | `site/content/*.md` |
| User guide (`/guide/…`) | [docs/user/](user/README.md), the same pages the app's user guide shows (#354) |
| Privacy | [PRIVACY.md](PRIVACY.md) |
| Download | GitHub's releases, read when the site is built |
| Look | `site/style.css`: the app's colours, light and dark |

The pages are never copied: `scripts/site-lib.mjs` renders them at build time through the same parser as the in-app guide (`scripts/guide-lib.mjs`, markdown-it). In `site/content/`, a link to `/x/` goes to the site's page `x`, an `https://` link goes out, and anything else becomes plain text. Raw HTML and images in a page fail the build.

## Private by design

Every page is plain HTML and one stylesheet, with system fonts: **no scripts, no fonts, analytics or anything else from another site**, so a visit asks nothing of anyone but GitHub Pages. A test (`scripts/site-lib.test.mjs`) fails if a page loads a script or anything from another address. Each page has a title, a description, its canonical address and sharing (Open Graph) tags; `sitemap.xml` lists every page and `robots.txt` points to it.

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
