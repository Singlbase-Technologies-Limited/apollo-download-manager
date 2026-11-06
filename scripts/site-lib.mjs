// The product website (#353): static pages for GitHub Pages, built from the same sources as the in-app guide.
// The user guides (docs/user/) and the privacy document (docs/PRIVACY.md) are rendered, never copied; the home,
// FAQ, support and licence pages are in site/content/. Every page is plain HTML, one stylesheet, and the site's own
// font and screenshots: no scripts, and nothing from another site, so a visit asks nothing of anyone but GitHub
// Pages. The screens are real ones of the app, in site/screens/ (`pnpm site:screens`), and what each one shows is in
// site/content/screens.json. The download page is made at build time from the GitHub releases the workflow passes in.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildGuide, parsePage, resolveLinks } from './guide-lib.mjs';

/** The site's address: the default GitHub Pages one (PO decision on #353). */
export const SITE_URL = 'https://singlbase-technologies-limited.github.io/apollo-download-manager/';
const REPO = 'https://github.com/Singlbase-Technologies-Limited/apollo-download-manager';
const NAME = 'Apollo Download Manager';

const root = new URL('../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), 'utf8').replace(/\r\n/g, '\n');

const content = JSON.parse(read('site/content/screens.json'));
const SCREEN_CAPTION = 'The real app, with example downloads.';

/** The files the pages use besides what `buildSite` makes: where each is, and its path in the site. */
export function siteFiles() {
  const at = (rel) => fileURLToPath(new URL(rel, root));
  const font = 'node_modules/@fontsource-variable/inter/';
  return [
    { from: at('src-tauri/icons/128x128.png'), to: 'icon.png' },
    { from: at(`${font}files/inter-latin-wght-normal.woff2`), to: 'fonts/inter-latin-wght-normal.woff2' },
    { from: at(`${font}LICENSE`), to: 'fonts/LICENSE.txt' },
    ...content.screens.map((s) => ({ from: at(`site/screens/${s.id}.png`), to: `screens/${s.id}.png` })),
  ];
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inlineHtml(content, hrefOf) {
  return content
    .map((n) => {
      switch (n.type) {
        case 'text':
          return esc(n.text);
        case 'code':
          return `<code>${esc(n.text)}</code>`;
        case 'break':
          return '<br>';
        case 'strong':
          return `<strong>${inlineHtml(n.content, hrefOf)}</strong>`;
        case 'em':
          return `<em>${inlineHtml(n.content, hrefOf)}</em>`;
        case 'strike':
          return `<s>${inlineHtml(n.content, hrefOf)}</s>`;
        case 'link':
          if ('url' in n.to) return `<a href="${esc(n.to.url)}" rel="noopener">${inlineHtml(n.content, hrefOf)}</a>`;
          return `<a href="${esc(hrefOf(n.to) + (n.to.anchor ? `#${n.to.anchor}` : ''))}">${inlineHtml(n.content, hrefOf)}</a>`;
        default:
          throw new Error(`unknown inline ${String(n.type)}`);
      }
    })
    .join('');
}

/**
 * Typed blocks (scripts/guide-lib.mjs) as HTML; every text escaped.
 * @param {object[]} blocks
 * @param {(to: { page?: string, path?: string }) => string} hrefOf the address of a link between the site's pages
 * @param {(id: string) => string} [afterHeading] what follows a heading, by its id
 */
export function renderBlocks(blocks, hrefOf, afterHeading = () => '') {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'heading': {
          const h = Math.min(b.level, 4);
          return `<h${String(h)} id="${esc(b.id)}">${inlineHtml(b.content, hrefOf)}</h${String(h)}>${afterHeading(b.id)}`;
        }
        case 'paragraph':
          return `<p>${inlineHtml(b.content, hrefOf)}</p>`;
        case 'list': {
          const tag = b.ordered ? 'ol' : 'ul';
          return `<${tag}>${b.items.map((item) => `<li>${renderBlocks(item, hrefOf)}</li>`).join('')}</${tag}>`;
        }
        case 'quote':
          return `<blockquote>${renderBlocks(b.content, hrefOf)}</blockquote>`;
        case 'codeBlock':
          return `<pre><code>${esc(b.text)}</code></pre>`;
        case 'table':
          return `<div class="table"><table><thead><tr>${b.head.map((c) => `<th scope="col">${inlineHtml(c, hrefOf)}</th>`).join('')}</tr></thead><tbody>${b.rows
            .map((r) => `<tr>${r.map((c) => `<td>${inlineHtml(c, hrefOf)}</td>`).join('')}</tr>`)
            .join('')}</tbody></table></div>`;
        case 'rule':
          return '<hr>';
        default:
          throw new Error(`unknown block ${String(b.type)}`);
      }
    })
    .join('\n');
}

