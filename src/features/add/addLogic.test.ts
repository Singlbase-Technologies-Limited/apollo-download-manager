import { describe, expect, it } from 'vitest';
import type { Capabilities } from '../../contract';
import { fixture, withSftp as addSftp } from '../../test/fakeBackend';
import { expandLinks, isTorrentLink, linkKind, linkProblem, MAX_ADD, parseChecksum, parseHeaders, splitLinks } from './addLogic';

// Ported from V1's tests/unit/addLogic.test.ts, with V2's SFTP links and engine capabilities (#60).
const capabilities = fixture('capabilities.json') as Capabilities;
const withSftp = addSftp(capabilities);

describe('add download input parsing', () => {
  it('splits pasted links on whitespace and removes duplicates', () => {
    expect(splitLinks(' https://a.test/1\n\nhttps://b.test/2 https://a.test/1\r\n')).toEqual(['https://a.test/1', 'https://b.test/2']);
    expect(splitLinks('   ')).toEqual([]);
  });

  it('accepts supported schemes and rejects others, saying why', () => {
    expect(linkProblem('https://example.com/f', withSftp)).toBeNull();
    expect(linkProblem('ftp://ftp.example.org/pub/1MB.zip', withSftp)).toBeNull();
    expect(linkProblem('ftps://ftp.example.org/pub/1MB.zip', withSftp)).toBeNull();
    expect(linkProblem('sftp://example.com/f.zip', withSftp)).toBeNull();
    expect(linkProblem('magnet:?xt=urn:btih:abc', withSftp)).toBeNull();
    expect(linkProblem('file:///etc/passwd', withSftp)).toMatch(/Only http, https, ftp, ftps, sftp and magnet links/);
    expect(linkProblem('javascript:alert(1)', withSftp)).toMatch(/Only http, https, ftp, ftps, sftp and magnet links/);
    expect(linkProblem('example.com/file', withSftp)).toMatch(/not a complete link/);
    expect(linkProblem('ftp://', withSftp)).toMatch(/not a complete link/);
  });

  it('asks for a login in its own fields, never in the link', () => {
    expect(linkProblem('https://me:secret@example.com/a.zip', withSftp)).toMatch(/user name and password in their own fields/);
  });

  it('says when this build can’t download a protocol, before anything is sent', () => {
    // The sample engine lists no SFTP.
    expect(linkProblem('sftp://example.com/f.zip', capabilities)).toBe('This version of Apollo Download Manager can’t download over SFTP yet.');
    // Until the capabilities arrive, only the native side can say.
    expect(linkProblem('sftp://example.com/f.zip', undefined)).toBeNull();
  });

  it('tells the kinds of link apart', () => {
    expect(linkKind('HTTPS://e.com/a')).toBe('http');
    expect(linkKind('ftps://e.com/a')).toBe('ftp');
    expect(linkKind('sftp://e.com/a')).toBe('sftp');
    expect(linkKind('Magnet:?xt=urn:btih:aa')).toBe('magnet');
    expect(linkKind('https://e.com/album.torrent')).toBe('torrentLink');
    expect(linkKind('mailto:me@e.com')).toBeNull();
  });

  it('tells .torrent links apart as the native side does', () => {
    // The same cases as `torrent_links_are_told_apart_as_v1_did` in Rust.
    expect(isTorrentLink('https://e.com/a/album.TORRENT')).toBe(true);
    expect(isTorrentLink('http://e.com/album.torrent?x=1#y')).toBe(true);
    expect(isTorrentLink('https://e.com/download.php?f=album.torrent')).toBe(false);
    expect(isTorrentLink('ftp://e.com/album.torrent')).toBe(false);
    expect(isTorrentLink('magnet:?xt=urn:btih:aa')).toBe(false);
    expect(isTorrentLink('https://e.com/album.torrent.zip')).toBe(false);
  });

  it('parses headers and reports malformed lines', () => {
    expect(parseHeaders('Cookie: a=b\n  Accept : */*  \n')).toEqual({
      headers: [
        { name: 'Cookie', value: 'a=b' },
        { name: 'Accept', value: '*/*' },
      ],
      error: null,
    });
    expect(parseHeaders('Cookie a=b').error).toMatch(/Line 1/);
    expect(parseHeaders(': nothing').error).toMatch(/Line 1/);
  });

  it('parses a checksum as V1 wrote it, and checks its length', () => {
    const hex = 'AB'.repeat(32);
    expect(parseChecksum('')).toEqual({ checksum: null, error: null });
    expect(parseChecksum(`sha-256=${hex}`)).toEqual({ checksum: { algorithm: 'sha256', hex: hex.toLowerCase() }, error: null });
    expect(parseChecksum(`SHA256:${hex}`).checksum?.algorithm).toBe('sha256');
    expect(parseChecksum(`md5=${'0'.repeat(32)}`).checksum?.algorithm).toBe('md5');
    expect(parseChecksum(`sha-256=${'ab'.repeat(20)}`).error).toMatch(/64 hexadecimal/);
    expect(parseChecksum(`crc32=${'ab'.repeat(4)}`).error).toMatch(/md5, sha-1/);
    expect(parseChecksum(hex).error).toMatch(/like “sha-256=/);
  });
});

