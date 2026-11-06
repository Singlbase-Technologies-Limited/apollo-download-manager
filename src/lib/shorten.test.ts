import { describe, expect, it } from 'vitest';
import { shortenPath, shortenUrl } from './shorten';

// #349: long values fit the details panel in at most two lines; the full value stays one click away.
describe('shortenUrl', () => {
  it('keeps a short link whole', () => {
    expect(shortenUrl('https://example.com/a.zip')).toBe('https://example.com/a.zip');
  });

  it('shows a long link as its host and file name', () => {
    const long = `https://releases.ubuntu.com/26.04.1/images/server/ubuntu-26.04.1-live-server-amd64.iso?mirror=eu-west-3&session=${'8c1f0e42'.repeat(20)}`;
    expect(shortenUrl(long)).toBe('releases.ubuntu.com/…/ubuntu-26.04.1-live-server-amd64.iso');
  });

  it('keeps a link whose file is right under the host as host and file', () => {
    expect(shortenUrl(`https://cdn.example.net/${'x'.repeat(70)}.bin?token=abc`)).toBe(`cdn.example.net/${'x'.repeat(70)}.bin`);
  });

  it('cuts the middle of a long link it can’t read as an address, such as a magnet', () => {
    const magnet = `magnet:?xt=urn:btih:${'0123456789abcdef'.repeat(5)}&dn=album`;
    const short = shortenUrl(magnet);
    expect(short.length).toBeLessThanOrEqual(60);
    expect(short.startsWith('magnet:?xt=urn:btih:')).toBe(true);
    expect(short.endsWith('&dn=album')).toBe(true);
    expect(short).toContain('…');
  });
});

describe('shortenPath', () => {
  it('keeps a short folder whole', () => {
    expect(shortenPath('C:\\Users\\me\\Downloads')).toBe('C:\\Users\\me\\Downloads');
  });

  it('keeps the start and the end of a long folder', () => {
    const long = `/home/user/${'very-long-folder-name/'.repeat(5)}Downloads/Programs`;
    const short = shortenPath(long);
    expect(short.length).toBeLessThanOrEqual(60);
    expect(short.startsWith('/home/user/')).toBe(true);
    expect(short.endsWith('Downloads/Programs')).toBe(true);
    expect(short).toContain('…');
  });
});
