import { useId } from 'react';
import { isTwelveHour } from '../lib/format';
import { Select } from './Select';

const two = (n: number) => String(n).padStart(2, '0');

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
      <Select id={id ?? own} aria-label={`${label}, hour`} className="w-16" disabled={disabled} value={String(twelve ? h % 12 : h)} onChange={(e) => { const v = Number(e.target.value); set(twelve ? v + (pm ? 12 : 0) : v, m); }}>
        {Array.from({ length: twelve ? 12 : 24 }, (_, i) => (
          <option key={i} value={i}>{twelve ? String(i === 0 ? 12 : i) : two(i)}</option>
        ))}
      </Select>
      <span aria-hidden="true">:</span>
      <Select aria-label={`${label}, minute`} className="w-16" disabled={disabled} value={String(m)} onChange={(e) => { set(h, Number(e.target.value)); }}>
        {Array.from({ length: 60 }, (_, i) => (
          <option key={i} value={i}>{two(i)}</option>
        ))}
      </Select>
      {twelve ? (
        <Select aria-label={`${label}, AM or PM`} className="w-18" disabled={disabled} value={pm ? 'pm' : 'am'} onChange={(e) => { set((h % 12) + (e.target.value === 'pm' ? 12 : 0), m); }}>
          <option value="am">AM</option>
          <option value="pm">PM</option>
        </Select>
      ) : null}
    </span>
  );
}
