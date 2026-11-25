/**
 * The files on a page (#426), as pure functions so they are tested without a browser: which links are files, by the
 * same rules as the downloads the extension takes (`decide`), and how a choice of them goes to the app.
 */
import { SHORT_NAME } from './branding';
import type { BatchOutcome } from './protocol';
import { decideAt, extensionOf, hostMatches } from './rules';
import type { ExtensionSettings } from './settings';

/** A link as the page has it: its `href`, and its `download` attribute when it names the file. */
export interface LinkSeen {
  href: string;
  download?: string | null | undefined;
}

/** The groups the panel shows, named like the app's categories. */
export const FILE_GROUPS = ['Disk images', 'Programs', 'Compressed', 'Video', 'Music', 'Documents', 'Torrents', 'Other'] as const;
export type FileGroup = (typeof FILE_GROUPS)[number];

export interface PageFile {
  url: string;
  name: string;
  group: FileGroup;
}

export interface SkippedFile {
  url: string;
  name: string;
  reason: string;
}

export interface PageFiles {
  files: PageFile[];
  skipped: SkippedFile[];
}

const GROUP_OF: Readonly<Record<string, FileGroup>> = Object.fromEntries(
  (
    [
      ['Disk images', ['iso', 'img', 'dmg', 'vhd', 'vhdx', 'qcow2', 'wsl']],
      ['Programs', ['exe', 'msi', 'msix', 'deb', 'rpm', 'appimage', 'apk', 'pkg', 'flatpak', 'snap']],
      ['Compressed', ['zip', '7z', 'rar', 'tar', 'gz', 'tgz', 'xz', 'bz2', 'zst']],
      ['Video', ['mp4', 'mkv', 'avi', 'mov', 'webm', 'm4v']],
      ['Music', ['mp3', 'flac', 'wav', 'm4a', 'ogg', 'opus', 'aac']],
      ['Documents', ['pdf', 'epub', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt']],
      ['Torrents', ['torrent']],
    ] as const
  ).flatMap(([group, exts]) => exts.map((e) => [e, group])),
);

export function groupOf(ext: string): FileGroup {
  return GROUP_OF[ext] ?? 'Other';
}

const MAX_URL = 8192;

/** The link as one address: resolved against the page, without its `#…` part; `null` unless it is http or https. */
export function normalizeLink(href: string, base: string): string | null {
  return parseLink(href, base)?.href ?? null;
}

function parseLink(href: string, base: string): URL | null {
  try {
    const u = new URL(href, base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    return u.href.length <= MAX_URL ? u : null;
  } catch {
    return null;
  }
}

/**
 * The file's name: the `download` attribute's, else the link's last path segment, read from the link as written so
 * that links that aren't files are passed over without parsing them (#426: a page can have thousands).
 */
export function nameOf(href: string, download: string | null | undefined): string {
  const given = download?.trim();
  if (given) return given.split(/[\\/]/).pop() ?? given;
  const path = href.split(/[?#]/, 1)[0] ?? '';
  const seg = path.slice(path.lastIndexOf('/') + 1);
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

/**
 * The files among `links`, each once, in page order. A link is a file when its name ends in one of the user's file
 * types (or `.torrent`). One the rules leave out, such as a site the user excluded, is listed as skipped with the
 * reason; any other link is not a file and isn't listed. `seen` holds the files already found, so a page read in
 * parts lists each once.
 */
export function findPageFiles(links: Iterable<LinkSeen>, base: string, s: ExtensionSettings, seen = new Set<string>()): PageFiles {
  // The page list follows the file rules whatever the browser-download mode or window, and its links have no size
  // yet: `decideAt` applies the address, site and type rules only.
  const rules: ExtensionSettings = { ...s, minSizeMib: 0, captureTorrents: true };
  const out: PageFiles = { files: [], skipped: [] };
  const types = new Set([...s.fileTypes, 'torrent']);
  for (const link of links) {
    const name = nameOf(link.href, link.download);
    if (!types.has(extensionOf(name))) continue;
    const parsed = parseLink(link.href, base);
    if (parsed === null || seen.has(parsed.href)) continue;
    const url = parsed.href;
    seen.add(url);
    const ext = extensionOf(name);
    const d = decideAt(parsed, { url, filename: name }, rules);
    if (d.intercept) out.files.push({ url, name, group: groupOf(ext) });
    else out.skipped.push({ url, name, reason: d.reason });
  }
  return out;
}

/** Whether the button stays off on the page at `pageUrl`: the user hid it for that site. */
export function hiddenOn(pageUrl: string, hiddenSites: readonly string[]): boolean {
  try {
    return hostMatches(new URL(pageUrl).hostname, hiddenSites);
  } catch {
    return true;
  }
}

/** What the panel says once a choice was sent (#426): what the app did, and what failed and why. */
export function outcomeText(o: BatchOutcome): { text: string; tone: 'ok' | 'err' } {
  const parts: string[] = [];
  if (o.added > 0) parts.push(`Sent ${String(o.added)} to ${SHORT_NAME}.`);
  if (o.prompted > 0) parts.push(`${String(o.prompted)} opened in ${SHORT_NAME}'s Add dialog for you to check.`);
  const failed = o.failed.length + o.notSent;
  if (failed > 0) {
    const why = o.error?.message ?? o.failed[0]?.message ?? '';
    parts.push(`${String(failed)} couldn't be sent${why ? `: ${why}` : '.'}`);
  }
  return { text: parts.join(' ') || 'Nothing was sent.', tone: failed > 0 ? 'err' : 'ok' };
}
