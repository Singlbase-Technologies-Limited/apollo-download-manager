#!/usr/bin/env node
// `pnpm site:check` (#379): opens the built website (`pnpm site` first) in Microsoft Edge with Playwright, as GitHub Pages
// would serve it, and checks every page in sitemap.xml at phone, tablet and desktop widths: that it loads, stays light,
// shows the app's logo, and has no sideways scroll, broken image, broken link, console error or failed request. Then it
// tries the menu, the theme switch, the screen switcher, the FAQ and the search. `--shots <folder>` saves what it saw.
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

/* global document, getComputedStyle, NodeFilter, scrollY -- the callbacks given to page.evaluate run in the page */

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'site-out');
const BASE = '/apollo-download-manager/';
const PORT = 4179;
const WIDTHS = [
  ['phone', 375, 720],
  ['tablet', 820, 1100],
  ['desktop', 1440, 900],
];
/** The most lines a table cell may wrap to at desktop width (#422). */
const TABLE_LINES = 8;
/** Pages whose tables hold paragraphs, not values: CSS can't make them short, so #425 rewrites them. */
const TALL_TABLES = [
  'developers/ai-agent-account/',
  'developers/architecture/',
  'developers/ci/',
  'developers/contracts/',
  'developers/decisions/0013-sftp-russh/',
  'developers/dependencies/',
  'developers/engine-internals/',
  'developers/parity/',
  'developers/repository-settings/',
  'developers/research/2026-10-21-libcurl-engine-research-r2/',
  'developers/research/engine-prototype-results/',
  'developers/security/',
  'developers/testing/',
  'guide/settings/',
  'guide/troubleshooting/',
];
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.xml': 'application/xml' };
const at = process.argv.indexOf('--shots');
const shots = at > 0 ? process.argv[at + 1] : null;
if (shots) mkdirSync(shots, { recursive: true });
if (!existsSync(join(root, 'sitemap.xml'))) throw new Error('no site-out/: run `pnpm site` first');

const server = http
  .createServer((request, response) => {
    let url = decodeURIComponent((request.url ?? '').split('?')[0]);
    if (!url.startsWith(BASE)) {
      response.writeHead(404);
      response.end();
      return;
    }
    url = url.slice(BASE.length - 1);
    if (url.endsWith('/')) url += 'index.html';
    const file = join(root, url);
    if (!existsSync(file) || statSync(file).isDirectory()) {
      response.writeHead(404, { 'content-type': TYPES['.html'] });
      createReadStream(join(root, '404.html')).pipe(response);
      return;
    }
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  })
  .listen(PORT);

const origin = `http://localhost:${String(PORT)}`;
const routes = [...readFileSync(join(root, 'sitemap.xml'), 'utf8').matchAll(/<loc>[^<]*apollo-download-manager\/([^<]*)<\/loc>/g)].map((m) => m[1]);
const problems = [];
const problem = (where, what) => problems.push(`${where}: ${what}`);
const browser = await chromium.launch({ channel: 'msedge', headless: true });

/** A page that records its console errors and failed requests under `where`. */
async function open(context, route, where) {
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') problem(where, `console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problem(where, `script: ${e.message}`));
  page.on('requestfailed', (r) => problem(where, `failed: ${r.url()}`));
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().startsWith(origin)) problem(where, `${String(r.status())}: ${r.url()}`);
  });
  await page.goto(`${origin}${BASE}${route}`, { waitUntil: 'load' });
  return page;
}

