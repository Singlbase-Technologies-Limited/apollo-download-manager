#!/usr/bin/env node
// `pnpm check:product-name` (#421): fails when the old working name "V2" is back in what people read: the
// documents in docs/ and the README (the developer site, the user guide and the in-app guide are built from them),
// the website's content, the extension's pages and the window's source. Internal identifiers stay (AGENTS.md,
// "Separate from V1"). CI's docs job runs it (docs/CI.md). Logic, allow-list and tests: product-name-lib.mjs.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fullNames, oldNames } from './product-name-lib.mjs';
import { recordCheck, root } from './checks-runner.mjs';

const SCANNED = ['README.md', 'docs/*.md', 'docs/**/*.md', 'site/content/*', 'browser-extension/static/*.html', 'src/*.ts', 'src/**/*.ts', 'src/**/*.tsx'];

/** Also read for the full name "Velocity Download Manager" (#486): every public text. CLA.md waits for the legal review (#441). */
const FULL_NAME_SCANNED = [...SCANNED, 'CHANGELOG.md', 'SECURITY.md', 'AGENTS.md', 'browser-extension/store/*.md'];

/** The repository's files matching `patterns`, tracked or new. */
function listed(patterns) {
  const r = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', ...patterns], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (r.status !== 0) {
    console.error(`git ls-files failed:\n${r.stderr}`);
    process.exit(2);
  }
  return [...new Set(r.stdout.split('\0').filter(Boolean))];
}

const files = listed(SCANNED);
const found = files.flatMap((file) => oldNames(file, readFileSync(join(root, file), 'utf8')).map((f) => ({ file, ...f })));
for (const f of found) console.log(`V2  ${f.file}:${String(f.line)}: ${f.text}`);
console.log(`check:product-name: ${String(files.length)} file(s), ${String(found.length)} line(s) still call the app V2.`);
if (found.length) console.log('Write "Apollo Download Manager" or "Apollo DM" (never "Apollo" alone); see scripts/product-name-lib.mjs for what may stay.');

const fullFiles = listed(FULL_NAME_SCANNED);
const full = fullFiles.flatMap((file) => fullNames(file, readFileSync(join(root, file), 'utf8')).map((f) => ({ file, ...f })));
for (const f of full) console.log(`NAME  ${f.file}:${String(f.line)}: ${f.text}`);
console.log(`check:product-name: ${String(fullFiles.length)} file(s), ${String(full.length)} line(s) still say "Velocity Download Manager".`);
if (full.length) console.log('Write "V1" or "the original version" for V1, and "0.1.x" for Apollo DM\'s first versions (#486).');

const all = [...found.map((f) => ({ ...f, message: `"V2": ${f.text}` })), ...full.map((f) => ({ ...f, message: `full name: ${f.text}` }))];
recordCheck({
  id: 'product-name',
  name: 'Docs (check:product-name)',
  status: all.length ? 'fail' : 'pass',
  errors: all.slice(0, 10).map((f) => ({ file: f.file, line: f.line, message: f.message })),
});
process.exit(all.length ? 1 : 0);
