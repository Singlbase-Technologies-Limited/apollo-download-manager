import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { callsOf, installFakeBackend } from '../test/fakeBackend';
import { TitleBar } from './TitleBar';

describe('TitleBar', () => {
  it('names the app and lets the window be dragged by it', async () => {
    const state = installFakeBackend();
    render(<TitleBar title="Apollo Download Manager" />);
    const bar = screen.getByRole('banner');
    expect(within(bar).getByText('Apollo Download Manager').textContent).toBe('Apollo Download Manager');
    expect(bar.hasAttribute('data-tauri-drag-region')).toBe(true);
    await waitFor(() => { expect(callsOf(state, 'plugin:window|is_maximized')).toHaveLength(1); });
  });

  it('minimises, maximises and closes the window from its own buttons', async () => {
    const state = installFakeBackend();
    const user = userEvent.setup();
    render(<TitleBar title="Apollo Download Manager" />);
    await user.click(screen.getByRole('button', { name: 'Minimize' }));
    await user.click(screen.getByRole('button', { name: 'Maximize' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(callsOf(state, 'plugin:window|minimize')).toHaveLength(1);
    expect(callsOf(state, 'plugin:window|toggle_maximize')).toHaveLength(1);
    // Closing asks the native side, which hides to the tray or quits as the settings say.
    expect(callsOf(state, 'plugin:window|close')).toHaveLength(1);
  });
});
