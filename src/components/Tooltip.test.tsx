import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Tooltip, TooltipProvider } from './Tooltip';

// #348 H: one tooltip for the whole window, in place of the browser's own `title` tooltips.
function renderWithTip(shortcut?: string) {
  return render(
    <TooltipProvider>
      <Tooltip label="Add download" shortcut={shortcut}>
        <button type="button" aria-label="Add download">+</button>
      </Tooltip>
    </TooltipProvider>,
  );
}

describe('Tooltip', () => {
  it('shows its label as soon as the trigger gets keyboard focus', async () => {
    renderWithTip();
    expect(screen.queryByRole('tooltip')).toBeNull();
    await userEvent.tab();
    expect((await screen.findByRole('tooltip')).textContent).toContain('Add download');
  });

  it('shows the shortcut beside the label', async () => {
    renderWithTip('Ctrl+N');
    await userEvent.tab();
    expect((await screen.findByRole('tooltip')).textContent).toContain('Ctrl+N');
  });

  it('leaves the trigger its own accessible name', async () => {
    renderWithTip('Ctrl+N');
    await userEvent.tab();
    await screen.findByRole('tooltip');
    expect(screen.getByRole('button', { name: 'Add download' })).toBeTruthy();
  });

  it('closes on Escape', async () => {
    renderWithTip();
    await userEvent.tab();
    await screen.findByRole('tooltip');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('adds no title attribute, so the browser shows no second tooltip', () => {
    renderWithTip();
    expect(screen.getByRole('button', { name: 'Add download' }).getAttribute('title')).toBeNull();
  });
});