const links = new Set();
for (const [name, width, height] of WIDTHS) {
  // A system set to dark must still open light: that is the point of the first check below.
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: 'dark' });
  for (const route of routes) {
    const where = `${name} /${route}`;
    const page = await open(context, route, where);
    const seen = await page.evaluate(async () => {
      for (const image of document.images) image.loading = 'eager';
      await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; }))));
      const logo = document.querySelector('.brand .logo-light');
      return {
        background: getComputedStyle(document.body).backgroundColor,
        theme: document.documentElement.dataset.theme ?? null,
        scroll: document.documentElement.scrollWidth,
        h1: document.querySelectorAll('h1').length,
        logo: logo?.getAttribute('src') ?? '',
        logoShown: logo ? logo.getBoundingClientRect().width > 0 : false,
        broken: [...document.images].filter((i) => i.getBoundingClientRect().width > 0 && i.naturalWidth === 0).map((i) => i.src),
        noAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).length,
        links: [...document.querySelectorAll('a[href]')].map((a) => a.href),
      };
    });
    if (seen.theme !== null || seen.background !== 'rgb(244, 246, 249)') problem(where, `not light: ${seen.background}`);
    if (seen.scroll > width) problem(where, `sideways scroll: ${String(seen.scroll)} px`);
    if (seen.h1 !== 1) problem(where, `${String(seen.h1)} h1 headings`);
    if (route === '' && (await page.locator('.stage img').evaluateAll((all) => all.filter((i) => i.getBoundingClientRect().height > 0).length)) !== 1) problem(where, 'the home page shows more than one screen at the top');
    if (!seen.logo.endsWith('logo-light.svg') || !seen.logoShown) problem(where, 'the logo is missing');
    for (const image of seen.broken) problem(where, `broken image: ${image}`);
    if (seen.noAlt) problem(where, `${String(seen.noAlt)} images without alt`);
    // Tables stay readable on a desktop (#422): no cell wraps into a tall, narrow column. The pages whose tables
    // hold paragraphs rather than values are listed in TALL_TABLES, for the content audit (#425).
    if (name === 'desktop' && !TALL_TABLES.includes(route)) {
      const tall = await page.evaluate((most) => {
        const found = [];
        for (const cell of document.querySelectorAll('.prose td, .prose th')) {
          const style = getComputedStyle(cell);
          const lines = Math.round((cell.getBoundingClientRect().height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)) / parseFloat(style.lineHeight));
          if (lines > most) found.push(`${String(lines)} lines: ${cell.textContent.trim().slice(0, 50)}`);
        }
        return found;
      }, TABLE_LINES);
      for (const t of tall.slice(0, 3)) problem(where, `a table cell wraps to ${t}`);
    }
    for (const link of seen.links) if (link.startsWith(origin)) links.add(link.split('#')[0]);
    if (shots && (route.split('/').length <= 2 || ['guide/torrents/', 'developers/testing/', 'developers/decisions/'].includes(route))) {
      await page.screenshot({ path: join(shots, `${name}-${route.replace(/\//g, '-') || 'home-'}page.png`), fullPage: true });
    }
    await page.close();
  }
  await context.close();
}

const check = await browser.newContext({ viewport: { width: 1440, height: 900 } });
for (const link of links) {
  const response = await check.request.get(link);
  if (!response.ok()) problem('links', `${String(response.status())}: ${link}`);
}

// The theme: dark only when chosen, and remembered on the next page.
{
  const page = await open(check, '', 'theme');
  await page.click('[data-theme-toggle]');
  if ((await page.getAttribute('html', 'data-theme')) !== 'dark') problem('theme', 'the switch did nothing');
  if ((await page.getAttribute('[data-theme-toggle]', 'aria-pressed')) !== 'true') problem('theme', 'the switch doesn’t say it is on');
  await page.goto(`${origin}${BASE}faq/`);
  if ((await page.getAttribute('html', 'data-theme')) !== 'dark') problem('theme', 'the choice wasn’t remembered');
  if (!(await page.locator('.brand .logo-dark').isVisible())) problem('theme', 'the dark logo isn’t shown');
  for (const [theme, shown, hidden] of [['dark', 'dark-only', 'light-only']]) {
    await page.goto(`${origin}${BASE}`, { waitUntil: 'load' });
    if (!(await page.locator(`.stage img.${shown}`).isVisible()) || (await page.locator(`.stage img.${hidden}`).isVisible())) problem('theme', `the ${theme} home page shows the wrong screen`);
  }
  if (shots) await page.screenshot({ path: join(shots, 'desktop-dark-faq.png') });
  await page.goto(`${origin}${BASE}`, { waitUntil: 'load' });
  if (shots) await page.screenshot({ path: join(shots, 'desktop-dark-home.png'), fullPage: true });
  await page.click('[data-theme-toggle]');
  await page.close();
}

