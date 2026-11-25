/** What the page button keeps in `storage.local`, and the messages about it (#426), checked like every message. */
import type { Point } from './page-panel';
import type { PageLinkPayload } from './protocol';

export const PAGE_POSITIONS_KEY = 'pageButtonPositions';
export const PAGE_SIZE_KEY = 'pagePanelSize';
export const PAGE_TIP_KEY = 'pageButtonTipSeen';

/** The button's place on this many sites at most; the oldest gives way. */
export const MAX_POSITIONS = 200;
/** As many files as the app's Add dialog takes (`MAX_ADD`). */
export const MAX_PAGE_LINKS = 500;

/** The stored places with `host`'s set to `p`, newest last. */
export function rememberPosition(stored: unknown, host: string, p: Point): Record<string, Point> {
  const old = (typeof stored === 'object' && stored !== null && !Array.isArray(stored) ? stored : {}) as Record<string, unknown>;
  const kept = Object.entries(old).filter(([h, v]) => h !== host && typeof v === 'object' && v !== null);
  const entries = [...kept.slice(-(MAX_POSITIONS - 1)), [host, { right: Math.round(p.right), bottom: Math.round(p.bottom) }]];
  return Object.fromEntries(entries) as Record<string, Point>;
}

/** The popup or the keyboard shortcut asking the page for its files (`list`) or to open the panel (`open`). */
export function pageMessageOf(m: unknown): 'list' | 'open' | null {
  const r = (typeof m === 'object' && m !== null ? m : {}) as Record<string, unknown>;
  return r.type === 'page.files.list' ? 'list' : r.type === 'page.files.open' ? 'open' : null;
}

/** The files the page script sends: up to {@link MAX_PAGE_LINKS} links, each a string with an optional name. */
export function pageSendOf(m: unknown): PageLinkPayload[] | null {
  const r = (typeof m === 'object' && m !== null ? m : {}) as Record<string, unknown>;
  if (r.type !== 'page.send' || !Array.isArray(r.links) || r.links.length === 0 || r.links.length > MAX_PAGE_LINKS) return null;
  const links: PageLinkPayload[] = [];
  for (const l of r.links as unknown[]) {
    const x = (typeof l === 'object' && l !== null ? l : {}) as Record<string, unknown>;
    if (typeof x.url !== 'string' || x.url.length > 8192) return null;
    if (x.filename !== undefined && (typeof x.filename !== 'string' || x.filename.length > 1024)) return null;
    links.push(typeof x.filename === 'string' ? { url: x.url, filename: x.filename } : { url: x.url });
  }
  return links;
}
