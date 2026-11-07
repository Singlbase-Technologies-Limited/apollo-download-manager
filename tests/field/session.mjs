#!/usr/bin/env node
// The field test's session tool (#262, tests/field/README.md): starts the installed app with
// WebView2's debugging port on 127.0.0.1, drives its window as a user does (Playwright over CDP),
// and watches the downloads. Run by hand only, never in CI.
//
//   pnpm field start                      start the installed app with the port
//   pnpm field onboard [folder]           finish the first-run setup
//   pnpm field add <link> [<link>…] [--connections N] [--checksum sha-256=HEX] [--folder DIR]
//                  [--user NAME --password] [--ftps] [--answer BUTTON]   (several: one per line, as pasted;
//                  the password is typed at a prompt, never given as an argument)
//   pnpm field pause|resume|cancel|retry|remove <name>
//   pnpm field delete <name> | --all     delete the downloads' files, confirmed
//   pnpm field click <role> <name>        any other control, by its accessible role and name
//   pnpm field watch [--every S] [--for S] [--until done]
//   pnpm field status | log [--last N] | export | shot <file>
//   pnpm field quit                       quit as the tray's Quit does
//   pnpm field kill [app|engine|torrent]  end a process at once, as a crash does
//
// Everything a session writes goes to its folder (--out, default %TEMP%\velocity-field\<date>),
// outside the repository, with every link cut to its host (field-lib.mjs).

import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { afterStart, ELEVATION_COMMAND, elevationCheck, findings, hideLinks, parseArgs, question, sample, shotPath } from './field-lib.mjs';

const PROCESSES = { app: 'velocity-desktop-v2', engine: 'velocity-transfer', torrent: 'velocity-torrent' };
const TERMINAL = new Set(['completed', 'failed', 'removed', 'seeding']);

