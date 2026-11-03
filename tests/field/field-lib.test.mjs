import { describe, expect, it } from 'vitest';
import { afterStart, findings, hideLinks, hostOf, parseArgs, sample } from './field-lib.mjs';

const record = (over = {}) => ({
  id: 'd-0001',
  kind: 'http',
  sourceUrl: 'https://me:pw@cdn.example.com/t0ken/ubuntu.iso?sig=abc',
  fileName: 'ubuntu.iso',
  directory: 'C:\\Downloads',
  status: 'downloading',
  progress: {
    completedBytes: 1000,
    totalBytes: 4000,
    downloadSpeedBps: 500,
    uploadSpeedBps: 0,
    connections: 6,
    connectionDetail: { requested: 8, allowed: 6, limitedBy: 'noGain' },
  },
  error: null,
  retryAtMs: null,
  ...over,
});

describe('hostOf', () => {
  it('keeps only the host of a link', () => {
    expect(hostOf('https://me:pw@cdn.example.com:8443/t0ken/a.iso?sig=abc')).toBe('cdn.example.com');
  });

  it('is null for a link without a host, or not a link', () => {
    expect(hostOf('magnet:?xt=urn:btih:0123')).toBeNull();
    expect(hostOf('C:\\a.torrent')).toBeNull();
  });
});

describe('hideLinks', () => {
  it('cuts every link in a text down to its scheme and host', () => {
    expect(hideLinks('Failed to get https://me:pw@cdn.example.com/t0ken/a.iso?sig=abc: 403')).toBe(
      'Failed to get https://cdn.example.com/…: 403',
    );
    expect(hideLinks('sftp://user@10.0.0.2:22/home/me/x and ftp://h.example/y')).toBe(
      'sftp://10.0.0.2/… and ftp://h.example/…',
    );
  });

  // #279: `add` printed a magnet link whole: it has no `//`, so the pattern never matched it.
  it('cuts a magnet link down to its scheme', () => {
    expect(hideLinks('Added magnet:?xt=urn:btih:0123abcd&dn=secret.iso&tr=udp://t.example:1337/announce.')).toBe(
      'Added magnet:?….',
    );
    expect(hideLinks('MAGNET:?xt=urn:btih:0123 and https://a.example/x')).toBe('MAGNET:?… and https://a.example/…');
  });

  // #274: the engine's "<origin>: 3 more requests ended the same way" came out as
  // "https://host:/…: 3 more …"; a link with nothing after its host has nothing to cut.
  it('keeps a bare origin, followed by a colon, as it is', () => {
    expect(hideLinks('https://fsn1-speed.hetzner.com: 3 more requests ended the same way')).toBe(
      'https://fsn1-speed.hetzner.com: 3 more requests ended the same way',
    );
    expect(hideLinks('see https://cdn.example.com:8443.')).toBe('see https://cdn.example.com.');
  });

  it('leaves a text without links as it is', () => {
    expect(hideLinks('libcurl error 28: Failed to connect to example.com port 443 after 21073 ms')).toBe(
      'libcurl error 28: Failed to connect to example.com port 443 after 21073 ms',
    );
  });
});

describe('sample', () => {
  it('keeps what the field test watches, with the link cut to its host', () => {
    const s = sample(record(), { partBytes: 4000, fileBytes: null });
    expect(s).toEqual({
      id: 'd-0001',
      name: 'ubuntu.iso',
      host: 'cdn.example.com',
      status: 'downloading',
      done: 1000,
      total: 4000,
      speed: 500,
      connections: 6,
      allowed: 6,
      requested: 8,
      limitedBy: 'noGain',
      error: null,
      retryAtMs: null,
      partBytes: 4000,
      fileBytes: null,
    });
    expect(JSON.stringify(s)).not.toContain('t0ken');
  });

  it('cuts links in the error message too', () => {
    const s = sample(record({ status: 'failed', error: { class: 'permanent', httpStatus: 403, message: 'Refused https://cdn.example.com/t0ken/a' } }), {});
    expect(s.error).toBe('Refused https://cdn.example.com/… [permanent, HTTP 403]');
  });
});

