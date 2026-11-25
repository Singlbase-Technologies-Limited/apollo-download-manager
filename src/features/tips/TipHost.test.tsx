import { emit } from '@tauri-apps/api/event';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import type { DownloadsSnapshot, Settings } from '../../contract';
import { DEFAULT_LAYOUT } from '../../layout/layoutLogic';
import { createQueryClient } from '../../lib/queries';
import { INITIAL_LIST, useDownloadsStore } from '../../stores/downloads';
import { useUiStore } from '../../stores/ui';
import { callsOf, emptySnapshot, fixture, installFakeBackend, setUp } from '../../test/fakeBackend';
import { makeRecord } from '../../test/records';
import { mayShow, TIPS, useTipStore } from './tips';

// #460. PO decisions, 2026-11-17: a card in the corner; a Tips page under Help; no tips before the guide is seen;
// none that repeats the guide: so three tips, network, tray and magnet files.
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
  });
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1366 });
  useUiStore.setState({ view: 'all', categoryFilter: null, layout: { ...DEFAULT_LAYOUT }, detailsId: null, settingsOpen: false, tourStep: null });
  useDownloadsStore.setState({ snapshot: null, error: null, ...INITIAL_LIST });
  useTipStore.setState({ pending: null, current: null, sessionUsed: false, pageOpen: false });
});

const allOff = (): Settings => {
  const s = fixture('settings.json') as Settings;
  return { ...s, general: { ...s.general, closeToTray: false }, queue: { ...s.queue, restartOnNetwork: false }, newTorrents: { ...s.newTorrents, chooseFilesForMagnets: false } };
};

const droppedConnection = (): DownloadsSnapshot => ({
  ...emptySnapshot(),
  downloads: [makeRecord({ id: 'd-1', status: 'failed', error: { class: 'transient', httpStatus: null, message: 'No connection.', retryable: true, hostKey: null, confirm: null, noNetwork: true, detail: null, loginRequired: false } })],
});

describe('which tip may show (#460)', () => {
  const ctx = { guide: 'finished' as const, tips: { enabled: true, shown: [], dismissed: [] }, settings: allOff(), tray: true, sessionUsed: false };
  it('shows a useful tip after the guide, with tips on, once per session', () => {
    expect(mayShow('restartOnNetwork', ctx)).toBe(true);
    expect(mayShow('restartOnNetwork', { ...ctx, guide: 'unseen' })).toBe(false);
    expect(mayShow('restartOnNetwork', { ...ctx, tips: { ...ctx.tips, enabled: false } })).toBe(false);
    expect(mayShow('restartOnNetwork', { ...ctx, sessionUsed: true })).toBe(false);
    expect(mayShow('restartOnNetwork', { ...ctx, tips: { ...ctx.tips, dismissed: ['restartOnNetwork'] } })).toBe(false);
    expect(mayShow('restartOnNetwork', { ...ctx, settings: { ...ctx.settings, queue: { ...ctx.settings.queue, restartOnNetwork: true } } })).toBe(false);
    expect(mayShow('closeToTray', { ...ctx, tray: false })).toBe(false);
  });

  it('has exactly the three tips the guide doesn’t show', () => {
    expect(TIPS.map((t) => t.id)).toEqual(['restartOnNetwork', 'closeToTray', 'chooseMagnetFiles']);
  });
});

