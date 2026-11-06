#!/usr/bin/env node
// `pnpm site:screens`: retakes the website's screenshots (#353, docs/WEBSITE.md) into site/screens/. They show the real
// window, from the Vite server (`pnpm exec vite`, port 1430), in Microsoft Edge. This script answers the app's commands
// itself, with made-up downloads of free software, so no native side runs and no real data is shown. It stops if the
// list doesn't load: the window checks every answer against the contract, and refuses one that doesn't fit.
/* global window -- installBackend runs in the page. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'site', 'screens');
const fixture = (name) => JSON.parse(readFileSync(join(root, 'tests', 'fixtures', 'contract', name), 'utf8'));
const APP = 'http://localhost:1430/';

const GIB = 1024 ** 3;
const MIB = 1024 ** 2;
const FOLDER = 'C:\\Users\\Alex\\Downloads';
const FIRST_ROW = 'ubuntu-26.04.1-live-server-amd64.iso';

const progress = (completedBytes, totalBytes, downloadSpeedBps = 0, connections = 0, connectionDetail = null, uploadSpeedBps = 0) => ({
  completedBytes,
  totalBytes,
  downloadSpeedBps,
  uploadSpeedBps,
  connections,
  connectionDetail,
});
const failure = (cls, httpStatus, message, retryable) => ({ class: cls, confirm: null, detail: null, hostKey: null, httpStatus, loginRequired: false, message, noNetwork: false, retryable });

/** Every status a visitor should see, newest first. */
function exampleDownloads() {
  const now = Date.now();
  const base = {
    kind: 'http',
    directory: FOLDER,
    error: null,
    verification: null,
    completedAtMs: null,
    retryAtMs: null,
    startedOver: null,
    averageSpeedBps: null,
    speedLimitBps: null,
    requestedConnections: 8,
    torrent: null,
    fileCount: null,
    waitsUntil: null,
  };
  const torrent = { kind: 'magnet', requestedConnections: null };
  const rows = [
    { fileName: FIRST_ROW, sourceUrl: `https://releases.ubuntu.com/26.04/${FIRST_ROW}`, categoryId: 'images', status: 'downloading', averageSpeedBps: 21 * MIB, progress: progress(Math.round(1.84 * GIB), Math.round(2.9 * GIB), 23 * MIB, 8, { requested: 8, allowed: 8, limitedBy: null }) },
    { fileName: 'blender-5.0.0-windows-x64.msi', sourceUrl: 'https://download.blender.org/release/Blender5.0/blender-5.0.0-windows-x64.msi', categoryId: 'programs', status: 'downloading', averageSpeedBps: 9 * MIB, progress: progress(148 * MIB, 412 * MIB, 11 * MIB, 4, { requested: 8, allowed: 4, limitedBy: 'serverThrottling' }) },
    { ...torrent, fileName: 'debian-13-amd64-DVD', sourceUrl: 'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567', categoryId: 'images', status: 'downloading', fileCount: 3, averageSpeedBps: 6 * MIB, torrent: { peers: 34, seeds: 12, uploadedBytes: 96 * MIB, seedingSecs: 0, seedQueued: false }, progress: progress(Math.round(1.1 * GIB), Math.round(3.7 * GIB), 7 * MIB, 34, null, 512 * 1024) },
    { fileName: 'big_buck_bunny_1080p.mp4', sourceUrl: 'https://download.blender.org/peach/bigbuckbunny_movies/big_buck_bunny_1080p.mp4', categoryId: 'video', status: 'paused', progress: progress(310 * MIB, 692 * MIB) },
    { fileName: 'node-v24.11.0-win-x64.zip', sourceUrl: 'https://nodejs.org/dist/v24.11.0/node-v24.11.0-win-x64.zip', categoryId: 'compressed', status: 'queued', progress: progress(0, 34 * MIB) },
    { fileName: 'LibreOffice_26.2_Win_x86-64.msi', sourceUrl: 'https://download.documentfoundation.org/libreoffice/stable/26.2/win/x86_64/LibreOffice_26.2_Win_x86-64.msi', categoryId: 'programs', status: 'completed', verification: 'verified', completedAtMs: now - 240_000, averageSpeedBps: 18 * MIB, progress: progress(356 * MIB, 356 * MIB) },
    { fileName: 'sintel-soundtrack.flac', sourceUrl: 'https://download.blender.org/durian/soundtrack/sintel-soundtrack.flac', categoryId: 'music', status: 'completed', verification: 'sizeVerified', completedAtMs: now - 500_000, averageSpeedBps: 12 * MIB, progress: progress(88 * MIB, 88 * MIB) },
    { fileName: 'postgresql-18-A4.pdf', sourceUrl: 'https://www.postgresql.org/files/documentation/pdf/18/postgresql-18-A4.pdf', categoryId: 'documents', status: 'completed', verification: 'sizeVerified', completedAtMs: now - 800_000, averageSpeedBps: 8 * MIB, progress: progress(15 * MIB, 15 * MIB) },
    { ...torrent, fileName: 'fedora-workstation-44-x86_64', sourceUrl: 'magnet:?xt=urn:btih:89abcdef0123456789abcdef0123456789abcdef', categoryId: 'images', status: 'seeding', fileCount: 2, verification: 'verified', completedAtMs: now - 1_200_000, averageSpeedBps: 14 * MIB, torrent: { peers: 9, seeds: 41, uploadedBytes: 640 * MIB, seedingSecs: 1200, seedQueued: false }, progress: progress(Math.round(2.4 * GIB), Math.round(2.4 * GIB), 0, 9, null, MIB) },
    { fileName: 'gimp-3.2.0-setup.exe', sourceUrl: 'https://download.gimp.org/gimp/v3.2/windows/gimp-3.2.0-setup.exe', categoryId: 'programs', status: 'retrying', retryAtMs: now + 25_000, error: failure('throttled', 503, 'Service unavailable', true), progress: progress(96 * MIB, 330 * MIB) },
    { fileName: 'old-release-notes.pdf', sourceUrl: 'https://example.org/files/old-release-notes.pdf', categoryId: 'documents', status: 'failed', error: failure('permanent', 404, 'The file was not found on the server (HTTP 404).', false), progress: progress(0, null) },
  ];
  return rows.map((row, i) => {
    const createdAtMs = now - (i + 1) * 420_000;
    return { ...base, id: `d-${String(i + 1)}`, createdAtMs, startedAtMs: row.status === 'queued' ? null : createdAtMs + 2000, ...row };
  });
}

