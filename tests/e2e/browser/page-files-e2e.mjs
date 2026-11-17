// Real Chromium (Playwright's) with V2's extension and the running V2 (#426): the download button on pages with files.
// It appears only on pages with files, also when a page adds them later; a page's styles can't change it; choosing
// 12 files and sending them adds 12 downloads in one go; the panel works by keyboard; and the scanning cost on a
// 5,000-link page, and of a rescan after the page adds 20, is measured and reported.
//
// The button lives in a closed shadow root, so the test finds it the way a screen reader does, in the browser's
// accessibility tree, and clicks where it is. Access to pages is asked for in a browser prompt a test can't answer,
// so the test loads a copy of the built extension whose manifest grants it.
//
// Build first: `cargo build -p velocity-desktop-v2 -p velocity-transfer -p velocity-torrent -p velocity-native-host`
// and `pnpm build:extension`. Then `pnpm test:e2e:page-files` (on Linux under a display). See docs/BROWSER_EXTENSION.md.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOST, branding, check, extension, finish, hostManifest, setup, sleep, waitFor } from './harness.mjs';

const BUILT = extension('chrome');
const w = await setup('v2-page-files-e2e-', [join(BUILT, 'manifest.json')]);
const profile = join(w.D, 'chromium-profile');
const v2Origin = `chrome-extension://${branding.chromeExtensionIds[0]}/`;
const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;

// The copy with access to pages granted, as after the user said yes.
const EXT = join(w.D, 'extension');
cpSync(BUILT, EXT, { recursive: true });
const manifestPath = join(EXT, 'manifest.json');
writeFileSync(manifestPath, JSON.stringify({ ...JSON.parse(readFileSync(manifestPath, 'utf8')), host_permissions: ['<all_urls>'] }, null, 2));

const registered = [];
function register(name, manifest) {
  if (process.platform !== 'win32') {
    mkdirSync(join(profile, 'NativeMessagingHosts'), { recursive: true });
    writeFileSync(join(profile, 'NativeMessagingHosts', `${name}.json`), manifest);
    return;
  }
  const file = join(w.D, `${name}.json`);
  writeFileSync(file, manifest);
  const key = `HKCU\\Software\\Chromium\\NativeMessagingHosts\\${name}`;
  let before = null;
  try {
    before = execFileSync('reg', ['query', key, '/ve'], { encoding: 'utf8' }).match(/REG_SZ\s+(.*)/)?.[1]?.trim() ?? null;
  } catch {
    before = null;
  }
  execFileSync('reg', ['add', key, '/ve', '/t', 'REG_SZ', '/d', file, '/f'], { stdio: 'ignore' });
  registered.push({ key, before });
}
function unregister() {
  for (const { key, before } of registered) {
    if (before === null) execFileSync('reg', ['delete', key, '/f'], { stdio: 'ignore' });
    else execFileSync('reg', ['add', key, '/ve', '/t', 'REG_SZ', '/d', before, '/f'], { stdio: 'ignore' });
  }
}

/** The page's accessibility tree, closed shadow roots included, as `{ role, name, node }`. */
async function axNodes(cdp) {
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  return nodes.filter((n) => !n.ignored).map((n) => ({ role: n.role?.value ?? '', name: n.name?.value ?? '', node: n.backendDOMNodeId }));
}
async function find(cdp, role, name) {
  return (await axNodes(cdp)).find((n) => n.role === role && (typeof name === 'string' ? n.name === name : name.test(n.name))) ?? null;
}
async function boxOf(cdp, node) {
  const { model } = await cdp.send('DOM.getBoxModel', { backendNodeId: node });
  const [x1, y1, , , x3, y3] = model.border;
  return { x: x1, y: y1, width: x3 - x1, height: y3 - y1 };
}
async function click(page, cdp, role, name) {
  const n = await waitFor(() => find(cdp, role, name), 10000, `${role} "${String(name)}"`);
  const b = await boxOf(cdp, n.node);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  return b;
}
async function open(context, path) {
  const page = await context.newPage();
  await page.goto(`${w.base}${path}`);
  const cdp = await context.newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('Accessibility.enable');
  return { page, cdp };
}
const buttonName = /^Apollo DM: \d+ files? on this page$/;
const countRecords = (pattern) => Number(w.query(`select count(*) from downloads where source_url like '${pattern}'`));

