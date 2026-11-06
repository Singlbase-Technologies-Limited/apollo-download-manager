// The website's frame (#379): the header, the footer and the two page shapes, a product page and a document with its
// sidebar, table of contents and previous and next links. Every page goes through `layout`, so they stay one site.
import { readFileSync } from 'node:fs';

/** The site's address: the default GitHub Pages one (PO decision on #353). */
export const SITE_URL = 'https://singlbase-technologies-limited.github.io/apollo-download-manager/';
export const REPO = 'https://github.com/Singlbase-Technologies-Limited/apollo-download-manager';
export const NAME = 'Apollo Download Manager';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The logo the app shows on its loading screen and Get started, as a file for one theme (#379). */
export function logoSvg(theme) {
  const source = readFileSync(new URL('../src/components/BrandLogo.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const svg = /<svg viewBox[\s\S]*<\/svg>/.exec(source)?.[0];
  if (!svg) throw new Error('src/components/BrandLogo.tsx has no logo');
  const fill = (light, dark) => (theme === 'dark' ? dark : light);
  return `${svg
    .replace(' className={className}', ' xmlns="http://www.w3.org/2000/svg"')
    .replace(' focusable="false"', '')
    .replace('id={front}', 'id="front"')
    .replace(/clipPath=\{`url\(#\$\{front\}\)`\}/g, 'clip-path="url(#front)"')
    .replace(/fillRule=/g, 'fill-rule=')
    .replace(/className="fill-\[(#[0-9A-Fa-f]+)\] dark:fill-\[(#[0-9A-Fa-f]+)\]"/g, (_, l, d) => `fill="${fill(l, d)}"`)
    .replace(/className="fill-\[(#[0-9A-Fa-f]+)\] dark:fill-white"/g, (_, l) => `fill="${fill(l, '#FFFFFF')}"`)}\n`;
}

const NAV = [
  ['features/', 'Features'],
  ['guide/', 'User guide'],
  ['developers/', 'Developers'],
  ['faq/', 'FAQ'],
  ['support/', 'Support'],
];

const FOOTER = [
  ['Product', [['features/', 'Features'], ['download/', 'Download'], [`${REPO}/releases`, 'All releases'], ['faq/', 'FAQ']]],
  ['User guide', [['guide/', 'Introduction'], ['guide/installing/', 'Installing'], ['guide/torrents/', 'Torrents'], ['guide/browser/', 'Browser integration'], ['guide/troubleshooting/', 'Troubleshooting']]],
  ['Developers', [['developers/', 'Start here'], ['developers/architecture/', 'Architecture'], ['developers/development/', 'Development setup'], ['developers/decisions/', 'Decision records'], [`${REPO}/blob/main/CONTRIBUTING.md`, 'Contributing']]],
  ['Project', [['support/', 'Support'], [REPO, 'Source code'], [`${REPO}/issues`, 'Report a problem'], ['privacy/', 'Privacy'], ['licence/', 'Licence']]],
];

const SUN = '<svg class="sun" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg class="moon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/></svg>';

const logo = (up, width, height) =>
  `<img class="logo-light" src="${up}logo-light.svg" alt="${NAME}" width="${width}" height="${height}"><img class="logo-dark" src="${up}logo-dark.svg" alt="${NAME}" width="${width}" height="${height}">`;

const href = (up, to) => (/^https?:/.test(to) ? `${to}" rel="noopener` : `${up}${to}`);

function header(up, here) {
  const links = NAV.map(([p, label]) => `<li><a href="${up}${p}"${here === p || (p !== '' && here.startsWith(p)) ? ' aria-current="page"' : ''}>${label}</a></li>`).join('');
  return `<header class="top"><div class="bar">
<a class="brand" href="${up}" aria-label="${NAME}, home">${logo(up, 110, 42)}</a>
<input class="toggle" type="checkbox" id="menu" aria-label="Show the menu">
<label class="menu-button" for="menu"><span></span>Menu</label>
<nav aria-label="Site"><ul>${links}</ul></nav>
<div class="tools">
<button class="theme" type="button" data-theme-toggle hidden aria-pressed="false" aria-label="Dark theme">${SUN}${MOON}</button>
<a class="button small" href="${up}download/">Download</a>
</div>
</div></header>`;
}

function footer(up) {
  const groups = FOOTER.map(
    ([title, links]) => `<div><h2>${title}</h2><ul>${links.map(([to, label]) => `<li><a href="${href(up, to)}">${label}</a></li>`).join('')}</ul></div>`,
  ).join('\n');
  return `<footer class="foot"><div class="wrap">
<div class="foot-brand"><a href="${up}" aria-label="${NAME}, home">${logo(up, 126, 48)}</a>
<p>A free download manager for Windows and Linux.</p></div>
${groups}
</div>
<div class="wrap legal"><p>© 2026 Singlbase Technologies Limited. Free software under the GNU GPL, version 3.</p></div>
</footer>`;
}

/** The list of a document's sections, for one long enough to need it. */
export function tableOfContents(headings) {
  const shown = headings.filter((h) => h.level === 2 || h.level === 3);
  if (shown.length < 3) return '';
  return `<ul>${shown.map((h) => `<li${h.level === 3 ? ' class="sub"' : ''}><a href="#${esc(h.id)}">${esc(h.text)}</a></li>`).join('')}</ul>`;
}

/** The next and previous documents: each `{ href, title }`, or nothing at the ends. */
export function pager(previous, next) {
  const side = (rel, label, to) => (to ? `<a rel="${rel}" href="${esc(to.href)}"><small>${label}</small>${esc(to.title)}</a>` : '<span></span>');
  return `<nav class="pager" aria-label="Previous and next">${side('prev', 'Previous', previous)}${side('next', 'Next', next)}</nav>`;
}

function document_({ body, aside, toc, after, crumb }) {
  const list = toc ? `<nav class="toc" aria-label="On this page"><p>On this page</p>${toc}</nav>` : '';
  const small = toc ? `<details class="toc-small"><summary class="toc-title">On this page</summary>${toc}</details>` : '';
  return `<div class="docs">
<input class="toggle" type="checkbox" id="docs-menu" aria-label="Show the documents">
<label class="docs-button" for="docs-menu">${crumb ? esc(crumb) : 'Documents'}</label>
<aside class="docs-side">
${aside}</aside>
<main id="main" class="doc">
${small}<article class="prose">
${body}
</article>
${after ?? ''}
</main>
${list}
</div>`;
}

/**
 * One page of the site.
 * @param {object} page
 * @param {string} page.path its path in the site
 * @param {string} page.title
 * @param {string} page.description
 * @param {string} page.body what it shows
 * @param {string} [page.aside] a document's sidebar: the page then takes the document shape
 * @param {string} [page.toc] a document's table of contents
 * @param {string} [page.after] what follows a document, such as its previous and next links
 * @param {string} [page.crumb] where a document is, for the small screens' menu button
 * @param {string} [page.head] more for the `<head>`
 * @param {boolean} [page.reading] a narrow page of text with no sidebar
 */
export function layout({ path, title, description, body, aside, toc, after, crumb, head = '', reading = false }) {
  const depth = path.split('/').length - 1;
  const up = depth === 0 ? './' : '../'.repeat(depth);
  const here = path.replace(/index\.html$/, '');
  const full = title === NAME ? NAME : `${title} · ${NAME}`;
  const canonical = path === '404.html' ? '' : `<link rel="canonical" href="${SITE_URL}${here}">\n`;
  const main = aside !== undefined ? document_({ body, aside, toc, after, crumb }) : `<main id="main"${reading ? ' class="reading"' : ''}>\n${body}\n</main>`;
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
<meta property="og:image" content="${SITE_URL}social-preview.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${up}icon.png">
<link rel="stylesheet" href="${up}style.css">
<script src="${up}theme.js"></script>
${head}</head>
<body>
<a class="skip" href="#main">Skip to the content</a>
${header(up, here)}
${main}
${footer(up)}
</body>
</html>
`;
}
