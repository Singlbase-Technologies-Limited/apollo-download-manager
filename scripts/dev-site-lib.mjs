// The developer site (#355): pages for people who build the app, under /developers/ of the website. Each is a document
// from docs/, rendered and never copied, so GitHub and the site show the same text. The order is in
// site/content/developers.json, and a document missing from it fails the build. So does a link to a heading that
// doesn't exist, so a pull request can't break the site's links. The only script is site/developers/search.js.
import { posix } from 'node:path';
import { parsePage, resolveLinks } from './guide-lib.mjs';
import { pager, searchForm, tableOfContents } from './site-layout.mjs';

const START = 'START_HERE.md';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A document's address under /developers/: `ENGINE_CONTRACT.md` is `engine-contract/`, a folder's README the folder. */
export function pagePath(file) {
  if (file === START) return '';
  if (file.endsWith('/README.md')) return file.replace(/README\.md$/, '');
  return `${file.replace(/\.md$/, '').toLowerCase().replace(/_/g, '-')}/`;
}

/** The longest sidebar name: one line at the sidebar's narrowest desktop width (#487). */
const NAME_LENGTH = 24;

/**
 * The contents as sections: each has its own documents, then its folders, each folder listing its README first and
 * then its documents by name. `pages` is every document of the section, in that order.
 */
function sectionsOf(nav, files) {
  const known = Object.keys(files);
  const sections = nav.sections.map((s) => {
    const folders = (s.folders ?? []).map((folder) => {
      const inside = known.filter((f) => f.startsWith(`${folder}/`)).sort();
      return [...inside.filter((f) => f.endsWith('/README.md')), ...inside.filter((f) => !f.endsWith('/README.md'))];
    });
    const own = [...(s.pages ?? [])];
    return { title: s.title, own, folders, pages: [...own, ...folders.flat()] };
  });
  const listed = new Set([START, ...sections.flatMap((s) => s.pages)]);
  for (const f of listed) if (!(f in files)) throw new Error(`site/content/developers.json lists ${f}, which isn't in docs/`);
  for (const f of known) {
    if (f !== 'README.md' && !f.startsWith('user/') && !listed.has(f)) throw new Error(`docs/${f} isn't in site/content/developers.json`);
  }
  for (const f of listed) {
    const name = nav.names?.[f];
    if (!name) throw new Error(`site/content/developers.json: ${f} has no sidebar name (add it to "names")`);
    if (name.length > NAME_LENGTH) throw new Error(`site/content/developers.json: the sidebar name of ${f} is longer than ${String(NAME_LENGTH)} characters`);
  }
  return sections;
}

/**
 * What a link in `file` points to: another developer page, a user guide, or the file on GitHub.
 * @param {string} file the document, relative to docs/
 * @param {Map<string, { headings: { id: string }[] }>} pages the developer pages, by document
 * @param {string} repo the repository's address
 */
