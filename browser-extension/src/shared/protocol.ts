/**
 * Native messaging protocol v1, unchanged from V1 and mirrored by the native host (#65).
 * The extension can only ping, ask for status, or offer a download link. It never sends
 * paths, commands or engine options.
 */
export const PROTOCOL_VERSION = 1;

export type RequestSource = 'intercept' | 'contextMenu' | 'popup';

/** One file chosen on a page (#426). */
export interface PageLinkPayload {
  url: string;
  filename?: string;
}

export interface AddPayload {
  url: string;
  referrer?: string;
  filename?: string;
  fileSize?: number;
  mime?: string;
  source: RequestSource;
}

export type Request =
  | { v: 1; id: string; type: 'ping' }
  | { v: 1; id: string; type: 'app.status' }
  | { v: 1; id: string; type: 'download.add'; payload: AddPayload }
  | { v: 1; id: string; type: 'download.addMany'; payload: { links: PageLinkPayload[]; referrer?: string } };

export interface ResponseError {
  code: string;
  message: string;
}

export type Response = { v: number; id: string; ok: true; result: Record<string, unknown> } | { v: number; id: string; ok: false; error: ResponseError };

const MAX_URL = 8192;

export function newId(): string {
  return crypto.randomUUID();
}

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Build a download.add request, dropping optional fields the desktop app would reject. */
export function buildAdd(p: AddPayload): Request {
  const payload: AddPayload = { url: p.url, source: p.source };
  if (p.referrer && p.referrer.length <= MAX_URL && isHttpUrl(p.referrer)) payload.referrer = p.referrer;
  if (p.filename && p.filename.length <= 1024) payload.filename = p.filename.split(/[\\/]/).pop() ?? p.filename;
  if (typeof p.fileSize === 'number' && Number.isSafeInteger(p.fileSize) && p.fileSize > 0) payload.fileSize = p.fileSize;
  if (p.mime && p.mime.length <= 255 && !/\p{Cc}/u.test(p.mime)) payload.mime = p.mime;
  return { v: PROTOCOL_VERSION, id: newId(), type: 'download.add', payload };
}

/** A magnet link carrying an exact topic (`xt=`). The desktop app validates the rest. */
export function isMagnet(url: string): boolean {
  return /^magnet:\?/i.test(url) && /[?&]xt=/i.test(url);
}

export function canSend(url: string): boolean {
  return url.length <= MAX_URL && (isHttpUrl(url) || isMagnet(url));
}

/** Links the browser itself can download when Apollo Download Manager cannot take them. */
export function browserCanDownload(url: string): boolean {
  return url.length <= MAX_URL && isHttpUrl(url);
}

/** Validate a response from the native host. Anything unexpected becomes an error response. */
export function parseResponse(raw: unknown, expectedId: string): Response {
  const bad = (message: string): Response => ({ v: PROTOCOL_VERSION, id: expectedId, ok: false, error: { code: 'INVALID_RESPONSE', message } });
  if (typeof raw !== 'object' || raw === null) return bad('The desktop application sent an invalid response.');
  const r = raw as Record<string, unknown>;
  if (r.v !== PROTOCOL_VERSION) return bad('The desktop application uses a different protocol version. Update both to the same version.');
  if (r.ok === true && typeof r.result === 'object' && r.result !== null) return { v: 1, id: String(r.id), ok: true, result: r.result as Record<string, unknown> };
  if (r.ok === false && typeof r.error === 'object' && r.error !== null) {
    const e = r.error as Record<string, unknown>;
    if (typeof e.code === 'string' && typeof e.message === 'string') return { v: 1, id: String(r.id), ok: false, error: { code: e.code, message: e.message } };
  }
  return bad('The desktop application sent an invalid response.');
}

/** The most links one `download.addMany` carries, as the app allows (`MAX_BATCH_LINKS`, #426). */
export const MAX_BATCH_LINKS = 100;
/** Kept under the browser's 64 KiB message limit (`MAX_MESSAGE_BYTES`) with room for the envelope. */
const MAX_BATCH_BYTES = 60 * 1024;
const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;

/**
 * The files chosen on a page as `download.addMany` requests (#426): as few as fit the app's limits on links and
 * message size. Links that can't be sent are left out, and a file name keeps its last component only.
 */
export function buildAddMany(links: readonly PageLinkPayload[], referrer?: string): Request[] {
  const ref = referrer && referrer.length <= MAX_URL && isHttpUrl(referrer) ? referrer : undefined;
  const base = 200 + (ref?.length ?? 0);
  const out: Request[] = [];
  let chunk: PageLinkPayload[] = [];
  let size = base;
  const flush = () => {
    if (chunk.length === 0) return;
    out.push({ v: PROTOCOL_VERSION, id: newId(), type: 'download.addMany', payload: ref ? { links: chunk, referrer: ref } : { links: chunk } });
    chunk = [];
    size = base;
  };
  for (const l of links) {
    if (!browserCanDownload(l.url)) continue;
    const link: PageLinkPayload = { url: l.url };
    const name = l.filename?.split(/[\\/]/).pop();
    if (name && name.length <= 1024 && !/\p{Cc}/u.test(name)) link.filename = name;
    const n = bytes(link) + 1;
    if (chunk.length === MAX_BATCH_LINKS || size + n > MAX_BATCH_BYTES) flush();
    chunk.push(link);
    size += n;
  }
  flush();
  return out;
}

export interface BatchFailure {
  url: string;
  code: string;
  message: string;
}

/** What happened to a choice of files from a page, over all its messages (#426). */
export interface BatchOutcome {
  added: number;
  prompted: number;
  failed: BatchFailure[];
  /** Why a message was refused as a whole, such as the app not running; its links count as not sent. */
  error: ResponseError | null;
  notSent: number;
}

const count = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : 0);

function failuresOf(v: unknown): BatchFailure[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((f: unknown) => {
    const r = (typeof f === 'object' && f !== null ? f : {}) as Record<string, unknown>;
    return typeof r.url === 'string' && typeof r.code === 'string' && typeof r.message === 'string' ? [{ url: r.url, code: r.code, message: r.message }] : [];
  });
}

/** Adds one message's answer, for `sent` links, to what happened so far. */
export function addToOutcome(o: BatchOutcome, r: Response, sent: number): BatchOutcome {
  if (!r.ok) return { ...o, error: o.error ?? r.error, notSent: o.notSent + sent };
  return { ...o, added: o.added + count(r.result.added), prompted: o.prompted + count(r.result.prompted), failed: [...o.failed, ...failuresOf(r.result.failed)] };
}

export const EMPTY_OUTCOME: BatchOutcome = { added: 0, prompted: 0, failed: [], error: null, notSent: 0 };
