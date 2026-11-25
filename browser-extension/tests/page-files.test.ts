import { describe, expect, it } from 'vitest';
import { findPageFiles, groupOf, hiddenOn, normalizeLink } from '../src/shared/page-files';
import { addToOutcome, buildAddMany, EMPTY_OUTCOME, MAX_BATCH_LINKS, type Request } from '../src/shared/protocol';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../src/shared/settings';

const BASE = 'https://mirror.example.org/releases/26.04/';

describe('the files on a page (#426)', () => {
  it('finds the links whose names are file types, each once, in page order', () => {
    const { files, skipped } = findPageFiles(
      [
        { href: '../' },
        { href: 'os-desktop-amd64.iso' },
        { href: 'os-desktop-amd64.iso#top' },
        { href: 'https://mirror.example.org/releases/26.04/os-desktop-amd64.iso' },
        { href: 'release-notes.pdf' },
        { href: 'known-issues.html' },
        { href: 'os.iso.torrent' },
        { href: 'get?id=7', download: 'tool-setup.exe' },
        { href: 'javascript:void(0)' },
        { href: 'magnet:?xt=urn:btih:abc' },
      ],
      BASE,
      DEFAULT_SETTINGS,
    );
    expect(files).toEqual([
      { url: `${BASE}os-desktop-amd64.iso`, name: 'os-desktop-amd64.iso', group: 'Disk images' },
      { url: `${BASE}release-notes.pdf`, name: 'release-notes.pdf', group: 'Documents' },
      { url: `${BASE}os.iso.torrent`, name: 'os.iso.torrent', group: 'Torrents' },
      { url: `${BASE}get?id=7`, name: 'tool-setup.exe', group: 'Programs' },
    ]);
    expect(skipped).toEqual([]);
  });

  it('lists 50 files on a static index', () => {
    const links = Array.from({ length: 50 }, (_, i) => ({ href: `file-${String(i)}.zip` }));
    expect(findPageFiles(links, BASE, DEFAULT_SETTINGS).files).toHaveLength(50);
  });

  it('finds nothing on a page without files', () => {
    expect(findPageFiles([{ href: '/' }, { href: 'about.html' }, { href: 'https://e.example/blog/post' }], BASE, DEFAULT_SETTINGS)).toEqual({ files: [], skipped: [] });
  });

  it('follows the user’s file types and lists files from excluded sites as skipped, with the reason', () => {
    const s = sanitizeSettings({ ...DEFAULT_SETTINGS, fileTypes: ['iso'], denyDomains: ['blocked.example'] });
    const { files, skipped } = findPageFiles([{ href: 'a.iso' }, { href: 'b.pdf' }, { href: 'https://cdn.blocked.example/c.iso' }], BASE, s);
    expect(files.map((f) => f.name)).toEqual(['a.iso']);
    expect(skipped).toEqual([{ url: 'https://cdn.blocked.example/c.iso', name: 'c.iso', reason: 'domain is excluded' }]);
  });

  it('lists files whatever the browser-download mode is, and in private windows', () => {
    const s = { ...DEFAULT_SETTINGS, mode: 'off' as const, includePrivate: false };
    expect(findPageFiles([{ href: 'a.iso' }], BASE, s).files).toHaveLength(1);
  });

  it('keeps only http and https links, without their #part', () => {
    expect(normalizeLink('a.zip#x', BASE)).toBe(`${BASE}a.zip`);
    expect(normalizeLink('ftp://e.example/a.zip', BASE)).toBeNull();
    expect(normalizeLink('data:text/plain,a', BASE)).toBeNull();
    expect(normalizeLink(`a${'x'.repeat(9000)}.zip`, BASE)).toBeNull();
  });

  it('groups by type like the app’s categories', () => {
    expect(groupOf('iso')).toBe('Disk images');
    expect(groupOf('7z')).toBe('Compressed');
    expect(groupOf('flac')).toBe('Music');
    expect(groupOf('xyz')).toBe('Other');
  });

  it('hides the button on the sites the user chose, subdomains too', () => {
    expect(hiddenOn('https://www.news.example/a', ['news.example'])).toBe(true);
    expect(hiddenOn('https://mirror.example.org/', ['news.example'])).toBe(false);
  });

  it('keeps the hidden sites as clean domains', () => {
    expect(sanitizeSettings({ pageButtonHiddenSites: ['*.News.Example', 'bad domain', 7] }).pageButtonHiddenSites).toEqual(['news.example']);
    expect(sanitizeSettings({}).pageButton).toBe(true);
    expect(sanitizeSettings({ pageButton: false }).pageButton).toBe(false);
  });
});

