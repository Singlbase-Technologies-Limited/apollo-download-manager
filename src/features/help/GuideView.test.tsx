import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { DEFAULT_LAYOUT } from '../../layout/layoutLogic';
import { createQueryClient } from '../../lib/queries';
import { INITIAL_LIST, useDownloadsStore } from '../../stores/downloads';
import { useUiStore } from '../../stores/ui';
import { installFakeBackend } from '../../test/fakeBackend';

async function renderApp() {
  const user = userEvent.setup();
  installFakeBackend();
  render(<App client={createQueryClient()} />);
  await screen.findByText('No downloads yet');
  return user;
}

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
  });
  useUiStore.setState({ layout: { ...DEFAULT_LAYOUT }, settingsOpen: false, guide: null });
  useDownloadsStore.setState({ snapshot: null, error: null, ...INITIAL_LIST });
});

describe('the in-app user guide (#354)', () => {
  it('opens from the Help menu, offline, on the guide’s first page with its contents', async () => {
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Help' }));
    await user.click(await screen.findByRole('menuitem', { name: 'User guide' }));
    const guide = await screen.findByRole('dialog', { name: 'User guide' });
    const contents = within(guide).getByRole('navigation', { name: 'Guide contents' });
    expect(within(contents).getByRole('button', { name: 'Downloads' })).toBeTruthy();
    expect(within(guide).getByRole('heading', { level: 1, name: 'Apollo Download Manager: user guide' })).toBeTruthy();
  });

  it('opens a page at its very top, not at its heading, which sits below the page’s margin', async () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Help' }));
    await user.click(await screen.findByRole('menuitem', { name: 'User guide' }));
    const heading = await screen.findByRole('heading', { level: 1, name: 'Apollo Download Manager: user guide' });
    await waitFor(() => { expect(document.activeElement).toBe(heading); });
    expect(scroll).not.toHaveBeenCalled();
    scroll.mockRestore();
  });

  it('goes to a page from the contents, and on with previous and next', async () => {
    const user = await renderApp();
    act(() => { useUiStore.getState().openGuide(); });
    const guide = await screen.findByRole('dialog', { name: 'User guide' });
    await user.click(within(guide).getByRole('button', { name: 'Downloads' }));
    expect(within(guide).getByRole('heading', { level: 1, name: 'Downloads' })).toBeTruthy();
    expect(within(guide).getByRole('heading', { level: 2, name: 'Adding downloads' })).toBeTruthy();
    await user.click(within(guide).getByRole('button', { name: /Next: Protocols and limits/ }));
    expect(within(guide).getByRole('heading', { level: 1, name: 'Protocols and limits' })).toBeTruthy();
    await user.click(within(guide).getByRole('button', { name: /Previous: Downloads/ }));
    expect(within(guide).getByRole('heading', { level: 1, name: 'Downloads' })).toBeTruthy();
  });

  it('follows a link to another guide page', async () => {
    const user = await renderApp();
    act(() => { useUiStore.getState().openGuide('downloads'); });
    const guide = await screen.findByRole('dialog', { name: 'User guide' });
    const [link] = within(guide).getAllByRole('link', { name: 'guide' });
    if (!link) throw new Error('no link to the torrents guide');
    await user.click(link);
    expect(within(guide).getByRole('heading', { level: 1, name: 'Torrents' })).toBeTruthy();
  });

  it('searches every page and opens a result at its heading', async () => {
    const user = await renderApp();
    act(() => { useUiStore.getState().openGuide(); });
    const guide = await screen.findByRole('dialog', { name: 'User guide' });
    await user.type(within(guide).getByRole('searchbox', { name: 'Search the guide' }), 'proxy');
    const results = within(guide).getByRole('list', { name: 'Search results' });
    expect(within(guide).getByRole('status').textContent).toMatch(/^\d+ results?$/);
    await user.click(within(results).getByRole('button', { name: /Settings › Proxy/ }));
    expect(within(guide).getByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy();
    await waitFor(() => { expect(document.activeElement?.textContent).toBe('Proxy'); });
  });

  it('says so when nothing matches', async () => {
    const user = await renderApp();
    act(() => { useUiStore.getState().openGuide(); });
    const guide = await screen.findByRole('dialog', { name: 'User guide' });
    await user.type(within(guide).getByRole('searchbox', { name: 'Search the guide' }), 'zzqqxx');
    expect(within(guide).getByRole('status').textContent).toBe('No results');
  });

  it('opens at a heading from a link elsewhere in the app, and closes with Escape', async () => {
    const user = await renderApp();
    act(() => { useUiStore.getState().openGuide('settings', 'proxy'); });
    const guide = await screen.findByRole('dialog', { name: 'User guide' });
    await waitFor(() => { expect(document.activeElement?.textContent).toBe('Proxy'); });
    await user.keyboard('{Escape}');
    await waitFor(() => { expect(screen.queryByRole('dialog', { name: 'User guide' })).toBeNull(); });
    expect(guide).toBeTruthy();
  });

  it('opens from each Settings section at that section’s heading', async () => {
    const user = await renderApp();
    act(() => { useUiStore.getState().openSettings('performance'); });
    await user.click(await screen.findByRole('button', { name: 'Queue and performance in the user guide' }));
    await screen.findByRole('dialog', { name: 'User guide' });
    await waitFor(() => { expect(document.activeElement?.textContent).toBe('Queue and performance'); });
  });
});
