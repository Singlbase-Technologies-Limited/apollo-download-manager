import { emit } from '@tauri-apps/api/event';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import type { DownloadRecord, DownloadsSnapshot } from '../../contract';
import { DEFAULT_LAYOUT } from '../../layout/layoutLogic';
import { createQueryClient } from '../../lib/queries';
import { INITIAL_LIST, useDownloadsStore } from '../../stores/downloads';
import { useUiStore } from '../../stores/ui';
import { callsOf, emptySnapshot, installFakeBackend, type FakeState } from '../../test/fakeBackend';
import { makeRecord } from '../../test/records';
import { chooseOption } from '../../test/select';

// V1's details-panel tests (tests/unit/app.test.tsx, "download list"), ported to V2's panel, and the panel's own (#61).

function renderApp() {
  return render(<App client={createQueryClient()} />);
}

const grid = () => screen.findByRole('grid', { name: 'Downloads' });
const rowFor = async (name: string) => {
  const cell = await within(await grid()).findByText(name);
  const row = cell.closest<HTMLElement>('[role="row"]');
  if (!row) throw new Error(`no row for ${name}`);
  return row;
};
const panel = () => screen.findByRole('complementary', { name: 'Download details' });
const heading = (p: HTMLElement) => within(p).getByRole('heading', { level: 2 }).textContent;
/** #349: a download's own settings are changed in a dialog, from the panel's footer. */
const openEdit = async (user: ReturnType<typeof userEvent.setup>, p: HTMLElement) => {
  await user.click(within(p).getByRole('button', { name: 'Edit…' }));
  return screen.findByRole('dialog', { name: 'Edit download' });
};

const progress = makeRecord().progress;
const archive = makeRecord({
  id: 'a',
  fileName: 'archive.zip',
  sourceUrl: 'https://example.com/a.zip',
  status: 'downloading',
  createdAtMs: 1,
  speedLimitBps: null,
  requestedConnections: 8,
  progress: { ...progress, completedBytes: 250, totalBytes: 1000, downloadSpeedBps: 100, connections: 3, connectionDetail: { requested: 8, allowed: 4, limitedBy: 'serverThrottling' } },
});
const movie = makeRecord({ id: 'b', fileName: 'movie.mp4', status: 'paused', createdAtMs: 2, speedLimitBps: 512 * 1024, requestedConnections: 4 });
const broken = makeRecord({
  id: 'c',
  fileName: 'broken.iso',
  status: 'failed',
  createdAtMs: 3,
  error: { class: 'permanent', httpStatus: 404, message: 'The file was not found on the server (HTTP 404).', retryable: false, hostKey: null, confirm: null, noNetwork: false, detail: null, loginRequired: false },
});
const done = makeRecord({ id: 'd', fileName: 'setup.exe', status: 'completed', createdAtMs: 4, completedAtMs: 5, verification: 'notVerified' });
const album = makeRecord({
  id: 'e',
  kind: 'magnet',
  fileName: 'album',
  status: 'seeding',
  createdAtMs: 6,
  requestedConnections: null,
  torrent: { peers: 7, seeds: 2, uploadedBytes: 8 * 1024 * 1024, seedingSecs: 600, seedQueued: false },
});

function withDownloads(downloads: DownloadRecord[], over: Partial<DownloadsSnapshot> = {}): DownloadsSnapshot {
  return { ...emptySnapshot(), downloads, ...over };
}

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
  });
  useUiStore.setState({ view: 'all', categoryFilter: null, layout: { ...DEFAULT_LAYOUT }, addDialog: { open: false, prefill: null }, detailsId: null });
  useDownloadsStore.setState({ snapshot: null, error: null, ...INITIAL_LIST });
});

