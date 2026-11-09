import { describe, expect, it } from 'vitest';
import { search, snippet } from '../site/developers/search.js';
import { buildDevSite, pagePath } from './dev-site-lib.mjs';
import { buildSite, renderBlocks, siteFiles } from './site-lib.mjs';

const layout = ({ path, title, body, aside, head }) => `<title>${title}</title>${head ?? ''}${aside ?? ''}<main data-path="${path}">${body}</main>`;
const nav = { sections: [{ title: 'Architecture', pages: ['ARCHITECTURE.md'] }, { title: 'Decisions', folders: ['decisions'] }] };
const files = {
  'START_HERE.md': '# Start here\n\nRead [the architecture](ARCHITECTURE.md#the-parts).\n',
  'ARCHITECTURE.md': '# Architecture\n\n## The parts\n\nThe manager, see [the rules](../AGENTS.md), [a crate](../crates/velocity-core/) and [the guide](user/torrents.md#seeding).\n',
  'decisions/README.md': '# Decisions\n\nSee [the first](0001-first.md).\n',
  'decisions/0001-first.md': '# ADR-0001\n\nBack to [the architecture](../ARCHITECTURE.md) or [the list](./).\n',
  'README.md': '# Documentation map\n',
  'user/torrents.md': '# Torrents\n',
};
const build = (over = {}, n = nav) => buildDevSite({ files: { ...files, ...over }, nav: n, layout, renderBlocks, repo: 'https://github.com/o/r' });

