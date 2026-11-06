import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DropdownMenu } from './Menu';
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

  it('still opens on hover when its button is disabled, as the browser’s tooltip did', async () => {
    render(
      <TooltipProvider>
        <Tooltip label="Resume selected" canBeDisabled>
          <button type="button" aria-label="Resume selected" disabled className="pointer-events-none">
            ▶
          </button>
        </Tooltip>
      </TooltipProvider>,
    );
    const button = screen.getByRole('button', { name: 'Resume selected' });
    await userEvent.hover(button.parentElement ?? button);
    expect((await screen.findByRole('tooltip')).textContent).toContain('Resume selected');
  });

  it('keeps the same button element when it turns disabled, so keyboard focus is not lost', () => {
    const tip = (disabled: boolean) => (
      <TooltipProvider>
        <Tooltip label="Resume selected" canBeDisabled>
          <button type="button" aria-label="Resume selected" disabled={disabled}>▶</button>
        </Tooltip>
      </TooltipProvider>
    );
    const { rerender } = render(tip(false));
    const before = screen.getByRole('button', { name: 'Resume selected' });
    rerender(tip(true));
    expect(screen.getByRole('button', { name: 'Resume selected' })).toBe(before);
  });

  it('can be the trigger of a menu, which still opens', async () => {
    render(
      <TooltipProvider>
        <DropdownMenu
          trigger={
            <Tooltip label="More actions">
              <button type="button" aria-label="More actions">⋯</button>
            </Tooltip>
          }
          items={[{ label: 'Retry all failed', onSelect: () => undefined }]}
        />
      </TooltipProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(await screen.findByRole('menuitem', { name: 'Retry all failed' })).toBeTruthy();
  });

  it('adds no title attribute, so the browser shows no second tooltip', () => {
    renderWithTip();
    expect(screen.getByRole('button', { name: 'Add download' }).getAttribute('title')).toBeNull();
  });
});
