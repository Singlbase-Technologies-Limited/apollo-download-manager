/** What the popup shows (#356), as pure functions of what it was told. */
import { SHORT_NAME } from './branding';
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

/** What the popup knows about the page in the active tab (#426). */
export interface PageFilesState {
  /** The tab shows a web page (http or https). */
  web: boolean;
  /** The user let the extension read pages. */
  access: boolean;
  /** "Show a download button on pages with files" is on. */
  enabled: boolean;
  /** The page's answer, or null when its script isn't there (a page opened before access was given). */
  page: { files: number; groups: Record<string, number>; hidden: boolean } | null;
}

export interface PageFilesView {
  /** The card is shown at all. */
  show: boolean;
  text: string;
  count: string | null;
  action: 'choose' | 'allow' | 'turnOn' | null;
  /** The "Show the button on this site" switch, and whether it is on; null when it doesn't apply. */
  siteSwitch: boolean | null;
}

export function pageFilesView(s: PageFilesState): PageFilesView {
  const none: PageFilesView = { show: false, text: '', count: null, action: null, siteSwitch: null };
  if (!s.web) return none;
  if (!s.enabled) return { ...none, show: true, text: `The download button for pages with files is off.`, action: 'turnOn' };
  if (!s.access)
    return { ...none, show: true, text: `${SHORT_NAME} can find the files on a page and show a button to download them. Your browser asks you to let it read pages first.`, action: 'allow' };
  if (s.page === null) return { ...none, show: true, text: 'Reload the page to look for files on it.' };
  if (s.page.files === 0) return { ...none, show: true, text: 'No files found on this page.', siteSwitch: !s.page.hidden };
  const parts = Object.entries(s.page.groups).map(([g, n]) => `${String(n)} ${g.toLowerCase()}`);
  return { show: true, text: `${parts.join(', ')}.`, count: `${String(s.page.files)} found`, action: 'choose', siteSwitch: !s.page.hidden };
}