// As in crates/velocity-core/migrations/0006_builtin_categories.sql.
const CATEGORIES = [
  ['compressed', 'Compressed', '#a855f7', 'archive', 'zip rar 7z tar gz tgz bz2 xz zst cab arj lzh'],
  ['documents', 'Documents', '#0ea5e9', 'file-text', 'pdf doc docx xls xlsx ppt pptx odt ods odp txt rtf epub csv'],
  ['music', 'Music', '#ec4899', 'music', 'mp3 flac wav aac ogg opus m4a wma aiff'],
  ['video', 'Video', '#f97316', 'film', 'mp4 mkv avi mov wmv webm m4v flv mpg mpeg ts'],
  ['programs', 'Programs', '#22c55e', 'app-window', 'exe msi msix appx dmg pkg deb rpm appimage apk flatpak snap'],
  ['images', 'Disk images', '#64748b', 'disc', 'iso img vhd vhdx vmdk qcow2'],
].map(([id, name, color, icon, extensions]) => ({ id, name, color, icon, extensions: extensions.split(' '), directory: null, builtin: true }));

function browserIntegration() {
  const browser = fixture('browser-integration.json');
  browser.hostPath = 'C:\\Program Files\\Apollo Download Manager\\native-host.exe';
  for (const r of browser.registrations) {
    const installed = ['chrome', 'edge', 'firefox'].includes(r.browser);
    r.manifestPath = `C:\\Users\\Alex\\AppData\\Local\\Apollo Download Manager\\${r.browser}.json`;
    r.found = installed ? { program: `C:\\Program Files\\${r.browser}\\${r.browser}.exe`, sandboxed: false } : null;
    r.registered = r.browser === 'chrome' || r.browser === 'edge';
    r.hostMatches = r.registered;
  }
  return browser;
}

/** Runs in the page, before the app: the answers to the commands the screens below use. */
function installBackend(d) {
  let next = 1;
  const check = ({ directory, fileName, categoryId }) => ({
    directory: directory ?? d.folder,
    directoryExists: true,
    automaticDirectory: directory === null,
    categoryId,
    fileName,
    path: fileName === null ? null : `${directory ?? d.folder}\\${fileName}`,
    fileExists: false,
    partialDownloadExists: false,
    suggestedName: null,
  });
  const answers = {
    app_info: () => d.appInfo,
    get_shell_settings: () => d.shell,
    set_appearance: (a) => a.appearance,
    get_snapshot: () => d.snapshot,
    list_categories: () => d.categories,
    get_capabilities: () => d.capabilities,
    get_browser_integration: () => d.browser,
    get_settings: () => d.settings,
    get_storage_settings: () => d.settings.storage,
    get_proxy_password_set: () => false,
    get_torrent_network: () => ({ listenPort: 6890, listenError: null, portMapping: { state: 'off' } }),
    get_diagnostics: () => d.diagnostics,
    get_history: () => d.history,
    check_destination: check,
    get_torrent_details: () => d.torrent.details,
    get_torrent_trackers: () => [],
    get_torrent_peers: () => [],
    'plugin:window|is_maximized': () => false,
    'plugin:event|listen': () => next++,
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => undefined };
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
    transformCallback: () => next++,
    unregisterCallback: () => undefined,
    convertFileSrc: (path) => path,
    invoke: (cmd, args = {}) => {
      const answer = answers[cmd];
      if (answer) return Promise.resolve(answer(args));
      if (cmd.startsWith('plugin:')) return Promise.resolve(null);
      return Promise.reject(new Error(`site-screens has no answer for ${cmd}`));
    },
  };
}

