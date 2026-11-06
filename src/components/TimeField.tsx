import { useId } from 'react';
import { isTwelveHour } from '../lib/format';
import { Select } from './Select';

const two = (n: number) => String(n).padStart(2, '0');
const MINUTES = Array.from({ length: 60 }, (_, i) => ({ value: String(i), label: two(i) }));
const AM_PM = [
  { value: 'am', label: 'AM' },
  { value: 'pm', label: 'PM' },
];

/**
 * A time of day, chosen and never typed (#350): an hour, a minute and, in the 12-hour format, AM
 * or PM. `value` and `onChange` are `HH:MM`, 24-hour, as the settings store it, whatever the app
 * shows. Each part has its own label for screen readers: "<label>, hour" and so on.
 */
export function TimeField({ id, label, value, onChange, disabled }: { id?: string; label: string; value: string; onChange: (hhmm: string) => void; disabled?: boolean }) {
  const own = useId();
  const [h = 0, m = 0] = value.split(':').map(Number);
  const twelve = isTwelveHour();
  const pm = h >= 12;
  const set = (hour: number, minute: number) => { onChange(`${two(hour)}:${two(minute)}`); };
  return (
    <span className="inline-flex items-center gap-1" role="group" aria-label={label}>
      <Select
        id={id ?? own}
        aria-label={`${label}, hour`}
        className="w-18"
        disabled={disabled}
        value={String(twelve ? h % 12 : h)}
        options={Array.from({ length: twelve ? 12 : 24 }, (_, i) => ({ value: String(i), label: twelve ? String(i === 0 ? 12 : i) : two(i) }))}
        onValueChange={(v) => { const n = Number(v); set(twelve ? n + (pm ? 12 : 0) : n, m); }}
      />
      <span aria-hidden="true">:</span>
      <Select
        aria-label={`${label}, minute`}
        className="w-18"
        disabled={disabled}
        value={String(m)}
        options={MINUTES}
        onValueChange={(v) => { set(h, Number(v)); }}
      />
      {twelve ? (
        <Select aria-label={`${label}, AM or PM`} className="w-20" disabled={disabled} value={pm ? 'pm' : 'am'} options={AM_PM} onValueChange={(v) => { set((h % 12) + (v === 'pm' ? 12 : 0), m); }} />
      ) : null}
    </span>
  );
}
