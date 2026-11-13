// The Add dialog's input rules (#60), ported from V1's addLogic.ts. They flag mistakes as the user
// types; the native side checks everything again (`Manager::add_request`) and decides.
import { availability } from '../../capabilities';
import type { Capabilities, Checksum, DownloadKind, HashAlgorithm, Header } from '../../contract';

/** The most links and `.torrent` files one request adds (`MAX_ADD`). */
export const MAX_ADD = 500;

/** Pasted text as links: one per line or space, each once (V1's `splitSources`). */
export function splitLinks(text: string): string[] {
  return [...new Set(text.split(/\s+/).filter((s) => s !== ''))];
}

/** A pattern link and what it makes (#468), for the dialog to show before adding. */
export interface PatternExpansion {
  link: string;
  count: number;
  first: string;
  last: string;
}

/** `[1-10]`, `[001-100]`, `[0-100:5]`, `[a-z]` or `[A-Z]`. Longer numbers are left alone, so counts stay exact. */
const RANGE = /\[(?:(\d{1,15})-(\d{1,15})(?::(\d{1,15}))?|([a-z])-([a-z])|([A-Z])-([A-Z]))\]/g;

interface Range {
  at: number;
  length: number;
  count: number;
  value: (i: number) => string;
}

/** Where a link's path is: after `scheme://host`, up to `?` or `#`. `null` for a link without one, such as a magnet link. */
function pathSpan(link: string): [number, number] | null {
  const scheme = link.indexOf('://');
  if (scheme < 0) return null;
  const start = link.indexOf('/', scheme + 3);
  if (start < 0) return null;
  const ends = ['?', '#'].map((c) => link.indexOf(c, start)).filter((i) => i >= 0);
  return [start, Math.min(link.length, ...ends)];
}

/** The range in `link`'s path, if there is one, or why it can't be used. */
function rangeIn(link: string): { range: Range | null; error: string | null } {
  const span = pathSpan(link);
  if (span === null) return { range: null, error: null };
  const found = [...link.slice(span[0], span[1]).matchAll(RANGE)];
  const m = found[0];
  if (m === undefined) return { range: null, error: null };
  if (found.length > 1) return { range: null, error: `${link}: only one range, such as [1-10], can be in a link.` };
  const at = span[0] + m.index;
  const goesDown = `${link}: the range goes down. Write it from the smaller end, such as [1-10] or [a-z].`;
  const [, from, to, step, lowFrom, lowTo, upFrom, upTo] = m;
  if (from !== undefined && to !== undefined) {
    const [a, b, s] = [Number(from), Number(to), step === undefined ? 1 : Number(step)];
    if (s === 0) return { range: null, error: `${link}: the step after ":" can’t be 0.` };
    if (b < a) return { range: null, error: goesDown };
    // A leading zero keeps every number as wide as the first: [001-100] makes 001 to 100.
    const width = from.length;
    return { range: { at, length: m[0].length, count: Math.floor((b - a) / s) + 1, value: (i) => String(a + i * s).padStart(width, '0') }, error: null };
  }
  const first = (lowFrom ?? upFrom ?? '').charCodeAt(0);
  const last = (lowTo ?? upTo ?? '').charCodeAt(0);
  if (last < first) return { range: null, error: goesDown };
  return { range: { at, length: m[0].length, count: last - first + 1, value: (i) => String.fromCharCode(first + i) }, error: null };
}

/**
 * Pattern links (#468): a link with one range in its path, such as `file[001-100].zip`, becomes one link per value.
 * Other links stay as they are; every link is kept once, in order. A range that can't be used, or more than `MAX_ADD`
 * links in all, is an error, and nothing is made. Brackets outside the path (an IPv6 host, a query) are left alone.
 */
export function expandLinks(links: readonly string[]): { links: string[]; patterns: PatternExpansion[]; error: string | null } {
  const planned: [string, Range | null][] = [];
  let total = 0;
  for (const link of links) {
    const { range, error } = rangeIn(link);
    if (error !== null) return { links: [], patterns: [], error };
    planned.push([link, range]);
    total += range === null ? 1 : range.count;
  }
  if (total > MAX_ADD) {
    return { links: [], patterns: [], error: `These links make ${total.toLocaleString('en')} downloads. At most ${String(MAX_ADD)} can be added at once.` };
  }
  const out = new Set<string>();
  const patterns: PatternExpansion[] = [];
  for (const [link, range] of planned) {
    if (range === null) {
      out.add(link);
      continue;
    }
    const make = (i: number) => link.slice(0, range.at) + range.value(i) + link.slice(range.at + range.length);
    for (let i = 0; i < range.count; i++) out.add(make(i));
    patterns.push({ link, count: range.count, first: make(0), last: make(range.count - 1) });
  }
  return { links: [...out], patterns, error: null };
}