const FILES = [
  { kind: 'windows', test: /(?:windows-x64-setup|_x64-setup)\.exe$/i, label: 'Windows 10 and 11, 64-bit', note: 'Installer for your user only, no administrator needed' },
  { kind: 'deb', test: /\.deb$/i, label: 'Linux: .deb', note: 'Ubuntu 22.04 and newer, Debian 12 and newer' },
  { kind: 'rpm', test: /\.rpm$/i, label: 'Linux: .rpm', note: 'Fedora, openSUSE' },
];

/**
 * The newest published release's downloads, from GitHub's releases API; `null` without one.
 * @param {object[] | null} releases
 */
export function pickDownloads(releases) {
  const published = (releases ?? []).filter((r) => !r.draft).sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)));
  const r = published[0];
  if (!r) return null;
  const files = [];
  for (const f of FILES) {
    const a = r.assets.find((x) => f.test.test(x.name));
    if (a) files.push({ kind: f.kind, label: f.label, note: f.note, name: a.name, size: a.size, url: a.browser_download_url });
  }
  return {
    version: String(r.tag_name).replace(/^v/, ''),
    prerelease: Boolean(r.prerelease),
    date: String(r.published_at).slice(0, 10),
    page: r.html_url,
    files,
    checksums: r.assets.find((x) => x.name === 'SHA256SUMS')?.browser_download_url ?? null,
  };
}

const mib = (n) => `${(n / 1_048_576).toFixed(1)} MB`;

function downloadBlocks(d) {
  if (!d) {
    return `<p>The downloads are on the project's <a href="${REPO}/releases" rel="noopener">releases page</a>.</p>`;
  }
  const items = d.files
    .map(
      (f) =>
        `<li class="file"><h2>${esc(f.label)}</h2><p>${esc(f.note)}</p><p><a class="button" href="${esc(f.url)}" aria-label="Download ${esc(f.name)}">Download</a></p><p class="muted">${esc(f.name)}, ${mib(f.size)}</p></li>`,
    )
    .join('\n');
  return `<p>Version ${esc(d.version)}, ${esc(d.date)}${d.prerelease ? ': a <strong>test release</strong>, not yet a stable one' : ''}. The files aren't signed yet, so Windows warns the first time; the <a href="../guide/installing/">installing guide</a> says what to do.</p>
<ul class="files">
${items}
<li class="file"><h2>macOS</h2>
<p>Not available yet.</p></li>
</ul>
<p>${d.checksums ? `Check a file against its <a href="${esc(d.checksums)}">SHA-256 checksum</a>. ` : ''}Every version, with its notes: <a href="${esc(d.page)}" rel="noopener">the release on GitHub</a>, and <a href="${REPO}/releases" rel="noopener">all releases</a>.</p>`;
}

const NAV = [
  ['', 'Home'],
  ['features/', 'Features'],
  ['download/', 'Download'],
  ['guide/', 'User guide'],
  ['faq/', 'FAQ'],
  ['support/', 'Support'],
];

/** One screen of the app, at its real size; the browser fetches it when it comes into view, unless `eager`. */
function screenImage(id, up, eager = false) {
  const s = content.screens.find((x) => x.id === id);
  if (!s) throw new Error(`site/content/screens.json has no screen ${id}`);
  return `<img src="${up}screens/${s.id}.png" alt="${esc(s.alt)}" width="1440" height="780"${eager ? '' : ' loading="lazy"'}>`;
}

const screenFigure = (id, up, eager) => `<figure class="shot">${screenImage(id, up, eager)}<figcaption>${SCREEN_CAPTION}</figcaption></figure>`;

