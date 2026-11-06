#!/usr/bin/env node
// `pnpm site [-- --releases <file>]`: builds the product website (#353) into site-out/, which is git-ignored.
// `--releases` is a JSON file of GitHub's releases API answer (the Pages workflow fetches it); without it the
// download page points to the releases page. See docs/WEBSITE.md.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite } from './site-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'site-out');
const at = process.argv.indexOf('--releases');
const releases = at > 0 ? JSON.parse(readFileSync(process.argv[at + 1], 'utf8')) : null;

const site = buildSite({ releases });
rmSync(out, { recursive: true, force: true });
for (const [path, body] of Object.entries(site)) {
  mkdirSync(dirname(join(out, path)), { recursive: true });
  writeFileSync(join(out, path), body);
}
copyFileSync(join(root, 'src-tauri', 'icons', '128x128.png'), join(out, 'icon.png'));
// GitHub Pages serves the files as they are, without Jekyll.
writeFileSync(join(out, '.nojekyll'), '');
console.log(`built ${String(Object.keys(site).length + 2)} files into site-out/${releases ? '' : ' (no releases given: the download page links to GitHub)'}`);
