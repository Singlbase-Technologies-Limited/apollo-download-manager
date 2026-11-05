import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Select } from './Select';

// #348 G: one dropdown for the whole window, its open list themed like the app (PO, 2026-11-05),
// with keyboard and screen-reader behaviour at least as good as the system's own list.
const SPEEDS = [
  { value: 'none', label: 'No limit' },
  { value: '1m', label: '1 MB/s' },
  { value: '5m', label: '5 MB/s' },
];

function Speed({ onChange, disabled }: { onChange?: (v: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState('1m');
  return (
    <>
      <label htmlFor="speed">Speed limit</label>
      <Select
        id="speed"
        value={value}
        options={SPEEDS}
        disabled={disabled}
        onValueChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
      />
    </>
  );
}

describe('Select', () => {
  it('shows the chosen option, named by its label', () => {
    render(<Speed />);
    const box = screen.getByRole('combobox', { name: 'Speed limit' });
    expect(box.textContent).toContain('1 MB/s');
  });

  it('opens a list of the options and takes the one clicked', async () => {
    const onChange = vi.fn();
    render(<Speed onChange={onChange} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Speed limit' }));
    const list = await screen.findByRole('listbox');
    expect(list).toBeTruthy();
    await userEvent.click(screen.getByRole('option', { name: '5 MB/s' }));
    expect(onChange).toHaveBeenCalledWith('5m');
    expect(screen.getByRole('combobox', { name: 'Speed limit' }).textContent).toContain('5 MB/s');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('works from the keyboard alone', async () => {
    const onChange = vi.fn();
    render(<Speed onChange={onChange} />);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Speed limit' }));
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('listbox');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('5m');
  });

  it('closes on Escape without changing the value', async () => {
    const onChange = vi.fn();
    render(<Speed onChange={onChange} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Speed limit' }));
    await screen.findByRole('listbox');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not open when disabled', async () => {
    render(<Speed disabled />);
    const box = screen.getByRole('combobox', { name: 'Speed limit' });
    expect((box as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(box);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