const SCHEMES: Record<string, DownloadKind> ={ 'http:': 'http', 'https:': 'http', 'ftp:': 'ftp', 'ftps:': 'ftp', 'sftp:': 'sftp' };

const isMagnet = (link: string) => link.slice(0, 7).toLowerCase() === 'magnet:';

/**
 * Whether `link` is to a `.torrent` file, which Apollo Download Manager fetches and adds as a torrent: an http or
 * https link whose path ends in `.torrent`. Mirrors `is_torrent_link` in Rust.
 */
export function isTorrentLink(link: string): boolean {
  try {
    const u = new URL(link.trim());
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.pathname.toLowerCase().endsWith('.torrent');
  } catch {
    return false;
  }
}

/** What a link downloads with: a direct protocol, a magnet link, or a `.torrent` link; `null` for none. */
export function linkKind(link: string): 'http' | 'ftp' | 'sftp' | 'magnet' | 'torrentLink' | null {
  if (isMagnet(link)) return 'magnet';
  if (isTorrentLink(link)) return 'torrentLink';
  try {
    const kind = SCHEMES[new URL(link).protocol.toLowerCase()];
    return kind === 'http' || kind === 'ftp' || kind === 'sftp' ? kind : null;
  } catch {
    return null;
  }
}

/**
 * Why `link` can't be added, in words for the user, or `null`. `capabilities` are the transfer
 * engine's: a protocol it lacks is refused with the reason, before anything is sent.
 */
export function linkProblem(link: string, capabilities: Capabilities | undefined): string | null {
  if (isMagnet(link)) return null;
  let u: URL;
  try {
    u = new URL(link);
  } catch {
    return 'This is not a complete link. It should start with https://, http://, ftp:// or sftp://.';
  }
  const kind = SCHEMES[u.protocol.toLowerCase()];
  if (kind === undefined) return 'Only http, https, ftp, ftps, sftp and magnet links are supported.';
  if (u.hostname === '') return 'This is not a complete link. It should start with https://, http://, ftp:// or sftp://.';
  if (u.username !== '' || u.password !== '') return 'Put the user name and password in their own fields, not in the link.';
  if (capabilities && !isTorrentLink(link)) {
    const available = availability(capabilities, kind);
    if (!available.available) return available.reason;
  }
  return null;
}

/** "Name: value" lines as headers, or the first malformed line (V1's `parseHeaders`). */
export function parseHeaders(text: string): { headers: Header[]; error: string | null } {
  const headers: Header[] = [];
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  for (const [i, line] of lines.entries()) {
    const at = line.indexOf(':');
    if (at <= 0) return { headers, error: `Line ${String(i + 1)} must look like "Name: value".` };
    headers.push({ name: line.slice(0, at).trim(), value: line.slice(at + 1).trim() });
  }
  return { headers, error: null };
}

const ALGORITHMS: Record<string, { algorithm: HashAlgorithm; hexLength: number }> = {
  md5: { algorithm: 'md5', hexLength: 32 },
  sha1: { algorithm: 'sha1', hexLength: 40 },
  sha224: { algorithm: 'sha224', hexLength: 56 },
  sha256: { algorithm: 'sha256', hexLength: 64 },
  sha384: { algorithm: 'sha384', hexLength: 96 },
  sha512: { algorithm: 'sha512', hexLength: 128 },
};

/** A checksum written as V1 took it, `sha-256=<hex>` (or `sha256:<hex>`); empty for none. */
export function parseChecksum(text: string): { checksum: Checksum | null; error: string | null } {
  const trimmed = text.trim();
  if (trimmed === '') return { checksum: null, error: null };
  const match = /^([a-z0-9-]+)\s*[=:]\s*([^\s]+)$/i.exec(trimmed);
  if (!match) return { checksum: null, error: 'Write the checksum like “sha-256=…”, with its algorithm first.' };
  const known = ALGORITHMS[(match[1] ?? '').toLowerCase().replace('-', '')];
  if (!known) return { checksum: null, error: 'Use md5, sha-1, sha-224, sha-256, sha-384 or sha-512.' };
  const hex = (match[2] ?? '').toLowerCase();
  if (hex.length !== known.hexLength || !/^[0-9a-f]+$/.test(hex)) {
    return { checksum: null, error: `This checksum must be ${String(known.hexLength)} hexadecimal characters.` };
  }
  return { checksum: { algorithm: known.algorithm, hex }, error: null };
}
