import { describe, expect, it } from 'vitest';
import { codeInUserGuide, missingSeeAlso, SEE_ALSO, unlinkedPaths } from './docs-rules-lib.mjs';

// #425: what the user guide may name, that the developer pages link the code they name, and that the matching pages of
// the two guides link each other.

describe('the user guide names no code (#425)', () => {
  const check = (text) => codeInUserGuide({ 'docs/user/x.md': text });

  it('finds crates, source and test files, code paths, identifiers and issue numbers', () => {
    const found = check(
      [
        'Checked by `crates/velocity-transfer/tests/user_guide.rs` in velocity-transfer.',
        'The `velocity_core` crate, `src/app/App.tsx` and `scripts/guide.mjs`.',
        'Its `retryAtMs` and `max_connections` fields, and `DownloadOptions::one_connection`.',
        'Torrents have their own limit (#312).',
      ].join('\n'),
    );
    expect(found.map((f) => f.name)).toEqual([
      'crates/velocity-transfer/tests/user_guide.rs',
      'velocity-transfer',
      'velocity_core',
      'src/app/App.tsx',
      'scripts/guide.mjs',
      'retryAtMs',
      'max_connections',
      'DownloadOptions::one_connection',
      '#312',
    ]);
    expect(found[0]).toMatchObject({ file: 'docs/user/x.md', line: 1 });
  });

  it('allows what users need: data folders, the known_hosts file, licence files, links and commands', () => {
    expect(
      check(
        [
          'Data is in `%APPDATA%\\com.velocity.downloadmanager.v2` and `~/.local/share/com.velocity.downloadmanager.v2`.',
          'Remove the entry from `known_hosts`. The licences are in `LICENSE` and `THIRD_PARTY_NOTICES.md`.',
          'Links such as `https://` or `sftp://`, a name like `file[001-100].zip`, and `sudo apt remove apollo-download-manager`.',
          'Open `chrome://extensions`. The part file is `<name>.vdmpart`.',
          '```sh\nsudo apt install ./x.deb  # crates/velocity-core in a code block is a command, not prose\n```',
        ].join('\n'),
      ),
    ).toEqual([]);
  });
});

describe('the developer pages link the paths they name (#425)', () => {
  const exists = (p) => ['crates/velocity-core', 'crates/velocity-core/src/lib.rs', 'package.json', 'docs/TESTING.md', 'docs/decisions/0001-v2-direction.md'].includes(p);

  it('lists a backticked path in the repository that isn’t a link, with its line', () => {
    const files = { 'docs/X.md': '# X\n\nThe core is `crates/velocity-core`, see `crates/velocity-core/src/lib.rs:42`.\n' };
    expect(unlinkedPaths(files, exists)).toEqual([
      { file: 'docs/X.md', line: 3, path: 'crates/velocity-core' },
      { file: 'docs/X.md', line: 3, path: 'crates/velocity-core/src/lib.rs' },
    ]);
  });

  it('accepts a linked path, a path beside the document, and text that is no path', () => {
    const files = {
      'docs/X.md': [
        '# X',
        'The core is [`crates/velocity-core`](../crates/velocity-core/) and [`package.json`](../package.json).',
        'Commands such as `pnpm check:links`, a type such as `Option<u32>`, a URL `https://example.org/a.b`, and `no/such/file.rs`.',
        '```sh\ncat package.json crates/velocity-core/src/lib.rs\n```',
      ].join('\n'),
    };
    expect(unlinkedPaths(files, exists)).toEqual([]);
    expect(unlinkedPaths({ 'docs/X.md': 'See `TESTING.md`.\n' }, exists)).toEqual([{ file: 'docs/X.md', line: 1, path: 'TESTING.md' }]);
    // A heading names a topic, and a link in it would change its anchor.
    expect(unlinkedPaths({ 'docs/X.md': '## The `crates/velocity-core` crate\n' }, exists)).toEqual([]);
  });

  it('leaves the user guide and the research records alone (PO decision on #425), and checks decision records', () => {
    const text = 'The core is `crates/velocity-core`.\n';
    expect(unlinkedPaths({ 'docs/user/x.md': text, 'docs/research/r.md': text, 'docs/README.md': text, 'README.md': text }, exists)).toEqual([]);
    expect(unlinkedPaths({ 'docs/decisions/0001-v2-direction.md': text }, exists)).toHaveLength(1);
  });
});

describe('the matching pages of the two guides link each other (#425)', () => {
  it('pairs every page with one that exists', () => {
    for (const [user, dev] of SEE_ALSO) {
      expect(user).toMatch(/^docs\/user\/[a-z0-9-]+\.md$/);
      expect(dev).toMatch(/^docs\/[A-Z_0-9]+\.md$/);
    }
  });

  it('says which side of a pair doesn’t link the other', () => {
    const read = (files) => (p) => files[p];
    const pairs = [['docs/user/torrents.md', 'docs/TORRENTS.md']];
    expect(missingSeeAlso(pairs, read({ 'docs/user/torrents.md': 'See also: [Torrents](../TORRENTS.md).', 'docs/TORRENTS.md': 'See also: [Torrents](user/torrents.md#seeding).' }))).toEqual([]);
    expect(missingSeeAlso(pairs, read({ 'docs/user/torrents.md': 'Nothing.', 'docs/TORRENTS.md': 'See also: [Torrents](user/torrents.md).' }))).toEqual([
      { file: 'docs/user/torrents.md', missing: 'docs/TORRENTS.md' },
    ]);
    expect(missingSeeAlso(pairs, read({ 'docs/user/torrents.md': 'See [it](../TORRENTS.md).', 'docs/TORRENTS.md': 'Nothing.' }))).toEqual([
      { file: 'docs/TORRENTS.md', missing: 'docs/user/torrents.md' },
    ]);
  });
});
