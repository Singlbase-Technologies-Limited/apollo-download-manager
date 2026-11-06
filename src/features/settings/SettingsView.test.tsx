import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import type { Browser, Capabilities, Registration, Settings } from '../../contract';
import { DEFAULT_LAYOUT } from '../../layout/layoutLogic';
import { createQueryClient } from '../../lib/queries';
import { INITIAL_LIST, useDownloadsStore } from '../../stores/downloads';
import { useUiStore, type SettingsSection } from '../../stores/ui';
import { SETTINGS_INDEX } from './settingsIndex';
import { callsOf, emptySnapshot, fixture, installFakeBackend, type FakeState } from '../../test/fakeBackend';
import { chooseOption } from '../../test/select';

// V1's settings tests (tests/unit/app.test.tsx, "settings") and its BitTorrent settings tests
// (tests/unit/torrentControls.test.tsx, moved here by the PO's decision on #63), ported to V2's screen, and #30's own.

function renderApp() {
  return render(<App client={createQueryClient()} />);
}

const saved = (state: FakeState) => callsOf(state, 'set_settings').map((c) => c.args.settings as Settings);

async function openSettings(section?: string) {
  const user = userEvent.setup();
  renderApp();
  await screen.findByText('No downloads yet');
  act(() => { useUiStore.getState().openSettings(); });
  if (section) await user.click(await screen.findByRole('button', { name: section }));
  return user;
}

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
  });
  useUiStore.setState({ view: 'all', categoryFilter: null, layout: { ...DEFAULT_LAYOUT }, addDialog: { open: false, prefill: null }, settingsSection: 'general', settingsOpen: false });
  useDownloadsStore.setState({ snapshot: null, error: null, ...INITIAL_LIST });
});

