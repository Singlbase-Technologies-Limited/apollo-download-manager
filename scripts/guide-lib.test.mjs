import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildGuide, GUIDE_OUT, guideData } from './guide-lib.mjs';

const index = `# The guide

## Start

| Guide | What |
|---|---|
| [Second](b.md) | b |

## More

| Guide | What |
|---|---|
| [First](a.md) | a |
`;

const files = (over = {}) => ({
  'README.md': index,
  'a.md': '# Page A\n\nIntro with **bold**, *em*, `code` and a [link to B](b.md#part-two).\n\n## Part one\n\n- one\n- two\n\n1. first\n2. second\n',
  'b.md': '# Page B\n\n## Part two\n\n| Name | Value |\n|---|---|\n| x | `1` |\n\n```sh\npnpm dev\n```\n\nSee [the site](https://example.org/x) and [the code](../ARCHITECTURE.md).\n\n## Part two\n',
  ...over,
});

describe('the in-app guide (#354)', () => {
  it('orders the pages as the index lists them', () => {
    expect(buildGuide(files()).pages.map((p) => p.id)).toEqual(['index', 'b', 'a']);
  });

  it('groups the pages under the index’s headings, the index first, for the app and the website (#488)', () => {
    expect(buildGuide(files()).groups).toEqual([
      { title: 'Start', pages: ['index', 'b'] },
      { title: 'More', pages: ['a'] },
    ]);
  });

  it('fails on a page the index lists outside a group (#488)', () => {
    const ungrouped = '# The guide\n\n| Guide | What |\n|---|---|\n| [First](a.md) | a |\n\n## More\n\n| Guide | What |\n|---|---|\n| [Second](b.md) | b |\n';
    expect(() => buildGuide(files({ 'README.md': ungrouped }))).toThrow(/a\.md.*group/);
  });

  it('gives each heading the anchor GitHub gives it, numbering repeats', () => {
    const b = buildGuide(files()).pages[1];
    expect(b.title).toBe('Page B');
    expect(b.headings).toEqual([
      { id: 'page-b', level: 1, text: 'Page B' },
      { id: 'part-two', level: 2, text: 'Part two' },
      { id: 'part-two-1', level: 2, text: 'Part two' },
    ]);
  });

  it('keeps inline styles, lists, tables and code as typed blocks', () => {
    const a = buildGuide(files()).pages[2];
    expect(a.blocks[1]).toEqual({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Intro with ' },
        { type: 'strong', content: [{ type: 'text', text: 'bold' }] },
        { type: 'text', text: ', ' },
        { type: 'em', content: [{ type: 'text', text: 'em' }] },
        { type: 'text', text: ', ' },
        { type: 'code', text: 'code' },
        { type: 'text', text: ' and a ' },
        { type: 'link', to: { page: 'b', anchor: 'part-two' }, content: [{ type: 'text', text: 'link to B' }] },
        { type: 'text', text: '.' },
      ],
    });
    expect(a.blocks[3]).toMatchObject({ type: 'list', ordered: false, items: [[{ type: 'paragraph' }], [{ type: 'paragraph' }]] });
    expect(a.blocks[4]).toMatchObject({ type: 'list', ordered: true });
    const b = buildGuide(files()).pages[1];
    expect(b.blocks.find((x) => x.type === 'table')).toEqual({
      type: 'table',
      head: [[{ type: 'text', text: 'Name' }], [{ type: 'text', text: 'Value' }]],
      rows: [[[{ type: 'text', text: 'x' }], [{ type: 'code', text: '1' }]]],
    });
    expect(b.blocks.find((x) => x.type === 'codeBlock')).toEqual({ type: 'codeBlock', text: 'pnpm dev\n' });
  });

  it('opens https links outside the app, and makes links to developer documents plain text', () => {
    const p = buildGuide(files()).pages[1].blocks.find((x) => x.type === 'paragraph' && x.content.some((i) => i.type === 'link'));
    expect(p.content).toContainEqual({ type: 'link', to: { url: 'https://example.org/x' }, content: [{ type: 'text', text: 'the site' }] });
    expect(p.content).toContainEqual({ type: 'text', text: ' and the code.' });
  });

  it('gives each page its plain text for searching', () => {
    const a = buildGuide(files()).pages[2];
    expect(a.sections[0]).toEqual({ anchor: 'page-a', heading: 'Page A', text: 'Intro with bold, em, code and a link to B.' });
    expect(a.sections[1]).toEqual({ anchor: 'part-one', heading: 'Part one', text: 'one two first second' });
  });

  it('fails on raw HTML and on a link to a page or anchor that does not exist', () => {
    expect(() => buildGuide(files({ 'a.md': '# A\n\n<b>bold</b>\n' }))).toThrow(/a\.md: raw HTML/);
    expect(() => buildGuide(files({ 'a.md': '# A\n\n<div>x</div>\n' }))).toThrow(/a\.md: raw HTML/);
    expect(() => buildGuide(files({ 'a.md': '# A\n\n[x](missing.md)\n' }))).toThrow(/a\.md: .*missing\.md/);
    expect(() => buildGuide(files({ 'a.md': '# A\n\n[x](b.md#nope)\n' }))).toThrow(/a\.md: .*b\.md#nope/);
    expect(() => buildGuide(files({ 'a.md': '# A\n\n![pic](x.png)\n' }))).toThrow(/a\.md: image/);
  });
});

describe('the committed guide data', () => {
  it('is what docs/user/ gives now (run `pnpm guide` after editing a guide)', () => {
    expect(readFileSync(GUIDE_OUT, 'utf8').replace(/\r\n/g, '\n')).toBe(guideData());
  });
});