const [command, ...args] = process.argv.slice(2);
const { named, rest } = parseArgs(args);
const port = Number(named.port ?? 9333);
const out = named.out ?? join(tmpdir(), 'velocity-field', new Date().toISOString().slice(0, 10));
const exe = named.exe ?? join(process.env.LOCALAPPDATA ?? '', 'Apollo Download Manager', `${PROCESSES.app}.exe`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mib = (bytes) => (bytes == null ? '?' : `${(bytes / 1048576).toFixed(1)} MiB`);
const clock = () => new Date().toTimeString().slice(0, 8);

async function portAnswers() {
  try {
    return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok;
  } catch {
    return false;
  }
}

function running(name) {
  const r = spawnSync('tasklist', ['/FI', `IMAGENAME eq ${name}.exe`, '/FO', 'CSV', '/NH'], { encoding: 'utf8' });
  return r.stdout.includes(`"${name}.exe"`);
}

async function start() {
  if (await portAnswers()) return console.log(`The app already answers on 127.0.0.1:${port}.`);
  // The app runs one instance: a second start only shows the first, without the port.
  if (running(PROCESSES.app)) throw new Error('The app is running without the debugging port. Quit it from the tray first.');
  if (!existsSync(exe)) throw new Error(`${exe} isn't installed (see tests/field/README.md).`);
  const elevation = elevationCheck(spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ELEVATION_COMMAND], { encoding: 'utf8' }));
  if (elevation.refuse) throw new Error(elevation.message);
  if (elevation.message) console.log(elevation.message);
  const env = { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1` };
  spawn(exe, [], { env, detached: true, stdio: 'ignore' }).unref();
  for (let i = 0; i < 60; i++) {
    if (await portAnswers()) return console.log(`Started; the window answers on 127.0.0.1:${port}.`);
    await sleep(500);
  }
  throw new Error('The app started but its window never answered on the port.');
}

/** Runs `f` with the app's page, then lets go of it; the app keeps running. */
async function withPage(f) {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  try {
    const page = browser.contexts()[0]?.pages()[0];
    if (!page) throw new Error('The app has no window to drive.');
    return await f(page);
  } finally {
    await browser.close();
  }
}

/** One of the app's typed commands, read-only ones only: what the window itself would ask. */
const invoke = (page, cmd, a) => page.evaluate(([c, x]) => window.__TAURI_INTERNALS__.invoke(c, x), [cmd, a]);

function lengthOf(path) {
  try {
    return statSync(path).size;
  } catch {
    return null;
  }
}

function samples(snapshot) {
  return snapshot.downloads.map((d) => {
    const file = d.fileName ? join(d.directory, d.fileName) : null;
    return sample(d, { partBytes: file && lengthOf(`${file}.vdmpart`), fileBytes: file && lengthOf(file) });
  });
}

/** The app's processes, and their open TCP connections by remote address. */
function processes() {
  const script = `$ps = Get-Process -Name ${Object.values(PROCESSES).join(',')} -ErrorAction SilentlyContinue
$ids = @($ps | ForEach-Object { $_.Id })
$tcp = @(Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue | Where-Object { $ids -contains $_.OwningProcess -and $_.RemoteAddress -ne '127.0.0.1' -and $_.RemoteAddress -ne '::1' } | ForEach-Object { @{ pid = $_.OwningProcess; remote = "$($_.RemoteAddress):$($_.RemotePort)" } })
@{ procs = @($ps | ForEach-Object { @{ name = $_.ProcessName; pid = $_.Id; mib = [math]::Round($_.WorkingSet64 / 1MB, 1); cpuSeconds = $_.CPU; handles = $_.HandleCount } }); tcp = $tcp } | ConvertTo-Json -Depth 4 -Compress`;
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' });
  if (r.status !== 0) return { error: r.stderr.trim() };
  const value = JSON.parse(r.stdout || '{}');
  const byProcess = {};
  for (const c of value.tcp ?? []) {
    const name = value.procs.find((p) => p.pid === c.pid)?.name ?? c.pid;
    (byProcess[name] ??= {})[c.remote] = (byProcess[name][c.remote] ?? 0) + 1;
  }
  return { procs: value.procs ?? [], connections: byProcess };
}

function line(s) {
  const pct = s.total ? `${((100 * s.done) / s.total).toFixed(1)}%` : mib(s.done);
  const conns = s.requested ? `${s.connections}/${s.requested} conns${s.limitedBy ? ` (${s.limitedBy})` : ''}` : `${s.connections} conns`;
  const part = s.partBytes != null ? ` part ${mib(s.partBytes)}` : '';
  return `${s.id} ${s.name ?? '(no name yet)'} ${s.status} ${pct} ${mib(s.speed)}/s ${conns}${part}${s.error ? ` | ${s.error}` : ''}`;
}

async function watch() {
  mkdirSync(out, { recursive: true });
  const every = Number(named.every ?? 5) * 1000;
  const until = Date.now() + Number(named.for ?? 600) * 1000;
  const last = new Map();
  const changedAt = new Map();
  console.log(`Watching every ${every / 1000} s; samples in ${out}`);
  while (Date.now() < until) {
    const now = Date.now();
    const snapshot = await withPage((page) => invoke(page, 'get_snapshot'));
    const current = samples(snapshot);
    const system = processes();
    appendFileSync(join(out, 'samples.jsonl'), `${JSON.stringify({ at: now, downloads: current, ...system })}\n`);
    for (const s of current) {
      const before = last.get(s.id);
      if (!before || before.done !== s.done) changedAt.set(s.id, now);
      console.log(`${clock()} ${line(s)}`);
      for (const f of before ? findings(before, s, now - changedAt.get(s.id)) : []) {
        console.log(`${clock()} FINDING ${f}`);
        appendFileSync(join(out, 'findings.jsonl'), `${JSON.stringify({ at: now, finding: f, sample: s })}\n`);
        await withPage((page) => page.screenshot({ path: join(out, `finding-${now}-${s.id}.png`) }));
      }
      last.set(s.id, s);
    }
    const engine = system.connections?.[PROCESSES.engine];
    if (engine) console.log(`${clock()} engine connections: ${JSON.stringify(engine)}`);
    if (named.until === 'done' && current.length > 0 && current.every((s) => TERMINAL.has(s.status))) break;
    await sleep(Math.max(0, every - (Date.now() - now)));
  }
}

async function row(page, name) {
  const r = page.getByRole('row').filter({ hasText: name });
  if ((await r.count()) === 0) throw new Error(`No download named ${name} in the list.`);
  await r.first().click();
}

/** Says what a confirmation that an action opened asks, and leaves it for `click` to answer. */
async function dialog(page) {
  await sleep(500);
  const open = page.getByRole('alertdialog').or(page.getByRole('dialog')).first();
  if (await open.isVisible()) console.log(`${clock()} the app asks: ${(await open.innerText()).replace(/\n+/g, ' | ')}`);
}

/** Reads a line from the terminal without showing it: a password never goes in an argument (#279). */
function askHidden(question) {
  if (!process.stdin.isTTY) return Promise.reject(new Error('--password needs a terminal to type the password in.'));
  process.stdout.write(question);
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let typed = '';
    const finish = () => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    function onData(chunk) {
      for (const c of chunk) {
        if (c === '\r' || c === '\n') {
          finish();
          resolve(typed);
          return;
        }
        if (c === '\u0003') {
          finish();
          reject(new Error('Cancelled.'));
          return;
        }
        typed = c === '\u007f' || c === '\b' ? typed.slice(0, -1) : typed + c;
      }
    }
    process.stdin.on('data', onData);
  });
}

/** The add dialog's text and buttons, or null once it has closed. */
async function addDialog(page) {
  const open = page.getByRole('dialog', { name: 'Add download' });
  if (!(await open.isVisible())) return null;
  const names = await open.getByRole('button').allInnerTexts();
  return { text: (await open.innerText()).replace(/\n+/g, ' | '), buttons: names.map((n) => n.trim()).filter((n) => n !== '' && n !== 'Close') };
}

/** Clicks Start, answers the question `--answer` names, and reports what is left (#279). */
async function startAdding(page) {
  await page.getByRole('button', { name: 'Start download' }).click();
  const answered = new Set();
  for (;;) {
    await sleep(1500);
    const open = await addDialog(page);
    const answer = typeof named.answer === 'string' && open?.buttons.includes(named.answer) && !answered.has(named.answer) ? named.answer : null;
    if (answer) {
      answered.add(answer);
      console.log(`${clock()} the app asks: ${hideLinks(question(open))}; answering ${answer}`);
      await page.getByRole('dialog', { name: 'Add download' }).getByRole('button', { name: answer, exact: true }).click();
      continue;
    }
    const r = afterStart(open, [...answered]);
    if (r.final && !r.added) await page.getByRole('button', { name: 'Done' }).click();
    return r;
  }
}

const ACTIONS = { pause: 'Pause selected', resume: 'Resume selected', cancel: 'Cancel selected', retry: 'Retry selected', remove: 'Remove selected from list' };

async function main() {
  switch (command) {
    case 'start':
      return start();
    case 'onboard':
      return withPage(async (page) => {
        if (rest[0]) await page.getByRole('textbox').first().fill(rest[0]);
        await page.getByRole('button', { name: 'Get started' }).click();
        console.log('Setup finished.');
      });
    case 'add': {
      if (named.password && !named.user) throw new Error('--password goes with --user NAME.');
      // Asked before the window is touched, so the dialog doesn't wait on the prompt.
      const password = named.password ? await askHidden(`Password for ${named.user}: `) : null;
      return withPage(async (page) => {
        await page.getByRole('button', { name: /^Add download/ }).click();
        // Several links are pasted one per line; a shell can't pass a line break in one argument.
        await page.getByRole('textbox', { name: 'Links' }).fill(rest.join('\n'));
        if (named.folder) await page.getByRole('textbox', { name: 'Save to' }).fill(named.folder);
        // Shown only for a plain ftp:// link.
        if (named.ftps) await page.getByRole('checkbox', { name: 'Require encryption (FTPS)' }).check();
        if (named.connections || named.checksum || named.user) await page.getByRole('button', { name: 'Advanced options' }).click();
        if (named.connections) await page.getByRole('spinbutton', { name: 'Connections' }).fill(named.connections);
        if (named.checksum) await page.getByRole('textbox', { name: 'Checksum' }).fill(named.checksum);
        if (named.user) await page.getByRole('textbox', { name: 'User name' }).fill(named.user);
        if (password !== null) await page.getByLabel('Password', { exact: true }).fill(password);
        const r = await startAdding(page);
        mkdirSync(out, { recursive: true });
        const shot = join(out, `added-${Date.now()}.png`);
        await page.screenshot({ path: shot });
        const links = rest.map(hideLinks).join(' ');
        console.log(`${r.added ? `Added ${rest.length} link(s): ${links}.` : `${links}: ${r.message}`} Screenshot ${shot}`);
        // A question left unanswered: the next command shouldn't assume the download exists.
        if (!r.added && !r.final) process.exitCode = 2;
      });
    }
    case 'pause':
    case 'resume':
    case 'cancel':
    case 'retry':
    case 'remove':
      return withPage(async (page) => {
        await row(page, rest[0]);
        await page.getByRole('button', { name: ACTIONS[command] }).click();
        console.log(`${clock()} ${command}: ${rest[0]}`);
        await dialog(page);
      });
    case 'delete':
      // The app's "Delete files of selected…", confirmed: the files the downloads own, and the rows.
      return withPage(async (page) => {
        if (named.all) {
          // Ctrl+A in the list selects every download shown. Clicking the select-all box failed
          // now and then: a list refresh came between the click and Playwright's check of it (#279).
          const items = Number(/(\d+) items?/.exec(await page.getByText(/^\d+ items?$/).first().innerText())?.[1] ?? 0);
          if (items === 0) throw new Error('No downloads shown to delete.');
          const grid = page.getByRole('grid', { name: 'Downloads' });
          for (let tries = 0; !(await page.getByText(`${items} selected`).isVisible()); tries++) {
            if (tries === 5) throw new Error(`Couldn't select all ${items} downloads shown.`);
            await grid.focus();
            // Lowercase: Playwright's `Control+A` sends a capital A, as Caps Lock does (#311, #310).
            await page.keyboard.press('Control+a');
            await sleep(300);
          }
          await page.getByRole('button', { name: 'More actions' }).click();
          await page.getByRole('menuitem', { name: /Delete files of selected/ }).click();
        } else {
          await page.getByRole('row').filter({ hasText: rest[0] }).first().click({ button: 'right' });
          await page.getByRole('menuitem', { name: /^Delete files/ }).click();
        }
        await dialog(page);
        await page.getByRole('button', { name: 'Delete files' }).click();
        await sleep(2000);
        console.log(`${clock()} deleted the files of ${rest[0] ?? 'every download shown'}`);
      });
    case 'click':
      return withPage(async (page) => {
        await page.getByRole(rest[0], { name: rest[1] }).first().click();
        console.log(`${clock()} clicked ${rest[0]} "${rest[1]}"`);
        await dialog(page);
      });
    case 'watch':
      return watch();
    case 'status':
      return withPage(async (page) => {
        for (const s of samples(await invoke(page, 'get_snapshot'))) console.log(line(s));
        console.log(JSON.stringify(processes()));
      });
    case 'log':
      return withPage(async (page) => {
        const report = await invoke(page, 'get_diagnostics');
        const lines = report.appLog.slice(-Number(named.last ?? 50));
        for (const l of lines) console.log(`${new Date(l.atMs).toTimeString().slice(0, 8)} ${l.level.padEnd(5)} ${hideLinks(l.message)}`);
      });
    case 'export':
      return withPage(async (page) => {
        mkdirSync(out, { recursive: true });
        const path = join(out, `diagnostics-${Date.now()}.json`);
        writeFileSync(path, hideLinks(JSON.stringify(await invoke(page, 'get_diagnostics'), null, 2)));
        console.log(`Diagnostics written to ${path}`);
      });
    case 'shot':
      return withPage(async (page) => {
        mkdirSync(out, { recursive: true });
        const path = shotPath(out, rest[0]);
        await page.screenshot({ path });
        console.log(`Screenshot ${path}`);
      });
    case 'quit':
      return withPage((page) => invoke(page, 'quit_app')).then(() => console.log('Quit.'));
    case 'kill': {
      const name = PROCESSES[rest[0] ?? 'app'];
      if (!name) throw new Error('kill app, engine or torrent');
      const r = spawnSync('taskkill', ['/F', '/IM', `${name}.exe`], { encoding: 'utf8' });
      console.log(`${clock()} ${r.stdout.trim() || r.stderr.trim()}`);
      return;
    }
    default:
      console.log('Commands: start, onboard, add, pause, resume, cancel, retry, remove, delete, click, watch, status, log, export, shot, quit, kill. See tests/field/README.md.');
  }
}

main().catch((e) => {
  console.error(`field: ${e.message}`);
  process.exit(1);
});
