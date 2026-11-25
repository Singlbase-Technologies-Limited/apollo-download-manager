// Real Firefox, driven through geckodriver's W3C WebDriver API (no npm package), with V2's add-on and V1's side by
// side (#64, #65): ported from V1's tests/e2e/firefox-extension-e2e.mjs. A link clicked on a page goes through V2's
// add-on and native host into the running V2, which records it once and holds it to confirm its local address (#67);
// Firefox's own copy is cancelled. V1's add-on reaches only V1's host (a recording stand-in).
//
// Linux only (PO decision on #64): Firefox reads ~/.mozilla/native-messaging-hosts, and HOME is the throwaway one.
// Build as for the Chromium test, then `pnpm test:e2e:firefox` under a display. Needs `firefox`, `geckodriver` and
// `zip` (or FIREFOX_PATH and GECKODRIVER_PATH). See docs/BROWSER_EXTENSION.md.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startFirefox } from './firefox-driver.mjs';
import { HOST, V1, branding, check, extension, finish, hostManifest, setup, sleep, v1Extension, waitFor } from './harness.mjs';

const EXT = extension('firefox');
const V1_EXT = v1Extension('firefox');
const w = await setup('v2-firefox-e2e-', [join(EXT, 'manifest.json'), join(V1_EXT, 'manifest.json')]);
const browserDownloads = join(w.D, 'firefox-downloads');
mkdirSync(browserDownloads, { recursive: true });

let ff;
const cmd = (method, path, body) => ff.cmd(method, path, body);

try {
  if (process.platform === 'win32') throw new Error('the Firefox test runs on Linux only (docs/BROWSER_EXTENSION.md#tests)');
  await w.startPreseeded();

  const hosts = join(w.env.HOME, '.mozilla', 'native-messaging-hosts');
  mkdirSync(hosts, { recursive: true });
  writeFileSync(join(hosts, `${branding.nativeHostName}.json`), hostManifest(branding.nativeHostName, HOST, true, [branding.firefoxExtensionId]));
  writeFileSync(join(hosts, `${V1.nativeHostName}.json`), hostManifest(V1.nativeHostName, w.stub.path, true, [V1.firefoxExtensionId]));

  // Each add-on is packed from its built folder, as it would be uploaded.
  const pack = (dir, name) => {
    const xpi = join(w.D, name);
    execFileSync('zip', ['-q', '-r', xpi, '.'], { cwd: dir });
    return xpi;
  };
  const v2Xpi = pack(EXT, 'velocity-v2.xpi');
  const v1Xpi = pack(V1_EXT, 'velocity-v1.xpi');

  // A fixed moz-extension UUID lets the test open V2's popup directly.
  const uuid = randomUUID();
  ff = await startFirefox(w.env, {
    'extensions.webextensions.uuids': JSON.stringify({ [branding.firefoxExtensionId]: uuid }),
    'browser.download.dir': browserDownloads,
    'browser.download.folderList': 2,
    'browser.download.useDownloadDir': true,
    'browser.download.always_ask_before_handling_new_types': false,
    'browser.download.alwaysOpenPanel': false,
  });
  check('Firefox started through geckodriver', true, ff.version);

  const id = await cmd('POST', '/moz/addon/install', { path: v2Xpi, temporary: true });
  check("V2's add-on installs with its pinned ID", id === branding.firefoxExtensionId, String(id));
  const v1Id = await cmd('POST', '/moz/addon/install', { path: v1Xpi, temporary: true });
  check("V1's add-on is installed beside it", v1Id === V1.firefoxExtensionId, String(v1Id));

  await ff.openFromChrome(`moz-extension://${uuid}/popup.html`);
  const status = await waitFor(async () => {
    const el = await cmd('POST', '/element', { using: 'css selector', value: '#status' });
    const t = await cmd('GET', `/element/${Object.values(el)[0]}/text`);
    return t && !t.startsWith('Checking') ? t : null;
  }, 15000, 'the popup status');
  check("V2's popup reaches V2 through V2's native host", status.startsWith('Connected · app '), status);

  const tab = await cmd('POST', '/window/new', { type: 'tab' });
  await cmd('POST', '/window', { handle: tab.handle });
  await cmd('POST', '/url', { url: `${w.base}/` });
  const link = await cmd('POST', '/element', { using: 'css selector', value: '#dl' });
  await cmd('POST', `/element/${Object.values(link)[0]}/click`, {});

  await w.checkV2Held();

  // Firefox's own copy: no complete file in its download folder.
  await sleep(1000);
  const leftovers = readdirSync(browserDownloads).filter((f) => f.startsWith('e2e-archive') && statSync(join(browserDownloads, f)).size > 0);
  check('Firefox left no copy of the file in its download folder', leftovers.length === 0, leftovers.join(', '));

  w.checkV1Isolated(V1.firefoxExtensionId);
} catch (e) {
  check('Firefox end-to-end run', false, String(e?.message ?? e));
} finally {
  await ff?.quit();
  await w.teardown();
}
finish();
