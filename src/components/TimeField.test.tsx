import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setTimeFormat } from '../lib/format';
import { chooseOption } from '../test/select';
import { TimeField } from './TimeField';

/** The names of the options the box offers, read from its open list, which is then closed again. */
async function optionsOf(user: ReturnType<typeof userEvent.setup>, box: HTMLElement) {
  await user.click(box);
  const names = within(await screen.findByRole('listbox')).getAllByRole('option').map((o) => o.textContent);
  await user.keyboard('{Escape}');
  return names;
}

// #350: a time is chosen, never typed, in the app's time format; it is stored as 24-hour HH:MM.
describe('TimeField', () => {
  afterEach(() => { setTimeFormat('twentyFourHour'); });

  it('chooses a 24-hour time by default', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimeField label="Start" value="02:30" onChange={onChange} />);
    const hour = screen.getByLabelText('Start, hour');
    expect(await optionsOf(user, hour)).toHaveLength(24);
    expect(hour.textContent).toBe('02');
    expect(screen.queryByLabelText('Start, AM or PM')).toBeNull();
    await chooseOption(user, hour, '14');
    expect(onChange).toHaveBeenLastCalledWith('14:30');
    await chooseOption(user, screen.getByLabelText('Start, minute'), '05');
    expect(onChange).toHaveBeenLastCalledWith('02:05');
  });

  it('chooses a 12-hour time with AM and PM when set', async () => {
    setTimeFormat('twelveHour');
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimeField label="Stop" value="14:00" onChange={onChange} />);
    const hour = screen.getByLabelText('Stop, hour');
    expect(await optionsOf(user, hour)).toEqual(['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
    expect(hour.textContent).toBe('2');
    const half = screen.getByLabelText('Stop, AM or PM');
    expect(half.textContent).toBe('PM');
    await chooseOption(user, half, 'AM');
    expect(onChange).toHaveBeenLastCalledWith('02:00');
    await chooseOption(user, hour, '12');
    expect(onChange).toHaveBeenLastCalledWith('12:00');
  });
});
