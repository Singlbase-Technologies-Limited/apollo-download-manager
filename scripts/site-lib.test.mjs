import { existsSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSite, pickDownloads, renderBlocks, siteFiles, SITE_URL } from './site-lib.mjs';

const release = (over = {}) => ({
  tag_name: 'v0.2.0',
  name: 'Apollo Download Manager 0.2.0',
  prerelease: false,
  draft: false,
  published_at: '2026-11-20T10:00:00Z',
  html_url: 'https://github.com/Singlbase-Technologies-Limited/apollo-download-manager/releases/tag/v0.2.0',
  assets: [
    { name: 'apollo-download-manager-0.2.0-windows-x64-setup.exe', size: 31_000_000, browser_download_url: 'https://github.com/x/releases/download/v0.2.0/apollo-download-manager-0.2.0-windows-x64-setup.exe' },
    { name: 'apollo-download-manager-0.2.0-linux-amd64.deb', size: 21_000_000, browser_download_url: 'https://github.com/x/releases/download/v0.2.0/apollo-download-manager-0.2.0-linux-amd64.deb' },
    { name: 'apollo-download-manager-0.2.0-linux-x86_64.rpm', size: 22_000_000, browser_download_url: 'https://github.com/x/releases/download/v0.2.0/apollo-download-manager-0.2.0-linux-x86_64.rpm' },
    { name: 'SHA256SUMS', size: 400, browser_download_url: 'https://github.com/x/releases/download/v0.2.0/SHA256SUMS' },
    { name: 'build-info.json', size: 900, browser_download_url: 'https://github.com/x/releases/download/v0.2.0/build-info.json' },
  ],
  ...over,
});

