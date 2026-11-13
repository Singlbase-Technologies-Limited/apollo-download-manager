import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT } from '../layout/layoutLogic';
import { createQueryClient } from '../lib/queries';
import { INITIAL_LIST, useDownloadsStore } from '../stores/downloads';
import { useUiStore } from '../stores/ui';
import { callsOf, emptySnapshot, installFakeBackend } from '../test/fakeBackend';
import { App } from './App';

// #363 (PO decision: option C): a slim icon bar on the window's left, always there.
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
  });
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1366 });
  useUiStore.setState({ view: 'all', categoryFilter: null, layout: { ...DEFAULT_LAYOUT }, detailsId: null, settingsOpen: false });
  useDownloadsStore.setState({ snapshot: null, error: null, ...INITIAL_LIST });
});

const banner = () => screen.findByRole('banner');

// #363 (PO decision, 2026-11-06: option B): a "?" help menu and a gear for Settings in the title bar.
describe('the title bar', () => {
  it('has a help menu and a Settings button beside the window buttons, each named', async () => {
    installFakeBackend({ snapshot: emptySnapshot() });
    render(<App client={createQueryClient()} />);
    await screen.findByText('No downloads yet');
    const bar = await banner();
    expect(within(bar).getByRole('button', { name: 'Help' })).toBeTruthy();
    expect(within(bar).getByRole('button', { name: 'Settings' })).toBeTruthy();
  });

  it('opens Settings from the gear, which shows its shortcut', async () => {
    installFakeBackend({ snapshot: emptySnapshot() });
    const user = userEvent.setup();
    render(<App client={createQueryClient()} />);
    await screen.findByText('No downloads yet');
    const gear = within(await banner()).getByRole('button', { name: 'Settings' });
    act(() => { (document.activeElement as HTMLElement | null)?.blur(); });
    await user.hover(gear);
    expect((await screen.findByRole('tooltip')).textContent).toContain('Ctrl+,');
    await user.click(gear);
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeTruthy();
  });

  it('shows this version’s changes from the changelog in What’s new, offline (#496)', async () => {
    installFakeBackend({ snapshot: emptySnapshot() });
    const user = userEvent.setup();
    render(<App client={createQueryClient()} />);
    await screen.findByText('No downloads yet');
    await user.click(within(await banner()).getByRole('button', { name: 'Help' }));
    await user.click(await screen.findByRole('menuitem', { name: 'What’s new' }));
    const dialog = await screen.findByRole('dialog', { name: 'What’s new' });
    // The fake app is 0.1.0: its section comes first, then nothing older.
    const versions = within(dialog).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(versions[0]).toBe('Version 0.1.0, 2026-10-31');
    expect(dialog.textContent).toContain('installs and runs beside V1');
    expect(dialog.textContent).not.toContain('A later version will show them here');
  });

  it('opens the feedback page in the browser and sends nothing itself', async () => {
    const state = installFakeBackend({ snapshot: emptySnapshot() });
    const user = userEvent.setup();
    render(<App client={createQueryClient()} />);
    await screen.findByText('No downloads yet');
    await user.click(within(await banner()).getByRole('button', { name: 'Help' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Send feedback…' }));
    expect(callsOf(state, 'open_feedback_page')).toHaveLength(1);
    expect(callsOf(state, 'open_feedback_page')[0]?.args).toEqual({});
  });

  it('opens About in Settings', async () => {
    installFakeBackend({ snapshot: emptySnapshot() });
    const user = userEvent.setup();
    render(<App client={createQueryClient()} />);
    await screen.findByText('No downloads yet');
    await user.click(within(await banner()).getByRole('button', { name: 'Help' }));
    await user.click(await screen.findByRole('menuitem', { name: 'About Apollo DM' }));
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    expect(within(dialog).getByRole('button', { name: 'About and diagnostics' }).getAttribute('aria-current')).toBe('page');
  });
});