describe('the details panel (V1)', () => {
  beforeEach(() => {
    installFakeBackend({ snapshot: withDownloads([archive, movie, broken, done, album]) });
  });

  it('opens on a double-click and groups the details into sections', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.dblClick(await rowFor('archive.zip'));
    const p = await panel();
    for (const name of ['Transfer', 'Source and destination', 'Timeline']) {
      expect(within(p).getByRole('region', { name })).toBeTruthy();
    }
    // #349: its own settings moved from an Options section to the Edit dialog.
    expect(within(p).queryByRole('region', { name: 'Options for this download' })).toBeNull();
    expect(within(p).getByRole('button', { name: 'Edit…' })).toBeTruthy();
    const source = within(p).getByRole('region', { name: 'Source and destination' });
    expect(within(source).getByText('Folder')).toBeTruthy();
    expect(within(source).getByText('https://example.com/a.zip')).toBeTruthy();
  });

  it('fits a very long link in the panel, keeps it whole for screen readers, and copies all of it', async () => {
    const long = `https://releases.example.com/2026/images/server/disk-image-amd64.iso?session=${'0123456789'.repeat(28)}`;
    installFakeBackend({ snapshot: withDownloads([makeRecord({ id: 'l', fileName: 'disk-image-amd64.iso', sourceUrl: long, createdAtMs: 9 })]) });
    const user = userEvent.setup();
    renderApp();
    await user.dblClick(await rowFor('disk-image-amd64.iso'));
    const source = within(await panel()).getByRole('region', { name: 'Source and destination' });
    expect(within(source).getByText('releases.example.com/…/disk-image-amd64.iso')).toBeTruthy();
    expect(within(source).getByText(long).className).toContain('sr-only');
    await user.click(within(source).getByRole('button', { name: 'Copy link' }));
    expect(await navigator.clipboard.readText()).toBe(long);
  });

  it('shows errors in the details panel', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.dblClick(await rowFor('broken.iso'));
    expect(within(await panel()).getByRole('alert').textContent).toContain('HTTP 404');
  });

  // #248: an SFTP host key's fingerprint is one long word; the user compares it, so it must wrap
  // inside the panel rather than run past its edge.
  it('wraps a long word in an error inside the panel', async () => {
    const fingerprint = 'SHA256:ftodxfmUVqw3bWVdI8IG5VtcFIfEZp0b48OwQYahtokftodxfmUVqw3bWVdI8IG5Vtc';
    const host = makeRecord({
      id: 'f',
      fileName: 'test-50mb.bin',
      status: 'failed',
      createdAtMs: 7,
      error: { class: 'permanent', httpStatus: null, message: `The server's identity isn't confirmed yet. Check that its host key fingerprint is ${fingerprint}, then trust it to continue.`, retryable: false, hostKey: null, confirm: null, noNetwork: false, detail: null, loginRequired: false },
    });
    installFakeBackend({ snapshot: withDownloads([host]) });
    const user = userEvent.setup();
    renderApp();
    await user.dblClick(await rowFor('test-50mb.bin'));
    const alert = within(await panel()).getByRole('alert');
    expect(alert.textContent).toContain(fingerprint);
    expect(alert.className).toMatch(/\bmin-w-0\b/);
    expect(alert.className).toMatch(/\bbreak-words\b/);
  });

  // #257: a download that dropped the bytes it had says why, while it runs and after.
  it('says why a download started again', async () => {
    const why = 'The file on the server changed, so the download started again.';
    const restarted = makeRecord({ id: 'f', fileName: 'big.rar', status: 'downloading', createdAtMs: 7, startedOver: why });
    installFakeBackend({ snapshot: withDownloads([restarted, { ...archive }]) });
    const user = userEvent.setup();
    renderApp();
    await user.dblClick(await rowFor('big.rar'));
    expect(within(await panel()).getByRole('status').textContent).toBe(why);
    await user.click(await rowFor('archive.zip'));
    expect(within(await panel()).queryByText(why)).toBeNull();
  });

  // #250: the hint under an error follows its class, and never promises that a retry helps.
  it.each([
    ['transient', true, 'Retrying may help once the cause is fixed.'],
    ['throttled', true, 'The server asked Apollo Download Manager to slow down. Retrying later may help.'],
    ['permanent', false, 'Retrying is unlikely to help without changing the request.'],
  ] as const)('shows the retry hint for a %s failure', async (failureClass, retryable, hint) => {
    const failed = makeRecord({
      id: 'f',
      fileName: 'test-50mb.bin',
      status: 'failed',
      createdAtMs: 7,
      error: { class: failureClass, httpStatus: null, message: 'The server name could not be resolved.', retryable, hostKey: null, confirm: null, noNetwork: false, detail: null, loginRequired: false },
    });
    installFakeBackend({ snapshot: withDownloads([failed]) });
    const user = userEvent.setup();
    renderApp();
    await user.dblClick(await rowFor('test-50mb.bin'));
    const alert = within(await panel()).getByRole('alert');
    expect(alert.textContent).toContain(hint);
    expect(alert.textContent).not.toContain('usually');
  });

  // #252: plain words first; the library's own text only behind a closed toggle, ready to copy.
  const expired = makeRecord({
    id: 'g',
    fileName: 'dataset.tar.gz',
    status: 'failed',
    createdAtMs: 8,
    error: {
      class: 'permanent',
      httpStatus: null,
      message: 'This website’s security certificate has expired.',
      retryable: false,
      hostKey: null,
      confirm: null,
      noNetwork: false,
      detail: 'libcurl error 60: SSL certificate problem: certificate has expired',
      loginRequired: false,
    },
  });

  it('shows the plain message, and the technical text only behind a closed toggle', async () => {
    installFakeBackend({ snapshot: withDownloads([expired]) });
    const user = userEvent.setup();
    renderApp();
    await user.dblClick(await rowFor('dataset.tar.gz'));
    const alert = within(await panel()).getByRole('alert');
    expect(alert.textContent).toContain('This website’s security certificate has expired.');
    expect(alert.textContent).not.toContain('libcurl');
    const toggle = within(alert).getByRole('button', { name: 'Technical details' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(alert.textContent).toContain('libcurl error 60: SSL certificate problem: certificate has expired');
  });

  it('copies the technical text', async () => {
    installFakeBackend({ snapshot: withDownloads([expired]) });
    const user = userEvent.setup();
    renderApp();
    await user.dblClick(await rowFor('dataset.tar.gz'));
    const alert = within(await panel()).getByRole('alert');
    await user.click(within(alert).getByRole('button', { name: 'Technical details' }));
    await user.click(within(alert).getByRole('button', { name: 'Copy technical details' }));
    // user-event gives the page a clipboard of its own; it holds what was copied.
    expect(await navigator.clipboard.readText()).toBe('libcurl error 60: SSL certificate problem: certificate has expired');
  });

  it('offers no technical details when there are none', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.dblClick(await rowFor('broken.iso'));
    const alert = within(await panel()).getByRole('alert');
    expect(within(alert).queryByRole('button', { name: 'Technical details' })).toBeNull();
  });

  it('keeps the open details panel on the selected download', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.dblClick(await rowFor('broken.iso'));
    const p = await panel();
    expect(heading(p)).toBe('broken.iso');

    await user.click(await rowFor('archive.zip'));
    expect(heading(p)).toBe('archive.zip');
    expect(within(p).getByText('https://example.com/a.zip')).toBeTruthy();

    await user.keyboard('{ArrowUp}');
    expect((await rowFor('movie.mp4')).getAttribute('aria-selected')).toBe('true');
    expect(heading(p)).toBe('movie.mp4');
  });

  it('sends nothing on Cancel, and the next edit starts from the saved values', async () => {
    const user = userEvent.setup();
    const state = installFakeBackend({ snapshot: withDownloads([archive, movie, broken, done, album]) });
    renderApp();
    await user.dblClick(await rowFor('movie.mp4'));
    let dialog = await openEdit(user, await panel());
    const limit = within(dialog).getByLabelText<HTMLInputElement>(/Speed limit/);
    await user.clear(limit);
    await user.type(limit, '500');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(callsOf(state, 'set_download_speed_limit')).toHaveLength(0);
    dialog = await openEdit(user, await panel());
    expect(within(dialog).getByLabelText<HTMLInputElement>(/Speed limit/).value).toBe('512');
  });

  it('shows information only: no field or list to change in its sections', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.dblClick(await rowFor('archive.zip'));
    const p = await panel();
    for (const role of ['textbox', 'spinbutton', 'combobox'] as const) {
      expect(within(p).queryAllByRole(role)).toEqual([]);
    }
  });
});