describe('settings (V1)', () => {
  it('persists a toggled setting through the native command', async () => {
    const state = installFakeBackend();
    const user = await openSettings();
    await user.click(await screen.findByRole('checkbox', { name: 'Start minimized' }));
    await waitFor(() => { expect(saved(state)).toHaveLength(1); });
    expect(state.appSettings.general.startMinimized).toBe(true);
  });

  it('starts the app at sign-in when switched on (#321)', async () => {
    const state = installFakeBackend();
    const user = await openSettings();
    const box = await screen.findByRole<HTMLInputElement>('checkbox', { name: 'Start Apollo Download Manager when I sign in' });
    expect(box.checked).toBe(false);
    await user.click(box);
    await waitFor(() => { expect(saved(state)).toHaveLength(1); });
    expect(state.appSettings.general.startAtLogin).toBe(true);
  });

  it('commits numeric settings on blur with clamping', async () => {
    const state = installFakeBackend();
    const user = await openSettings('Queue and performance');
    const input = await screen.findByLabelText<HTMLInputElement>('Simultaneous downloads');
    await user.clear(input);
    await user.type(input, '99');
    expect(saved(state)).toHaveLength(0);
    await user.tab();
    await waitFor(() => { expect(state.appSettings.queue.maxConcurrentDownloads).toBe(32); });
  });

  it('turns off restarting downloads when the network is back (#318)', async () => {
    const state = installFakeBackend();
    const user = await openSettings('Queue and performance');
    const toggle = await screen.findByRole('checkbox', { name: 'Restart downloads when the network is back' });
    expect((toggle as HTMLInputElement).checked).toBe(true);
    await user.click(toggle);
    await waitFor(() => { expect(state.appSettings.queue.restartOnNetwork).toBe(false); });
  });

  it('switches every time to 12-hour, with AM and PM (#350)', async () => {
    const state = installFakeBackend();
    const user = await openSettings('Appearance');
    const choice = await screen.findByLabelText('Time format');
    expect(choice.textContent).toContain('24-hour (14:30)');
    await chooseOption(user, choice, '12-hour (2:30 PM)');
    await waitFor(() => { expect(state.settings.appearance.timeFormat).toBe('twelveHour'); });
  });

  it('chooses the schedule’s times, and says when it next runs (#350)', async () => {
    const state = installFakeBackend({
      snapshot: { ...emptySnapshot(), schedule: { opens: '2026-10-20T02:00', closes: '2026-10-20T07:00', open: false } },
    });
    const user = await openSettings('Queue and performance');
    expect(await screen.findByText(/^Off: downloads start as soon as/)).toBeTruthy();
    await user.click(screen.getByRole('checkbox', { name: 'Use the schedule' }));
    await waitFor(() => { expect(state.appSettings.queue.schedule.enabled).toBe(true); });
    expect(await screen.findByText(/^Next: .*02:00 to 07:00$/)).toBeTruthy();
    await chooseOption(user, screen.getByLabelText('Start, hour'), '03');
    await waitFor(() => { expect(state.appSettings.queue.schedule.startTime).toBe('03:00'); });
    await chooseOption(user, screen.getByLabelText('Stop, minute'), '30');
    await waitFor(() => { expect(state.appSettings.queue.schedule.stopTime).toBe('07:30'); });
    expect(screen.queryByRole('textbox', { name: /HH:MM/ })).toBeNull();
  });

  it('confirms before resetting settings', async () => {
    const state = installFakeBackend();
    const user = await openSettings();
    await user.click(await screen.findByRole('button', { name: /Reset to defaults/ }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(callsOf(state, 'reset_settings')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: /Reset to defaults/ }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reset settings' }));
    await waitFor(() => { expect(callsOf(state, 'reset_settings')).toHaveLength(1); });
  });
});

describe('BitTorrent settings (V1)', () => {
  it('has its own BitTorrent switch, separate from Metalink', async () => {
    const state = installFakeBackend();
    const user = await openSettings('BitTorrent');
    await user.click(await screen.findByRole('checkbox', { name: 'BitTorrent' }));
    await waitFor(() => { expect(state.appSettings.advanced.enableBittorrent).toBe(false); });
    expect(state.appSettings.advanced.enableMetalink).toBe(false);
  });

  it('limits how many torrents seed at once', async () => {
    const state = installFakeBackend();
    const user = await openSettings('BitTorrent');
    const seeds = await screen.findByLabelText<HTMLInputElement>('Torrents seeding at once');
    await user.clear(seeds);
    await user.type(seeds, '3');
    await user.tab();
    await waitFor(() => { expect(state.appSettings.torrent.maxActiveSeeds).toBe(3); });
  });

  it('says new torrents use libtorrent and offers opt-in port mapping', async () => {
    const state = installFakeBackend();
    const user = await openSettings('BitTorrent');
    expect((await screen.findByRole('region', { name: 'BitTorrent' })).textContent).toContain('libtorrent');
    const mapping = screen.getByRole<HTMLInputElement>('checkbox', { name: 'Ask the router to forward the port (UPnP, NAT-PMP)' });
    expect(mapping.checked).toBe(false);
    await user.click(mapping);
    await waitFor(() => { expect(state.appSettings.torrent.portMapping).toBe(true); });
  });

  it('shows the libtorrent session and the port mapping state', async () => {
    installFakeBackend({ network: { listenPort: 6890, listenError: null, portMapping: { state: 'mapped', externalPort: 40000, via: 'natpmp' } } });
    await openSettings('BitTorrent');
    const session = await screen.findByRole('region', { name: 'Connection' });
    await waitFor(() => { expect(session.textContent).toContain('Listening on port 6890'); });
    expect(session.textContent).toContain('Port 6890 forwarded by the router as 40000 (NAT-PMP).');
  });
});

describe('the Settings screen (#30)', () => {
  it('opens from the navigation and with Ctrl+,', async () => {
    installFakeBackend();
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('No downloads yet');
    await user.keyboard('{Control>},{/Control}');
    expect(await screen.findByRole('heading', { name: 'Settings', level: 1 })).toBeTruthy();
    act(() => { useUiStore.getState().closeSettings(); });
    // #363: Settings is the title bar's gear, always shown.
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Settings' }));
    expect(await screen.findByRole('heading', { name: 'Settings', level: 1 })).toBeTruthy();
  });

  // #364 (PO): Settings opens in a window over the app, as in VS Code, and the list stays behind it.
  it('opens in a window over the list, which stays behind it', async () => {
    installFakeBackend();
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('No downloads yet');
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    expect(within(dialog).getByRole('navigation', { name: 'Settings sections' })).toBeTruthy();
    expect(useUiStore.getState().view).toBe('all');
    expect(document.body.textContent).toContain('No downloads yet');
  });

  it('closes with Escape and gives focus back to the Settings button', async () => {
    installFakeBackend();
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('No downloads yet');
    const button = within(screen.getByRole('banner')).getByRole('button', { name: 'Settings' });
    await user.click(button);
    await screen.findByRole('dialog', { name: 'Settings' });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('opens at the section asked for', async () => {
    installFakeBackend();
    renderApp();
    await screen.findByText('No downloads yet');
    act(() => { useUiStore.getState().openSettings('proxy'); });
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    expect(within(dialog).getByRole('button', { name: 'Proxy' }).getAttribute('aria-current')).toBe('page');
  });

  it('says why a value was refused, and shows what is saved', async () => {
    const state = installFakeBackend({ failures: { set_settings: 'INVALID_INPUT' } });
    const user = await openSettings();
    const box = await screen.findByRole<HTMLInputElement>('checkbox', { name: 'Start minimized' });
    await user.click(box);
    expect(await screen.findByRole('alert')).toBeTruthy();
    await waitFor(() => { expect(box.checked).toBe(false); });
    expect(state.appSettings.general.startMinimized).toBe(false);
  });

  it('turns Metalink off and says why when the engine can’t do it', async () => {
    const caps = fixture('capabilities.json') as Capabilities;
    installFakeBackend({ capabilities: { ...caps, metalink: false } });
    await openSettings('Advanced');
    const metalink = await screen.findByRole<HTMLInputElement>('checkbox', { name: 'Metalink' });
    expect(metalink.disabled).toBe(true);
    expect((await screen.findByRole('region', { name: 'Protocols' })).textContent).toMatch(/can’t/);
  });

  it('saves the engine’s retries, timeouts and preallocation', async () => {
    const state = installFakeBackend();
    const user = await openSettings('Advanced');
    await chooseOption(user, await screen.findByLabelText('Preallocation'), 'Full');
    await waitFor(() => { expect(state.appSettings.engine.preallocation).toBe('full'); });
    const failures = screen.getByLabelText<HTMLInputElement>('Failures in a row before giving up');
    await user.clear(failures);
    await user.type(failures, '9');
    await user.tab();
    await waitFor(() => { expect(state.appSettings.engine.failuresInARow).toBe(9); });
  });

  it('saves how long the history keeps entries', async () => {
    const state = installFakeBackend();
    const user = await openSettings('History and storage');
    const days = await screen.findByLabelText<HTMLInputElement>('Keep history for (days, 0 for ever)');
    await user.clear(days);
    await user.type(days, '30');
    await user.tab();
    await waitFor(() => { expect(state.appSettings.storage.historyRetentionDays).toBe(30); });
  });

  it('names the speed limit for direct downloads and points torrents to their own (#312)', async () => {
    installFakeBackend();
    await openSettings('Queue and performance');
    // Both throw when they find nothing.
    await screen.findByLabelText('Speed limit for direct downloads (KiB/s, 0 for none)');
    screen.getByText('Torrents have their own limit, under BitTorrent.');
  });

  it('keeps the global speed limit and the user agent', async () => {
    const state = installFakeBackend();
    const user = await openSettings('Advanced');
    const agent = await screen.findByLabelText<HTMLInputElement>('User agent');
    await user.type(agent, 'Apollo Download Manager-Test/1');
    await user.tab();
    await waitFor(() => { expect(state.appSettings.advanced.userAgent).toBe('Apollo Download Manager-Test/1'); });
    await user.clear(agent);
    await user.tab();
    await waitFor(() => { expect(state.appSettings.advanced.userAgent).toBeNull(); });
  });

  it('shows the diagnostics under About and diagnostics', async () => {
    installFakeBackend();
    await openSettings('About and diagnostics');
    expect(await screen.findByRole('button', { name: 'Export diagnostics…' })).toBeTruthy();
  });

  it('starts new torrents in the Add dialog with the saved seeding and upload limit', async () => {
    const settings = fixture('settings.json') as Settings;
    installFakeBackend({ appSettings: { ...settings, newTorrents: { chooseFilesForMagnets: true, seeding: { mode: 'unlimited' }, uploadLimitKib: 64 } } });
    renderApp();
    await screen.findByText('No downloads yet');
    act(() => { useUiStore.getState().openAdd({ links: 'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567' }); });
    expect((await screen.findByLabelText('Seeding after download')).textContent).toContain('Until I stop it');
    expect(screen.getByLabelText<HTMLInputElement>('Upload limit (KiB/s)').value).toBe('64');
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Choose files before downloading' }).checked).toBe(true);
  });
});

describe('the Browser section (#65)', () => {
  it('saves what happens to links from the browser', async () => {
    const state = installFakeBackend();
    const user = await openSettings('Browser');
    const ask = await screen.findByRole<HTMLInputElement>('checkbox', { name: 'Ask before adding' });
    expect(ask.checked).toBe(true);
    await user.click(ask);
    await waitFor(() => { expect(saved(state)).toHaveLength(1); });
    expect(state.appSettings.browser).toEqual({ acceptRequests: true, confirmBeforeAdding: false });
    await user.click(screen.getByRole('checkbox', { name: 'Take links from the browser' }));
    await waitFor(() => { expect(state.appSettings.browser.acceptRequests).toBe(false); });
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Ask before adding' }).disabled).toBe(true);
  });

  it('registers and unregisters each browser', async () => {
    const state = installFakeBackend();
    installed(state, 'firefox');
    const user = await openSettings('Browser');
    await user.click(await screen.findByRole('button', { name: 'Register with Mozilla Firefox' }));
    await waitFor(() => { expect(callsOf(state, 'register_browser')).toEqual([{ cmd: 'register_browser', args: { browser: 'firefox' } }]); });
    expect(await screen.findByRole('button', { name: 'Unregister from Mozilla Firefox' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Unregister from Google Chrome' }));
    await waitFor(() => { expect(callsOf(state, 'unregister_browser')).toEqual([{ cmd: 'unregister_browser', args: { browser: 'chrome' } }]); });
    expect(await screen.findByRole('button', { name: 'Register with Google Chrome' })).toBeTruthy();
  });

  it('says so when the native host isn’t installed, and offers nothing to register', async () => {
    const state = installFakeBackend();
    state.browser = { ...state.browser, hostPath: null };
    installed(state, 'firefox');
    await openSettings('Browser');
    expect(await screen.findByText(/isn’t installed beside Apollo Download Manager/)).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Register with Mozilla Firefox' }).disabled).toBe(true);
  });
});

/** Marks `browser` as installed here, with `extra` fields for its row (#241). */
function installed(state: FakeState, browser: Browser, extra: Partial<Registration> = {}) {
  state.browser = {
    ...state.browser,
    registrations: state.browser.registrations.map((r) =>
      r.browser === browser ? { ...r, found: { program: `/usr/bin/${browser}`, sandboxed: false }, ...extra } : r,
    ),
  };
}

describe('setting up a browser (#241)', () => {
  it('lists only the browsers installed here, and any still registered', async () => {
    const state = installFakeBackend();
    // The fixture: Chrome installed and registered; Edge only registered; the rest neither.
    state.browser = {
      ...state.browser,
      registrations: state.browser.registrations.map((r) => (r.browser === 'edge' ? { ...r, registered: true, hostMatches: true } : r)),
    };
    await openSettings('Browser');
    expect(await screen.findByText('Google Chrome')).toBeTruthy();
    expect(screen.getByText('Microsoft Edge')).toBeTruthy();
    expect(screen.getByText(/isn’t installed any more/)).toBeTruthy();
    for (const gone of ['Chromium', 'Brave', 'Mozilla Firefox']) expect(screen.queryByText(gone)).toBeNull();
  });

  it('says so when no supported browser is installed', async () => {
    const state = installFakeBackend();
    state.browser = { ...state.browser, registrations: state.browser.registrations.map((r) => ({ ...r, found: null, registered: false, hostMatches: false })) };
    await openSettings('Browser');
    expect(await screen.findByText(/No supported browser was found/)).toBeTruthy();
  });

  it('warns that a Snap or Flatpak browser may not work', async () => {
    const state = installFakeBackend();
    installed(state, 'firefox', { found: { program: '/snap/bin/firefox', sandboxed: true } });
    await openSettings('Browser');
    expect(await screen.findByText(/may not work with a Snap or Flatpak browser/)).toBeTruthy();
  });

  it('keeps “Get the extension” off until the store page exists', async () => {
    installFakeBackend();
    await openSettings('Browser');
    const get = await screen.findByRole<HTMLButtonElement>('button', { name: 'Get the extension for Google Chrome' });
    expect(get.disabled).toBe(true);
    expect(screen.getByText(/isn’t in the browser stores yet/)).toBeTruthy();
  });

  it('opens the store page in that browser, and offers the link to copy when it can’t', async () => {
    const state = installFakeBackend();
    const page = 'https://chromewebstore.google.com/detail/apollo/abc';
    installed(state, 'chrome', { storeUrl: page });
    const user = await openSettings('Browser');
    await user.click(await screen.findByRole('button', { name: 'Get the extension for Google Chrome' }));
    await waitFor(() => { expect(callsOf(state, 'open_extension_page')).toEqual([{ cmd: 'open_extension_page', args: { browser: 'chrome' } }]); });
    expect(screen.queryByText(page)).toBeNull();
    state.failures.open_extension_page = 'IO';
    await user.click(screen.getByRole('button', { name: 'Get the extension for Google Chrome' }));
    expect(await screen.findByText(page)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy the link' })).toBeTruthy();
  });
});

describe('the Proxy section (#192)', () => {
  it('saves the proxy without its password, and checks nothing that the native side checks', async () => {
    const state = installFakeBackend();
    const user = await openSettings('Proxy');
    const host = await screen.findByLabelText('Host');
    await user.type(host, 'proxy.example.com');
    await user.tab();
    await waitFor(() => { expect(state.appSettings.proxy.host).toBe('proxy.example.com'); });
    await chooseOption(user, screen.getByLabelText('Type'), 'SOCKS5');
    await waitFor(() => { expect(state.appSettings.proxy.kind).toBe('socks5'); });
    expect(JSON.stringify(saved(state))).not.toContain('password"');
  });

  it('sets the password on its own, never shows it, and can clear it', async () => {
    const state = installFakeBackend();
    const user = await openSettings('Proxy');
    expect(await screen.findByText('No password is set.')).toBeTruthy();
    const field = screen.getByLabelText<HTMLInputElement>('Password');
    expect(field.type).toBe('password');
    await user.type(field, 'hunter2-proxy');
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    await waitFor(() => { expect(state.proxyPassword).toBe('hunter2-proxy'); });
    expect(await screen.findByText('A password is set.')).toBeTruthy();
    expect(field.value).toBe('');
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => { expect(state.proxyPassword).toBeNull(); });
    expect(callsOf(state, 'set_proxy_password').map((c) => c.args.password)).toEqual(['hunter2-proxy', null]);
  });

  it('says why a password was refused', async () => {
    const state = installFakeBackend();
    state.failures.set_proxy_password = 'KEYCHAIN_UNAVAILABLE';
    const user = await openSettings('Proxy');
    await user.type(await screen.findByLabelText('Password'), 'hunter2-proxy');
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    expect((await screen.findByRole('alert')).textContent).toContain('keychain');
  });

  it('remembers the password in the keychain only when ticked', async () => {
    const state = installFakeBackend();
    const user = await openSettings('Proxy');
    const remember = await screen.findByRole('checkbox', { name: 'Remember the password in the system keychain' });
    expect((remember as HTMLInputElement).checked).toBe(false);
    await user.click(remember);
    await waitFor(() => { expect(state.appSettings.proxy.rememberPassword).toBe(true); });
  });
});

// #364: the search in Settings finds a setting by its name and opens its section.
describe('searching Settings', () => {
  it('finds a setting by its name and opens the section it is in', async () => {
    installFakeBackend();
    const user = await openSettings();
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    await user.type(within(dialog).getByRole('searchbox', { name: 'Search settings' }), 'listening port');
    await user.click(await within(dialog).findByRole('button', { name: /Listening port \(0 for any\)/ }));
    expect(within(dialog).getByRole('button', { name: 'BitTorrent' }).getAttribute('aria-current')).toBe('page');
    expect(within(dialog).getByRole<HTMLInputElement>('searchbox', { name: 'Search settings' }).value).toBe('');
    expect(await within(dialog).findByText('Listening port (0 for any)')).toBeTruthy();
  });

  it('says so when no setting matches', async () => {
    installFakeBackend();
    const user = await openSettings();
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    await user.type(within(dialog).getByRole('searchbox', { name: 'Search settings' }), 'zzz');
    expect(await within(dialog).findByText('No setting matches “zzz”.')).toBeTruthy();
  });

  it.each(Object.entries(SETTINGS_INDEX))('finds only settings that the %s section really shows', async (section, titles) => {
    installFakeBackend();
    renderApp();
    await screen.findByText('No downloads yet');
    act(() => { useUiStore.getState().openSettings(section as SettingsSection); });
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    await waitFor(() => { expect(within(dialog).queryByText('Loading settings…')).toBeNull(); });
    for (const title of titles) expect(await within(dialog).findAllByText(title)).not.toHaveLength(0);
  });
});
