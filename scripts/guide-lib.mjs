// The user guides (docs/user/) as typed data (#354): the in-app guide draws it with React, and
// the website (#353) renders it to pages. One parse, with markdown-it at build time only; the app
// ships the data, never the library. Raw HTML and images fail the build, so neither can reach the
// app as markup; a link stays a link only to another guide page (whose anchor must exist) or to an
// https site, and becomes plain text otherwise (for example a developer document).
import { readdirSync, readFileSync } from 'node:fs';
import MarkdownIt from 'markdown-it';
import { githubSlug } from './links-lib.mjs';

const md = new MarkdownIt({ html: true, linkify: false, typographer: false });

/** The page id of a guide file: `downloads.md` is `downloads`, the README is `index`. */
const pageId = (file) => (file === 'README.md' ? 'index' : file.replace(/\.md$/, ''));

/** Block tokens from `start` up to the matching close of `open`; returns [children, next index]. */
function until(tokens, start, closeType) {
  const out = [];
  let i = start;
  while (i < tokens.length && tokens[i].type !== closeType) {
    const [block, next] = block1(tokens, i);
    if (block) out.push(block);
    i = next;
  }
  return [out, i + 1];
}

let current = '';
let developer = false;
const fail = (why) => {
  throw new Error(`${current}: ${why}`);
};

function inline(children) {
  const root = { content: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1].content;
  const pushText = (text) => {
    const c = top();
    const last = c[c.length - 1];
    if (last?.type === 'text') last.text += text;
    else c.push({ type: 'text', text });
  };
  for (const t of children) {
    switch (t.type) {
      case 'text':
        pushText(t.content);
        break;
      case 'softbreak':
        pushText(' ');
        break;
      case 'hardbreak':
        top().push({ type: 'break' });
        break;
      case 'code_inline':
        top().push({ type: 'code', text: t.content });
        break;
      case 'strong_open':
      case 'em_open':
      case 's_open': {
        const node = { type: t.type === 'strong_open' ? 'strong' : t.type === 'em_open' ? 'em' : 'strike', content: [] };
        top().push(node);
        stack.push(node);
        break;
      }
      case 'link_open': {
        const node = { type: 'link', href: t.attrGet('href') ?? '', content: [] };
        top().push(node);
        stack.push(node);
        break;
      }
      case 'strong_close':
      case 'em_close':
      case 's_close':
      case 'link_close':
        stack.pop();
        break;
      case 'html_inline':
        if (!developer) fail(`raw HTML is not allowed (${t.content.trim()})`);
        pushText(t.content);
        break;
      case 'image':
        if (!developer) fail('image: the guides have no images yet');
        top().push({ type: 'image', src: t.attrGet('src') ?? '', alt: t.content });
        break;
      default:
        fail(`unexpected Markdown (${t.type})`);
    }
  }
  return root.content;
}

function block1(tokens, i) {
  const t = tokens[i];
  switch (t.type) {
    case 'heading_open': {
      const content = inline(tokens[i + 1].children);
      return [{ type: 'heading', level: Number(t.tag.slice(1)), id: '', content }, i + 3];
    }
    case 'paragraph_open':
      return [{ type: 'paragraph', content: inline(tokens[i + 1].children) }, i + 3];
    case 'bullet_list_open':
    case 'ordered_list_open': {
      const ordered = t.type === 'ordered_list_open';
      const close = ordered ? 'ordered_list_close' : 'bullet_list_close';
      const items = [];
      let j = i + 1;
      while (tokens[j].type !== close) {
        const [content, next] = until(tokens, j + 1, 'list_item_close');
        items.push(content);
        j = next;
      }
      return [{ type: 'list', ordered, items }, j + 1];
    }
    case 'blockquote_open': {
      const [content, next] = until(tokens, i + 1, 'blockquote_close');
      return [{ type: 'quote', content }, next];
    }
    case 'fence':
    case 'code_block':
      return [{ type: 'codeBlock', text: t.content }, i + 1];
    case 'hr':
      return [{ type: 'rule' }, i + 1];
    case 'table_open': {
      const head = [];
      const rows = [];
      let j = i + 1;
      let row = null;
      let inHead = false;
      for (; tokens[j].type !== 'table_close'; j++) {
        const k = tokens[j];
        if (k.type === 'thead_open') inHead = true;
        else if (k.type === 'thead_close') inHead = false;
        else if (k.type === 'tr_open') row = [];
        else if (k.type === 'tr_close') {
          if (!inHead) rows.push(row);
        } else if (k.type === 'inline') {
          const cell = inline(k.children);
          if (inHead) head.push(cell);
          else row.push(cell);
        }
      }
      return [{ type: 'table', head, rows }, j + 1];
    }
    case 'html_block':
      fail(`raw HTML is not allowed (${t.content.trim().slice(0, 40)})`);
      return [null, i + 1];
    default:
      fail(`unexpected Markdown (${t.type})`);
      return [null, i + 1];
  }
}

