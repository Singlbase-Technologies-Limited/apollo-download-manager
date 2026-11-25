#!/usr/bin/env node
// `pnpm check:links`: checks that relative links and heading anchors in every Markdown file git
// knows about (tracked, or untracked and not ignored) resolve. External links are not fetched.
// CI's docs job runs it (docs/CI.md). Logic and tests: links-lib.mjs. It also runs the documents' own rules (#425,
// docs-rules-lib.mjs): no code named in the user guide, every repository path a developer page names linked, and the
// matching pages of the two guides linking each other.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { codeInUserGuide, missingSeeAlso, SEE_ALSO, unlinkedPaths } from './docs-rules-lib.mjs';
import { brokenLinks } from './links-lib.mjs';
import { recordCheck, root } from './checks-runner.mjs';

const r = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.md'], {
  cwd: root,
  encoding: 'utf8',
  windowsHide: true,
});
if (r.status !== 0) {
  console.error(`git ls-files failed:\n${r.stderr}`);
  process.exit(2);
}
// The website's own pages (site/content/) link to the site's addresses, such as `/guide/`, not to files here;
// scripts/site-lib.test.mjs checks every link of the built site, so they aren't checked twice with this rule.
const files = r.stdout.split('\0').filter((p) => p && !p.startsWith('site/content/'));
const read = (p) => {
  const abs = join(root, p);
  return existsSync(abs) && statSync(abs).isFile() ? readFileSync(abs, 'utf8') : undefined;
};
const isDir = (p) => {
  const abs = join(root, p);
  return existsSync(abs) && statSync(abs).isDirectory();
};

const broken = brokenLinks(files, read, isDir);
for (const b of broken) console.log(`BROKEN  ${b.file}: ${b.link} (${b.problem})`);
const docs = Object.fromEntries(files.filter((f) => f.startsWith('docs/')).map((f) => [f, read(f) ?? '']));
const rules = [
  ...codeInUserGuide(docs).map((x) => ({ file: `${x.file}:${String(x.line)}`, message: `the user guide names code: ${x.name} (#425)` })),
  ...unlinkedPaths(docs, (p) => existsSync(join(root, p))).map((x) => ({ file: `${x.file}:${String(x.line)}`, message: `${x.path} isn't a link (#425)` })),
  ...missingSeeAlso(SEE_ALSO, read).map((x) => ({ file: x.file, message: `no "See also" link to ${x.missing} (#425)` })),
];
for (const r of rules) console.log(`RULE    ${r.file}: ${r.message}`);
console.log(`check:links: ${files.length} Markdown file(s), ${broken.length} broken link(s), ${rules.length} documentation rule problem(s).`);
recordCheck({
  id: 'links',
  name: 'Docs (check:links)',
  status: broken.length || rules.length ? 'fail' : 'pass',
  errors: [...broken.map((x) => ({ file: x.file, message: `${x.link} (${x.problem})` })), ...rules].slice(0, 10),
});
process.exit(broken.length || rules.length ? 1 : 0);
