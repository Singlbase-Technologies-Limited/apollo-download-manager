// Pure logic behind the field test (#262, tests/field/README.md):
// - hostOf, hideLinks: a link is never written whole, only its scheme and host (PO decision on
//   #262: the PO's own links stay out of every report).
// - parseArgs: the session tool's options and flags (#279).
// - afterStart, question: what the add dialog shows once Start is clicked (#279, #311).
// - shotPath: where a screenshot goes (#311).
// - sample: one download as the field test watches it, from the app's snapshot and its files.
// - findings: what looks wrong between two samples of the same download.
// No I/O here; session.mjs supplies the inputs.

import { isAbsolute, join } from 'node:path';

/** How long a download may show Downloading without a new byte before it is flagged. */
export const QUIET_MS = 30_000;

/** The host of a link, or null for one without a host (a magnet link, a file path). */
export function hostOf(link) {
  try {
    const host = new URL(link).hostname;
    return host === '' ? null : host;
  } catch {
    return null;
  }
}

const LINK = /\b([a-z][a-z0-9+.-]*):\/\/([^\s/?#"'<>]*)[^\s"'<>]*/gi;
const MAGNET = /\b(magnet):\?[^\s"'<>]*/gi;
const TRAILING = /[.,:;)\]]+$/;

/**
 * `text` with every link cut to `scheme://host/…`: no login, port, path or query. A link with
 * nothing after its host, such as the engine's `https://host: 3 more requests …`, stays
 * `scheme://host` (#274).
 */
export function hideLinks(text) {
  // A magnet link has no host, and its trackers are links of their own: all of it goes (#279).
  const magnets = text.replace(MAGNET, (whole, scheme) => `${scheme}:?…${TRAILING.exec(whole)?.[0] ?? ''}`);
  return magnets.replace(LINK, (whole, scheme) => {
    const tail = TRAILING.exec(whole)?.[0] ?? '';
    const link = whole.slice(scheme.length + 3, whole.length - tail.length);
    const end = link.search(/[/?#]/);
    const authority = end === -1 ? link : link.slice(0, end);
    const host = authority.slice(authority.lastIndexOf('@') + 1).replace(/:\d*$/, '');
    return `${scheme}://${host}${end === -1 ? '' : '/…'}${tail}`;
  });
}

function why(error) {
  if (!error) return null;
  const status = error.httpStatus == null ? '' : `, HTTP ${error.httpStatus}`;
  return `${hideLinks(error.message)} [${error.class}${status}]`;
}

/**
 * One download as the field test watches it.
 * @param {object} record a `DownloadRecord` from the app's `get_snapshot`
 * @param {{partBytes?: number|null, fileBytes?: number|null}} files the part file's and the file's length on disk
 */
export function sample(record, files) {
  const p = record.progress;
  return {
    id: record.id,
    name: record.fileName,
    host: hostOf(record.sourceUrl),
    status: record.status,
    done: p.completedBytes,
    total: p.totalBytes,
    speed: p.downloadSpeedBps,
    connections: p.connections,
    allowed: p.connectionDetail?.allowed ?? null,
    requested: p.connectionDetail?.requested ?? null,
    limitedBy: p.connectionDetail?.limitedBy ?? null,
    error: why(record.error),
    retryAtMs: record.retryAtMs,
    partBytes: files.partBytes ?? null,
    fileBytes: files.fileBytes ?? null,
  };
}

const size = (bytes) => (bytes == null ? 'unknown' : `${bytes} bytes`);

/**
 * What looks wrong from `before` to `now`, two samples of one download.
 * @param {number} quietMs how long its bytes have stayed the same, up to `now`
 * @returns {string[]}
 */
export function findings(before, now, quietMs) {
  const out = [];
  const id = now.id;
  // A user's cancel or retry queues it again first; anything else that loses bytes is a finding.
  if (now.done < before.done && now.status !== 'queued') {
    out.push(`${id}: progress went backwards, from ${before.done} to ${now.done} bytes`);
  }
  if (before.total != null && now.total !== before.total) {
    out.push(`${id}: the size changed, from ${size(before.total)} to ${size(now.total)}`);
  }
  if (before.status === 'completed' && now.status !== 'completed') {
    out.push(`${id}: Completed, then ${now.status}`);
  }
  if (now.status === 'downloading' && now.done === before.done && quietMs >= QUIET_MS) {
    out.push(`${id}: no new bytes for ${Math.floor(quietMs / 1000)} s, but it still shows downloading`);
  }
  return out;
}

/** Options that take no value. A password is never one: it is typed at the prompt (#279). */
const FLAGS = new Set(['all', 'ftps', 'password']);

/**
 * The session tool's arguments: `--name value` options, `--flag`s, and the rest in order.
 * @param {string[]} args
 * @returns {{named: Record<string, string|true>, rest: string[]}}
 */
export function parseArgs(args) {
  const named = {};
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      rest.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (name.startsWith('password') && name !== 'password') {
      throw new Error('--password takes no value: the password is typed at the prompt.');
    }
    if (FLAGS.has(name)) {
      named[name] = true;
      continue;
    }
    const value = args[++i];
    if (value === undefined || value.startsWith('--')) throw new Error(`--${name} needs a value.`);
    named[name] = value;
  }
  return { named, rest };
}

/** The add dialog's title and hint, which every question repeats (#311). */
const DIALOG_HEADER = new Set(['Add download', 'Paste links, one per line, or choose .torrent files.']);

/**
 * The add dialog's text without its title, its hint and its buttons, which are listed apart.
 * @param {{text: string, buttons: string[]}} open
 */
export function question(open) {
  return open.text
    .split(' | ')
    .filter((part) => !DIALOG_HEADER.has(part) && !open.buttons.includes(part))
    .join(' | ');
}

/**
 * Where `shot` writes: a relative path goes in the session folder, not the folder the tool ran
 * in, which is the repository (#311).
 * @param {string} out the session folder
 * @param {string} path
 */
export function shotPath(out, path) {
  return isAbsolute(path) ? path : join(out, path);
}

/**
 * What the add dialog shows once Start was clicked, as `add` reports it.
 * @param {{text: string, buttons: string[]}|null} open the dialog's text and buttons, or null once it closed
 * @param {string[]} [answered] the buttons `--answer` clicked
 * @returns {{added: boolean, final: boolean, message: string}}
 */
export function afterStart(open, answered = []) {
  // Skip closes the dialog too, with nothing added (#311).
  if (!open) return answered.includes('Skip') ? { added: false, final: true, message: 'Skipped: nothing was added.' } : { added: true, final: true, message: 'Added.' };
  const text = hideLinks(question(open));
  // Only Done left: an outcome to read, not a question.
  if (open.buttons.length === 1 && open.buttons[0] === 'Done') return { added: false, final: true, message: `The app says: ${text}` };
  const answers = open.buttons.map((b) => `--answer "${b}"`).join(' or ');
  const stop = /[.?!]$/.test(text) ? '' : '.';
  return { added: false, final: false, message: `Not added yet. The app asks: ${text}${stop} Answer with ${answers}.` };
}

/** The PowerShell line whose output `elevationCheck` reads: True when this session runs as administrator. */
export const ELEVATION_COMMAND = "[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole('Administrator')";

/**
 * Whether `start` may go on (#397). Elevated, WebView2 ignores the debugging port by design
 * (WebView2Feedback #5640, #5645), so the window would never answer.
 * @param {{status: number|null, stdout: string, error?: Error}} result the check's spawnSync result
 * @returns {{refuse: boolean, message: string|null}}
 */
export function elevationCheck(result) {
  const answer = result.error || result.status !== 0 ? '' : result.stdout.trim();
  if (answer === 'True') {
    return {
      refuse: true,
      message: 'This session runs as administrator, and WebView2 then ignores the debugging port, so the window would never answer. Start the terminal, or the editor it runs in, without administrator rights, then run pnpm field start again.',
    };
  }
  if (answer === 'False') return { refuse: false, message: null };
  return { refuse: false, message: "Couldn't tell whether this session runs as administrator; carrying on. If the window never answers, check that first." };
}
