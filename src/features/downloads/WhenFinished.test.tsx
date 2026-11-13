import { emit } from '@tauri-apps/api/event';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import type { DownloadRecord } from '../../contract';
import { DEFAULT_LAYOUT } from '../../layout/layoutLogic';
import { createQueryClient } from '../../lib/queries';
import { INITIAL_LIST, useDownloadsStore } from '../../stores/downloads';
import { useUiStore } from '../../stores/ui';
import { callsOf, emptySnapshot, installFakeBackend } from '../../test/fakeBackend';
import { makeRecord } from '../../test/records';

// #467: what the computer does once the downloads finish, chosen in the status bar.

const running = makeRecord({ id: 'a', fileName: 'big.iso', status: 'downloading' });
const done = makeRecord({ id: 'a', fileName: 'big.iso', status: 'completed' });
const snapshot = (downloads: DownloadRecord[]) => ({ ...emptySnapshot(), downloads });

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  // jsdom has no matchMedia; the window follows a light system here.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
  });
  useUiStore.setState({ view: 'all', categoryFilter: null, layout: { ...DEFAULT_LAYOUT }, addDialog: { open: false, prefill: null } });
  useDownloadsStore.setState({ snapshot: null, error: null, ...INITIAL_LIST });
});

afterEach(() => {
  vi.useRealTimers();
});

async function choose(user: ReturnType<typeof userEvent.setup>, item: string) {
  await user.click(await screen.findByRole('button', { name: /^When downloads finish/ }));
  await user.click(await screen.findByRole('menuitem', { name: item }));
}

describe('when the downloads finish (#467)', () => {
  it('counts down for a minute once the running downloads finish, then puts the computer to sleep, once', async () => {
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    const state = installFakeBackend({ snapshot: snapshot([running]) });
    render(<App client={createQueryClient()} />);
    await choose(user, 'Sleep');
    expect(screen.getByRole('button', { name: 'When downloads finish: Sleep' })).toBeTruthy();
    await act(() => emit('downloads-snapshot', snapshot([done])));
    const ask = await screen.findByRole('dialog', { name: 'Downloads finished' });
    expect(within(ask).getByText(/sleep in 60 seconds/)).toBeTruthy();
    // A tick a second, as the countdown shows it.
    for (let s = 0; s < 60; s++) await act(() => vi.advanceTimersByTimeAsync(1000));
    await waitFor(() => { expect(callsOf(state, 'finish_downloads').map((c) => c.args)).toEqual([{ action: 'sleep' }]); });
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    // It applies once: the choice is back to doing nothing.
    expect(screen.getByRole('button', { name: 'When downloads finish: Do nothing' })).toBeTruthy();
  });

  it('Cancel in the countdown does nothing, and the choice goes back to doing nothing', async () => {
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    const state = installFakeBackend({ snapshot: snapshot([running]) });
    render(<App client={createQueryClient()} />);
    await choose(user, 'Shut down');
    await act(() => emit('downloads-snapshot', snapshot([done])));
    const ask = await screen.findByRole('dialog', { name: 'Downloads finished' });
    await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
    await act(() => vi.advanceTimersByTimeAsync(61_000));
    expect(callsOf(state, 'finish_downloads')).toEqual([]);
    expect(screen.getByRole('button', { name: 'When downloads finish: Do nothing' })).toBeTruthy();
  });

  it('closes Apollo Download Manager when that was chosen, without waiting for the end of the countdown if asked', async () => {
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    const state = installFakeBackend({ snapshot: snapshot([running]) });
    render(<App client={createQueryClient()} />);
    await choose(user, 'Close Apollo Download Manager');
    await act(() => emit('downloads-snapshot', snapshot([done])));
    const ask = await screen.findByRole('dialog', { name: 'Downloads finished' });
    await user.click(within(ask).getByRole('button', { name: 'Close now' }));
    await waitFor(() => { expect(callsOf(state, 'quit_app')).toHaveLength(1); });
    expect(callsOf(state, 'finish_downloads')).toEqual([]);
  });

  it('does nothing when no download was running, and stops counting when one starts again', async () => {
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    const state = installFakeBackend({ snapshot: snapshot([done]) });
    render(<App client={createQueryClient()} />);
    await choose(user, 'Shut down');
    await act(() => emit('downloads-snapshot', snapshot([done])));
    expect(screen.queryByRole('dialog', { name: 'Downloads finished' })).toBeNull();
    await act(() => emit('downloads-snapshot', snapshot([running])));
    await act(() => emit('downloads-snapshot', snapshot([done])));
    expect(await screen.findByRole('dialog', { name: 'Downloads finished' })).toBeTruthy();
    await act(() => emit('downloads-snapshot', snapshot([running])));
    await waitFor(() => { expect(screen.queryByRole('dialog', { name: 'Downloads finished' })).toBeNull(); });
    await act(() => vi.advanceTimersByTimeAsync(61_000));
    expect(callsOf(state, 'finish_downloads')).toEqual([]);
  });
});
