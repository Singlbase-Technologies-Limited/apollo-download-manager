// Packs PNG images into a Windows .ico file. Windows (Vista and later) reads PNG images inside an
// .ico, so the images are stored as they are, never decoded or resized. This lets the small sizes
// come from the small drawing of the icon (assets/brand/README.md, #347).

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** The width and height of a PNG, from its IHDR chunk. */
export function pngSize(png) {
  if (png.length < 24 || !png.subarray(0, 8).equals(SIGNATURE) || png.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error('not a PNG image');
  }
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

/** An .ico holding `pngs`, one entry each, ordered from the smallest to the largest. */
export function packIco(pngs) {
  const images = pngs
    .map((png) => {
      const { width, height } = pngSize(png);
      if (width !== height) throw new Error(`an icon image must be square, not ${String(width)}x${String(height)}`);
      if (width < 1 || width > 256) throw new Error(`an icon image must be 1 to 256 pixels, not ${String(width)}`);
      return { size: width, png };
    })
    .sort((a, b) => a.size - b.size);
  images.forEach((image, i) => {
    if (i > 0 && images[i - 1].size === image.size) throw new Error(`the ${String(image.size)} px image is given twice`);
  });

  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const entry = 6 + i * 16;
    header[entry] = size === 256 ? 0 : size; // width; 0 means 256
    header[entry + 1] = size === 256 ? 0 : size; // height
    header[entry + 2] = 0; // no palette
    header[entry + 3] = 0; // reserved
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.png)]);
}