// #349: every action sits in the panel's footer, the one that fits the download's state first.
describe('the details footer', () => {
  let state: FakeState;
  beforeEach(() => {
    state = installFakeBackend({ snapshot: withDownloads([archive, movie, broken, done, album]) });
  });
  const footer = async () => within(await panel()).getByRole('group', { name: 'Actions for this download' });
  const first = async () => within(await footer()).getAllByRole('button')[0]?.textContent.trim();

  it('offers the action that fits the state first', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(await rowFor('archive.zip'));
    expect(await first()).toBe('Pause');
    await user.click(await rowFor('movie.mp4'));
    expect(await first()).toBe('Resume');
    await user.click(await rowFor('broken.iso'));
    expect(await first()).toBe('Retry');
    await user.click(await rowFor('setup.exe'));
    expect(await first()).toBe('Open file');
  });

  it('acts on the download shown', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(await rowFor('broken.iso'));
    await user.click(within(await footer()).getByRole('button', { name: 'Retry' }));
    await waitFor(() => { expect(callsOf(state, 'retry_downloads')[0]?.args).toEqual({ ids: ['c'] }); });
  });

  it('keeps no action in the information above it', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(await rowFor('broken.iso'));
    const alert = within(await panel()).getByRole('alert');
    expect(within(alert).queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('has the rest in its menu, removing only after asking', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(await rowFor('movie.mp4'));
    await user.click(within(await footer()).getByRole('button', { name: 'More actions for this download' }));
    expect(await screen.findByRole('menuitem', { name: 'Copy link' })).toBeTruthy();
    await user.click(screen.getByRole('menuitem', { name: 'Remove from list…' }));
    const confirm = await screen.findByRole('alertdialog');
    // Answered, so the question doesn't stay open for the next test (the confirm store outlives a render).
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(callsOf(state, 'remove_downloads')).toHaveLength(0);
  });
});