/** The screens to choose from: radio buttons and CSS, since the site has no scripts. It opens on another screen than the one above it. */
function screenSwitcher(up) {
  const inputs = content.screens.map((s) => `<input type="radio" name="screen" id="screen-${s.id}"${s.id === 'details' ? ' checked' : ''}>`).join('\n');
  const labels = content.screens.map((s) => `<label for="screen-${s.id}">${esc(s.label)}</label>`).join('\n');
  const shots = content.screens.map((s) => `<div class="screen screen-${s.id}">${screenImage(s.id, up)}</div>`).join('\n');
  return `<section class="wrap switcher" aria-labelledby="see-every-screen">
<h2 id="see-every-screen">See every screen before you install</h2>
${inputs}
<div class="tabs">${labels}</div>
<div class="screens">${shots}</div>
<p class="muted">${SCREEN_CAPTION}</p>
</section>`;
}

function featureSections(list, up) {
  return list
    .map(
      (f) => `<section class="feature">
<div><h2>${esc(f.title)}</h2><p>${esc(f.text)}</p><p><a href="${up}${esc(f.guide)}">In the user guide</a></p></div>
<figure class="shot">${screenImage(f.screen, up)}</figure>
</section>`,
    )
    .join('\n');
}

function homeBody(page, d, hrefOf) {
  const [title, lead, ...rest] = page.blocks;
  if (title?.type !== 'heading' || lead?.type !== 'paragraph') throw new Error('site/content/home.md starts with its title and a paragraph');
  const version = d ? `Version ${esc(d.version)}${d.prerelease ? ', a test release' : ''}. ` : '';
  return `<div class="hero"><div class="wrap">
<h1>${inlineHtml(title.content, hrefOf)}</h1>
<p class="lead">${inlineHtml(lead.content, hrefOf)}</p>
<p class="actions"><a class="button" href="download/">Download for Windows or Linux</a> <a href="features/">See the features</a></p>
<p class="small">${version}No account, no telemetry.</p>
</div></div>
<div class="wrap hero-shot">${screenFigure('downloads', './', true)}</div>
${screenSwitcher('./')}
<div class="wrap features">${featureSections(content.features.filter((f) => f.home), './')}</div>
<div class="wrap prose">${renderBlocks(rest, hrefOf)}</div>`;
}

