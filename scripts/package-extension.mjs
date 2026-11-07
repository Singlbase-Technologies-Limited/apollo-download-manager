#!/usr/bin/env node
// `pnpm package:extension`: a release build of the browser extension, zipped for the stores (#356):
// browser-extension/dist/packages/apollo-download-manager-<chrome|firefox>-<version>.zip. The Chrome
// package also goes to the Edge store. Uploading is the PO's step (#240), never this script's.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { storePackageEntries, TARGETS } from './extension-lib.mjs';
import { zip } from './zip-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'browser-extension', 'dist');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

execFileSync(process.execPath, [join(root, 'scripts', 'build-extension.mjs'), '--release'], { stdio: 'inherit' });

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isSymbolicLink()) throw new Error(`Refusing a link in the build output: ${p}`);
    return s.isDirectory() ? files(p) : [p];
  });
}

const out = join(dist, 'packages');
mkdirSync(out, { recursive: true });
for (const target of TARGETS) {
  const dir = join(dist, target);
  const entries = storePackageEntries(target, files(dir).map((p) => ({ name: relative(dir, p).split(sep).join('/'), data: readFileSync(p) })));
  const file = join(out, `apollo-download-manager-${target}-${version}.zip`);
  writeFileSync(file, zip(entries));
  console.log(`packaged ${target}: ${relative(root, file)} (${String(entries.length)} files)`);
}