describe('the website (#353)', () => {
  it('escapes everything a guide says, so no text becomes markup', () => {
    const html = renderBlocks([{ type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script> & "q"' }, { type: 'code', text: '<b>' }] }], () => '');
    expect(html).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;q&quot;<code>&lt;b&gt;</code></p>');
  });

  it('turns guide links into links between the site’s pages', () => {
    const html = renderBlocks(
      [{ type: 'paragraph', content: [{ type: 'link', to: { page: 'torrents', anchor: 'seeding' }, content: [{ type: 'text', text: 'seeding' }] }, { type: 'link', to: { url: 'https://example.org/a?b=1&c=2' }, content: [{ type: 'text', text: 'site' }] }] }],
      (to) => `../${to.page}/`,
    );
    expect(html).toBe('<p><a href="../torrents/#seeding">seeding</a><a href="https://example.org/a?b=1&amp;c=2" rel="noopener">site</a></p>');
  });

  it('picks the newest release’s downloads, labelling a pre-release', () => {
    const older = release({ tag_name: 'v0.1.1', published_at: '2026-11-04T10:00:00Z', prerelease: true });
    const d = pickDownloads([older, release({ draft: true, tag_name: 'v0.3.0', published_at: '2026-12-01T10:00:00Z' }), release()]);
    expect(d).toMatchObject({ version: '0.2.0', prerelease: false, date: '2026-11-20' });
    expect(d.files.map((f) => f.kind)).toEqual(['windows', 'deb', 'rpm']);
    expect(d.checksums).toMatch(/SHA256SUMS$/);
    expect(pickDownloads([older])).toMatchObject({ version: '0.1.1', prerelease: true });
    expect(pickDownloads([])).toBeNull();
  });

  it('builds every page with its title, description, canonical address and sharing tags, and nothing from elsewhere', () => {
    const site = buildSite({ releases: [release()] });
    const paths = Object.keys(site);
    for (const p of ['index.html', 'download/index.html', 'guide/index.html', 'guide/downloads/index.html', 'faq/index.html', 'support/index.html', 'privacy/index.html', 'licence/index.html', '404.html', 'sitemap.xml', 'robots.txt', 'style.css']) {
      expect(paths).toContain(p);
    }
    for (const [path, body] of Object.entries(site)) {
      if (!path.endsWith('.html')) continue;
      expect(body, path).toMatch(/<title>[^<]+ · Apollo Download Manager<\/title>|<title>Apollo Download Manager<\/title>/);
      expect(body, path).toMatch(/<meta name="description" content="[^"]{20,}">/);
      expect(body, path).toMatch(/<meta property="og:title" content="[^"]+">/);
      if (path !== '404.html') expect(body, path).toContain(`<link rel="canonical" href="${SITE_URL}`);
      // The canonical address is the page's own; nothing else is loaded from anywhere.
      // The site's own scripts are checked in dev-site-lib.test.mjs: nothing else may load.
      const page = body.replace(/<script src="[./]*theme\.js"><\/script>/, '').replace(/<script type="module" src="[./]*search\.js"><\/script>/, '');
      expect(page, path).not.toMatch(/<script|<iframe|fonts\.googleapis|<link(?![^>]*rel="canonical")[^>]+href="https?:|<img[^>]+src="https?:/i);
      expect(body, path).toMatch(/<a class="skip" href="#main">/);
    }
  });

  it('lists the Windows and Linux downloads, and no other system (PO decision on #379)', () => {
    const page = buildSite({ releases: [release()] })['download/index.html'];
    expect(page).toContain('apollo-download-manager-0.2.0-windows-x64-setup.exe');
    expect(page).toContain('apollo-download-manager-0.2.0-linux-amd64.deb');
    expect(page).not.toMatch(/macOS/);
  });

  it('says where to look when no release is known at build time', () => {
    const page = buildSite({ releases: null })['download/index.html'];
    expect(page).toContain('https://github.com/Singlbase-Technologies-Limited/apollo-download-manager/releases');
  });

  it('lists every page in the sitemap at its full address', () => {
    const site = buildSite({ releases: [release()] });
    const pages = Object.keys(site).filter((p) => p.endsWith('index.html'));
    for (const p of pages) expect(site['sitemap.xml']).toContain(`<loc>${SITE_URL}${p.replace(/index\.html$/, '')}</loc>`);
    expect(site['robots.txt']).toContain(`Sitemap: ${SITE_URL}sitemap.xml`);
  });

  it('has no broken link between its pages, nor to a heading', () => {
    const site = buildSite({ releases: [release()] });
    // Files the build copies as they are (the icon, the font, the screens), beside the pages it makes.
    const copied = new Set(siteFiles().map((f) => f.to));
    const broken = [];
    for (const [path, body] of Object.entries(site)) {
      if (!path.endsWith('.html')) continue;
      for (const [, href] of body.matchAll(/ href="([^"]+)"/g)) {
        if (/^(https?:|mailto:)/.test(href) || href === '#main') continue;
        const [target, anchor] = href.split('#');
        let file = posix.normalize(posix.join(posix.dirname(path), target || posix.basename(path))).replace(/^\.\/?/, '');
        if (file === '' || file.endsWith('/')) file = `${file}index.html`;
        else if (!file.includes('.')) file = `${file}/index.html`;
        if (!(file in site) && !copied.has(file)) broken.push(`${path}: ${href}`);
        else if (anchor && file.endsWith('.html') && !site[file].includes(` id="${anchor}"`)) broken.push(`${path}: ${href} (no heading)`);
      }
    }
    expect(broken).toEqual([]);
  });
});

describe('the website shows the real app (#353)', () => {
  const site = buildSite({ releases: [release()] });
  const images = (html) => [...html.matchAll(/<img\b[^>]*>/g)].map(([tag]) => tag);

  it('opens the home page with what it is, the download and the app', () => {
    const home = site['index.html'];
    expect(home).toMatch(/<h1[^>]*>A free download manager for Windows and Linux<\/h1>/);
    expect(home.indexOf('class="button large"')).toBeGreaterThan(0);
    expect(home.indexOf('class="button large"')).toBeLessThan(home.indexOf('screens/downloads.webp'));
    expect(home).toContain('The real app, with example downloads.');
  });

  it('lets a visitor switch between the screens with no script, each one labelled', () => {
    const home = site['index.html'];
    const choices = [...home.matchAll(/<input type="radio" name="screen" id="screen-([a-z-]+)"/g)].map((m) => m[1]);
    expect(choices.length).toBeGreaterThanOrEqual(8);
    for (const id of choices) {
      expect(home).toContain(`<label for="screen-${id}">`);
      expect(home).toContain(`class="screen screen-${id}"`);
      expect(site['style.css']).toContain(`#screen-${id}:checked`);
    }
    expect(home.match(/<input type="radio"[^>]* checked>/g)).toHaveLength(1);
    expect(home).toContain('id="screen-details" checked');
  });

  it('has a Features page in the navigation, with a screen for every feature', () => {
    const page = site['features/index.html'];
    expect(site['index.html']).toMatch(/<a href="[^"]*features\/">Features<\/a>/);
    const features = page.match(/<section class="feature"/g) ?? [];
    expect(features.length).toBeGreaterThanOrEqual(5);
    expect(images(page.slice(page.indexOf('<main'))).length).toBeGreaterThanOrEqual(features.length);
    expect(page).toContain('screens/schedule.webp');
  });

  it('shows the screen a guide section describes, right under its heading', () => {
    expect(site['guide/downloads/index.html']).toMatch(/id="adding-downloads">[^<]*<\/h2>\s*<figure[^>]*><img[^>]+screens\/add\.webp/);
    expect(site['guide/categories/index.html']).toContain('screens/categories.webp');
  });

  it('describes every screen, gives it a size, and has its file', () => {
    const files = siteFiles().map((f) => f.to);
    for (const [path, body] of Object.entries(site)) {
      if (!path.endsWith('.html')) continue;
      for (const tag of images(body)) {
        if (!tag.includes('screens/')) continue;
        expect(tag, path).toMatch(/ alt="[^"]{15,}"/);
        expect(tag, path).toMatch(/ width="\d+" height="\d+"/);
        expect(files, path).toContain(/screens\/[a-z-]+\.webp/.exec(tag)[0]);
      }
    }
  });

  it('serves its font itself, with the font’s licence', () => {
    expect(site['style.css']).toMatch(/@font-face\s*{[^}]*url\("fonts\/inter-latin-wght-normal\.woff2"\)/);
    expect(site['style.css']).not.toMatch(/url\(["']?https?:/);
    const files = siteFiles();
    expect(files.map((f) => f.to)).toEqual(expect.arrayContaining(['fonts/inter-latin-wght-normal.woff2', 'fonts/LICENSE.txt']));
    for (const f of files) expect(existsSync(f.from), f.from).toBe(true);
  });

  it('shows the logo of the app’s loading screen and Get started, for each theme (#379)', () => {
    const app = readFileSync(new URL('../src/components/BrandLogo.tsx', import.meta.url), 'utf8');
    const shapes = (text) => [...text.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
    expect(shapes(site['logo-light.svg'])).toEqual(shapes(app));
    expect(shapes(site['logo-dark.svg'])).toEqual(shapes(app));
    expect(site['logo-light.svg']).toContain('fill="#1659B3"');
    expect(site['logo-dark.svg']).toContain('fill="#2F80E4"');
    expect(site['logo-light.svg']).not.toMatch(/className|\{/);
    expect(site['index.html']).toMatch(/<a class="brand"[^>]*><img class="logo-light" src="\.\/logo-light\.svg"/);
  });

  it('opens light whatever the system prefers, with the app’s colours (#379)', () => {
    const css = site['style.css'];
    expect(css).not.toMatch(/prefers-color-scheme/);
    const tokens = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
    for (const token of ['--bg', '--surface', '--border', '--fg', '--accent', '--accent-strong', '--frame']) {
      const value = (text) => new RegExp(`${token}:\\s*(#[0-9a-f]{6})`).exec(text)?.[1];
      expect(value(css), token).toBe(value(tokens));
    }
    expect(site['theme.js']).toMatch(/read\(\) === 'dark'/);
  });

  it('gives a long document its contents, and previous and next links (#379)', () => {
    const page = site['guide/torrents/index.html'];
    expect(page).toMatch(/<nav class="toc" aria-label="On this page">/);
    expect(page).toMatch(/<a rel="prev" href="\.\.\/\.\.\/guide\/downloads\/">/);
    expect(page).toMatch(/<a rel="next" href="\.\.\/\.\.\/guide\/categories\/">/);
    expect(page).toContain('aria-current="page">Torrents');
  });

  it('keeps every address the site had', () => {
    for (const p of ['features', 'download', 'guide', 'guide/downloads', 'guide/protocols', 'guide/torrents', 'guide/categories', 'guide/settings', 'guide/browser', 'guide/troubleshooting', 'guide/installing', 'guide/v1-and-v2', 'faq', 'support', 'privacy', 'licence', 'developers']) {
      expect(Object.keys(site)).toContain(`${p}/index.html`);
    }
  });

  it('says several connections only of HTTP and HTTPS', () => {
    const text = site['index.html'].replace(/<[^>]+>/g, ' ');
    for (const [, sentence] of text.matchAll(/([^.]*several connections[^.]*\.)/gi)) expect(sentence).toMatch(/HTTP and HTTPS/);
  });
});
