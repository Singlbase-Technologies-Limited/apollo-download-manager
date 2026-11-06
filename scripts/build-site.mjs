#!/usr/bin/env node
// `pnpm site [-- --releases <file>]`: builds the product website (#353) into site-out/, which is git-ignored.
// `--releases` is a JSON file of GitHub's releases API answer (the Pages workflow fetches it); without it the
// download page points to the releases page. See docs/WEBSITE.md.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite, siteFiles } from './site-lib.mjs';

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
const files = siteFiles();
for (const { from, to } of files) {
  mkdirSync(dirname(join(out, to)), { recursive: true });
  copyFileSync(from, join(out, to));
}
// GitHub Pages serves the files as they are, without Jekyll.
writeFileSync(join(out, '.nojekyll'), '');
console.log(`built ${String(Object.keys(site).length + files.length + 1)} files into site-out/${releases ? '' : ' (no releases given: the download page links to GitHub)'}`);