let context;
try {
  await w.startPreseeded();
  register(branding.nativeHostName, hostManifest(branding.nativeHostName, HOST, false, [v2Origin]));
  context = await chromium.launchPersistentContext(profile, {
    headless: false,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    env: w.env,
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-first-run'],
  });
  await waitFor(() => (context.serviceWorkers().length >= 1 ? true : null), 15000, "V2's extension");
  // The page script is registered once the extension sees it may read pages.
  await sleep(1500);

  // No files: no button.
  {
    const { page, cdp } = await open(context, '/page/none');
    await sleep(2000);
    check('no button on a page without files', (await find(cdp, 'button', buttonName)) === null);
    await page.close();
  }

  // 12 files: the button, its first-time tip, the panel, and sending.
  {
    const { page, cdp } = await open(context, '/page/files');
    const fab = await waitFor(() => find(cdp, 'button', 'Apollo DM: 12 files on this page'), 10000, 'the button for 12 files');
    check('the button appears on a page with 12 files', fab !== null);
    const tip = await find(cdp, 'StaticText', /^Apollo DM found 12 files on this page$/);
    const howOff = await find(cdp, 'StaticText', /turn it off for every site in the extension's settings/);
    check('the first time, a tip says how to turn the button off', tip !== null && howOff !== null);
    if (shots) await page.screenshot({ path: join(shots, 'page-files-tip.png') });
    await click(page, cdp, 'button', 'Got it');
    const normal = await boxOf(cdp, fab.node);

    await click(page, cdp, 'button', 'Apollo DM: 12 files on this page');
    const dialog = await waitFor(() => find(cdp, 'dialog', '12 files on this page'), 5000, 'the panel');
    check('the panel opens as a labelled dialog', dialog !== null);
    // Keyboard only from here: the search has the focus; Tab to "Select all shown", Space, Tab to the send button.
    for (let i = 0; i < 20; i += 1) {
      await page.keyboard.press('Tab');
      const all = await find(cdp, 'checkbox', 'Select all shown');
      const props = all ? (await cdp.send('Accessibility.getPartialAXTree', { backendNodeId: all.node, fetchRelatives: false })).nodes[0] : null;
      if (props?.properties?.some((p) => p.name === 'focused' && p.value.value === true)) break;
    }
    await page.keyboard.press('Space');
    const send = await waitFor(() => find(cdp, 'button', 'Send 12 to Apollo DM'), 5000, 'the send button for 12');
    check('by keyboard, Select all chooses the 12 files', send !== null);
    if (shots) await page.screenshot({ path: join(shots, 'page-files-panel.png') });
    await click(page, cdp, 'button', 'Send 12 to Apollo DM');
    const said = await waitFor(() => find(cdp, 'StaticText', /^Sent 12 to Apollo DM\.$/), 15000, 'the panel to say they were sent').catch(() => null);
    check('the panel says the 12 were sent', said !== null);
    const added = await waitFor(() => (countRecords('%/files/page-%.iso') === 12 ? 12 : null), 15000, '12 downloads').catch(() => countRecords('%/files/page-%.iso'));
    check('V2 added the 12 files once each, in one go (no RATE_LIMITED)', added === 12, `${String(added)} download(s)`);

    await page.keyboard.press('Escape');
    const closed = await waitFor(async () => ((await find(cdp, 'dialog', '12 files on this page')) === null ? true : null), 5000, 'the panel to close').catch(() => false);
    check('Escape closes the panel', closed === true);

    // Dragging moves it out of the way, and the page keeps it there.
    await page.mouse.move(normal.x + normal.width / 2, normal.y + normal.height / 2);
    await page.mouse.down();
    await page.mouse.move(normal.x - 400, normal.y - 300, { steps: 8 });
    await page.mouse.up();
    const moved = await boxOf(cdp, fab.node);
    check('the button can be dragged out of the way', moved.x < normal.x - 350 && moved.y < normal.y - 250, JSON.stringify(moved));
    await page.reload();
    const after = await waitFor(() => find(cdp, 'button', buttonName), 10000, 'the button after a reload');
    const kept = await boxOf(cdp, after.node);
    check('the button stays where it was dragged, on this site', Math.abs(kept.x - moved.x) < 4 && Math.abs(kept.y - moved.y) < 4, JSON.stringify(kept));
    check('the tip shows only once', (await find(cdp, 'button', 'Got it')) === null);
    await page.close();

    // The page's styles can't change it: the same size on a page that tries.
    const hostile = await open(context, '/page/hostile');
    const hb = await waitFor(() => find(hostile.cdp, 'button', 'Apollo DM: 12 files on this page'), 10000, 'the button on a hostile page');
    const hbox = await boxOf(hostile.cdp, hb.node);
    check("a page's styles don't change the button", Math.abs(hbox.width - normal.width) < 2 && Math.abs(hbox.height - normal.height) < 2, `${JSON.stringify(hbox)} vs ${JSON.stringify(normal)}`);
    if (shots) await hostile.page.screenshot({ path: join(shots, 'page-files-hostile.png') });

    // Turning it off removes it without a reload.
    const options = await context.newPage();
    await options.goto(`${v2Origin}options.html`);
    await options.evaluate(async () => {
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...(settings ?? {}), pageButton: false } });
    });
    const gone = await waitFor(async () => ((await find(hostile.cdp, 'button', buttonName)) === null ? true : null), 5000, 'the button to go').catch(() => false);
    check('turning the button off removes it without a reload', gone === true);
    await options.evaluate(async () => {
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, pageButton: true } });
    });
    await options.close();
    await hostile.page.close();
  }

  // Links a page adds later.
  {
    const { page, cdp } = await open(context, '/page/late');
    await sleep(1000);
    check('no button before the page adds files', (await find(cdp, 'button', buttonName)) === null);
    const late = await waitFor(() => find(cdp, 'button', 'Apollo DM: 20 files on this page'), 8000, 'the button for 20 late files').catch(() => null);
    check('the button appears when the page adds 20 files 2 s after loading', late !== null);
    await page.close();
  }

  // The scanning cost: the time the page button's script was running, its own code and the browser's work it called,
  // from V8's CPU profile (a sample every 50 µs), on a page with 5,000 file links, then after the page adds 20.
  {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('Accessibility.enable');
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 50 });
    /** Milliseconds of samples with pagefiles.js anywhere on the stack. */
    const ours = (profile) => {
      const parent = new Map();
      const byId = new Map(profile.nodes.map((n) => [n.id, n]));
      for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
      const inScript = new Map();
      const hit = (id) => {
        if (inScript.has(id)) return inScript.get(id);
        const n = byId.get(id);
        const v = String(n?.callFrame?.url ?? '').endsWith('pagefiles.js') || (parent.has(id) && hit(parent.get(id)));
        inScript.set(id, v);
        return v;
      };
      let us = 0;
      profile.samples.forEach((id, i) => {
        if (hit(id)) us += profile.timeDeltas[i + 1] ?? 50;
      });
      return us / 1000;
    };
    await cdp.send('Profiler.start');
    await page.goto(`${w.base}/page/big`);
    await waitFor(() => find(cdp, 'button', 'Apollo DM: 5000 files on this page'), 15000, 'the button for 5,000 files');
    await sleep(300);
    const first = ours((await cdp.send('Profiler.stop')).profile);
    await cdp.send('Profiler.start');
    await page.evaluate(() => window.addMore());
    await waitFor(() => find(cdp, 'button', 'Apollo DM: 5020 files on this page'), 15000, 'the rescan');
    await sleep(300);
    const rescan = ours((await cdp.send('Profiler.stop')).profile);
    console.log(`measured (V8 CPU profile, 50 µs samples): first scan of 5,000 links ${first.toFixed(1)} ms; rescan after the page added 20 links ${rescan.toFixed(1)} ms`);
    check('the first scan of 5,000 links takes under 50 ms', first > 0 && first < 50, `${first.toFixed(1)} ms`);
    check('a rescan of 20 added links takes under 10 ms', rescan > 0 && rescan < 10, `${rescan.toFixed(1)} ms`);
    await page.close();
  }
} catch (e) {
  check('page-button end-to-end run', false, String(e?.message ?? e));
} finally {
  await context?.close().catch(() => undefined);
  try {
    unregister();
  } catch (e) {
    check('the test registry keys were removed', false, String(e?.message ?? e));
  }
  await w.teardown();
}
finish();
