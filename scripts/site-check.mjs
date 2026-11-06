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

/* global document, getComputedStyle -- the callbacks given to page.evaluate run in the page */

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'site-out');
const BASE = '/apollo-download-manager/';
const PORT = 4179;
const WIDTHS = [
  ['phone', 375, 720],
  ['tablet', 820, 1100],
  ['desktop', 1440, 900],
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

// The developer search, and following a result.
{
  const page = await open(check, 'developers/', 'search');
  await page.fill('#dev-search', 'libtorrent bridge');
  await page.waitForSelector('.search ul li');
  await page.locator('.search ul li a').first().click();
  await page.waitForLoadState();
  if (!page.url().includes('/developers/')) problem('search', `a result went to ${page.url()}`);
  await page.goto(`${origin}${BASE}developers/`);
  await page.fill('#dev-search', 'zzzznothing');
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
