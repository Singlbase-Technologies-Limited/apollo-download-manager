#!/usr/bin/env node
// `pnpm check:product-name` (#421): fails when the old working name "V2" is back in what people read: the
// documents in docs/ and the README (the developer site, the user guide and the in-app guide are built from them),
// the website's content, the extension's pages and the window's source. Internal identifiers stay (AGENTS.md,
// "Separate from V1"). CI's docs job runs it (docs/CI.md). Logic, allow-list and tests: product-name-lib.mjs.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { oldNames } from './product-name-lib.mjs';
import { recordCheck, root } from './checks-runner.mjs';

const SCANNED = ['README.md', 'docs/*.md', 'docs/**/*.md', 'site/content/*', 'browser-extension/static/*.html', 'src/*.ts', 'src/**/*.ts', 'src/**/*.tsx'];

const r = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', ...SCANNED], {
  cwd: root,
  encoding: 'utf8',
  windowsHide: true,
});
if (r.status !== 0) {
  console.error(`git ls-files failed:\n${r.stderr}`);
  process.exit(2);
}
const files = [...new Set(r.stdout.split('\0').filter(Boolean))];
const found = files.flatMap((file) => oldNames(file, readFileSync(join(root, file), 'utf8')).map((f) => ({ file, ...f })));
for (const f of found) console.log(`V2  ${f.file}:${String(f.line)}: ${f.text}`);
console.log(`check:product-name: ${String(files.length)} file(s), ${String(found.length)} line(s) still call the app V2.`);
if (found.length) console.log('Write "Apollo Download Manager" or "Apollo DM" (never "Apollo" alone); see scripts/product-name-lib.mjs for what may stay.');
recordCheck({
  id: 'product-name',
  name: 'Docs (check:product-name)',
  status: found.length ? 'fail' : 'pass',
  errors: found.slice(0, 10).map((f) => ({ file: f.file, line: f.line, message: `"V2": ${f.text}` })),
});
process.exit(found.length ? 1 : 0);