function layout({ path, title, description, body, aside = '', wide = false }) {
  const depth = path.split('/').length - 1;
  const up = depth === 0 ? './' : '../'.repeat(depth);
  const here = path.replace(/index\.html$/, '');
  const full = title === NAME ? NAME : `${title} · ${NAME}`;
  const canonical = path === '404.html' ? '' : `<link rel="canonical" href="${SITE_URL}${here}">\n`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">
${canonical}<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE_URL}${here}">
<meta property="og:image" content="${SITE_URL}icon.png">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="${up}icon.png">
<link rel="stylesheet" href="${up}style.css">
</head>
<body>
<a class="skip" href="#main">Skip to the content</a>
<header class="top"><div class="wrap">
<a class="brand" href="${up}"><img src="${up}icon.png" alt="" width="28" height="28"> ${NAME}</a>
<nav aria-label="Site"><ul>${NAV.map(([p, label]) => `<li><a href="${up}${p}"${here === p ? ' aria-current="page"' : ''}>${label}</a></li>`).join('')}</ul></nav>
</div></header>
${wide ? `<main id="main" class="full">\n${body}\n</main>` : `<div class="wrap page${aside ? ' with-aside' : ''}">\n${aside}<main id="main">\n${body}\n</main>\n</div>`}
<footer><div class="wrap">
<p>${NAME} is free software under the GNU GPL, version 3. <a href="${up}privacy/">Privacy</a> · <a href="${up}licence/">Licence and source</a> · <a href="${REPO}" rel="noopener">GitHub</a></p>
</div></footer>
</body>
</html>
`;
}

const firstText = (blocks) => {
  const p = blocks.find((b) => b.type === 'paragraph');
  const text = p ? p.content.map((n) => n.text ?? (n.content ? n.content.map((c) => c.text ?? '').join('') : '')).join('') : '';
  return text.length > 155 ? `${text.slice(0, 152).replace(/\s+\S*$/, '')}…` : text;
};

/** Pages from site/content/ and docs/PRIVACY.md: `/x/` links go to the site's own pages, https ones out. */
function contentPage(file, text) {
  const page = parsePage(file, text);
  resolveLinks(page, (href) => {
    if (/^https:\/\//i.test(href)) return { url: href };
    const m = /^\/((?:[a-z0-9-]+\/)*)(?:#(.+))?$/.exec(href);
    if (m) return m[2] ? { path: m[1], anchor: m[2] } : { path: m[1] };
    return null;
  });
  return page;
}

/**
 * Every file of the site, by its path: HTML pages, the sitemap, robots.txt and the stylesheet.
 * @param {{ releases: object[] | null }} input the GitHub releases, or `null` when unknown
 */
export function buildSite({ releases }) {
  const guideFiles = Object.fromEntries(
    readdirSync(new URL('docs/user/', root))
      .filter((f) => f.endsWith('.md'))
      .map((f) => [f, read(`docs/user/${f}`)]),
  );
  const guide = buildGuide(guideFiles).pages;
  const out = {};
  const pageHref = (path) => (to) => {
    const up = '../'.repeat(path.split('/').length - 1) || './';
    if (to.page !== undefined) return `${up}guide/${to.page === 'index' ? '' : `${to.page}/`}`;
    return `${up}${to.path ?? ''}`;
  };
  const emit = (path, page, extra = {}) => {
    out[path] = layout({ path, title: extra.title ?? page.title, description: extra.description ?? firstText(page.blocks), body: renderBlocks(page.blocks, pageHref(path), extra.afterHeading), aside: extra.aside });
  };

  const d = pickDownloads(releases);
  const home = contentPage('site/content/home.md', read('site/content/home.md'));
  out['index.html'] = layout({ path: 'index.html', title: NAME, description: firstText(home.blocks), body: homeBody(home, d, pageHref('index.html')), wide: true });
  out['features/index.html'] = layout({
    path: 'features/index.html',
    title: 'Features',
    description: `What ${NAME} does, shown in the real app: adding downloads, following them, categories, the browser and the schedule.`,
    body: `<div class="wrap intro"><h1>Features, shown in the real app</h1><p class="lead">Every picture on this page is a screen from ${NAME}, with example downloads.</p></div>\n<div class="wrap features">${featureSections(content.features, '../')}</div>`,
    wide: true,
  });
  for (const name of ['faq', 'support', 'licence']) emit(`${name}/index.html`, contentPage(`site/content/${name}.md`, read(`site/content/${name}.md`)));
  emit('privacy/index.html', contentPage('docs/PRIVACY.md', read('docs/PRIVACY.md')), { title: 'Privacy' });

  out['download/index.html'] = layout({
    path: 'download/index.html',
    title: 'Download',
    description: `Download ${NAME} for Windows and Linux${d ? `: version ${d.version}` : ''}.`,
    body: `<h1>Download</h1>\n${downloadBlocks(d)}`,
  });

  for (const p of guide) {
    const path = p.id === 'index' ? 'guide/index.html' : `guide/${p.id}/index.html`;
    const href = pageHref(path);
    const aside = `<nav class="aside" aria-label="User guide"><ul>${guide
      .map((g) => `<li><a href="${esc(href({ page: g.id }))}"${g.id === p.id ? ' aria-current="page"' : ''}>${esc(g.id === 'index' ? 'Introduction' : g.title)}</a></li>`)
      .join('')}</ul></nav>\n`;
    const shown = content.guide[p.id] ?? {};
    const afterHeading = (id) => (shown[id] ? screenFigure(shown[id], '../'.repeat(path.split('/').length - 1)) : '');
    for (const id of Object.keys(shown)) {
      if (!p.blocks.some((b) => b.type === 'heading' && b.id === id)) throw new Error(`site/content/screens.json: guide ${p.id} has no heading ${id}`);
    }
    emit(path, p, { aside, afterHeading, title: p.id === 'index' ? 'User guide' : p.title });
  }

  out['404.html'] = layout({ path: '404.html', title: 'Page not found', description: `This page of the ${NAME} website doesn't exist.`, body: `<h1>Page not found</h1>\n<p>This page doesn't exist. Try the <a href="${SITE_URL}">home page</a> or the <a href="${SITE_URL}guide/">user guide</a>.</p>` });

  const pages = Object.keys(out).filter((p) => p.endsWith('index.html')).sort();
  out['sitemap.xml'] = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `<url><loc>${SITE_URL}${p.replace(/index\.html$/, '')}</loc></url>`).join('\n')}
</urlset>
`;
  out['robots.txt'] = `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}sitemap.xml\n`;
  out['style.css'] = read('site/style.css');
  return out;
}