const plain = (content) =>
  content.map((n) => (n.type === 'text' || n.type === 'code' ? n.text : n.type === 'break' ? ' ' : n.content ? plain(n.content) : '')).join('');

function blockText(b) {
  switch (b.type) {
    case 'paragraph':
    case 'heading':
      return plain(b.content);
    case 'list':
      return b.items.map((item) => item.map(blockText).join(' ')).join(' ');
    case 'quote':
      return b.content.map(blockText).join(' ');
    case 'codeBlock':
      return b.text.trim();
    case 'table':
      return [...b.head, ...b.rows.flat()].map(plain).join(' ');
    default:
      return '';
  }
}

/** Walks every inline node of `blocks`, depth first. */
function* inlines(blocks) {
  function* walk(nodes) {
    for (const n of nodes) {
      yield n;
      if (n.content) yield* walk(n.content);
    }
  }
  for (const b of blocks) {
    if (b.type === 'paragraph' || b.type === 'heading') yield* walk(b.content);
    else if (b.type === 'list') for (const item of b.items) yield* inlines(item);
    else if (b.type === 'quote') yield* inlines(b.content);
    else if (b.type === 'table') for (const cell of [...b.head, ...b.rows.flat()]) yield* walk(cell);
  }
}

/**
 * One Markdown file as a page: its title (the `#` heading), headings with GitHub's anchors, typed blocks and each
 * section's plain text. Links keep their `href` until {@link resolveLinks}. Raw HTML and images fail.
 * @param {string} file the file's name, for errors
 * @param {string} text its Markdown
 * @param {{ developer?: boolean }} [options] a developer document (#355) may show its pictures, and text like `<Name>` stays
 * text; the guides allow neither
 */
export function parsePage(file, text, options = {}) {
  current = file;
  developer = options.developer === true;
  const [blocks] = until(md.parse(text, {}), 0, '__end__');
  const seen = new Map();
  const headings = [];
  for (const b of blocks) {
    if (b.type !== 'heading') continue;
    const heading = plain(b.content);
    const slug = githubSlug(heading);
    const n = seen.get(slug) ?? 0;
    seen.set(slug, n + 1);
    b.id = n ? `${slug}-${String(n)}` : slug;
    headings.push({ id: b.id, level: b.level, text: heading });
  }
  const title = headings.find((h) => h.level === 1)?.text ?? fail('no title (a # heading)');
  const sections = [];
  for (const b of blocks) {
    if (b.type === 'heading') sections.push({ anchor: b.id, heading: plain(b.content), text: [] });
    else if (sections.length > 0) sections[sections.length - 1].text.push(blockText(b));
  }
  return { file, title, headings, blocks, sections: sections.map((x) => ({ ...x, text: x.text.join(' ').replace(/\s+/g, ' ').trim() })) };
}

/**
 * Gives each link of `page` the target `resolve` returns for its `href` (an object stored as `to`), or makes it
 * plain text when that is `null`; an error `resolve` throws fails the build, naming the page.
 * @param {{ file: string, blocks: object[] }} page
 * @param {(href: string) => object | null} resolve
 */
