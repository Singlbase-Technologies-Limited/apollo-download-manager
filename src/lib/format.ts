const UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB'] as const;

/** A size that is known: not `null`, a number, and not negative. */
function known(bytes: number | null | undefined): bytes is number {
  return bytes !== null && bytes !== undefined && Number.isFinite(bytes) && bytes >= 0;
}

/** The unit a size is said in: the largest it is at least one of. */
function unitOf(bytes: number): number {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return unit;
}

/** Bytes in binary units with one decimal, as the tray says them (src-tauri/src/tray.rs): "1.5 MiB". "—" when unknown. */
export function formatBytes(bytes: number | null | undefined): string {
  if (!known(bytes)) return '—';
  const unit = unitOf(bytes);
  return unit === 0 ? `${String(bytes)} B` : `${(bytes / 1024 ** unit).toFixed(1)} ${UNITS[unit] ?? ''}`;
}

export function formatSpeed(bytesPerSecond: number | null | undefined): string {
  return known(bytesPerSecond) ? `${formatBytes(bytesPerSecond)}/s` : '—';
}

/** `bytes` in `unit`, with two decimals from GiB up, so a large download visibly moves every ~10 MiB (V1). */
function inUnit(bytes: number, unit: number): string {
  const digits = unit >= 3 ? 2 : unit >= 1 ? 1 : 0;
  return `${(bytes / 1024 ** unit).toFixed(digits)} ${UNITS[unit] ?? ''}`;
}

/** A transferred amount, more precise than {@link formatBytes} for large values. */
export function formatTransferredBytes(bytes: number | null | undefined): string {
  return known(bytes) ? inUnit(bytes, unitOf(bytes)) : '—';
}

/** "0.50 GiB of 3.80 GiB": both sides in the total's unit, so they compare at a glance. */
export function formatTransferred(completed: number, total: number | null | undefined): string {
  if (!known(total) || total === 0) return `${formatTransferredBytes(completed)} of unknown size`;
  const unit = unitOf(total);
  return `${inUnit(completed, unit)} of ${inUnit(total, unit)}`;
}

/** "59s", "1m 01s", "3h 02m", "2d 2h"; "—" when unknown. */
export function formatDuration(seconds: number | null | undefined): string {
  if (!known(seconds)) return '—';
  const s = Math.round(seconds);
  if (s < 60) return `${String(s)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${String(m)}m ${String(s % 60).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${String(h)}h ${String(m % 60).padStart(2, '0')}m`;
  return `${String(Math.floor(h / 24))}d ${String(h % 24)}h`;
}

/** One decimal below 10%, none above; "—" when unknown. */
export function formatPercent(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return '—';
  if (p >= 100) return '100%';
  return `${p.toFixed(p < 10 ? 1 : 0)}%`;
}

// Times follow the app's own setting, 24-hour by default, never the system's (#350, PO decision:
// every time the app shows). `setTimeFormat` rebuilds the formatters when the setting changes.
let hourCycle: 'h23' | 'h12' = 'h23';
const clockOptions = (): Intl.DateTimeFormatOptions => ({ hour: hourCycle === 'h23' ? '2-digit' : 'numeric', minute: '2-digit', hourCycle });
let timeFmt = new Intl.DateTimeFormat(undefined, clockOptions());
let monthDayTimeFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', ...clockOptions() });
const monthDayYearFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const monthDayFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

/** Shows every time 24-hour (`14:30`) or 12-hour (`2:30 PM`) from now on (#350). */
export function setTimeFormat(format: 'twentyFourHour' | 'twelveHour'): void {
  hourCycle = format === 'twelveHour' ? 'h12' : 'h23';
  timeFmt = new Intl.DateTimeFormat(undefined, clockOptions());
  monthDayTimeFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', ...clockOptions() });
}

/** Whether times show 12-hour, with AM and PM. */
export const isTwelveHour = (): boolean => hourCycle === 'h12';

/** A time of day, `HH:MM` 24-hour as settings store it, in the app's time format. */
export function formatClock(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return timeFmt.format(new Date(2000, 0, 1, h, m));
}

/** A local date and time as the native side sends it, `YYYY-MM-DDTHH:MM`, or `null` for anything else. */
export function parseLocal(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(text);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const date = new Date(y, mo - 1, d, h, mi);
  const same = date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d && date.getHours() === h && date.getMinutes() === mi;
  return same ? date : null;
}

/** `date` as `YYYY-MM-DDTHH:MM` in local time, as the native side reads it. */
export function toLocalText(date: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${String(date.getFullYear())}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** The next full hour from `now`, local `YYYY-MM-DDTHH:MM`: where a new start time begins (#350). */
export function nextFullHour(now = new Date()): string {
  return toLocalText(new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0));
}

const dayDiff = (a: Date, b: Date) => Math.round((new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime() - new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()) / 86_400_000);

/** "today 18:00", "tomorrow 02:00", "Sat 03:00" within a week, else "30 Nov 03:00", from a local `YYYY-MM-DDTHH:MM`. */
export function formatWhen(text: string, now = new Date()): string {
  const at = parseLocal(text);
  if (!at) return text;
  const days = dayDiff(at, now);
  const time = timeFmt.format(at);
  if (days === 0) return `today ${time}`;
  if (days === 1) return `tomorrow ${time}`;
  if (days > 1 && days < 7) return `${weekdayFmt.format(at)} ${time}`;
  return `${monthDayFmt.format(at)} ${time}`;
}

/** A window, "tomorrow 02:00 to 07:00": its stop as a time of day when it is the same day or the next. */
export function formatWindow(opens: string, closes: string, now = new Date()): string {
  const start = parseLocal(opens);
  const stop = parseLocal(closes);
  if (!start || !stop) return `${opens} to ${closes}`;
  const end = dayDiff(stop, start) <= 1 ? timeFmt.format(stop) : formatWhen(closes, now);
  return `${formatWhen(opens, now)} to ${end}`;
}

/** A date for a table cell (V1): the time only today, no year within this year. `ms` since the Unix epoch. */
export function formatShortDate(ms: number | null, now = new Date()): string {
  if (ms === null) return '—';
  const d = new Date(ms);
  if (d.toDateString() === now.toDateString()) return timeFmt.format(d);
  if (d.getFullYear() === now.getFullYear()) return monthDayTimeFmt.format(d);
  return monthDayYearFmt.format(d);
}

/** "in 1m 00s" or "30s ago", from `ms` since the Unix epoch. */
export function relativeFromNow(ms: number, now = Date.now()): string {
  const diff = Math.round((ms - now) / 1000);
  return diff > 0 ? `in ${formatDuration(diff)}` : `${formatDuration(-diff)} ago`;
}
