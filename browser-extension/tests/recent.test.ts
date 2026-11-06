import { describe, expect, it } from 'vitest';
import { MAX_RECENT, recentEntry, pushRecent, sanitizeRecent, type RecentSend } from '../src/shared/recent';

const okReply = { v: 1, id: 'x', ok: true as const, result: {} };
const failed = (code: string) => ({ v: 1, id: 'x', ok: false as const, error: { code, message: 'https://cdn.test/a.iso?token=secret failed' } });

describe('recent sends (#356)', () => {
  it('keeps only the host and the file name, never the path, query or fragment', () => {
    const e = recentEntry({ url: 'https://user:pw@cdn.test:8443/dir/big%20file.iso?token=secret#x', source: 'popup' }, okReply, 1000);
    expect(e).toEqual({ name: 'big file.iso', host: 'cdn.test', ok: true, at: 1000 });
    expect(JSON.stringify(e)).not.toMatch(/secret|user|pw|dir|8443/);
  });

  it("prefers the browser's file name to the link's last segment", () => {
    expect(recentEntry({ url: 'https://cdn.test/get?id=1', filename: 'C:\\Users\\me\\Downloads\\report.pdf', source: 'intercept' }, okReply, 1).name).toBe('report.pdf');
    expect(recentEntry({ url: 'https://cdn.test/', source: 'popup' }, okReply, 1).name).toBe('cdn.test');
  });

  it('names a magnet link by its display name, with no host', () => {
    const e = recentEntry({ url: 'magnet:?xt=urn:btih:abc&dn=Big+Buck+Bunny&tr=udp://tracker.test:80', source: 'intercept' }, okReply, 1);
    expect(e).toMatchObject({ name: 'Big Buck Bunny', host: '' });
    expect(recentEntry({ url: 'magnet:?xt=urn:btih:abc', source: 'popup' }, okReply, 1).name).toBe('Magnet link');
  });

  it('records a failure by its error code only, since messages can echo the link', () => {
    const e = recentEntry({ url: 'https://cdn.test/a.iso', source: 'popup' }, failed('DESKTOP_NOT_RUNNING'), 1);
    expect(e).toEqual({ name: 'a.iso', host: 'cdn.test', ok: false, code: 'DESKTOP_NOT_RUNNING', at: 1 });
  });

  it(`keeps the newest ${String(MAX_RECENT)} first`, () => {
    let list: RecentSend[] = [];
    for (let i = 0; i < 8; i++) list = pushRecent(list, { name: `f${String(i)}`, host: 'h', ok: true, at: i });
    expect(list.map((e) => e.name)).toEqual(['f7', 'f6', 'f5', 'f4', 'f3']);
  });

  it('drops anything malformed read back from storage', () => {
    const raw = [
      { name: 'ok.iso', host: 'cdn.test', ok: true, at: 5 },
      { name: 'x'.repeat(500), host: 'cdn.test', ok: true, at: 4 },
      { name: 'bad', host: 'cdn.test', ok: 'yes', at: 3 },
      { name: 'e.iso', host: 'h', ok: false, code: 'not a code!', at: 2 },
      'junk',
      ...Array.from({ length: 10 }, (_, i) => ({ name: `m${String(i)}`, host: 'h', ok: true, at: 1 })),
    ];
    const list = sanitizeRecent(raw);
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0]).toEqual({ name: 'ok.iso', host: 'cdn.test', ok: true, at: 5 });
    expect(list[1]?.name.length).toBeLessThanOrEqual(200);
    expect(list.some((e) => e.name === 'bad')).toBe(false);
    expect(list.some((e) => e.name === 'e.iso')).toBe(false);
    expect(sanitizeRecent(undefined)).toEqual([]);
  });
});
