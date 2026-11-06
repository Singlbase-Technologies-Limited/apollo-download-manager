/** What the popup shows (#356), as pure functions of what it was told. */
import type { Response } from './protocol';

export type Tone = 'ok' | 'warn' | 'err';

export interface StatusView {
  /** The badge under the name. */
  text: string;
  tone: Tone;
  /** The reason shown in the "app isn't reachable" card, or null when connected. */
  offline: string | null;
}

const VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/;

export function statusView(r: Response): StatusView {
  if (!r.ok) return { text: 'Not connected', tone: 'err', offline: r.error.message };
  const engine = r.result.engineRunning === true;
  const accepts = r.result.acceptsRequests === true;
  if (!accepts) return { text: 'Connected, but browser requests are off in the app', tone: 'warn', offline: null };
  if (!engine) return { text: "Connected, but the download engine isn't running", tone: 'warn', offline: null };
  const v = r.result.version;
  return { text: typeof v === 'string' && VERSION_RE.test(v) ? `Connected · app ${v}` : 'Connected', tone: 'ok', offline: null };
}

const FAILURES: Record<string, string> = {
  DESKTOP_NOT_RUNNING: 'App not running',
  DISABLED: 'Browser requests off',
  UNSUPPORTED: 'Link not supported',
};

export function failureLabel(code: string | undefined): string {
  return (code !== undefined && FAILURES[code]) || 'Failed';
}

export function ago(at: number, now: number): string {
  const s = Math.max(0, now - at) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${String(Math.floor(s / 60))} min ago`;
  if (s < 86_400) return `${String(Math.floor(s / 3600))} h ago`;
  if (s < 2 * 86_400) return 'yesterday';
  return `${String(Math.floor(s / 86_400))} days ago`;
}