// The screens on the home page, and an answer in the FAQ.
{
  const page = await open(check, '', 'screens');
  await page.click('label[for="screen-categories"]');
  if (!(await page.locator('.screen-categories img').isVisible())) problem('screens', 'choosing a screen didn’t show it');
  await page.close();
  const faq = await open(check, 'faq/', 'faq');
  await faq.locator('.question').first().click();
  if (!(await faq.locator('.answer p').first().isVisible())) problem('faq', 'an answer didn’t open');
  await faq.close();
}

// Both guides' searches (#355, #422): lined up with the documents list, a placeholder that says what to search,
// a result that opens the right page, by mouse and by keyboard alone, and "Nothing found." for no match.
for (const [route, id, query, target] of [
  ['developers/', 'dev-search', 'libtorrent bridge', '/developers/'],
  ['guide/', 'guide-search', 'seeding', '/guide/torrents/'],
]) {
  const where = `search /${route}`;
  const page = await open(check, route, where);
  const input = page.locator(`#${id}`);
  if (!(await input.isVisible())) {
    problem(where, 'no search box');
    await page.close();
    continue;
  }
  if (!(await input.getAttribute('placeholder'))) problem(where, 'the search box has no placeholder');
  // One text edge down the side: the search's label, what is typed in the box, and the documents list's links.
  const edges = await page.evaluate((id) => {
    const textStart = (el) => el.getBoundingClientRect().left + parseFloat(getComputedStyle(el).borderLeftWidth) + parseFloat(getComputedStyle(el).paddingLeft);
    const link = [...document.querySelectorAll('.docs-side a')].find((a) => !a.closest('.search'));
    return { label: textStart(document.querySelector(`label[for="${id}"]`)), input: textStart(document.getElementById(id)), links: textStart(link) };
  }, id);
  for (const [what, x] of [['label', edges.label], ['typed text', edges.input]]) {
    if (Math.abs(x - edges.links) > 1) problem(where, `the search's ${what} starts at ${x.toFixed(1)} px, the documents list's text at ${edges.links.toFixed(1)} px`);
  }
  await input.fill(query);
  await page.waitForSelector('.search ul li');
  await page.locator('.search ul li a').first().click();
  await page.waitForLoadState();
  if (!page.url().includes(target)) problem(where, `"${query}" went to ${page.url()}, not ${target}`);
  // By keyboard alone: focus the box, type, Tab to the first result, Enter.
  await page.goto(`${origin}${BASE}${route}`);
  await page.focus(`#${id}`);
  await page.keyboard.type(query);
  await page.waitForSelector('.search ul li');
  await page.keyboard.press('Tab');
  await Promise.all([page.waitForURL((u) => !u.pathname.endsWith(`/${route}`) || u.hash !== ''), page.keyboard.press('Enter')]);
  if (!page.url().includes(target)) problem(where, `by keyboard, "${query}" went to ${page.url()}`);
  await page.goto(`${origin}${BASE}${route}`);
  await page.fill(`#${id}`, 'zzzznothing');
  await page.waitForFunction(() => document.querySelector('.search p')?.textContent === 'Nothing found.');
  await page.close();
}

// A page's previous and next links.
{
  const page = await open(check, 'guide/installing/', 'pager');
  await page.click('.pager a[rel="next"]');
  await page.waitForLoadState();
  if (!page.url().endsWith('/guide/downloads/')) problem('pager', `next went to ${page.url()}`);
  await page.close();
}
await check.close();

