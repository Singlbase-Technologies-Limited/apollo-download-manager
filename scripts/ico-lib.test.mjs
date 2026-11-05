import { describe, expect, it } from 'vitest';
import { packIco, pngSize } from './ico-lib.mjs';

/** A PNG with only the signature and an IHDR chunk: enough for the packer, which never decodes pixels. */
function png(width, height, filler = 0) {
  const b = Buffer.alloc(33 + filler);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

describe('pngSize', () => {
  it('reads the width and height from the IHDR chunk', () => {
    expect(pngSize(png(24, 24))).toEqual({ width: 24, height: 24 });
  });

  it('rejects data that is not a PNG', () => {
    expect(() => pngSize(Buffer.from('GIF89a................................'))).toThrow(/not a PNG/);
  });
});

describe('packIco', () => {
  const images = [png(256, 256, 40), png(16, 16, 3), png(32, 32, 7)];
  const ico = packIco(images);

  it('writes an icon directory with one entry per image', () => {
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(3);
  });

  it('orders the entries from small to large, and writes 256 as 0', () => {
    const sizes = [0, 1, 2].map((i) => ico[6 + i * 16]);
    expect(sizes).toEqual([16, 32, 0]);
  });

  it('points each entry at its own PNG, byte for byte', () => {
    const sorted = [images[1], images[2], images[0]];
    sorted.forEach((image, i) => {
      const entry = 6 + i * 16;
      expect(ico.readUInt16LE(entry + 4)).toBe(1);
      expect(ico.readUInt16LE(entry + 6)).toBe(32);
      const length = ico.readUInt32LE(entry + 8);
      const offset = ico.readUInt32LE(entry + 12);
      expect(length).toBe(image.length);
      expect(ico.subarray(offset, offset + length).equals(image)).toBe(true);
    });
    expect(ico.length).toBe(6 + 3 * 16 + images.reduce((n, i) => n + i.length, 0));
  });

  it('refuses an image that is not square', () => {
    expect(() => packIco([png(16, 32)])).toThrow(/square/);
  });

  it('refuses two images of the same size', () => {
    expect(() => packIco([png(16, 16), png(16, 16)])).toThrow(/twice/);
  });

  it('refuses sizes an icon cannot hold', () => {
    expect(() => packIco([png(512, 512)])).toThrow(/1 to 256/);
  });
});
