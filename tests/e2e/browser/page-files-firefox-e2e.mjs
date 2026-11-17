// Real Firefox, through geckodriver, with V2's add-on and the running V2 (#426): the download button on pages with
// files. Its frame is added to a page only when files are found, also when the page adds them later; choosing 12
// files by keyboard and sending them adds 12 downloads in one go.
//
// The button lives in a closed shadow root, which WebDriver can't look into, so the test reaches it as a keyboard
// user does, with real key presses, and checks what reached the app's database. Access to pages is asked for in a
// prompt a test can't answer, so the test installs a copy of the built add-on whose manifest grants it (Firefox 127
// and later grant an MV3 add-on's host permissions at install).
//
// Linux only, like the Firefox test (PO decision on #64). Build as for the Chromium test, then
// `pnpm test:e2e:page-files:firefox` under a display. Needs `firefox`, `geckodriver` and `zip`. See
// docs/BROWSER_EXTENSION.md.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startFirefox } from './firefox-driver.mjs';
import { HOST, branding, check, extension, finish, hostManifest, setup, sleep, waitFor } from './harness.mjs';

const BUILT = extension('firefox');
const w = await setup('v2-page-files-firefox-e2e-', [join(BUILT, 'manifest.json')]);
const EXT = join(w.D, 'extension');
cpSync(BUILT, EXT, { recursive: true });
const manifestPath = join(EXT, 'manifest.json');
writeFileSync(manifestPath, JSON.stringify({ ...JSON.parse(readFileSync(manifestPath, 'utf8')), host_permissions: ['<all_urls>'] }, null, 2));
const countRecords = (pattern) => Number(w.query(`select count(*) from downloads where source_url like '${pattern}'`));

let ff;
try {
  if (process.platform === 'win32') throw new Error('the Firefox tests run on Linux only (docs/BROWSER_EXTENSION.md#tests)');
  await w.startPreseeded();
  const hosts = join(w.env.HOME, '.mozilla', 'native-messaging-hosts');
  mkdirSync(hosts, { recursive: true });
  writeFileSync(join(hosts, `${branding.nativeHostName}.json`), hostManifest(branding.nativeHostName, HOST, true, [branding.firefoxExtensionId]));
  const xpi = join(w.D, 'velocity-v2.xpi');
  execFileSync('zip', ['-q', '-r', xpi, '.'], { cwd: EXT });

  ff = await startFirefox(w.env, {});
  check('Firefox started through geckodriver', true, ff.version);
  const id = await ff.cmd('POST', '/moz/addon/install', { path: xpi, temporary: true });
  check("V2's add-on installs with its pinned ID", id === branding.firefoxExtensionId, String(id));

  // What the add-on may reach, as Firefox granted it: the pages are needed.
  await ff.cmd('POST', '/moz/context', { context: 'chrome' });
  const origins = await ff.cmd('POST', '/execute/sync', {
    script: 'return WebExtensionPolicy.getByID(arguments[0])?.allowedOrigins.patterns.map((p) => p.pattern) ?? [];',
    args: [branding.firefoxExtensionId],
  });
  await ff.cmd('POST', '/moz/context', { context: 'content' });
  check('Firefox granted the add-on access to pages', origins.includes('<all_urls>'), JSON.stringify(origins));
  await sleep(1500);

  const tab = await ff.cmd('POST', '/window/new', { type: 'tab' });
  await ff.cmd('POST', '/window', { handle: tab.handle });
  const run = (script, args = []) => ff.cmd('POST', '/execute/sync', { script, args });
  const frame = () => run("return document.querySelector('apollo-dm-page-files') !== null;");
  const open = (path) => ff.cmd('POST', '/url', { url: `${w.base}${path}` });

  await open('/page/none');
  await sleep(2000);
  check('no button on a page without files', (await frame()) === false);

  await open('/page/late');
  await sleep(1000);
  check('no button before the page adds files', (await frame()) === false);
  const late = await waitFor(async () => ((await frame()) ? true : null), 8000, 'the button for files added later').catch(() => false);
  check('the button appears when the page adds 20 files 2 s after loading', late === true);

  await open('/page/files');
  const shown = await waitFor(async () => ((await frame()) ? true : null), 10000, 'the button for 12 files').catch(() => false);
  check('the button appears on a page with 12 files', shown === true);

  // Keyboard only: Tab through the page's 13 links to the button, Enter opens the panel with the focus in its search;
  // Tab past the two type filters to "Select all shown", Space. Then Tab and Enter until the files arrive: Enter does
  // nothing on a file's checkbox or the list (which Firefox stops on, as it scrolls), and sends on Send.
  const keys = (...values) => ff.cmd('POST', '/actions', { actions: [{ type: 'key', id: 'kb', actions: values.flatMap((value) => [{ type: 'keyDown', value }, { type: 'keyUp', value }]) }] });
  const TAB = '';
  const ENTER = '';
  const SPACE = '';
  const inFrame = () => run("return document.activeElement?.tagName === 'APOLLO-DM-PAGE-FILES';");
  await run('document.body.focus(); window.focus();');
  let reached = false;
  for (let i = 0; i < 20 && !reached; i += 1) {
    await keys(TAB);
    reached = await inFrame();
  }
  check('the button is reached by Tab', reached);
  await keys(ENTER);
  await sleep(300);
  await keys(TAB, TAB, TAB, SPACE);
  for (let i = 0; i < 20 && countRecords('%/files/page-%.iso') === 0; i += 1) {
    await keys(TAB, ENTER);
    await sleep(400);
  }
  const added = await waitFor(() => (countRecords('%/files/page-%.iso') === 12 ? 12 : null), 15000, '12 downloads').catch(() => countRecords('%/files/page-%.iso'));
  check('by keyboard, V2 added the 12 chosen files once each, in one go', added === 12, `${String(added)} download(s)`);
} catch (e) {
  check('Firefox page-button end-to-end run', false, String(e?.message ?? e));
} finally {
  await ff?.quit();
  await w.teardown();
}
finish();
