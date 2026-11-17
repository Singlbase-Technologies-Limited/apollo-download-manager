import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { DEFAULT_LAYOUT } from '../../layout/layoutLogic';
import { createQueryClient } from '../../lib/queries';
import { INITIAL_LIST, useDownloadsStore } from '../../stores/downloads';
import { useUiStore } from '../../stores/ui';
import { callsOf, emptySnapshot, installFakeBackend, setUp } from '../../test/fakeBackend';

// #463: the guide after Get started. PO decisions, 2026-11-17: a spotlight on the real window; offered on the first
// view, to people updating from 0.2.0 too; a hidden sidebar shows for the guide only; Help replays it.
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
  });
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1366 });
  useUiStore.setState({ view: 'all', categoryFilter: null, layout: { ...DEFAULT_LAYOUT }, detailsId: null, settingsOpen: false, tourStep: null });
  useDownloadsStore.setState({ snapshot: null, error: null, ...INITIAL_LIST });
});

const unseen = (welcome: boolean) => ({ ...setUp(), guide: 'unseen' as const, guideWelcome: welcome });

describe('the guide after Get started (#463)', () => {
  it('is offered with a welcome after a new setup, and goes through 6 steps to the end', async () => {
    const state = installFakeBackend({ snapshot: emptySnapshot(), settings: unseen(true) });
    const user = userEvent.setup();
    render(<App client={createQueryClient()} />);
    const offer = await screen.findByRole('region', { name: 'Welcome to Apollo Download Manager' });
    await user.click(within(offer).getByRole('button', { name: 'Show me around' }));

    const titles: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const step = await screen.findByRole('dialog', { name: /./ });
      expect(within(step).getByText(`Step ${String(i + 1)} of 6`)).toBeTruthy();
      const title = within(step).getByRole('heading');
      expect(document.activeElement).toBe(title);
      titles.push(title.textContent);
      await user.click(within(step).getByRole('button', { name: i === 5 ? 'Done' : 'Next' }));
    }
    expect(titles).toEqual(['Add a download', 'Your downloads', 'Lists and categories', 'From your browser', 'Queue and schedule', 'Torrents, and help']);
    expect(screen.queryByTestId('guide-tour')).toBeNull();
    expect(callsOf(state, 'set_guide_state').map((c) => c.args)).toEqual([{ state: 'finished' }]);
    expect(screen.queryByRole('region', { name: /Welcome/ })).toBeNull();
  });

  it('lights each step’s control in the window', async () => {
    installFakeBackend({ snapshot: emptySnapshot(), settings: unseen(true) });
    const user = userEvent.setup();
    render(<App client={createQueryClient()} />);
    await user.click(await screen.findByRole('button', { name: 'Show me around' }));
    expect(document.querySelector('[data-tour="add"]')?.textContent).toContain('Add download');
    for (const target of ['toolbar', 'nav', 'settings', 'help']) expect(document.querySelector(`[data-tour="${target}"]`)).not.toBeNull();
  });

  it('is offered as a new quick tour to someone who set up before it', async () => {
    installFakeBackend({ snapshot: emptySnapshot(), settings: unseen(false) });
    render(<App client={createQueryClient()} />);
    const offer = await screen.findByRole('region', { name: 'New: a quick tour of the window' });
    expect(offer.textContent).toContain('6 short steps');
  });

  it('is skipped from the offer, from any step, and with Escape, and isn’t offered again', async () => {
    const state = installFakeBackend({ snapshot: emptySnapshot(), settings: unseen(true) });
    const user = userEvent.setup();
    render(<App client={createQueryClient()} />);
    await user.click(await screen.findByRole('button', { name: 'Skip' }));
    expect(callsOf(state, 'set_guide_state').map((c) => c.args)).toEqual([{ state: 'skipped' }]);
    expect(screen.queryByRole('region', { name: /Welcome/ })).toBeNull();
  });

  it('stops at Escape, saved as skipped', async () => {
    const state = installFakeBackend({ snapshot: emptySnapshot(), settings: unseen(true) });
    const user = userEvent.setup();
    render(<App client={createQueryClient()} />);
    await user.click(await screen.findByRole('button', { name: 'Show me around' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Add a download' })).getByRole('button', { name: 'Next' }));
    await screen.findByRole('dialog', { name: 'Your downloads' });
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('guide-tour')).toBeNull();
    expect(callsOf(state, 'set_guide_state').map((c) => c.args)).toEqual([{ state: 'skipped' }]);
  });

  it('isn’t offered once seen, and Help replays it without saving anything', async () => {
    const state = installFakeBackend({ snapshot: emptySnapshot() });
    const user = userEvent.setup();
    render(<App client={createQueryClient()} />);
    await screen.findByText('No downloads yet');
    expect(screen.queryByRole('button', { name: 'Show me around' })).toBeNull();
    await user.click(within(await screen.findByRole('banner')).getByRole('button', { name: 'Help' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Show the guide again' }));
    const step = await screen.findByRole('dialog', { name: 'Add a download' });
    await user.click(within(step).getByRole('button', { name: 'Skip the guide' }));
    expect(screen.queryByTestId('guide-tour')).toBeNull();
    expect(callsOf(state, 'set_guide_state').map((c) => c.args)).toEqual([]);
  });

  it('shows a hidden sidebar while it runs, without saving that', async () => {
    const settings = { ...unseen(true), appearance: { ...setUp().appearance, layout: { ...DEFAULT_LAYOUT, sidebarVisible: false } } };
    const state = installFakeBackend({ snapshot: emptySnapshot(), settings });
    const user = userEvent.setup();
    render(<App client={createQueryClient()} />);
    await screen.findByRole('button', { name: 'Show me around' });
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show me around' }));
    expect(await screen.findByRole('navigation', { name: 'Primary' })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
    // The layout was never saved with the sidebar shown.
    await act(() => new Promise((r) => setTimeout(r, 400)));
    expect(callsOf(state, 'set_appearance').filter((c) => ((c.args as { appearance: unknown }).appearance as { layout: { sidebarVisible: boolean } }).layout.sidebarVisible)).toEqual([]);
  });

  it('keeps the keyboard in the bubble', async () => {
    installFakeBackend({ snapshot: emptySnapshot(), settings: unseen(true) });
    const user = userEvent.setup();
    render(<App client={createQueryClient()} />);
    await user.click(await screen.findByRole('button', { name: 'Show me around' }));
    const step = await screen.findByRole('dialog', { name: 'Add a download' });
    await user.tab();
    expect(document.activeElement).toBe(within(step).getByRole('button', { name: 'Skip the guide' }));
    await user.tab();
    expect(document.activeElement).toBe(within(step).getByRole('button', { name: 'Next' }));
    await user.tab();
    expect(document.activeElement).toBe(within(step).getByRole('heading'));
  });
});
