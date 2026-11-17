// The layout checks in a real Chromium (L4, V1's tests/e2e/layout): the window runs against the mocked IPC in
// harness.tsx, served by Vite's dev server, so no desktop shell or engine is needed. Usage:
//   pnpm test:e2e:layout [-- --shots <dir>]
// The browser comes from `pnpm exec playwright install chromium` (docs/TESTING.md), or CHROMIUM_PATH.
import { chromium } from '@playwright/test';
import { mkdirSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';

const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const SHOTS = opt('--shots', null);
const PORT = Number(opt('--port', '15873'));
const BASE = `http://127.0.0.1:${String(PORT)}/tests/e2e/layout/harness.html`;
const failedRequests = [];

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};

// Vite's dev server in this process. node_modules may be a link (in a worktree), so its real place is allowed too.
const vite = await createServer({
  root,
  configFile: join(root, 'vite.config.ts'),
  logLevel: 'warn',
  server: { port: PORT, strictPort: true, host: '127.0.0.1', fs: { allow: [root, realpathSync(join(root, 'node_modules'))] } },
});
await vite.listen();

const executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(executablePath ? { executablePath } : {});

async function open(page, query = '') {
  await page.goto(`${BASE}?${query}`);
  await page.getByRole('grid', { name: 'Downloads' }).waitFor();
  await page.getByText('archive.zip').first().waitFor();
}

async function shot(page, name) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

const row = (page, text) => page.getByRole('grid', { name: 'Downloads' }).getByRole('row').filter({ hasText: text }).first();

async function newPage(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) failedRequests.push(`${String(r.status())} ${r.url()}`);
  });
  page.on('pageerror', (e) => { failedRequests.push(`page error: ${e.message}`); });
  return { ctx, page };
}

async function screenshots() {
  for (const theme of ['light', 'dark']) {
    for (const [label, w, h] of [
      ['laptop-1366x768', 1366, 768],
      ['wide-1920x1080', 1920, 1080],
      ['min-960x600', 960, 600],
    ]) {
      const { ctx, page } = await newPage(w, h);
      await open(page, `fresh=1&theme=${theme}`);
      await row(page, 'archive.zip').click();
      await shot(page, `${label}-${theme}-list`);
      await ctx.close();
    }
  }
}

// Hovering a row (#424): a cut-off name in full, and what a failed download's status means, in the window's tooltip.
async function hoverHelp() {
  for (const theme of ['light', 'dark']) {
    for (const [label, w, h] of [
      ['laptop-1366x768', 1366, 768],
      ['wide-1920x1080', 1920, 1080],
    ]) {
      const { ctx, page } = await newPage(w, h);
      await open(page, `fresh=1&theme=${theme}`);
      const name = row(page, 'Ubuntu-24.04.1').getByText(/^Ubuntu-24\.04\.1-desktop/);
      await name.hover();
      const tip = page.getByRole('tooltip').first();
      await tip.waitFor({ timeout: 3000 }).catch(() => undefined);
      const shown = (await tip.textContent().catch(() => '')) ?? '';
      check(`hover ${label} ${theme}: a cut-off name shows in full`, shown.includes('beyond-the-column-width.iso'), shown.slice(0, 60));
      await shot(page, `${label}-${theme}-hover-name`);
      // Away and onto the status as a mouse moves, in steps: Radix keeps a closing tooltip's "pointer in transit"
      // until the next move, so a single jump would land on the status while it still thinks so.
      await page.mouse.move(0, 0, { steps: 5 });
      await page.waitForTimeout(300);
      const badge = await row(page, 'broken-download-with-a-long-name').getByText('Failed').boundingBox();
      if (badge) await page.mouse.move(badge.x + badge.width / 2, badge.y + badge.height / 2, { steps: 10 });
      const status = page.getByRole('tooltip').first();
      await status.waitFor({ timeout: 3000 }).catch(() => undefined);
      const said = (await status.textContent().catch(() => '')) ?? '';
      check(`hover ${label} ${theme}: a failed status says what to do`, said.includes('Retry'), said.slice(0, 60));
      await shot(page, `${label}-${theme}-hover-status`);
      // By keyboard: Home reaches the long name's row, and its cut-off name shows without a hover.
      await page.mouse.move(0, 0, { steps: 5 });
      await page.getByRole('grid', { name: 'Downloads' }).focus();
      await page.keyboard.press('Home');
      const byKey = page.getByRole('tooltip').filter({ hasText: 'beyond-the-column-width.iso' }).first();
      const keyShown = await byKey.waitFor({ timeout: 3000 }).then(() => true, () => false);
      check(`keyboard ${label} ${theme}: a cut-off name shows in full on its row`, keyShown);
      await shot(page, `${label}-${theme}-keyboard-name`);
      await ctx.close();
    }
  }
}

