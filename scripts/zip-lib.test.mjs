import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { zip } from './zip-lib.mjs';

/** Reads an archive back through its central directory, the way store uploaders and unzip do. */
function unzip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(end).toBeGreaterThanOrEqual(0);
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const out = {};
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(p)).toBe(0x02014b50);
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    expect(buf.readUInt32LE(local)).toBe(0x04034b50);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const compressed = buf.subarray(start, start + compressedSize);
    const data = method === 8 ? inflateRawSync(compressed) : compressed;
    expect(data.length).toBe(size);
    out[name] = data.toString('utf8');
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

describe('zip (store packages, #356)', () => {
  it('writes an archive that reads back to the same files', () => {
    const files = { 'manifest.json': '{"a":1}', 'icons/icon-16.png': 'png'.repeat(100), 'empty.txt': '' };
    const got = unzip(zip(Object.entries(files).map(([name, data]) => ({ name, data: Buffer.from(data) }))));
    expect(got).toEqual(files);
  });

  it('is byte-for-byte the same on every run, whatever the input order', () => {
    const a = zip([{ name: 'b.js', data: Buffer.from('b') }, { name: 'a.js', data: Buffer.from('a') }]);
    const b = zip([{ name: 'a.js', data: Buffer.from('a') }, { name: 'b.js', data: Buffer.from('b') }]);
    expect(a.equals(b)).toBe(true);
  });

  it('refuses names that would land outside the folder it is unpacked into', () => {
    for (const name of ['../x', '/abs', 'a/../../x', 'c:\\x', 'a\\b', '', 'a//b']) {
      expect(() => zip([{ name, data: Buffer.from('') }])).toThrow(/name/);
    }
  });
});
