// Firefox through geckodriver's W3C WebDriver API (no npm package), shared by the Firefox tests: start geckodriver
// and a session, send commands, and open an add-on page from the browser chrome. See docs/BROWSER_EXTENSION.md.
import { spawn } from 'node:child_process';
import net from 'node:net';
import { waitFor } from './harness.mjs';

const FIREFOX = process.env.FIREFOX_PATH ?? 'firefox';
const GECKODRIVER = process.env.GECKODRIVER_PATH ?? 'geckodriver';

const freePort = () =>
  new Promise((r) => {
    const srv = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => r(port));
    });
  });

/**
 * Starts geckodriver and a Firefox session with `prefs`, under `env` (its HOME holds the native-host manifests).
 * Returns `cmd(method, path, body)` for session paths (`''` is the session itself), the browser version, and `quit()`.
 */
export async function startFirefox(env, prefs) {
  const port = await freePort();
  // --allow-system-access lets a test use the browser chrome: open an add-on's page, read Firefox's download list.
  const driver = spawn(GECKODRIVER, ['--port', String(port), '--host', '127.0.0.1', '--allow-system-access'], { env, stdio: ['ignore', 'ignore', 'pipe'] });
  driver.stderr.on('data', () => undefined);
  const wd = `http://127.0.0.1:${port}`;
  const call = async (method, path, body) => {
    const res = await fetch(`${wd}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new Error(`${method} ${path}: ${json.value?.error ?? res.status} ${json.value?.message ?? ''}`);
    return json.value;
  };
  let session = null;
  const quit = async () => {
    if (session) await call('DELETE', `/session/${session}`).catch(() => undefined);
    if (driver.exitCode === null) driver.kill('SIGTERM');
  };
  try {
    await waitFor(() => fetch(`${wd}/status`).then((r) => r.ok).catch(() => false), 15000, 'geckodriver');
    const created = await call('POST', '/session', {
      capabilities: { alwaysMatch: { browserName: 'firefox', 'moz:firefoxOptions': { ...(process.env.FIREFOX_PATH ? { binary: FIREFOX } : {}), env: { HOME: env.HOME }, prefs } } },
    });
    session = created.sessionId;
    const cmd = (method, path, body) => call(method, `/session/${session}${path}`, body);
    /** WebDriver may not navigate to moz-extension: pages, so the tab is opened from the browser chrome, as a toolbar click would. */
    const openFromChrome = async (url) => {
      const before = await cmd('GET', '/window/handles');
      await cmd('POST', '/moz/context', { context: 'chrome' });
      await cmd('POST', '/execute/sync', {
        script: 'gBrowser.selectedTab = gBrowser.addTab(arguments[0], { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });',
        args: [url],
      });
      await cmd('POST', '/moz/context', { context: 'content' });
      const handle = await waitFor(async () => (await cmd('GET', '/window/handles')).find((h) => !before.includes(h)), 10000, 'the add-on tab');
      await cmd('POST', '/window', { handle });
      return handle;
    };
    return { cmd, openFromChrome, version: created.capabilities?.browserVersion ?? '', quit };
  } catch (e) {
    await quit();
    throw e;
  }
}
