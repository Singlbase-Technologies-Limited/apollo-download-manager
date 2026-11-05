import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setTimeFormat } from '../lib/format';
import { TimeField } from './TimeField';

// #350: a time is chosen, never typed, in the app's time format; it is stored as 24-hour HH:MM.
describe('TimeField', () => {
  afterEach(() => { setTimeFormat('twentyFourHour'); });

  it('chooses a 24-hour time by default', () => {
    const onChange = vi.fn();
    render(<TimeField label="Start" value="02:30" onChange={onChange} />);
    const hour = screen.getByLabelText<HTMLSelectElement>('Start, hour');
    expect(hour.options).toHaveLength(24);
    expect(hour.value).toBe('2');
    expect(screen.queryByLabelText('Start, AM or PM')).toBeNull();
    fireEvent.change(hour, { target: { value: '14' } });
    expect(onChange).toHaveBeenLastCalledWith('14:30');
    fireEvent.change(screen.getByLabelText('Start, minute'), { target: { value: '5' } });
    expect(onChange).toHaveBeenLastCalledWith('02:05');
  });

  it('chooses a 12-hour time with AM and PM when set', () => {
    setTimeFormat('twelveHour');
    const onChange = vi.fn();
    render(<TimeField label="Stop" value="14:00" onChange={onChange} />);
    const hour = screen.getByLabelText<HTMLSelectElement>('Stop, hour');
    expect([...hour.options].map((o) => o.text)).toEqual(['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
    expect(hour.value).toBe('2');
    const half = screen.getByLabelText<HTMLSelectElement>('Stop, AM or PM');
    expect(half.value).toBe('pm');
    fireEvent.change(half, { target: { value: 'am' } });
    expect(onChange).toHaveBeenLastCalledWith('02:00');
    fireEvent.change(hour, { target: { value: '0' } });
    expect(onChange).toHaveBeenLastCalledWith('12:00');
  });
});