// The user guide (#488): the website's four groups in the sidebar, each a labelled list, every entry on one line.
async function guideSidebar() {
  for (const theme of ['light', 'dark']) {
    for (const [label, w, h] of [
      ['laptop-1366x768', 1366, 768],
      ['min-960x600', 960, 600],
    ]) {
      const { ctx, page } = await newPage(w, h);
      await open(page, `fresh=1&theme=${theme}`);
      await page.getByRole('button', { name: 'Help' }).click();
      await page.getByRole('menuitem', { name: 'User guide' }).click();
      const contents = page.getByRole('dialog', { name: 'User guide' }).getByRole('navigation', { name: 'Guide contents' });
      await contents.waitFor();
      const groups = [];
      for (const name of ['Getting started', 'Using the app', 'Reference', 'Help']) groups.push(await contents.getByRole('list', { name }).count());
      check(`guide ${label} ${theme}: the sidebar has the website's four groups`, groups.every((n) => n === 1), groups.join(','));
      const shape = await contents.evaluate((nav) => ({
        wrapped: [...nav.querySelectorAll('li > button, ul[aria-labelledby] ~ p, p[id^="guide-group-"]')]
          .filter((e) => e.getBoundingClientRect().height > parseFloat(getComputedStyle(e).lineHeight) * 1.5 + parseFloat(getComputedStyle(e).paddingTop) + parseFloat(getComputedStyle(e).paddingBottom))
          .map((e) => e.textContent),
        sideways: nav.scrollWidth > nav.clientWidth,
      }));
      check(`guide ${label} ${theme}: no sidebar entry wraps`, shape.wrapped.length === 0, shape.wrapped.slice(0, 3).join(', '));
      check(`guide ${label} ${theme}: the sidebar doesn't scroll sideways`, !shape.sideways);
      await shot(page, `${label}-${theme}-guide`);
      await ctx.close();
    }
  }
}

// The guide after Get started (#463): at each of its 6 steps, the bubble is inside the window and the lit area is on
// the step's control, at the narrowest window (the sidebar a rail) and a wide one, and with the sidebar hidden, which
// the guide shows while it runs (PO decision).
async function tourChecks() {
  for (const theme of ['light', 'dark']) {
    for (const [label, w, h, sidebar] of [
      ['min-960x600', 960, 600, 'full'],
      ['laptop-1366x768-rail', 1366, 768, 'rail'],
      ['laptop-1366x768-hidden', 1366, 768, 'hidden'],
    ]) {
      const { ctx, page } = await newPage(w, h);
      await open(page, `fresh=1&theme=${theme}&guide=unseen&sidebar=${sidebar}`);
      await page.getByRole('button', { name: 'Show me around' }).click();
      const problems = [];
      for (let step = 1; step <= 6; step += 1) {
        const dialog = page.getByRole('dialog').filter({ hasText: `Step ${String(step)} of 6` });
        await dialog.waitFor();
        await page.waitForTimeout(350);
        const shape = await page.evaluate(() => {
          const bubble = document.querySelector('[data-testid="guide-tour"] [role="dialog"]')?.getBoundingClientRect();
          const ring = document.querySelector('[data-testid="guide-tour"] .ring-2')?.getBoundingClientRect();
          const id = document.querySelector('#guide-step-title')?.textContent ?? '';
          return { bubble: bubble && { l: bubble.left, t: bubble.top, r: bubble.right, b: bubble.bottom }, ring: ring && { l: ring.left, t: ring.top, r: ring.right, b: ring.bottom }, id, vw: innerWidth, vh: innerHeight };
        });
        const target = ['add', 'toolbar', 'nav', 'settings', 'settings', 'help'][step - 1];
        const t = await page.locator(`[data-tour="${target}"]`).first().boundingBox();
        const b = shape.bubble;
        if (!b || b.l < 0 || b.t < 0 || b.r > shape.vw || b.b > shape.vh) problems.push(`step ${String(step)}: the bubble leaves the window`);
        const r = shape.ring;
        if (!t || !r || !(r.l <= t.x + 1 && r.t <= t.y + 1 && r.r >= t.x + t.width - 1 && r.b >= t.y + t.height - 1)) problems.push(`step ${String(step)} (${shape.id}): the light isn't on the control`);
        if (b && r && !(b.r <= r.l || b.l >= r.r || b.b <= r.t || b.t >= r.b) && target !== 'toolbar' && target !== 'nav') problems.push(`step ${String(step)}: the bubble covers the control`);
        if (step === 1 || step === 6) await shot(page, `guide-${label}-${theme}-step${String(step)}`);
        await dialog.getByRole('button', { name: step === 6 ? 'Done' : 'Next' }).click();
      }
      check(`guide ${label} ${theme}: each step's bubble is in the window and its control lit`, problems.length === 0, problems.slice(0, 3).join('; '));
      const sidebarAfter = await page.getByRole('navigation', { name: 'Primary' }).count();
      check(`guide ${label} ${theme}: the sidebar is as it was afterwards`, (sidebarAfter === 0) === (sidebar === 'hidden'), `${String(sidebarAfter)} navigation(s)`);
      await ctx.close();
    }
  }
}

try {
  // First, so it reports even when a later check stops the run.
  await hoverHelp();
  await tourChecks();
  await guideSidebar();
  const { runChecks } = await import('./layout-checks.mjs');
  await runChecks({ open, shot, row, newPage, check, BASE });
  await screenshots();
  check('harness: every asset loaded, and no page error', failedRequests.length === 0, failedRequests.slice(0, 3).join(', '));
} finally {
  await browser.close();
  await vite.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${String(results.length - failed.length)} passed, ${String(failed.length)} failed`);
if (failed.length > 0) process.exit(1);
