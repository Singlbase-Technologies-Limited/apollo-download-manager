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
  useUiStore.setState({ view: 'all', categoryFilter: null, layout: { ...DEFAULT_LAYOUT }, detailsId: null });
  useDownloadsStore.setState({ snapshot: null, error: null, ...INITIAL_LIST });
});

const bar = () => screen.findByRole('navigation', { name: 'Sections' });

describe('the icon bar', () => {
  it('has the sections at the top and What’s new, Feedback and Settings at the bottom, each named', async () => {
    installFakeBackend({ snapshot: emptySnapshot() });
    render(<App client={createQueryClient()} />);
    const names = within(await bar()).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Downloads', 'History', 'Categories', 'What’s new', 'Feedback', 'Settings']);
  });

  it('marks the section shown and switches to another', async () => {
    installFakeBackend({ snapshot: emptySnapshot() });
    const user = userEvent.setup();
    render(<App client={createQueryClient()} />);
    const nav = await bar();
    expect(within(nav).getByRole('button', { name: 'Downloads' }).getAttribute('aria-current')).toBe('page');
    await user.click(within(nav).getByRole('button', { name: 'History' }));
    expect(useUiStore.getState().view).toBe('history');
    expect(within(nav).getByRole('button', { name: 'History' }).getAttribute('aria-current')).toBe('page');
    await user.click(within(nav).getByRole('button', { name: 'Downloads' }));
    expect(useUiStore.getState().view).toBe('all');
  });

  it('shows its name in a tooltip, as its icon has no label', async () => {
    installFakeBackend({ snapshot: emptySnapshot() });
    const user = userEvent.setup();
    render(<App client={createQueryClient()} />);
    await bar();
    act(() => { (document.activeElement as HTMLElement | null)?.blur(); });
    await user.hover(within(await bar()).getByRole('button', { name: 'Categories' }));
    expect((await screen.findByRole('tooltip')).textContent).toBe('Categories');
  });

  it('says where the release notes are, from What’s new', async () => {
    installFakeBackend({ snapshot: emptySnapshot() });
    const user = userEvent.setup();
    render(<App client={createQueryClient()} />);
    await user.click(within(await bar()).getByRole('button', { name: 'What’s new' }));
    const dialog = await screen.findByRole('dialog', { name: 'What’s new' });
    expect(dialog.textContent).toContain('CHANGELOG');
  });

  it('opens the feedback page in the browser and sends nothing itself', async () => {
    const state = installFakeBackend({ snapshot: emptySnapshot() });
    const user = userEvent.setup();
    render(<App client={createQueryClient()} />);
    await user.click(within(await bar()).getByRole('button', { name: 'Feedback' }));
    expect(callsOf(state, 'open_feedback_page')).toHaveLength(1);
    expect(callsOf(state, 'open_feedback_page')[0]?.args).toEqual({});
  });
});