describe('sending the chosen files (#426)', () => {
  const payloadOf = (r: Request) => (r.type === 'download.addMany' ? r.payload : null);

  it('sends a choice in as few messages as the app’s limits allow', () => {
    const links = Array.from({ length: 250 }, (_, i) => ({ url: `https://e.example/${String(i)}.zip` }));
    const reqs = buildAddMany(links, 'https://e.example/files/');
    expect(reqs.map((r) => payloadOf(r)?.links.length)).toEqual([MAX_BATCH_LINKS, MAX_BATCH_LINKS, 50]);
    expect(reqs.every((r) => payloadOf(r)?.referrer === 'https://e.example/files/')).toBe(true);
    expect(new Set(reqs.map((r) => r.id)).size).toBe(3);
  });

  it('keeps each message under the browser’s size limit', () => {
    const long = (i: number) => ({ url: `https://e.example/${String(i)}/${'a'.repeat(4000)}.zip` });
    const reqs = buildAddMany(Array.from({ length: 40 }, (_, i) => long(i)));
    expect(reqs.length).toBeGreaterThan(1);
    for (const r of reqs) expect(new TextEncoder().encode(JSON.stringify(r)).length).toBeLessThan(64 * 1024);
  });

  it('leaves out what the app would refuse', () => {
    const [r] = buildAddMany([{ url: 'file:///etc/passwd' }, { url: 'https://e.example/a.zip', filename: 'C:\\x\\..\\a.zip' }, { url: 'https://e.example/b.zip', filename: 'b\u0001.zip' }], 'javascript:alert(1)');
    expect(r && payloadOf(r)).toEqual({ links: [{ url: 'https://e.example/a.zip', filename: 'a.zip' }, { url: 'https://e.example/b.zip' }] });
    expect(buildAddMany([])).toEqual([]);
  });

  it('adds up what the app did with each message', () => {
    let o = addToOutcome(EMPTY_OUTCOME, { v: 1, id: 'a', ok: true, result: { action: 'sent', added: 2, prompted: 1, failed: [{ url: 'https://e.example/x', code: 'INVALID_URL', message: 'Bad link.' }, { junk: true }] } }, 4);
    o = addToOutcome(o, { v: 1, id: 'b', ok: false, error: { code: 'DESKTOP_NOT_RUNNING', message: 'Not running.' } }, 5);
    o = addToOutcome(o, { v: 1, id: 'c', ok: true, result: { added: -3, prompted: 'x' } }, 1);
    expect(o).toEqual({ added: 2, prompted: 1, failed: [{ url: 'https://e.example/x', code: 'INVALID_URL', message: 'Bad link.' }], error: { code: 'DESKTOP_NOT_RUNNING', message: 'Not running.' }, notSent: 5 });
  });
});

describe('page messages (#426)', () => {
  it('takes only well-formed lists of files from the page script', async () => {
    const { pageSendOf, pageMessageOf, rememberPosition, MAX_POSITIONS } = await import('../src/shared/page-store');
    expect(pageSendOf({ type: 'page.send', links: [{ url: 'https://e.example/a.iso', filename: 'a.iso' }, { url: 'https://e.example/b' }] })).toEqual([
      { url: 'https://e.example/a.iso', filename: 'a.iso' },
      { url: 'https://e.example/b' },
    ]);
    for (const bad of [
      { type: 'page.send', links: [] },
      { type: 'page.send', links: Array.from({ length: 501 }, () => ({ url: 'https://e.example/a' })) },
      { type: 'page.send', links: [{ url: 7 }] },
      { type: 'page.send', links: [{ url: 'https://e.example/a', filename: 'x'.repeat(2000) }] },
      { type: 'page.send', links: 'https://e.example/a' },
      { type: 'magnet', links: [{ url: 'https://e.example/a' }] },
    ]) {
      expect(pageSendOf(bad)).toBeNull();
    }
    expect(pageMessageOf({ type: 'page.files.list' })).toBe('list');
    expect(pageMessageOf({ type: 'page.files.open' })).toBe('open');
    expect(pageMessageOf({ type: 'other' })).toBeNull();
    const many = Object.fromEntries(Array.from({ length: MAX_POSITIONS + 5 }, (_, i) => [`h${String(i)}.example`, { right: 1, bottom: 1 }]));
    const kept = rememberPosition(many, 'new.example', { right: 30.4, bottom: 40.6 });
    expect(Object.keys(kept)).toHaveLength(MAX_POSITIONS);
    expect(kept['new.example']).toEqual({ right: 30, bottom: 41 });
    expect(kept['h0.example']).toBeUndefined();
  });

  it('says what happened to the files sent', async () => {
    const { outcomeText } = await import('../src/shared/page-files');
    expect(outcomeText({ ...EMPTY_OUTCOME, added: 12 })).toEqual({ text: 'Sent 12 to Apollo DM.', tone: 'ok' });
    expect(outcomeText({ ...EMPTY_OUTCOME, prompted: 12 })).toEqual({ text: "12 opened in Apollo DM's Add dialog for you to check.", tone: 'ok' });
    expect(outcomeText({ ...EMPTY_OUTCOME, added: 1, failed: [{ url: 'u', code: 'INVALID_URL', message: 'The link is not valid.' }] })).toEqual({
      text: "Sent 1 to Apollo DM. 1 couldn't be sent: The link is not valid.",
      tone: 'err',
    });
  });
});

describe('the popup’s page card (#426)', () => {
  it('leads to the files, to access, or to turning the button on', async () => {
    const { pageFilesView } = await import('../src/shared/popup-view');
    const page = { files: 10, groups: { 'Disk images': 4, Documents: 6 }, hidden: false };
    expect(pageFilesView({ web: false, access: true, enabled: true, page })).toMatchObject({ show: false });
    expect(pageFilesView({ web: true, access: true, enabled: true, page })).toEqual({ show: true, text: '4 disk images, 6 documents.', count: '10 found', action: 'choose', siteSwitch: true });
    expect(pageFilesView({ web: true, access: true, enabled: true, page: { ...page, hidden: true } }).siteSwitch).toBe(false);
    expect(pageFilesView({ web: true, access: false, enabled: true, page: null })).toMatchObject({ action: 'allow' });
    expect(pageFilesView({ web: true, access: true, enabled: false, page: null })).toMatchObject({ action: 'turnOn' });
    expect(pageFilesView({ web: true, access: true, enabled: true, page: null })).toMatchObject({ action: null, text: 'Reload the page to look for files on it.' });
    expect(pageFilesView({ web: true, access: true, enabled: true, page: { files: 0, groups: {}, hidden: false } })).toMatchObject({ action: null, text: 'No files found on this page.' });
  });
});