describe('the tip card (#460)', () => {
  it('shows after a download failed from a dropped connection, read out, and dismissed for good', async () => {
    const state = installFakeBackend({ snapshot: droppedConnection(), appSettings: allOff() });
    const user = userEvent.setup();
    render(<App client={createQueryClient()} />);
    const card = await screen.findByRole('region', { name: 'Tip' });
    expect(card.closest('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
    expect(card.textContent).toContain('restart downloads by itself when the network is back');
    expect(card.contains(document.activeElement)).toBe(false);
    await user.click(within(card).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('region', { name: 'Tip' })).toBeNull();
    const saved = callsOf(state, 'set_tips').map((c) => c.args.tips);
    expect(saved).toEqual([
      { enabled: true, shown: ['restartOnNetwork'], dismissed: [] },
      { enabled: true, shown: ['restartOnNetwork'], dismissed: ['restartOnNetwork'] },
    ]);
  });

  it('shows after quitting was cancelled with downloads running', async () => {
    installFakeBackend({ snapshot: emptySnapshot(), appSettings: allOff() });
    const user = userEvent.setup();
    render(<App client={createQueryClient()} />);
    await screen.findByText('No downloads yet');
    await act(() => emit('quit-requested', { active: 1 }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Keep downloading' }));
    expect((await screen.findByRole('region', { name: 'Tip' })).textContent).toContain('keep Apollo DM running in the tray');
  });

  it('shows after a magnet link was added', async () => {
    installFakeBackend({ snapshot: emptySnapshot(), appSettings: allOff() });
    const user = userEvent.setup();
    render(<App client={createQueryClient()} />);
    await user.click(await screen.findByRole('button', { name: 'Add download' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add download' });
    await user.click(within(dialog).getByRole('textbox', { name: 'Links' }));
    await user.paste('magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    await user.click(within(dialog).getByRole('button', { name: 'Start download' }));
    expect((await screen.findByRole('region', { name: 'Tip' })).textContent).toContain('magnet link’s files');
  });

  it('turns the feature on from its button', async () => {
    const state = installFakeBackend({ snapshot: droppedConnection(), appSettings: allOff() });
    const user = userEvent.setup();
    render(<App client={createQueryClient()} />);
    const card = await screen.findByRole('region', { name: 'Tip' });
    await user.click(within(card).getByRole('button', { name: 'Restart them by themselves' }));
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(state.appSettings.queue.restartOnNetwork).toBe(true);
    expect(state.settings.tips.dismissed).toEqual(['restartOnNetwork']);
  });

  it('waits for the guide after Get started', async () => {
    installFakeBackend({ snapshot: droppedConnection(), appSettings: allOff(), settings: { ...setUp(), guide: 'unseen' } });
    render(<App client={createQueryClient()} />);
    await screen.findByRole('button', { name: 'Show me around' });
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(screen.queryByRole('region', { name: 'Tip' })).toBeNull();
  });

  it('stays off with Show tips off, and after it was dismissed', async () => {
    installFakeBackend({ snapshot: droppedConnection(), appSettings: allOff(), settings: { ...setUp(), tips: { enabled: false, shown: [], dismissed: [] } } });
    render(<App client={createQueryClient()} />);
    await screen.findByRole('navigation', { name: 'Primary' });
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(screen.queryByRole('region', { name: 'Tip' })).toBeNull();
  });

  it('never shows over a dialog, and shows once it closes', async () => {
    installFakeBackend({ snapshot: emptySnapshot(), appSettings: allOff() });
    render(<App client={createQueryClient()} />);
    await screen.findByText('No downloads yet');
    act(() => { useUiStore.getState().openSettings(); });
    act(() => { useTipStore.getState().request('chooseMagnetFiles'); });
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(screen.queryByRole('region', { name: 'Tip' })).toBeNull();
    act(() => { useUiStore.getState().closeSettings(); });
    expect((await screen.findByRole('region', { name: 'Tip' })).textContent).toContain('magnet link’s files');
  });

  it('shows the tray tip only where there is a tray', async () => {
    installFakeBackend({ snapshot: emptySnapshot(), appSettings: allOff(), tray: false });
    render(<App client={createQueryClient()} />);
    await screen.findByText('No downloads yet');
    act(() => { useTipStore.getState().request('closeToTray'); });
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(screen.queryByRole('region', { name: 'Tip' })).toBeNull();
  });

  it('shows one tip per session', async () => {
    installFakeBackend({ snapshot: emptySnapshot(), appSettings: allOff() });
    const user = userEvent.setup();
    render(<App client={createQueryClient()} />);
    await screen.findByText('No downloads yet');
    act(() => { useTipStore.getState().request('chooseMagnetFiles'); });
    await user.click(within(await screen.findByRole('region', { name: 'Tip' })).getByRole('button', { name: 'Dismiss tip' }));
    act(() => { useTipStore.getState().request('closeToTray'); });
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(screen.queryByRole('region', { name: 'Tip' })).toBeNull();
  });
});

describe('Help, then Tips (#460)', () => {
  it('lists every tip with what happened to it, turns one on, and has the Show tips switch', async () => {
    const state = installFakeBackend({ snapshot: emptySnapshot(), appSettings: allOff(), settings: { ...setUp(), tips: { enabled: true, shown: ['closeToTray'], dismissed: ['chooseMagnetFiles'] } } });
    const user = userEvent.setup();
    render(<App client={createQueryClient()} />);
    await screen.findByText('No downloads yet');
    await user.click(within(await screen.findByRole('banner')).getByRole('button', { name: 'Help' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Tips' }));
    const page = await screen.findByRole('dialog', { name: 'Tips' });
    const items = within(page).getAllByRole('listitem');
    expect(items.map((li) => within(li).getByRole('heading').textContent)).toEqual(['When the connection drops', 'Downloading with the window closed', 'Choosing a torrent’s files']);
    expect(items.map((li) => li.textContent.match(/Not shown yet|Shown|Dismissed/)?.[0])).toEqual(['Not shown yet', 'Shown', 'Dismissed']);
    await user.click(within(items[2] as HTMLElement).getByRole('button', { name: 'Show me the files first' }));
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(state.appSettings.newTorrents.chooseFilesForMagnets).toBe(true);
    expect(within(items[2] as HTMLElement).getByRole('button', { name: 'Already on' })).toBeTruthy();
    await user.click(within(page).getByRole('checkbox', { name: /Show tips/ }));
    expect(callsOf(state, 'set_tips').at(-1)?.args.tips).toMatchObject({ enabled: false });
  });
});