// The menus on a phone, by keyboard as well as by touch.
{
  const phone = await browser.newContext({ viewport: { width: 375, height: 720 } });
  const page = await open(phone, 'guide/torrents/', 'phone menus');
  if (await page.locator('.bar nav').isVisible()) problem('phone menus', 'the menu starts open');
  await page.click('.menu-button');
  if (!(await page.locator('.bar nav a').first().isVisible())) problem('phone menus', 'the menu didn’t open');
  if (await page.locator('.docs-side').isVisible()) problem('phone menus', 'the documents start open');
  await page.click('.docs-button');
  if (!(await page.locator('.docs-side a').first().isVisible())) problem('phone menus', 'the documents didn’t open');
  if (shots) await page.screenshot({ path: join(shots, 'phone-menus-open.png') });
  await page.close();
  await phone.close();
}

// Contrast (#353, docs/ACCESSIBILITY.md): every visible piece of text reaches 4.5:1 on what's behind it, or 3:1 when
// large, on every page in both themes.
for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (theme === 'dark') await context.addInitScript(() => localStorage.setItem('theme', 'dark'));
  for (const route of routes) {
    const page = await open(context, route, `contrast ${theme} /${route}`);
    const low = await page.evaluate(() => {
      const rgb = (c) => (c.match(/[\d.]+/g) ?? []).map(Number);
      const lum = ([r, g, b]) => {
        const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const behind = (el) => {
        for (let e = el; e; e = e.parentElement) {
          const c = rgb(getComputedStyle(e).backgroundColor);
          if (c.length === 3 || (c.length === 4 && c[3] > 0.5)) return c.slice(0, 3);
        }
        return [255, 255, 255];
      };
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || !n.textContent.trim() || el.closest('.skip, [hidden], svg')) continue;
        const box = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (box.width === 0 || style.visibility === 'hidden' || style.display === 'none') continue;
        const a = lum(rgb(style.color).slice(0, 3));
        const b = lum(behind(el));
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        const size = parseFloat(style.fontSize);
        const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
        if (ratio < (large ? 3 : 4.5)) out.push(`${ratio.toFixed(2)}: ${n.textContent.trim().slice(0, 40)}`);
      }
      return [...new Set(out)].slice(0, 3);
    });
    for (const l of low) problem(`contrast ${theme} /${route}`, l);
    await page.close();
  }
  await context.close();
}

// The keyboard (#353): Tab starts at the skip link, reaches every link and button on the home page, and shows where it is.
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await open(context, '', 'keyboard');
  const wanted = await page.evaluate(() => [...document.querySelectorAll('a[href], button:not([hidden]), input')].filter((e) => e.getBoundingClientRect().width > 0 || e.matches('input[type=radio]')).length);
  const seen = new Set();
  for (let i = 0; i < wanted + 10; i++) {
    await page.keyboard.press('Tab');
    const at = await page.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const s = getComputedStyle(e);
      const shown = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
      const box = e.getBoundingClientRect();
      return { key: `${e.tagName}${e.id}${e.getAttribute('href') ?? ''}${e.className}${Math.round(box.top + scrollY)}`, shown, skip: e.classList.contains('skip'), radio: e.matches('input[type=radio]') };
    });
    if (!at) continue;
    if (i === 0 && !at.skip) problem('keyboard', 'Tab doesn’t start at the skip link');
    if (!at.shown && !at.radio) problem('keyboard', `no focus outline on ${at.key.slice(0, 60)}`);
    seen.add(at.key);
  }
  if (seen.size < 20) problem('keyboard', `Tab reached only ${String(seen.size)} things`);
  await context.close();
}

// A page that doesn't exist.
{
  const context = await browser.newContext();
  const page = await context.newPage();
  const response = await page.goto(`${origin}${BASE}no-such-page/`);
  if (response?.status() !== 404 || !(await page.textContent('h1'))?.includes('Page not found')) problem('404', 'no 404 page');
  await context.close();
}

await browser.close();
server.close();
const seen = routes.length * WIDTHS.length;
console.log(`site:check: ${String(routes.length)} pages at ${String(WIDTHS.length)} widths (${String(seen)} views), ${String(links.size)} links, ${String(problems.length)} problem(s).`);
for (const p of [...new Set(problems)].slice(0, 60)) console.log(`- ${p}`);
process.exit(problems.length ? 1 : 0);
