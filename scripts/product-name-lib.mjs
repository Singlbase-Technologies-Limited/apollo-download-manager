// The old working name "V2" in what users and contributors read (#421): the product is Apollo Download Manager
// (ADR-0018). `pnpm check:product-name` runs this over the documents, the website's content, the extension's pages
// and the window's source; the tests are in product-name-lib.test.mjs. Only whole-word, upper-case "V2" counts, so
// "BitTorrent v2", file names such as v1-and-v2.md and identifiers such as VELOCITY_V2_DATA_DIR pass.

const V2 = /\bV2\b/;

/**
 * What may still say V2, each with its reason. A line matching one is skipped.
 * @type {{ why: string, test: (line: string, path: string, lineNo: number) => boolean }[]}
 */
const ALLOWED = [
  {
    why: 'the 0.1.x product name, quoted, in a decision record: records stay as written (PO decision on #486)',
    test: (line, path) => path.startsWith('docs/decisions/') && !V2.test(line.replace(/"Velocity Download Manager V2"/g, '')),
  },
  {
    why: 'an issue title quoted after its number: titles are kept verbatim',
    test: (line) => !V2.test(line.replace(/#\d+\s*\("[^"]*"\)|#\d+\s+"[^"]*"/g, '')),
  },
  {
    why: "a decision record's title: records keep their titles (PO decision on #421)",
    test: (line, path, lineNo) => path.startsWith('docs/decisions/') && lineNo === 1 && line.startsWith('# '),
  },
  {
    why: 'a quote in a decision record: quotes stay as they were said (PO decision on #421)',
    test: (line, path) => path.startsWith('docs/decisions/') && line.startsWith('>'),
  },
];

/** Generated or test files: their text is checked where it comes from. */
const skipped = (path) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) || /\.generated\./.test(path);

/** Markdown with code, link targets and comments blanked out, keeping the line numbers. */
function markdownText(text) {
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  return text
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, blank)
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(`+)[\s\S]*?\1/g, blank)
    .replace(/\]\([^)]*\)/g, (m) => `]${blank(m.slice(1))}`);
}

/** HTML with comments blanked out. */
const htmlText = (text) => text.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));

/** Source with comments blanked out (strings kept, so a `//` inside one is left alone). */
function sourceText(text) {
  let out = '';
  for (let i = 0; i < text.length; ) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < text.length && text[j] !== c && !(c !== '`' && text[j] === '\n')) j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (text.startsWith('//', i)) {
      const end = text.indexOf('\n', i);
      const stop = end < 0 ? text.length : end;
      out += ' '.repeat(stop - i);
      i = stop;
    } else if (text.startsWith('/*', i)) {
      const end = text.indexOf('*/', i + 2);
      const stop = end < 0 ? text.length : end + 2;
      out += text.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

/**
 * The lines of `text` (the file at `path`, relative to the repository) that still call the product V2.
 * @param {string} path
 * @param {string} text
 * @returns {{ line: number, text: string }[]}
 */
export function oldNames(path, text) {
  if (skipped(path)) return [];
  const prose = /\.md$/i.test(path) ? markdownText(text) : /\.html?$/i.test(path) ? htmlText(text) : /\.[cm]?[jt]sx?$/.test(path) ? sourceText(text) : text;
  const original = text.split('\n');
  const found = [];
  prose.split('\n').forEach((line, i) => {
    if (!V2.test(line)) return;
    if (ALLOWED.some((a) => a.test(line, path, i + 1))) return;
    found.push({ line: i + 1, text: original[i].trim() });
  });
  return found;
}

// V1's full name, "Velocity Download Manager", may be another company's product name, so it leaves public texts,
// and so does Apollo DM's 0.1.x name, "Velocity Download Manager V2" (PO decisions on #486). "velocity" alone, in
// crate names, identifiers and code, stays (PO comment on #486). Unlike "V2", the name counts in code spans too:
// a path such as `%LOCALAPPDATA%\Velocity Download Manager` shows it as plainly as the text.
const FULL_NAME = /velocity\s+download\s+manager/i;

/** Decision records and research copies stay as written (AGENTS.md; PO decision on #486). */
const records = (path) => path.startsWith('docs/decisions/') || path.startsWith('docs/research/');

/**
 * The lines of `text` (the file at `path`, relative to the repository) that name V1 or Apollo DM 0.1.x in full.
 * @param {string} path
 * @param {string} text
 * @returns {{ line: number, text: string }[]}
 */
export function fullNames(path, text) {
  if (skipped(path) || records(path)) return [];
  const read = /\.[cm]?[jt]sx?$/.test(path) ? sourceText(text) : /\.html?$/i.test(path) ? htmlText(text) : text;
  const original = text.split('\n');
  const found = [];
  read.split('\n').forEach((line, i) => {
    if (FULL_NAME.test(line)) found.push({ line: i + 1, text: original[i].trim() });
  });
  return found;
}
