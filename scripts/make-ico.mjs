// `node scripts/make-ico.mjs <out.ico> <image.png>...`: packs square PNG images into a Windows .ico,
// smallest first (scripts/ico-lib.mjs). The steps that make the images are in assets/brand/README.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { packIco } from './ico-lib.mjs';

const [out, ...inputs] = process.argv.slice(2);
if (!out || inputs.length === 0) {
  console.error('usage: node scripts/make-ico.mjs <out.ico> <image.png>...');
  process.exit(2);
}
const ico = packIco(inputs.map((path) => readFileSync(path)));
writeFileSync(out, ico);
console.log(`make-ico: wrote ${out} with ${String(inputs.length)} images`);