describe('the developer site (#355)', () => {
  it('gives each document its address', () => {
    expect(pagePath('START_HERE.md')).toBe('');
    expect(pagePath('ENGINE_CONTRACT.md')).toBe('engine-contract/');
    expect(pagePath('decisions/README.md')).toBe('decisions/');
    expect(pagePath('decisions/0001-first.md')).toBe('decisions/0001-first/');
  });

  it('builds a page from each document, opening on Start here', () => {
    const out = build();
    expect(Object.keys(out).filter((p) => p.endsWith('.html')).sort()).toEqual([
      'developers/architecture/index.html',
      'developers/decisions/0001-first/index.html',
      'developers/decisions/index.html',
      'developers/index.html',
    ]);
    expect(out['developers/index.html']).toContain('<h1 id="start-here">Start here</h1>');
  });

  it('keeps the links between documents working on the site', () => {
    const out = build();
    expect(out['developers/index.html']).toContain('href="../developers/architecture/#the-parts"');
    expect(out['developers/decisions/0001-first/index.html']).toContain('href="../../../developers/architecture/"');
    expect(out['developers/decisions/0001-first/index.html']).toContain('href="../../../developers/decisions/"');
  });

  it('sends a link outside the documents to GitHub, and one to a user guide to that guide', () => {
    const page = build()['developers/architecture/index.html'];
    expect(page).toContain('href="https://github.com/o/r/blob/main/AGENTS.md"');
    expect(page).toContain('href="https://github.com/o/r/blob/main/crates/velocity-core/"');
    expect(page).toContain('href="../../guide/torrents/#seeding"');
  });

  it('fails the build on a link to a heading that doesn’t exist', () => {
    expect(() => build({ 'START_HERE.md': '# Start here\n\n[x](ARCHITECTURE.md#nothing)\n' })).toThrow(/START_HERE\.md.*#nothing/);
  });

  it('fails the build on a document missing from the contents, or contents with no document', () => {
    expect(() => build({ 'NEW.md': '# New\n' })).toThrow(/NEW\.md/);
    expect(() => build({}, { sections: [...nav.sections, { title: 'Gone', pages: ['GONE.md'] }] })).toThrow(/GONE\.md/);
  });

  it('lists the sections in order, with the open page’s section unfolded', () => {
    const page = build()['developers/decisions/0001-first/index.html'];
    expect(page.indexOf('<summary>Architecture</summary>')).toBeLessThan(page.indexOf('<summary>Decisions</summary>'));
    expect(page).toContain('<details open><summary>Decisions</summary>');
    expect(page).toContain('<details><summary>Architecture</summary>');
    expect(page).toMatch(/aria-current="page">ADR-0001/);
  });

  it('shows a document’s own images, and refuses one from another site', () => {
    const shown = build({ 'ARCHITECTURE.md': '# Architecture\n\n## The parts\n\n![The shell](images/a.png)\n' });
    expect(shown['developers/architecture/index.html']).toContain('<img src="../images/a.png" alt="The shell" loading="lazy">');
    expect(() => build({ 'ARCHITECTURE.md': '# Architecture\n\n## The parts\n\n![x](https://example.org/a.png)\n' })).toThrow(/image/);
  });

  it('shows text such as <Name> as text, never as markup', () => {
    const shown = build({ 'ARCHITECTURE.md': '# Architecture\n\n## The parts\n\nThe "<Name> Download Manager" names.\n' });
    expect(shown['developers/architecture/index.html']).toContain('&lt;Name&gt; Download Manager');
  });

  it('indexes every heading of every page for the search', () => {
    const index = JSON.parse(build()['developers/search-index.json']);
    expect(index).toContainEqual(expect.objectContaining({ page: 'Architecture', heading: 'The parts', path: 'architecture/', anchor: 'the-parts' }));
    expect(index.map((e) => e.page)).toEqual(expect.arrayContaining(['Start here', 'Decisions', 'ADR-0001']));
  });
});

describe('the developer site’s search (#355)', () => {
  const index = [
    { page: 'Testing', heading: 'Levels', path: 'testing/', anchor: 'levels', text: 'The range scheduler has its own fixtures.' },
    { page: 'Engine', heading: 'Range scheduler', path: 'engine/', anchor: 'range-scheduler', text: 'Splits a file.' },
    { page: 'Other', heading: 'Nothing', path: 'other/', anchor: 'nothing', text: 'About ranges of colour.' },
  ];

  it('finds pages holding every word, best match first, ignoring case', () => {
    expect(search(index, 'RANGE scheduler').map((e) => e.path)).toEqual(['engine/', 'testing/']);
  });

  it('finds nothing for an empty search, and limits how many it shows', () => {
    expect(search(index, '   ')).toEqual([]);
    expect(search(index, 'range', 1)).toHaveLength(1);
  });

  it('quotes the text around the first word found', () => {
    const text = `${'a '.repeat(100)}the needle is here ${'b '.repeat(100)}`;
    expect(snippet(text, 'needle')).toContain('the needle is here');
    expect(snippet(text, 'needle').length).toBeLessThan(170);
  });
});

describe('the developer site, built from docs/ (#355)', () => {
  const site = buildSite({ releases: null });

  it('has the issue’s sections, in order, and every document', () => {
    const sections = [...site['developers/index.html'].matchAll(/<summary>([^<]+)<\/summary>/g)].map((m) => m[1]);
    expect(sections).toHaveLength(10);
    expect(sections[0]).toMatch(/^Architecture/);
    expect(sections[9]).toMatch(/^Decisions/);
    for (const p of ['developers/architecture/index.html', 'developers/repository-map/index.html', 'developers/decisions/0001-v2-direction/index.html']) {
      expect(Object.keys(site)).toContain(p);
    }
  });

  it('links to the developer site from the product pages', () => {
    expect(site['index.html']).toMatch(/<a href="[^"]*developers\/">Developers<\/a>/);
  });

  it('loads only its own scripts: the theme everywhere, and the search on developer and user guide pages (#379, #422)', () => {
    for (const [path, body] of Object.entries(site)) {
      if (!path.endsWith('.html')) continue;
      const scripts = body.match(/<script\b[^>]*>/gi) ?? [];
      expect(scripts[0], path).toMatch(/^<script src="(\.\/|(\.\.\/)+)theme\.js">$/);
      if (path.startsWith('developers/') || path.startsWith('guide/')) {
        expect(scripts, path).toHaveLength(2);
        expect(scripts[1], path).toMatch(/^<script type="module" src="(\.\/|(\.\.\/)+)search\.js">$/);
      } else {
        expect(scripts, path).toHaveLength(1);
      }
    }
    expect(site['developers/search.js']).toBeDefined();
    expect(site['guide/search.js']).toBe(site['developers/search.js']);
  });

  it('lets the user guide be searched with the same search, over its own pages only (#422)', () => {
    const index = JSON.parse(site['guide/search-index.json']);
    expect(search(index, 'seeding')[0].path).toBe('torrents/');
    expect(search(index, 'magnet').map((e) => e.path)).toContain('torrents/');
    expect(index.every((e) => !e.path.startsWith('developers'))).toBe(true);
    expect(site['guide/torrents/index.html']).toMatch(/<input id="guide-search" type="search" placeholder="[^"]+"/);
    expect(site['developers/index.html']).toMatch(/<input id="dev-search" type="search" placeholder="[^"]+"/);
  });

  it('has the file of every image a developer page shows', () => {
    const page = site['developers/development/index.html'];
    const shown = [...page.matchAll(/<img src="\.\.\/(images\/[^"]+)"/g)].map((m) => m[1]);
    expect(shown.length).toBeGreaterThan(0);
    const files = siteFiles().map((f) => f.to);
    for (const src of shown) expect(files).toContain(`developers/${src}`);
  });

  it('finds a term from any page', () => {
    const index = JSON.parse(site['developers/search-index.json']);
    expect(search(index, 'libtorrent bridge').length).toBeGreaterThan(0);
    expect(new Set(index.map((e) => e.path)).size).toBeGreaterThan(50);
  });
});
