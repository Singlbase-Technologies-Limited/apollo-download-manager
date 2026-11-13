// The website (#353, #379): static pages for GitHub Pages, built from the same sources as the in-app guide. The user
// guides (docs/user/), the developer documents and the privacy document are rendered, never copied; the product pages'
// words are in site/content/. Its only scripts are its own: the theme switch on every page (site/theme.js), and the
// developer pages' search. Nothing comes from another site, so a visit asks nothing of anyone but GitHub Pages. The
// screens are real ones of the app, in site/screens/ (`pnpm site:screens`), and what each one shows is in
// site/content/screens.json. The download page is made at build time from the GitHub releases the workflow passes in.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildDevSite } from './dev-site-lib.mjs';
import { buildGuide, parsePage, resolveLinks } from './guide-lib.mjs';
import { esc, layout, logoSvg, NAME, pager, REPO, searchForm, SITE_URL, tableOfContents } from './site-layout.mjs';

export { SITE_URL };

const root = new URL('../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), 'utf8').replace(/\r\n/g, '\n');

const content = JSON.parse(read('site/content/screens.json'));
/** The smaller copies of each screenshot, made by `pnpm site:screens` (scripts/site-screens.mjs, SMALLER). */
const SCREEN_WIDTHS = [720, 1440];
const SCREEN_CAPTION = 'The real app, with example downloads.';

/** The user guide's sidebar, in reading order. */
const GUIDE_GROUPS = [
  ['Getting started', ['index', 'installing']],
  ['Using the app', ['downloads', 'torrents', 'categories', 'browser']],
  ['Reference', ['settings', 'protocols']],
  ['Help', ['troubleshooting', 'v1-and-v2']],
];

/** The files the pages use besides what `buildSite` makes: where each is, and its path in the site. */
export function siteFiles() {
  const at = (rel) => fileURLToPath(new URL(rel, root));
  const font = 'node_modules/@fontsource-variable/inter/';
  return [
    { from: at('src-tauri/icons/128x128.png'), to: 'icon.png' },
    { from: at('assets/brand/apollo-social-preview.png'), to: 'social-preview.png' },
    { from: at(`${font}files/inter-latin-wght-normal.woff2`), to: 'fonts/inter-latin-wght-normal.woff2' },
    { from: at(`${font}LICENSE`), to: 'fonts/LICENSE.txt' },
    ...content.screens.flatMap((s) => ['', ...SCREEN_WIDTHS.map((w) => `-${String(w)}`)].map((suffix) => ({ from: at(`site/screens/${s.id}${suffix}.webp`), to: `screens/${s.id}${suffix}.webp` }))),
    ...readdirSync(new URL('docs/images/', root)).map((f) => ({ from: at(`docs/images/${f}`), to: `developers/images/${f}` })),
  ];
}

function inlineHtml(content, hrefOf) {
  return content
    .map((n) => {
      switch (n.type) {
        case 'text':
          return esc(n.text);
        case 'code':
          // Code may break after a separator such as a slash, dot or underscore, and never between two letters (#485;
          // site/style.css keeps code in tables from breaking anywhere else). Not before the end, so no empty break.
          return `<code>${esc(n.text).replace(/([/\\._:])(?=.)/g, '$1<wbr>')}</code>`;
        case 'break':
          return '<br>';
        case 'image':
          return `<img src="${esc(hrefOf({ image: n.src }))}" alt="${esc(n.alt)}" loading="lazy">`;
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

const mib = (n) => `${(n / 1_048_576).toFixed(1)} MB`;

function downloadBody(d) {
  const intro = `<header class="page-head"><div class="wrap">
<h1>Download</h1>
<p class="lead">${d ? `Version ${esc(d.version)}, released ${esc(d.date)}.` : 'Free for Windows and Linux.'}${d?.prerelease ? ' This is a <strong>test release</strong>, not yet a stable one.' : ''}</p>
</div></header>`;
  if (!d) return `${intro}\n<section class="wrap band-gap"><p>The downloads are on the project’s <a href="${REPO}/releases" rel="noopener">releases page</a>.</p></section>`;
  const rows = d.files
    .map(
      (f) => `<li class="file file-${f.kind}"><div><h2>${esc(f.label)}</h2><p>${esc(f.note)}</p><p class="file-name">${esc(f.name)}, ${mib(f.size)}</p></div>
<a class="button" href="${esc(f.url)}" aria-label="Download ${esc(f.name)}">Download</a></li>`,
    )
    .join('\n');
  return `${intro}
<section class="wrap band-gap">
<ul class="files">
${rows}
</ul>
<aside class="note"><strong>Windows warns the first time.</strong> The files aren’t signed yet. The <a href="../guide/installing/">installing guide</a> says what to do.</aside>
<div class="columns">
<div><h2>Check your file</h2><p>${d.checksums ? `Compare it with the <a href="${esc(d.checksums)}">SHA-256 checksums</a>.` : 'This release has no checksum file.'}</p></div>
<div><h2>Other versions</h2><p>Read <a href="${esc(d.page)}" rel="noopener">this release’s notes</a>, or see <a href="${REPO}/releases" rel="noopener">all releases</a>.</p></div>
<div><h2>Next</h2><p>The <a href="../guide/">user guide</a> covers installing, your first download and every setting.</p></div>
</div>
</section>`;
}

/**
 * One screen of the app, at its real proportions; the browser fetches it when it comes into view, unless `eager`.
 * It picks the smallest width that is sharp at the screen's size (#423): 720 and 1440 px copies beside the full 2880.
 */
function screenImage(id, up, eager = false, className = '') {
  const s = content.screens.find((x) => x.id === id);
  if (!s) throw new Error(`site/content/screens.json has no screen ${id}`);
  const file = (suffix) => `${up}screens/${s.id}${suffix}.webp`;
  const srcset = [...SCREEN_WIDTHS.map((w) => `${file(`-${String(w)}`)} ${String(w)}w`), `${file('')} 2880w`].join(', ');
  return `<img${className ? ` class="${className}"` : ''} src="${file('')}" srcset="${srcset}" sizes="(max-width: 1208px) 100vw, 1160px" alt="${esc(s.alt)}" width="1440" height="780"${eager ? ' fetchpriority="high"' : ' loading="lazy"'}>`;
}

const screenFigure = (id, up, eager) => `<figure class="shot">${screenImage(id, up, eager)}<figcaption>${SCREEN_CAPTION}</figcaption></figure>`;

/** The part of a screen a feature is about, enlarged: `focus` is where to look, in percent, and how far in. */
function focused(f, up) {
  const [x, y, zoom] = f.focus ?? [50, 50, 1];
  return `<figure class="shot focus"><div style="--x:${x}%;--y:${y}%;--zoom:${zoom}">${screenImage(f.screen, up)}</div></figure>`;
}

/** The screens to choose from: radio buttons and CSS, so it works without a script. */
function screenSwitcher(up) {
  const inputs = content.screens.map((s) => `<input type="radio" name="screen" id="screen-${s.id}"${s.id === 'details' ? ' checked' : ''}>`).join('\n');
  const labels = content.screens.map((s) => `<label for="screen-${s.id}">${esc(s.label)}</label>`).join('\n');
  const shots = content.screens.map((s) => `<div class="screen screen-${s.id}">${screenImage(s.id, up)}</div>`).join('\n');
  return `<section class="switcher" aria-labelledby="see-every-screen"><div class="wrap">
<h2 id="see-every-screen">See every screen before you install</h2>
${inputs}
<div class="tabs">${labels}</div>
<div class="screens">${shots}</div>
<p class="muted">${SCREEN_CAPTION}</p>
</div></section>`;
}

const featureText = (f, up) => `<div class="feature-text"><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p><p><a class="more" href="${up}${esc(f.guide)}">In the user guide</a></p></div>`;

function featureSections(list, up) {
  return list.map((f) => `<section class="feature">\n${featureText(f, up)}\n${focused(f, up)}\n</section>`).join('\n');
}

/** A page's blocks after each `##` heading, by the heading's id. */
function sectionsOf(page) {
  const out = {};
  let at = null;
  for (const b of page.blocks) {
    if (b.type === 'heading' && b.level === 2) {
      at = { heading: b, blocks: [] };
      out[b.id] = at;
    } else if (at) {
      at.blocks.push(b);
    }
  }
  return out;
}

function homeBody(page, d, hrefOf) {
  const [title, lead] = page.blocks;
  if (title?.type !== 'heading' || lead?.type !== 'paragraph') throw new Error('site/content/home.md starts with its title and a paragraph');
  const parts = sectionsOf(page);
  const part = (id) => {
    if (!parts[id]) throw new Error(`site/content/home.md has no section ${id}`);
    return parts[id];
  };
  const blocks = (id) => renderBlocks(part(id).blocks, hrefOf);
  const heading = (id) => inlineHtml(part(id).heading.content, hrefOf);
  const shown = content.features.filter((f) => f.home);
  const version = d ? `<p class="eyebrow">Version ${esc(d.version)}${d.prerelease ? ' · test release' : ''}</p>` : '';
  return `<section class="hero"><div class="wrap">
${version}<h1>${inlineHtml(title.content, hrefOf)}</h1>
<p class="lead">${inlineHtml(lead.content, hrefOf)}</p>
<p class="actions"><a class="button large" href="download/">Download</a> <a class="button quiet large" href="features/">See the features</a></p>
<p class="small">No account. No telemetry. Free software.</p>
</div>
<div class="stage"><div class="wrap"><figure class="shot">${screenImage('downloads', './', true, 'light-only')}${screenImage('dark', './', false, 'dark-only')}<figcaption>${SCREEN_CAPTION}</figcaption></figure></div></div>
</section>
<section class="wrap strengths" aria-label="At a glance">${blocks('at-a-glance')}</section>
<section class="wrap features">
<h2>What it does</h2>
${featureSections(shown, './')}
</section>
<section class="ink" aria-labelledby="what-it-downloads"><div class="wrap">
<h2 id="what-it-downloads">${heading('what-it-downloads')}</h2>
${blocks('what-it-downloads')}
</div></section>
${screenSwitcher('./')}
<section class="wrap columns promises">
<div><h2>${heading('private-by-design')}</h2>${blocks('private-by-design')}</div>
<div><h2>${heading('free-software')}</h2>${blocks('free-software')}</div>
<div><h2>${heading('still-in-development')}</h2>${blocks('still-in-development')}</div>
</section>
<section class="closing"><div class="wrap">
<div><h2>Runs on Windows and Linux</h2>
<p>Windows 10 and 11, 64-bit. Ubuntu 22.04 and newer, Debian 12 and newer, Fedora and openSUSE.</p>
<p class="actions"><a class="button large" href="download/">Download</a></p></div>
<ul class="next-steps">
<li><a href="guide/"><strong>User guide</strong>Every screen and setting.</a></li>
<li><a href="developers/"><strong>Developers</strong>How it’s built, and how to help.</a></li>
<li><a href="support/"><strong>Support</strong>Report a problem or ask for a feature.</a></li>
</ul>
</div></section>`;
}

function featuresBody(up) {
  return `<header class="page-head"><div class="wrap">
<h1>Features</h1>
<p class="lead">Every picture is a real screen from ${NAME}, with example downloads.</p>
</div></header>
<div class="wrap features">${featureSections(content.features, up)}</div>
<section class="closing"><div class="wrap">
<div><h2>See it for yourself</h2><p>Free for Windows and Linux, with no account.</p>
<p class="actions"><a class="button large" href="${up}download/">Download</a></p></div>
<ul class="next-steps">
<li><a href="${up}guide/protocols/"><strong>Protocols and limits</strong>What each kind of link can do.</a></li>
<li><a href="${up}guide/"><strong>User guide</strong>Every screen and setting.</a></li>
</ul>
</div></section>`;
}

/** A page of `##` sections, each heading beside its text. */
function rowsBody(page, hrefOf) {
  const [title, ...rest] = page.blocks;
  const firstHeading = rest.findIndex((b) => b.type === 'heading');
  const lead = rest.slice(0, firstHeading < 0 ? rest.length : firstHeading);
  const rows = Object.values(sectionsOf(page))
    .map((s) => `<section class="row"><h2 id="${esc(s.heading.id)}">${inlineHtml(s.heading.content, hrefOf)}</h2><div>${renderBlocks(s.blocks, hrefOf)}</div></section>`)
    .join('\n');
  return `<header class="page-head"><div class="wrap">
<h1>${inlineHtml(title.content, hrefOf)}</h1>
${lead.map((b) => `<p class="lead">${inlineHtml(b.content, hrefOf)}</p>`).join('\n')}
</div></header>
<div class="wrap rows">${rows}</div>`;
}

function faqBody(page, hrefOf) {
  const [title] = page.blocks;
  const answers = Object.values(sectionsOf(page))
    .map((s) => `<details class="answer" id="${esc(s.heading.id)}"><summary class="question"><h2>${inlineHtml(s.heading.content, hrefOf)}</h2></summary>${renderBlocks(s.blocks, hrefOf)}</details>`)
    .join('\n');
  return `<header class="page-head"><div class="wrap"><h1>${inlineHtml(title.content, hrefOf)}</h1></div></header>
<div class="wrap faq">
<div class="answers">${answers}</div>
<aside class="ask"><h2>Something else?</h2><p>Look in the <a href="${hrefOf({ path: 'guide/' })}">user guide</a>, or <a href="${hrefOf({ path: 'support/' })}">ask for help</a>.</p></aside>
</div>`;
}

/** The guide's sidebar, with `current` marked; `href` gives a guide page's address. */
function guideNav(pages, current, href) {
  const titleOf = (id) => {
    const page = pages.find((p) => p.id === id);
    if (!page) throw new Error(`the guide has no page ${id}`);
    return id === 'index' ? 'Introduction' : page.title;
  };
  const groups = GUIDE_GROUPS.map(
    ([title, ids]) =>
      `<div class="nav-group"><p>${title}</p><ul>${ids.map((id) => `<li><a href="${esc(href({ page: id }))}"${id === current ? ' aria-current="page"' : ''}>${esc(titleOf(id))}</a></li>`).join('')}</ul></div>`,
  ).join('\n');
  return `<nav aria-label="User guide">\n${groups}\n</nav>\n`;
}

/**
 * Every file of the site, by its path: HTML pages, the sitemap, robots.txt, the stylesheet, the logo and the scripts.
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
  const content_ = (name) => contentPage(`site/content/${name}.md`, read(`site/content/${name}.md`));

  const d = pickDownloads(releases);
  const home = content_('home');
  out['index.html'] = layout({ path: 'index.html', title: NAME, description: firstText(home.blocks), body: homeBody(home, d, pageHref('index.html')) });
  out['features/index.html'] = layout({
    path: 'features/index.html',
    title: 'Features',
    description: `What ${NAME} does, shown in the real app: adding downloads, following them, categories, the browser and the schedule.`,
    body: featuresBody('../'),
  });
  out['download/index.html'] = layout({
    path: 'download/index.html',
    title: 'Download',
    description: `Download ${NAME} for Windows and Linux${d ? `: version ${d.version}` : ''}.`,
    body: downloadBody(d),
  });
  const faq = content_('faq');
  out['faq/index.html'] = layout({ path: 'faq/index.html', title: faq.title, description: firstText(faq.blocks), body: faqBody(faq, pageHref('faq/index.html')) });
  for (const name of ['support', 'licence']) {
    const page = content_(name);
    const path = `${name}/index.html`;
    out[path] = layout({ path, title: page.title, description: firstText(page.blocks), body: rowsBody(page, pageHref(path)) });
  }

  const privacy = contentPage('docs/PRIVACY.md', read('docs/PRIVACY.md'));
  out['privacy/index.html'] = layout({
    path: 'privacy/index.html',
    title: 'Privacy',
    description: firstText(privacy.blocks),
    body: renderBlocks(privacy.blocks, pageHref('privacy/index.html')),
    aside: '<nav aria-label="Legal"><div class="nav-group"><p>Legal</p><ul><li><a href="./" aria-current="page">Privacy</a></li><li><a href="../licence/">Licence and source</a></li></ul></div></nav>\n',
    toc: tableOfContents(privacy.headings),
    crumb: 'Legal',
  });

  const order = GUIDE_GROUPS.flatMap(([, ids]) => ids);
  for (const p of guide) {
    if (!order.includes(p.id)) throw new Error(`docs/user/${p.file}: the guide's sidebar doesn't list it`);
    const path = p.id === 'index' ? 'guide/index.html' : `guide/${p.id}/index.html`;
    const href = pageHref(path);
    const shown = content.guide[p.id] ?? {};
    const afterHeading = (id) => (shown[id] ? screenFigure(shown[id], '../'.repeat(path.split('/').length - 1)) : '');
    for (const id of Object.keys(shown)) {
      if (!p.blocks.some((b) => b.type === 'heading' && b.id === id)) throw new Error(`site/content/screens.json: guide ${p.id} has no heading ${id}`);
    }
    const at = order.indexOf(p.id);
    const neighbour = (id) => id && { href: href({ page: id }), title: id === 'index' ? 'Introduction' : guide.find((g) => g.id === id).title };
    // The guide's own search (#422): the developer site's script, over an index of the guide's pages only.
    const guideRoot = '../'.repeat(path.split('/').length - 2) || './';
    out[path] = layout({
      path,
      title: p.id === 'index' ? 'User guide' : p.title,
      description: firstText(p.blocks),
      body: renderBlocks(p.blocks, href, afterHeading),
      aside: `${searchForm({ root: guideRoot, id: 'guide-search', label: 'Search the user guide', placeholder: 'Resume, torrents, browser…' })}\n${guideNav(guide, p.id, href)}`,
      toc: tableOfContents(p.headings),
      after: pager(neighbour(order[at - 1]), neighbour(order[at + 1])),
      crumb: 'User guide',
      head: `<script type="module" src="${guideRoot}search.js"></script>\n`,
    });
  }
  const guideIndex = guide.flatMap((p) => p.sections.map((s) => ({ page: p.id === 'index' ? 'Introduction' : p.title, heading: s.heading, path: p.id === 'index' ? '' : `${p.id}/`, anchor: s.anchor, text: s.text })));
  out['guide/search-index.json'] = JSON.stringify(guideIndex);
  out['guide/search.js'] = read('site/developers/search.js');

  const docFiles = (dir) =>
    readdirSync(new URL(`docs/${dir}`, root), { withFileTypes: true }).flatMap((e) => {
      if (e.isDirectory()) return e.name === 'user' || e.name === 'images' ? [] : docFiles(`${dir}${e.name}/`);
      return e.name.endsWith('.md') ? [`${dir}${e.name}`] : [];
    });
  const files = Object.fromEntries(docFiles('').map((f) => [f, read(`docs/${f}`)]));
  Object.assign(out, buildDevSite({ files, nav: JSON.parse(read('site/content/developers.json')), layout, renderBlocks, repo: REPO }));
  out['developers/search.js'] = read('site/developers/search.js');

  out['404.html'] = layout({
    path: '404.html',
    title: 'Page not found',
    description: `This page of the ${NAME} website doesn't exist.`,
    body: `<header class="page-head"><div class="wrap"><h1>Page not found</h1><p class="lead">This page doesn’t exist. Try the <a href="${SITE_URL}">home page</a> or the <a href="${SITE_URL}guide/">user guide</a>.</p></div></header>`,
  });

  const pages = Object.keys(out).filter((p) => p.endsWith('index.html')).sort();
  out['sitemap.xml'] = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `<url><loc>${SITE_URL}${p.replace(/index\.html$/, '')}</loc></url>`).join('\n')}
</urlset>
`;
  out['robots.txt'] = `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}sitemap.xml\n`;
  out['style.css'] = read('site/style.css');
  out['theme.js'] = read('site/theme.js');
  out['logo-light.svg'] = logoSvg('light');
  out['logo-dark.svg'] = logoSvg('dark');
  return out;
}
