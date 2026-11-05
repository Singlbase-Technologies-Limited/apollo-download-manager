import { useId } from 'react';
import { parseLocal } from '../lib/format';
import { Input } from './Input';
import { TimeField } from './TimeField';

/**
 * A download's own start time (#350): a date, and a time chosen in the app's time format. `value` and `onChange` are
 * local `YYYY-MM-DDTHH:MM`, as the native side reads them.
 */
export function StartAtFields({ value, onChange, disabled }: { value: string; onChange: (local: string) => void; disabled?: boolean }) {
  const dateId = useId();
  const [date = '', time = '00:00'] = value.split('T');
  const set = (d: string, t: string) => {
    if (parseLocal(`${d}T${t}`)) onChange(`${d}T${t}`);
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <label htmlFor={dateId} className="sr-only">Start date</label>
      <Input id={dateId} type="date" className="h-8 w-40" disabled={disabled} value={date} onChange={(e) => { set(e.target.value, time); }} />
      <TimeField label="Start time" value={time} disabled={disabled} onChange={(t) => { set(date, t); }} />
    </span>
  );
}