describe('pattern links (#468)', () => {
  it('expands a number range into one link per number, keeping zero padding', () => {
    const r = expandLinks(['https://example.com/file[001-003].zip']);
    expect(r.error).toBeNull();
    expect(r.links).toEqual(['https://example.com/file001.zip', 'https://example.com/file002.zip', 'https://example.com/file003.zip']);
    expect(r.patterns).toEqual([{ link: 'https://example.com/file[001-003].zip', count: 3, first: 'https://example.com/file001.zip', last: 'https://example.com/file003.zip' }]);
    expect(expandLinks(['https://example.com/p[8-10].jpg']).links).toEqual(['https://example.com/p8.jpg', 'https://example.com/p9.jpg', 'https://example.com/p10.jpg']);
  });

  it('expands letters and steps', () => {
    expect(expandLinks(['https://example.com/part-[a-c].rar']).links).toEqual(['https://example.com/part-a.rar', 'https://example.com/part-b.rar', 'https://example.com/part-c.rar']);
    expect(expandLinks(['https://example.com/[X-Z]/f']).links).toEqual(['https://example.com/X/f', 'https://example.com/Y/f', 'https://example.com/Z/f']);
    expect(expandLinks(['https://example.com/img[00-10:5].png']).links).toEqual(['https://example.com/img00.png', 'https://example.com/img05.png', 'https://example.com/img10.png']);
  });

  it('keeps links without a pattern, and other links beside a pattern, in order and once', () => {
    const r = expandLinks(['https://a.test/x', 'https://b.test/[1-2]', 'https://b.test/1']);
    expect(r.links).toEqual(['https://a.test/x', 'https://b.test/1', 'https://b.test/2']);
    expect(r.patterns).toHaveLength(1);
  });

  it('leaves brackets outside the path alone: an IPv6 host, a query, a fragment, and magnet links', () => {
    for (const link of ['http://[::1]:8080/f.zip', 'https://example.com/f?range=[1-3]', 'https://example.com/f#[1-2]', 'magnet:?xt=urn:btih:abc&dn=[1-2]']) {
      expect(expandLinks([link])).toEqual({ links: [link], patterns: [], error: null });
    }
    expect(expandLinks(['http://[::1]:8080/f[1-2].zip']).links).toEqual(['http://[::1]:8080/f1.zip', 'http://[::1]:8080/f2.zip']);
  });

  it('leaves brackets that aren’t a range alone', () => {
    for (const link of ['https://example.com/[draft].pdf', 'https://example.com/f[1].zip', 'https://example.com/f[a-3].zip']) {
      expect(expandLinks([link]).links).toEqual([link]);
    }
  });

  it('refuses a range that goes down, a zero step, and two ranges in one link', () => {
    expect(expandLinks(['https://example.com/f[5-1].zip']).error).toMatch(/goes down/);
    expect(expandLinks(['https://example.com/f[1-5:0].zip']).error).toMatch(/step/);
    expect(expandLinks(['https://example.com/[1-2]/f[1-2].zip']).error).toMatch(/one range/);
  });

  it('refuses more than MAX_ADD links in all, without making them', () => {
    const r = expandLinks(['https://example.com/f[1-1000000000].zip']);
    expect(r.error).toMatch(new RegExp(`at most ${String(MAX_ADD)}`, 'i'));
    expect(r.links).toEqual([]);
    expect(expandLinks(['https://a.test/x', `https://example.com/f[1-${String(MAX_ADD)}].zip`]).error).toMatch(/at most/i);
    expect(expandLinks([`https://example.com/f[1-${String(MAX_ADD)}].zip`]).error).toBeNull();
  });
});