const linkTarget = (file, pages, repo) => (href) => {
  if (/^(https?:|mailto:)/i.test(href)) return { url: href };
  const [rel, anchor] = href.split('#');
  const target = rel ? posix.normalize(posix.join(posix.dirname(file), rel)) : file;
  const withAnchor = (to) => (anchor ? { ...to, anchor } : to);
  const name = target === '.' ? 'README.md' : target;
  const doc = [name, `${name.replace(/\/$/, '')}/README.md`].find((f) => pages.has(f));
  if (doc) {
    if (anchor && !pages.get(doc).headings.some((h) => h.id === anchor)) throw new Error(`${href}: docs/${doc} has no heading #${anchor}`);
    return withAnchor({ path: `developers/${pagePath(doc)}` });
  }
  if (name === 'README.md') return withAnchor({ path: 'developers/' });
  if (name.startsWith('user/')) {
    const guide = name.replace(/^user\//, '').replace(/\.md$/, '');
    return withAnchor({ path: guide === 'README' ? 'guide/' : `guide/${guide}/` });
  }
  const inRepo = name.startsWith('../') ? name.replace(/^(\.\.\/)+/, '') : `docs/${name}`;
  return { url: `${repo}/blob/main/${inRepo}${anchor ? `#${anchor}` : ''}` };
};

/**
 * The sidebar, in the user guide's style (#487): each section a headed group of short names, and each folder in it
 * folded under its README's name unless it holds the open page.
 */
function contents(sections, names, current, href) {
  const link = (file, label = names[file]) => `<li><a href="${esc(href(file))}"${file === current ? ' aria-current="page"' : ''}>${esc(label)}</a></li>`;
  // The folder is named after its README, which is listed in it as its overview.
  const folder = ([readme, ...rest]) =>
    `<details${[readme, ...rest].includes(current) ? ' open' : ''}><summary>${esc(names[readme])}</summary><ul>${link(readme, 'Overview')}${rest.map((f) => link(f)).join('')}</ul></details>`;
  const groups = sections
    .map((s) => `<div class="nav-group"><p>${esc(s.title)}</p>${s.own.length ? `<ul>${s.own.map((f) => link(f)).join('')}</ul>` : ''}${s.folders.map(folder).join('')}</div>`)
    .join('\n');
  return `<nav aria-label="Developer documents"><ul class="nav-start">${link(START)}</ul>\n${groups}</nav>`;
}

/** The first page's map of every section, for someone new. */
function topics(sections, titles, root) {
  const shown = sections.map(
    (s) => `<section><h2>${esc(s.title)}</h2><ul>${s.pages
      .filter((f) => !f.includes('/') || f.endsWith('/README.md'))
      .slice(0, 4)
      .map((f) => `<li><a href="${esc(`${root}${pagePath(f)}`)}">${esc(titles.get(f))}</a></li>`)
      .join('')}</ul></section>`,
  );
  return `\n<div class="topics">${shown.join('\n')}</div>`;
}

const devSearch = (root) => searchForm({ root, id: 'dev-search', label: 'Search the developer documents', placeholder: 'Commands, files, settings…' });

/**
 * Every file of the developer site, by its path in the website.
 * @param {object} input
 * @param {Record<string, string>} input.files the Markdown files of docs/, by their path in it
 * @param {{ sections: { title: string, pages?: string[], folders?: string[] }[], names: Record<string, string> }} input.nav
 *   site/content/developers.json: the sections, and each document's short name for the sidebar
 * @param {(page: object) => string} input.layout the website's page frame
 * @param {(blocks: object[], hrefOf: (to: object) => string) => string} input.renderBlocks
 * @param {string} input.repo the repository's address
 */
export function buildDevSite({ files, nav, layout, renderBlocks, repo }) {
  const sections = sectionsOf(nav, files);
  const docs = [START, ...sections.flatMap((s) => s.pages)];
  const pages = new Map(docs.map((f) => [f, parsePage(`docs/${f}`, files[f], { developer: true })]));
  for (const [file, page] of pages) resolveLinks(page, linkTarget(file, pages, repo));
  const titles = new Map([...pages].map(([f, p]) => [f, p.title]));

  const out = {};
  for (const [file, page] of pages) {
    const path = `developers/${pagePath(file)}index.html`;
    const up = '../'.repeat(path.split('/').length - 1);
    const root = '../'.repeat(path.split('/').length - 2) || './';
    const hrefOf = (to) => {
      if (to.image === undefined) return `${up}${to.path ?? ''}`;
      if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(to.image)) throw new Error(`docs/${file}: the image ${to.image} must be a file in docs/images/`);
      return `${root}${posix.normalize(posix.join(posix.dirname(file), to.image))}`;
    };
    const first = page.sections.find((s) => s.text)?.text ?? page.title;
    const at = docs.indexOf(file);
    const neighbour = (f) => f && { href: `${root}${pagePath(f)}`, title: titles.get(f) };
    out[path] = layout({
      path,
      title: file === START ? 'Developers' : `${page.title} · Developers`,
      description: first.length > 155 ? `${first.slice(0, 152).replace(/\s+\S*$/, '')}…` : first.padEnd(20, '.'),
      body: renderBlocks(page.blocks, hrefOf) + (file === START ? topics(sections, titles, root) : ''),
      aside: `${devSearch(root)}\n${contents(sections, nav.names, file, (f) => `${root}${pagePath(f)}`)}\n`,
      toc: tableOfContents(page.headings),
      after: pager(neighbour(docs[at - 1]), neighbour(docs[at + 1])),
      crumb: 'Developer documents',
      head: `<script type="module" src="${root}search.js"></script>\n`,
    });
  }

  const index = [...pages].flatMap(([file, page]) => page.sections.map((s) => ({ page: page.title, heading: s.heading, path: pagePath(file), anchor: s.anchor, text: s.text })));
  out['developers/search-index.json'] = JSON.stringify(index);
  return out;
}