export function resolveLinks(page, resolve) {
  current = page.file;
  for (const n of inlines(page.blocks)) {
    if (n.type !== 'link') continue;
    const href = n.href;
    delete n.href;
    let to;
    try {
      to = resolve(href);
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
    if (to === null) {
      n.type = 'text';
      n.text = plain(n.content);
      delete n.content;
    } else {
      n.to = to;
    }
  }
  page.blocks = page.blocks.map(function merge(b) {
    const fix = (content) =>
      content.reduce((out, x) => {
        const last = out[out.length - 1];
        if (x.type === 'text' && last?.type === 'text') last.text += x.text;
        else out.push(x.content ? { ...x, content: fix(x.content) } : x);
        return out;
      }, []);
    if (b.type === 'paragraph' || b.type === 'heading') return { ...b, content: fix(b.content) };
    if (b.type === 'list') return { ...b, items: b.items.map((item) => item.map(merge)) };
    if (b.type === 'quote') return { ...b, content: b.content.map(merge) };
    if (b.type === 'table') return { ...b, head: b.head.map(fix), rows: b.rows.map((r) => r.map(fix)) };
    return b;
  });
}

/**
 * @param {Record<string, string>} files the guide's files by name (`README.md`, `downloads.md`, …)
 * @returns {{ groups: { title: string, pages: string[] }[], pages: { id: string, file: string, title: string, headings: { id: string, level: number, text: string }[], blocks: object[], sections: { anchor: string, heading: string, text: string }[] }[] }}
 */
export function buildGuide(files) {
  if (!('README.md' in files)) throw new Error('The guide has no README.md to list its pages');
  const order = ['README.md'];
  // The order is the README's tables: each row starts with a link to its page. Each table follows a `##` heading,
  // which is the pages' group in the app's and the website's sidebar (#488); the README itself opens the first group.
  /** @type {{ title: string, files: string[] }[]} */
  const grouped = [];
  for (const m of files['README.md'].matchAll(/^## (.+)$|^\| \[[^\]]+\]\(([a-z0-9-]+\.md)\)/gm)) {
    if (m[1] !== undefined) {
      grouped.push({ title: m[1].trim(), files: grouped.length === 0 ? ['README.md'] : [] });
      continue;
    }
    if (order.includes(m[2])) continue;
    if (grouped.length === 0) throw new Error(`${m[2]} is listed in the guide's README.md before any group heading (## …)`);
    order.push(m[2]);
    grouped[grouped.length - 1].files.push(m[2]);
  }
  if (grouped.length === 0) grouped.push({ title: 'User guide', files: ['README.md'] });
  for (const f of Object.keys(files)) {
    if (!order.includes(f)) throw new Error(`${f} is not listed in the guide's README.md`);
  }
  const pages = order.map((file) => {
    if (!(file in files)) {
      current = file;
      fail('listed in README.md, but missing');
    }
    return { id: pageId(file), ...parsePage(file, files[file]) };
  });
  const byFile = new Map(pages.map((p) => [p.file, p]));
  for (const page of pages) {
    resolveLinks(page, (href) => {
      if (/^https:\/\//i.test(href)) return { url: href };
      const m = /^([a-z0-9-]+\.md)?(?:#(.+))?$/.exec(href);
      const target = m ? byFile.get(m[1] ?? page.file) : undefined;
      if (m && (m[1] || m[2]) && !target) throw new Error(`a link to ${href}, which is not a guide page`);
      // Not a guide page (a developer document, another scheme): plain text, kept in place.
      if (!target) return null;
      if (m[2] && !target.headings.some((h) => h.id === m[2])) throw new Error(`a link to ${href}, whose heading does not exist`);
      return m[2] ? { page: target.id, anchor: m[2] } : { page: target.id };
    });
  }
  const groups = grouped.filter((g) => g.files.length > 0).map((g) => ({ title: g.title, pages: g.files.map(pageId) }));
  return { groups, pages: pages.map(({ file, ...p }) => ({ ...p, file })) };
}

const GUIDE_DIR = new URL('../docs/user/', import.meta.url);
/** Where `pnpm guide` writes the data the app bundles. */
export const GUIDE_OUT = new URL('../src/features/help/guide.generated.json', import.meta.url);

/** The guide data as `pnpm guide` writes it, from docs/user/ as it is now. */
export function guideData() {
  const files = Object.fromEntries(
    readdirSync(GUIDE_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => [f, readFileSync(new URL(f, GUIDE_DIR), 'utf8').replace(/\r\n/g, '\n')]),
  );
  return `${JSON.stringify(buildGuide(files), null, 1)}\n`;
}

/** A version's heading in CHANGELOG.md: `## 0.2.0 - 2026-11-10`, a pre-release such as `0.3.0-rc.1` too. */
const VERSION_HEADING = /^(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?) - (\d{4}-\d{2}-\d{2})$/;

/**
 * The changelog for the app's What's new window (#496): one entry per version, newest first as the file has them,
 * each with its date and its typed blocks, like the guide's. A web address stays a link the window shows to copy; a
 * link to a file of the repository becomes plain text, since the window opens nothing.
 * @param {string} text CHANGELOG.md
 * @returns {{ versions: { version: string, date: string, blocks: object[] }[] }}
 */
export function buildChangelog(text) {
  const page = parsePage('CHANGELOG.md', text);
  resolveLinks(page, (href) => (/^https:\/\//i.test(href) ? { url: href } : null));
  const versions = [];
  // What has merged since the last release (docs/RELEASE_PROCESS.md) belongs to no build yet: left out.
  let unreleased = false;
  for (const b of page.blocks) {
    if (b.type === 'heading' && b.level === 2) {
      const heading = plain(b.content);
      unreleased = heading === 'Unreleased';
      if (unreleased) continue;
      const m = VERSION_HEADING.exec(heading);
      if (!m) throw new Error(`CHANGELOG.md: a version heading must read "## 1.2.3 - 2026-01-31", not "${heading}"`);
      versions.push({ version: m[1], date: m[2], blocks: [] });
    } else if (versions.length > 0 && !unreleased) {
      versions[versions.length - 1].blocks.push(b);
    }
  }
  return { versions };
}

/** Where `pnpm guide` writes the changelog the app bundles (#496). */
export const CHANGELOG_OUT = new URL('../src/app/changelog.generated.json', import.meta.url);

/** The changelog data as `pnpm guide` writes it, from CHANGELOG.md as it is now. */
export function changelogData() {
  const text = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  return `${JSON.stringify(buildChangelog(text), null, 1)}\n`;
}
