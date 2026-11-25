/**
 * Reading a page's links for the files on it (#426): once at the start, then only the parts the page adds later,
 * a short while after it stops changing. Nothing else on the page is read.
 */
import { findPageFiles, type LinkSeen, type PageFiles } from './page-files';
import type { ExtensionSettings } from './settings';

const LINKS = 'a[href], area[href], video[src], audio[src], source[src]';

/** The links in `root` and below it, `root` included. */
export function linksIn(root: Element | Document): LinkSeen[] {
  const els: Element[] = [];
  if (root instanceof Element && root.matches(LINKS)) els.push(root);
  els.push(...root.querySelectorAll(LINKS));
  return els.map((el) => ({ href: el.getAttribute('href') ?? el.getAttribute('src') ?? '', download: el.getAttribute('download') }));
}

/** The files found so far, growing as the page adds links; each file once. */
export class PageFileList {
  private readonly urls = new Set<string>();
  readonly found: PageFiles = { files: [], skipped: [] };

  constructor(
    private readonly base: () => string,
    private readonly settings: ExtensionSettings,
  ) {}

  /** Adds the files among `links`; whether any were new. */
  add(links: LinkSeen[]): boolean {
    const fresh = findPageFiles(links, this.base(), this.settings, this.urls);
    this.found.files.push(...fresh.files);
    this.found.skipped.push(...fresh.skipped);
    return fresh.files.length + fresh.skipped.length > 0;
  }
}

/** How long the page must stay still before the added parts are read. */
export const RESCAN_DELAY_MS = 500;

/**
 * Calls `onAdded` with the links in the parts added to `doc`, at most once per `delay` of quiet. Returns a function
 * that stops watching.
 */
export function watchAddedLinks(doc: Document, onAdded: (links: LinkSeen[]) => void, delay = RESCAN_DELAY_MS): () => void {
  let pending: Element[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    timer = undefined;
    const added = pending.filter((el) => el.isConnected);
    pending = [];
    const links = added.flatMap((el) => linksIn(el));
    if (links.length > 0) onAdded(links);
  };
  const observer = new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) pending.push(n as Element);
    if (pending.length === 0) return;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(flush, delay);
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    if (timer !== undefined) clearTimeout(timer);
  };
}