const columns = fixture('columns.json').default;
const shellSettings = (theme, onboardingCompleted) => ({
  appearance: {
    theme,
    density: 'compact',
    layout: { sidebarWidth: null, sidebarCollapsed: false, sidebarVisible: true, detailsWidth: null, detailsVisible: false },
    visibleColumns: columns,
    columnWidths: { name: 340 },
    timeFormat: 'twentyFourHour',
  },
  onboardingCompleted,
  defaultDirectory: FOLDER,
});

const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const settings = fixture('settings.json');
settings.downloads.defaultDirectory = FOLDER;
const answers = {
  folder: FOLDER,
  appInfo: { ...fixture('app-info.json'), name: 'Apollo Download Manager', version },
  snapshot: { downloads: exampleDownloads(), unavailable: [], needsLogin: [], engine: { state: 'running' }, torrentEngine: { state: 'running' }, storageError: null, schedule: null },
  categories: CATEGORIES,
  capabilities: fixture('capabilities.json'),
  browser: browserIntegration(),
  settings,
  diagnostics: fixture('diagnostics.json'),
  history: fixture('history.json').page,
  torrent: fixture('torrent.json'),
};

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });

async function open(theme, { onboarded = true, over = {} } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 780 }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.addInitScript(installBackend, { ...answers, ...over, shell: shellSettings(theme, onboarded) });
  await page.goto(APP);
  if (onboarded) await page.getByText(FIRST_ROW).first().waitFor({ timeout: 10_000 });
  return page;
}

const shot = async (page, name) => {
  await page.waitForTimeout(350);
  const png = await page.screenshot();
  /* global Image, document -- this callback runs in the page */
  // WebP, drawn by the browser itself: a third of a PNG's size, with no tool to add (#379).
  const webp = await page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);
    return canvas.toDataURL('image/webp', 0.88).split(',')[1];
  }, png.toString('base64'));
  writeFileSync(join(out, `${name}.webp`), Buffer.from(webp, 'base64'));
  console.log(`site/screens/${name}.webp`);
};
const settingsSection = (page, name) => page.getByRole('navigation', { name: 'Settings sections' }).getByRole('button', { name }).click();

try {
  const page = await open('light');
  await shot(page, 'downloads');

  await page.getByRole('button', { name: /Add download/ }).first().click();
  await page.getByRole('dialog').getByRole('textbox').first().fill('https://releases.ubuntu.com/26.04/ubuntu-26.04.1-desktop-amd64.iso');
  await shot(page, 'add');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });

  await page.getByText(FIRST_ROW).first().click();
  await shot(page, 'details');

  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Categories' }).click();
  await shot(page, 'categories');

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await settingsSection(page, 'Browser');
  await shot(page, 'browser');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });

  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.getByRole('menuitem', { name: 'User guide' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Downloads', exact: true }).click();
  await shot(page, 'guide');

  const scheduled = await open('light', {
    over: {
      settings: { ...settings, queue: { ...settings.queue, schedule: { ...settings.queue.schedule, enabled: true } } },
      snapshot: { ...answers.snapshot, schedule: { open: false, opens: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10).concat('T02:00'), closes: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10).concat('T07:00') } },
    },
  });
  await scheduled.getByRole('button', { name: 'Settings', exact: true }).click();
  await settingsSection(scheduled, 'Queue and performance');
  await scheduled.getByText('Schedule', { exact: true }).first().evaluate((e) => { e.scrollIntoView({ block: 'start' }); });
  await shot(scheduled, 'schedule');

  const first = await open('light', { onboarded: false });
  await first.getByRole('button', { name: 'Next' }).waitFor({ timeout: 10_000 });
  await shot(first, 'get-started');

  await shot(await open('dark'), 'dark');
} finally {
  await browser.close();
}