describe('findings', () => {
  const at = (over = {}, files = {}) => sample(record(over), files);
  const progress = (completedBytes, totalBytes = 4000, more = {}) => ({
    ...record().progress,
    completedBytes,
    totalBytes,
    ...more,
  });

  it('flags progress that goes backwards without a start-over the user asked for', () => {
    expect(findings(at({ progress: progress(3000) }), at({ progress: progress(1000) }), 5_000)).toEqual([
      'd-0001: progress went backwards, from 3000 to 1000 bytes',
    ]);
  });

  it('flags a size that changes or becomes unknown', () => {
    expect(findings(at(), at({ progress: progress(1000, null) }), 5_000)).toEqual([
      'd-0001: the size changed, from 4000 bytes to unknown',
    ]);
  });

  it('flags a completed download that changes status again', () => {
    expect(findings(at({ status: 'completed' }), at({ status: 'downloading' }), 5_000)).toEqual([
      'd-0001: Completed, then downloading',
    ]);
  });

  it('flags no data for 30 s while it still says downloading', () => {
    const still = at({ progress: progress(1000, 4000, { downloadSpeedBps: 0 }) });
    expect(findings(at(), still, 29_999)).toEqual([]);
    expect(findings(at(), still, 30_000)).toEqual([
      'd-0001: no new bytes for 30 s, but it still shows downloading',
    ]);
  });

  it('says nothing about a download that behaves', () => {
    expect(findings(at({ progress: progress(1000) }), at({ progress: progress(2000) }), 5_000)).toEqual([]);
    // A user's cancel and retry start over on purpose; the status says so.
    expect(findings(at({ progress: progress(3000) }), at({ status: 'queued', progress: progress(0) }), 5_000)).toEqual([]);
  });
});

describe('parseArgs', () => {
  // #279: every `--name` took the next argument, so a flag without a value ate a link.
  it('reads flags without a value, and options with one', () => {
    expect(parseArgs(['--user', 'alice', '--password', 'ftp://h.example/a', '--ftps', '--connections', '4'])).toEqual({
      named: { user: 'alice', password: true, ftps: true, connections: '4' },
      rest: ['ftp://h.example/a'],
    });
    expect(parseArgs(['--all'])).toEqual({ named: { all: true }, rest: [] });
  });

  it('never takes a password as an argument', () => {
    expect(() => parseArgs(['--password=hunter2', 'ftp://h.example/a'])).toThrow(/typed at the prompt/);
  });

  it('refuses an option without its value', () => {
    expect(() => parseArgs(['ftp://h.example/a', '--user'])).toThrow(/--user needs a value/);
  });
});

describe('afterStart', () => {
  // #279: `add` printed "Added 1 link(s)" while the dialog still waited for Add anyway.
  it('reports a question the dialog still asks, with the buttons that answer it', () => {
    const r = afterStart({ text: 'This was added before | https://me@a.example/t0ken/x.iso · In your history', buttons: ['Skip', 'Add anyway'] });
    expect(r.added).toBe(false);
    expect(r.final).toBe(false);
    expect(r.message).toBe(
      'Not added yet. The app asks: This was added before | https://a.example/… · In your history. Answer with --answer "Skip" or --answer "Add anyway".',
    );
  });

  it('reports what the app says when only Done is left', () => {
    const r = afterStart({ text: 'One link couldn’t be added | ftp://h.example/a', buttons: ['Done'] });
    expect(r).toEqual({ added: false, final: true, message: 'The app says: One link couldn’t be added | ftp://h.example/…' });
  });

  it('says added once the dialog has closed', () => {
    expect(afterStart(null)).toEqual({ added: true, final: true, message: 'Added.' });
  });
});
