// The developer site (#355): pages for people who build the app, under /developers/ of the website. Each is a document
// from docs/, rendered and never copied, so GitHub and the site show the same text. The order is in
// site/content/developers.json, and a document missing from it fails the build. So does a link to a heading that
// doesn't exist, so a pull request can't break the site's links. The only script is site/developers/search.js.
import { posix } from 'node:path';
import { parsePage, resolveLinks } from './guide-lib.mjs';

const START = 'START_HERE.md';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A document's address under /developers/: `ENGINE_CONTRACT.md` is `engine-contract/`, a folder's README the folder. */
export function pagePath(file) {
  if (file === START) return '';
  if (file.endsWith('/README.md')) return file.replace(/README\.md$/, '');
  return `${file.replace(/\.md$/, '').toLowerCase().replace(/_/g, '-')}/`;
}

/** The contents as sections of files: a folder lists its README first, then its documents by name. */
function sectionsOf(nav, files) {
  const known = Object.keys(files);
  const sections = nav.sections.map((s) => {
    const pages = [...(s.pages ?? [])];
    for (const folder of s.folders ?? []) {
      const inside = known.filter((f) => f.startsWith(`${folder}/`)).sort();
      pages.push(...inside.filter((f) => f.endsWith('/README.md')), ...inside.filter((f) => !f.endsWith('/README.md')));
    }
    return { title: s.title, pages };
  });
  const listed = new Set([START, ...sections.flatMap((s) => s.pages)]);
  for (const f of listed) if (!(f in files)) throw new Error(`site/content/developers.json lists ${f}, which isn't in docs/`);
  for (const f of known) {
    if (f !== 'README.md' && !f.startsWith('user/') && !listed.has(f)) throw new Error(`docs/${f} isn't in site/content/developers.json`);
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

function contents(sections, titles, current, href) {
  const link = (file, label) => `<li><a href="${esc(href(file))}"${file === current ? ' aria-current="page"' : ''}>${esc(label)}</a></li>`;
  const folds = sections
    .map((s) => `<details${s.pages.includes(current) ? ' open' : ''}><summary>${esc(s.title)}</summary><ul>${s.pages.map((f) => link(f, titles.get(f))).join('')}</ul></details>`)
    .join('\n');
  return `<nav aria-label="Developer documents"><ul>${link(START, 'Start here')}</ul>\n${folds}</nav>`;
}

/** Hidden until the script runs, so a browser without scripts never shows a search that can't work. */
const searchForm = (root) => `<form class="search" role="search" data-root="${root}" hidden>
<label for="dev-search">Search the developer documents</label>
<input id="dev-search" type="search" autocomplete="off">
<p role="status"></p>
<ul></ul>
</form>`;

/**
 * Every file of the developer site, by its path in the website.
 * @param {object} input
 * @param {Record<string, string>} input.files the Markdown files of docs/, by their path in it
 * @param {{ sections: { title: string, pages?: string[], folders?: string[] }[] }} input.nav site/content/developers.json
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
    out[path] = layout({
      path,
      title: file === START ? 'Developers' : `${page.title} · Developers`,
      description: first.length > 155 ? `${first.slice(0, 152).replace(/\s+\S*$/, '')}…` : first.padEnd(20, '.'),
      body: renderBlocks(page.blocks, hrefOf),
      aside: `<div class="aside dev">\n${searchForm(root)}\n${contents(sections, titles, file, (f) => `${root}${pagePath(f)}`)}\n</div>\n`,
      head: `<script type="module" src="${root}search.js"></script>\n`,
    });
  }

  const index = [...pages].flatMap(([file, page]) => page.sections.map((s) => ({ page: page.title, heading: s.heading, path: pagePath(file), anchor: s.anchor, text: s.text })));
  out['developers/search-index.json'] = JSON.stringify(index);
  return out;
}
