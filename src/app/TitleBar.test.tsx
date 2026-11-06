import { emit } from '@tauri-apps/api/event';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { callsOf, installFakeBackend } from '../test/fakeBackend';
import { TooltipProvider } from '../components/Tooltip';
import { TitleBar } from './TitleBar';

// The bar's buttons have tooltips; App mounts their provider in the window.
const renderBar = () => render(<TooltipProvider><TitleBar title="Apollo Download Manager" /></TooltipProvider>);

describe('the maximise button on Windows 11 (#359)', () => {
  afterEach(() => { vi.restoreAllMocks(); });
  const placed = (x: number) => vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x, y: 0, width: 44, height: 32 } as DOMRect);

  it('tells the native side where the button is, and again when the window resizes', async () => {
    const state = installFakeBackend();
    placed(1000);
    renderBar();
    await waitFor(() => { expect(callsOf(state, 'set_maximize_button_rect')).toHaveLength(1); });
    expect(callsOf(state, 'set_maximize_button_rect')[0]?.args).toEqual({ rect: { x: 1000, y: 0, width: 44, height: 32 } });
    placed(700);
    act(() => { window.dispatchEvent(new Event('resize')); });
    await waitFor(() => { expect(callsOf(state, 'set_maximize_button_rect').at(-1)?.args).toEqual({ rect: { x: 700, y: 0, width: 44, height: 32 } }); });
  });

  it('says nothing while the button has no size', async () => {
    const state = installFakeBackend();
    renderBar();
    await waitFor(() => { expect(callsOf(state, 'plugin:window|is_maximized')).toHaveLength(1); });
    expect(callsOf(state, 'set_maximize_button_rect')).toEqual([]);
  });

  it('shows the hover and press the native side reports, since it has the mouse there', async () => {
    const state = installFakeBackend();
    renderBar();
    await waitFor(() => { expect(callsOf(state, 'plugin:window|is_maximized')).toHaveLength(1); });
    const button = screen.getByRole('button', { name: 'Maximize' });
    await waitFor(async () => {
      await act(() => emit('maximize-button', 'hover'));
      expect(button.getAttribute('data-native')).toBe('hover');
    });
    await act(() => emit('maximize-button', 'pressed'));
    expect(button.getAttribute('data-native')).toBe('pressed');
    await act(() => emit('maximize-button', 'idle'));
    expect(button.getAttribute('data-native')).toBe('idle');
  });

  it('ignores a state it doesn’t know', async () => {
    const state = installFakeBackend();
    renderBar();
    await waitFor(() => { expect(callsOf(state, 'plugin:window|is_maximized')).toHaveLength(1); });
    const button = screen.getByRole('button', { name: 'Maximize' });
    await act(() => emit('maximize-button', 'sideways'));
    expect(button.getAttribute('data-native')).toBe('idle');
  });
});

describe('TitleBar', () => {
  it('names the app and lets the window be dragged by it', async () => {
    const state = installFakeBackend();
    renderBar();
    const bar = screen.getByRole('banner');
    expect(within(bar).getByText('Apollo Download Manager').textContent).toBe('Apollo Download Manager');
    expect(bar.hasAttribute('data-tauri-drag-region')).toBe(true);
    await waitFor(() => { expect(callsOf(state, 'plugin:window|is_maximized')).toHaveLength(1); });
  });

  it('minimises, maximises and closes the window from its own buttons', async () => {
    const state = installFakeBackend();
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByRole('button', { name: 'Minimize' }));
    await user.click(screen.getByRole('button', { name: 'Maximize' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(callsOf(state, 'plugin:window|minimize')).toHaveLength(1);
    expect(callsOf(state, 'plugin:window|toggle_maximize')).toHaveLength(1);
    // Closing asks the native side, which hides to the tray or quits as the settings say.
    expect(callsOf(state, 'plugin:window|close')).toHaveLength(1);
  });
});
