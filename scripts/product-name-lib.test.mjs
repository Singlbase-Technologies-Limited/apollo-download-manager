import { describe, expect, it } from 'vitest';
import { fullNames, oldNames } from './product-name-lib.mjs';

const lines = (path, text) => oldNames(path, text).map((f) => f.line);

describe('oldNames (#421)', () => {
  it('finds V2 used as the product name in a document', () => {
    expect(oldNames('docs/X.md', 'Intro.\n\nV2 does X, and V2\'s engine does Y.\n')).toEqual([
      { line: 3, text: "V2 does X, and V2's engine does Y." },
    ]);
  });

  it('ignores identifiers and paths in code spans and fenced blocks', () => {
    const text = 'Data in `%APPDATA%\\com.velocity.downloadmanager.v2` and `V2_DIR`.\n\n```sh\necho V2\n```\n';
    expect(lines('docs/X.md', text)).toEqual([]);
  });

  it('ignores link targets and HTML comments, but not link text', () => {
    expect(lines('docs/X.md', 'See [the page](V2/notes.md). <!-- V2 -->\n')).toEqual([]);
    expect(lines('docs/X.md', 'See [V2 notes](notes.md).\n')).toEqual([1]);
  });

  it("allows lower-case v2, as in BitTorrent v2 and Info hash (v2)", () => {
    expect(lines('docs/user/torrents.md', 'BitTorrent v1, v2 and hybrid; Info hash (v2).\n')).toEqual([]);
  });

  it('allows the quoted 0.1.x product name only in decision records, which stay as written (PO decisions on #486)', () => {
    expect(lines('docs/user/installing.md', 'From 0.1.x, which was named "Velocity Download Manager V2": install it.\n')).toEqual([1]);
    expect(lines('docs/decisions/0018-product-name-apollo.md', 'It replaces ADR-0016\'s "Velocity Download Manager V2" as the name.\n')).toEqual([]);
  });

  it('allows the title of a decision record, but not its running text (PO, 2026-11-09)', () => {
    const text = '# ADR-0003: V2 app identity\n\nV2 uses its own folder.\n';
    expect(lines('docs/decisions/0003-v2-app-identity.md', text)).toEqual([3]);
    expect(lines('docs/OTHER.md', text)).toEqual([1, 3]);
  });

  it('allows quotes in a decision record', () => {
    expect(lines('docs/decisions/0001-v2-direction.md', '> V2 builds its own engine.\n')).toEqual([]);
  });

  it('allows an issue title quoted after its number', () => {
    expect(lines('docs/X.md', 'Moved to #240 ("feat: publish V2\'s browser extension in the stores").\n')).toEqual([]);
  });

  it('finds V2 in the text of a web page, not in its comments', () => {
    expect(lines('browser-extension/static/p.html', '<!-- V2 -->\n<p>Send to V2</p>\n')).toEqual([2]);
  });

  it("finds V2 in a source file's strings, not in its comments", () => {
    const text = "// V2's own list\n/* V2 */\nconst label = 'Open V2';\nconst id = 'VELOCITY_V2_DATA_DIR';\n";
    expect(lines('src/app/X.tsx', text)).toEqual([3]);
  });

  it('skips tests and generated files, whose text is checked at the source', () => {
    expect(lines('src/app/X.test.tsx', "it('V2 works', () => {});\n")).toEqual([]);
    expect(lines('src/features/help/guide.generated.json', '{"t":"V2"}')).toEqual([]);
  });
});

describe('fullNames (#486)', () => {
  const at = (path, text) => fullNames(path, text).map((f) => f.line);

  it('finds V1 and 0.1.x full names in any case, including in code spans', () => {
    const text = 'Beside the original Velocity Download Manager.\n\nIn `%LOCALAPPDATA%\\Velocity Download Manager V2`.\n\nvelocity download manager\n';
    expect(fullNames('docs/user/README.md', text)).toEqual([
      { line: 1, text: 'Beside the original Velocity Download Manager.' },
      { line: 3, text: 'In `%LOCALAPPDATA%\\Velocity Download Manager V2`.' },
      { line: 5, text: 'velocity download manager' },
    ]);
  });

  it('allows the word velocity alone, in crate names, identifiers and package names (PO comment on #486)', () => {
    expect(at('docs/X.md', 'The `velocity-core` crate, `VELOCITY_V2_DATA_DIR` and `com.velocity.downloadmanager.v2`.\n')).toEqual([]);
  });

  it('keeps decision records and research copies as written (PO decision on #486)', () => {
    expect(at('docs/decisions/0016-release-product-name-v2.md', '# ADR-0016: The released app is named "Velocity Download Manager V2"\n')).toEqual([]);
    expect(at('docs/research/2026-10-21-libcurl-engine-research-r2.md', 'The original Velocity Download Manager (V1).\n')).toEqual([]);
  });

  it("finds the name in a source file's strings, not in its comments", () => {
    expect(at('src/app/X.tsx', "// Velocity Download Manager\nconst t = 'Velocity Download Manager';\n")).toEqual([2]);
  });

  it('skips tests and generated files, whose text is checked at the source', () => {
    expect(at('src/app/X.test.tsx', "const v1 = 'Velocity Download Manager';\n")).toEqual([]);
    expect(at('src/features/help/guide.generated.json', '{"t":"Velocity Download Manager"}')).toEqual([]);
  });
});
