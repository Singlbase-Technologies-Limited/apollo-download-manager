/**
 * The popup's "Recent sends" (#356): the last few links sent to Apollo Download Manager, kept in
 * `storage.local` under {@link RECENT_KEY}. Only a file name and a host are kept, never the link
 * itself, because paths and queries can hold tokens; a failure keeps its error code, not its
 * message, which can echo the link. Validated on every read.
 */
import type { AddPayload, Response } from './protocol';

export const RECENT_KEY = 'recentSends';
export const MAX_RECENT = 5;
const MAX_NAME = 200;
const MAX_HOST = 253;
const CODE_RE = /^[A-Z][A-Z0-9_]{0,63}$/;

export interface RecentSend {
  name: string;
  /** The link's host name, without user info or port; empty for a magnet link. */
  host: string;
  ok: boolean;
  /** The error code of a failed send. */
  code?: string;
  /** When it was sent, in milliseconds since the epoch. */
  at: number;
}

function lastSegment(path: string): string {
  const seg = path.split(/[\\/]/).filter(Boolean).pop() ?? '';
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

/** The entry for one send: `payload` as sent, and the answer it got. */
export function recentEntry(payload: AddPayload, r: Response, at: number): RecentSend {
  let name = '';
  let host = '';
  if (payload.url.toLowerCase().startsWith('magnet:')) {
    const dn = new URLSearchParams(payload.url.slice(payload.url.indexOf('?') + 1)).get('dn');
    name = dn?.trim() || 'Magnet link';
  } else {
    try {
      const u = new URL(payload.url);
      host = u.hostname;
      name = lastSegment(u.pathname);
    } catch {
      /* not a URL: named below */
    }
  }
  if (payload.filename) name = lastSegment(payload.filename) || name;
  const e: RecentSend = { name: clip(name || host || 'Link', MAX_NAME), host: clip(host, MAX_HOST), ok: r.ok, at };
  if (!r.ok && CODE_RE.test(r.error.code)) e.code = r.error.code;
  return e;
}

/** `list` with `e` added first, keeping the newest {@link MAX_RECENT}. */
export function pushRecent(list: readonly RecentSend[], e: RecentSend): RecentSend[] {
  return [e, ...list].slice(0, MAX_RECENT);
}

/** Storage contents as a valid list; anything malformed is dropped. */
export function sanitizeRecent(raw: unknown): RecentSend[] {
  if (!Array.isArray(raw)) return [];
  const out: RecentSend[] = [];
  for (const v of raw) {
    if (typeof v !== 'object' || v === null) continue;
    const r = v as Record<string, unknown>;
    if (typeof r.name !== 'string' || typeof r.host !== 'string' || typeof r.ok !== 'boolean' || typeof r.at !== 'number' || !Number.isFinite(r.at)) continue;
    if (r.code !== undefined && (typeof r.code !== 'string' || !CODE_RE.test(r.code))) continue;
    const e: RecentSend = { name: clip(r.name, MAX_NAME), host: clip(r.host, MAX_HOST), ok: r.ok, at: r.at };
    if (typeof r.code === 'string') e.code = r.code;
    out.push(e);
    if (out.length === MAX_RECENT) break;
  }
  return out;
}
