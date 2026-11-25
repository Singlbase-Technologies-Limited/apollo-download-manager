// Rules for what the documents say, beside the link check (#425; `pnpm check:links` runs them, docs/WEBSITE.md):
// - the user guide (docs/user/) names no code: no crate, source or test file, code path, identifier or issue number;
// - a developer page links every repository path it names in code style, so readers don't copy paths by hand; the
//   research records stay word for word (PO decision on #425), and the documentation map and user guide aren't
//   developer pages;
// - each user guide page and its developer counterpart link each other.
import { posix } from 'node:path';

/** The user guide pages and their developer counterparts, which link each other in a "See also" line (#425). */
export const SEE_ALSO = [
  ['docs/user/installing.md', 'docs/PACKAGING.md'],
  ['docs/user/torrents.md', 'docs/TORRENTS.md'],
  ['docs/user/browser.md', 'docs/BROWSER_EXTENSION.md'],
  ['docs/user/settings.md', 'docs/SETTINGS.md'],
  ['docs/user/protocols.md', 'docs/ENGINE_INTERNALS.md'],
  ['docs/user/troubleshooting.md', 'docs/DIAGNOSTICS.md'],
  ['docs/user/v1-and-v2.md', 'docs/COEXISTENCE.md'],
  ['docs/user/files-and-logins.md', 'docs/FILE_NAMING.md'],
];

/** Code-style names the user guide may use, because users need them. */
const USER_ALLOWED = new Set(['known_hosts']);

/** Each line of `text` outside fenced code blocks, with its number. */
function* proseLines(text) {
  let fenced = false;
  for (const [i, line] of text.split(/\r?\n/).entries()) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (!fenced) yield [i + 1, line];
  }
}

/** `line` with each code span blanked, so prose rules don't see inside it; the spans, with where they start. */
function codeSpans(line) {
  const spans = [...line.matchAll(/`([^`]+)`/g)].map((m) => ({ at: m.index, text: m[1] }));
  return { spans, prose: line.replace(/`[^`]+`/g, (m) => ' '.repeat(m.length)) };
}

const isCode = (name) =>
  !USER_ALLOWED.has(name) &&
  (/^(crates|src|src-tauri|scripts|tests|browser-extension|site)\//.test(name) ||
    /\.(rs|ts|tsx|mjs|cjs|js|toml|cpp|hpp|h)$/.test(name) ||
    /\bvelocity[-_][a-z]/.test(name) ||
    name.includes('::') ||
    /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(name) ||
    /^[a-z]+[A-Z][A-Za-z0-9]*$/.test(name));

/**
 * Code the user guide names (#425): `{ file, line, name }` for each crate, source or test file, code path, identifier
 * or issue number in a page's prose. Code blocks hold commands for users, so they aren't checked.
 * @param {Record<string, string>} files Markdown files by their path; only docs/user/ is checked
 */
export function codeInUserGuide(files) {
  const found = [];
  for (const [file, text] of Object.entries(files)) {
    if (!file.startsWith('docs/user/')) continue;
    for (const [line, raw] of proseLines(text)) {
      const { spans, prose } = codeSpans(raw);
      const hits = spans.filter((s) => isCode(s.text.trim())).map((s) => ({ at: s.at, name: s.text.trim() }));
      for (const m of prose.matchAll(/(?<![\w.])velocity-[a-z][a-z-]*/g)) hits.push({ at: m.index, name: m[0] });
      for (const m of prose.matchAll(/(?<![\w&/#])#\d+\b/g)) hits.push({ at: m.index, name: m[0] });
      for (const h of hits.sort((a, b) => a.at - b.at)) found.push({ file, line, name: h.name });
    }
  }
  return found;
}

/** Whether `file` is a developer page whose paths must be links (#425). */
const isDeveloperPage = (file) => file.startsWith('docs/') && !file.startsWith('docs/user/') && !file.startsWith('docs/research/') && file !== 'docs/README.md';

/**
 * Repository paths a developer page names in code style without linking them (#425): `{ file, line, path }`.
 * A path counts when `exists` finds it from the repository's root or from the page's own folder; a line number or
 * anchor after it (`lib.rs:42`, `X.md#part`) is left off.
 * @param {Record<string, string>} files Markdown files by their path
 * @param {(path: string) => boolean} exists whether a path, from the repository's root, is a file or folder
 */
export function unlinkedPaths(files, exists) {
  const found = [];
  for (const [file, text] of Object.entries(files)) {
    if (!isDeveloperPage(file)) continue;
    const dir = posix.dirname(file);
    for (const [line, raw] of proseLines(text)) {
      // A heading names a topic, and a link in it would change its anchor.
      if (/^#{1,6}\s/.test(raw)) continue;
      // A link's text is linked already.
      const unlinked = raw.replace(/\[(?:[^\]`]|`[^`]*`)*\]\([^)\s]*\)/g, (m) => ' '.repeat(m.length));
      for (const { text: span } of codeSpans(unlinked).spans) {
        const candidate = span.trim();
        if (/[\s<>*${}|]|^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) continue;
        const path = candidate.replace(/:\d+(-\d+)?$/, '').replace(/#.*$/, '').replace(/\/+$/, '');
        if (!path.includes('/') && !/\.[A-Za-z0-9]{1,6}$/.test(path)) continue;
        if (exists(posix.normalize(path)) || exists(posix.normalize(posix.join(dir, path)))) found.push({ file, line, path });
      }
    }
  }
  return found;
}

/** The files `text`, at `file`, links to, as paths from the repository's root. */
const linkedFiles = (file, text) =>
  new Set([...text.matchAll(/\]\(([^)\s#]+)(#[^)\s]*)?\)/g)].filter((m) => !/^[a-z][a-z0-9+.-]*:/i.test(m[1])).map((m) => posix.normalize(posix.join(posix.dirname(file), m[1]))));

/**
 * The pairs whose pages don't link each other (#425): `{ file, missing }` for a page that doesn't link its counterpart.
 * @param {string[][]} pairs [user guide page, developer page]
 * @param {(path: string) => string | undefined} read a file's text
 */
export function missingSeeAlso(pairs, read) {
  const missing = [];
  for (const [user, dev] of pairs) {
    for (const [file, other] of [[user, dev], [dev, user]]) {
      const text = read(file);
      if (text === undefined || !linkedFiles(file, text).has(other)) missing.push({ file, missing: other });
    }
  }
  return missing;
}