// #349 (PO decision): a plain click on a row opens the details panel, even when the user closed it.
describe('a single click on a row', () => {
  beforeEach(() => {
    installFakeBackend({ snapshot: withDownloads([archive, movie, broken, done, album]) });
  });

  it('opens the details panel for that download', async () => {
    const user = userEvent.setup();
    renderApp();
    await rowFor('movie.mp4');
    expect(screen.queryByRole('complementary', { name: 'Download details' })).toBeNull();
    await user.click(await rowFor('movie.mp4'));
    expect(heading(await panel())).toBe('movie.mp4');
  });

  it('only selects with Ctrl or Shift, or on the row’s checkbox', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.keyboard('{Control>}');
    await user.click(await rowFor('movie.mp4'));
    await user.keyboard('{/Control}{Shift>}');
    await user.click(await rowFor('archive.zip'));
    await user.keyboard('{/Shift}');
    await user.click(screen.getByRole('checkbox', { name: 'Select setup.exe' }));
    expect(screen.queryByRole('complementary', { name: 'Download details' })).toBeNull();
  });
});

describe('the details panel (#61)', () => {
  let state: FakeState;
  beforeEach(() => {
    state = installFakeBackend({ snapshot: withDownloads([archive, movie, broken, done, album]) });
  });

  it('opens with Enter and the toolbar button, closes, and remembers whether it is open', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(await rowFor('movie.mp4'));
    await user.keyboard('{Enter}');
    expect(heading(await panel())).toBe('movie.mp4');
    await user.click(screen.getByRole('button', { name: 'Close details' }));
    await waitFor(() => { expect(screen.queryByRole('complementary', { name: 'Download details' })).toBeNull(); });
    const toggle = screen.getByRole('button', { name: 'Toggle details panel' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    await user.click(toggle);
    expect(heading(await panel())).toBe('movie.mp4');
    await waitFor(() => { expect(callsOf(state, 'set_appearance').at(-1)?.args).toMatchObject({ appearance: { layout: { detailsVisible: true } } }); });
  });

  it('shows the download it was opened for while the search hides it, and says so', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.dblClick(await rowFor('broken.iso'));
    const p = await panel();
    await user.type(screen.getByRole('searchbox', { name: 'Search downloads' }), 'movie');
    await waitFor(() => { expect(within(screen.getByRole('grid', { name: 'Downloads' })).queryByText('broken.iso')).toBeNull(); });
    expect(heading(p)).toBe('broken.iso');
    expect(within(p).getByRole('status').textContent).toContain('hidden by the search or filter');
  });

  it('says so when its download leaves the list, without showing another one', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.dblClick(await rowFor('broken.iso'));
    await panel();
    await act(() => emit('downloads-snapshot', withDownloads([archive, movie, done, album])));
    await waitFor(async () => { expect((await panel()).textContent).toContain('This download is no longer in the list.'); });
    expect(within(await panel()).queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('says how many connections are in use and what holds them back', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.dblClick(await rowFor('archive.zip'));
    const transfer = within(await panel()).getByRole('region', { name: 'Transfer' });
    expect(transfer.textContent).toContain('Using 3 connections, up to 4 of the 8 asked for: the server asked Apollo Download Manager to slow down.');
  });

  it('says a download that isn’t running isn’t connected, without the reason it had while it ran', async () => {
    const user = userEvent.setup();
    state.snapshot = withDownloads([{ ...movie, progress: { ...movie.progress, connections: 0, connectionDetail: { requested: 8, allowed: 4, limitedBy: 'serverThrottling' } } }]);
    renderApp();
    await user.dblClick(await rowFor('movie.mp4'));
    const transfer = within(await panel()).getByRole('region', { name: 'Transfer' });
    expect(transfer.textContent).toContain('Not connected.');
    expect(transfer.textContent).not.toContain('slow down');
  });

  it('changes the connections of a running download at once, with no restart to confirm', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.dblClick(await rowFor('archive.zip'));
    const dialog = await openEdit(user, await panel());
    const input = within(dialog).getByLabelText<HTMLInputElement>('Connections');
    expect(input.value).toBe('8');
    await user.clear(input);
    await user.type(input, '12');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => { expect(callsOf(state, 'set_download_connections')[0]?.args).toEqual({ id: 'a', connections: 12 }); });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(await screen.findByText('Connections set to 12')).toBeTruthy();
  });

  it('sets the speed limit and the category of the download shown', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.dblClick(await rowFor('movie.mp4'));
    const dialog = await openEdit(user, await panel());
    const limit = within(dialog).getByLabelText<HTMLInputElement>(/Speed limit/);
    await user.clear(limit);
    await user.type(limit, '256');
    await chooseOption(user, within(dialog).getByLabelText('Category'), 'None');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => { expect(callsOf(state, 'set_download_speed_limit').at(-1)?.args).toEqual({ id: 'b', kib: 256 }); });
    await waitFor(() => { expect(callsOf(state, 'set_download_category')[0]?.args).toEqual({ id: 'b', categoryId: null }); });
    expect(screen.queryByRole('dialog', { name: 'Edit download' })).toBeNull();
  });

  it('shows the verification state of a completed download', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.dblClick(await rowFor('broken.iso'));
    await user.click(await rowFor('setup.exe'));
    const transfer = within(await panel()).getByRole('region', { name: 'Transfer' });
    expect(transfer.textContent).toContain('Not verified');
  });

  it('opens a finished file, asking first when it is a program', async () => {
    const user = userEvent.setup();
    state.programs = ['d'];
    renderApp();
    await user.click(await rowFor('setup.exe'));
    await user.keyboard('{Enter}');
    await user.click(within(await panel()).getByRole('button', { name: 'Open file' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('can run code on your computer');
    await user.click(within(dialog).getByRole('button', { name: 'Open anyway' }));
    await waitFor(() => {
      expect(callsOf(state, 'open_download_file').map((c) => c.args)).toEqual([
        { id: 'd', allowProgram: false },
        { id: 'd', allowProgram: true },
      ]);
    });
  });

  it('opens nothing when the user declines to open a program', async () => {
    const user = userEvent.setup();
    state.programs = ['d'];
    renderApp();
    await user.click(await rowFor('setup.exe'));
    await user.keyboard('{Enter}');
    await user.click(within(await panel()).getByRole('button', { name: 'Open file' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(callsOf(state, 'open_download_file')).toHaveLength(1);
  });

  it('opens a finished file on a double-click, and the folder from the panel', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.dblClick(await rowFor('setup.exe'));
    await waitFor(() => { expect(callsOf(state, 'open_download_file')[0]?.args).toEqual({ id: 'd', allowProgram: false }); });
    await user.dblClick(await rowFor('movie.mp4'));
    expect(within(await panel()).queryByRole('button', { name: 'Open file' })).toBeNull();
    await user.click(within(await panel()).getByRole('button', { name: 'Open folder' }));
    await waitFor(() => { expect(callsOf(state, 'open_download_folder')[0]?.args).toEqual({ id: 'b' }); });
  });

  it('says why a file could not be opened', async () => {
    const user = userEvent.setup();
    state.failures.open_download_file = 'NOT_FOUND';
    renderApp();
    await user.dblClick(await rowFor('setup.exe'));
    expect(await screen.findByText(/no longer there/)).toBeTruthy();
  });

  it('offers opening and the details from the right-click menu', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.pointer({ keys: '[MouseRight]', target: await rowFor('setup.exe') });
    const menu = await screen.findByRole('menu');
    await user.click(within(menu).getByRole('menuitem', { name: 'Open folder' }));
    await waitFor(() => { expect(callsOf(state, 'open_download_folder')[0]?.args).toEqual({ id: 'd' }); });
    await user.pointer({ keys: '[MouseRight]', target: await rowFor('movie.mp4') });
    const again = await screen.findByRole('menu');
    expect(within(again).getByRole('menuitem', { name: 'Open file' }).getAttribute('aria-disabled')).toBe('true');
    await user.click(within(again).getByRole('menuitem', { name: 'Details' }));
    expect(heading(await panel())).toBe('movie.mp4');
  });

  it('shows a torrent’s peers and seeding, and no connections to set', async () => {
    const user = userEvent.setup();
    renderApp();
    // A double-click would open a seeding torrent's files.
    await user.click(await rowFor('album'));
    await user.keyboard('{Enter}');
    const p = await panel();
    const torrent = within(p).getByRole('region', { name: 'Torrent' });
    expect(torrent.textContent).toContain('7 connected, 2 with the whole torrent');
    expect(torrent.textContent).toContain('8.0 MiB');
    expect(torrent.textContent).toContain('10m 00s');
    expect(within(p).queryByLabelText('Connections')).toBeNull();
  });

  it('says a torrent’s peers are unknown until the helper reports them', async () => {
    const user = userEvent.setup();
    state.snapshot = withDownloads([{ ...album, torrent: null }]);
    renderApp();
    await user.click(await rowFor('album'));
    await user.keyboard('{Enter}');
    const torrent = within(await panel()).getByRole('region', { name: 'Torrent' });
    expect(torrent.textContent).toContain('Not reported yet');
  });
});
