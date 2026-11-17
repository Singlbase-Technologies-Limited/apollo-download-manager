import type { Response } from './shared/protocol';
import { ext, send } from './shared/ext';
import { sanitizeSettings, type InterceptMode } from './shared/settings';
import { SHORT_NAME } from './shared/branding';
import { $ } from './shared/dom';
import { RECENT_KEY, sanitizeRecent } from './shared/recent';
import { ago, failureLabel, pageFilesView, statusView, type PageFilesState } from './shared/popup-view';

const MODE_HINTS: Record<InterceptMode, string> = {
  auto: `Matching downloads go to ${SHORT_NAME}.`,
  ask: 'The browser asks you each time.',
  off: 'The browser keeps every download.',
};

async function refreshStatus() {
  const badge = $('status', HTMLElement);
  badge.textContent = 'Checking…';
  badge.className = 'badge';
  const view = statusView(await send<Response>({ type: 'status' }));
  badge.textContent = view.text;
  badge.className = `badge ${view.tone}`;
  $('offline', HTMLElement).hidden = view.offline === null;
  $('offlineReason', HTMLElement).textContent = view.offline ?? '';
}

async function renderRecent() {
  const list = sanitizeRecent((await ext.storage.local.get(RECENT_KEY))[RECENT_KEY]);
  const ul = $('recent', HTMLUListElement);
  const now = Date.now();
  ul.replaceChildren(
    ...list.map((e) => {
      const li = document.createElement('li');
      const what = document.createElement('span');
      what.className = 'what';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = e.name;
      name.title = e.name;
      // The site shortens with "…" when the row is narrow; the time stays whole (#412).
      const parts = [e.host, ago(e.at, now)].filter(Boolean);
      const where = document.createElement('span');
      where.className = 'hint where';
      where.title = parts.join(' · ');
      where.append(
        ...parts.map((p, i) => {
          const s = document.createElement('span');
          s.textContent = i === 0 ? p : ` · ${p}`;
          return s;
        }),
      );
      what.append(name, where);
      const pill = document.createElement('span');
      pill.className = `pill ${e.ok ? 'ok' : 'err'}`;
      pill.textContent = e.ok ? 'Sent' : failureLabel(e.code);
      li.append(what, pill);
      return li;
    }),
  );
  $('recentEmpty', HTMLElement).hidden = list.length > 0;
}

function showMode(mode: InterceptMode) {
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  $('modeHint', HTMLElement).textContent = MODE_HINTS[mode];
}

const PAGES = { origins: ['<all_urls>'] };

/** The "Files on this page" card (#426): what the page in the active tab has, and the way to it. */
async function renderPageFiles() {
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  const s = sanitizeSettings((await ext.storage.local.get('settings')).settings);
  const access = await ext.permissions.contains(PAGES).catch(() => false);
  // Without access to pages the browser doesn't tell the popup the tab's address; the card then offers access.
  const web = tab?.url === undefined ? tab?.id !== undefined : /^https?:\/\//i.test(tab.url);
  let page: PageFilesState['page'] = null;
  if (web && access && s.pageButton && tab?.id !== undefined) {
    page = await ext.tabs.sendMessage<unknown, PageFilesState['page'] | undefined>(tab.id, { type: 'page.files.list' }).then(
      (r) => r ?? null,
      () => null,
    );
  }
  const view = pageFilesView({ web, access, enabled: s.pageButton, page });
  $('pageFiles', HTMLElement).hidden = !view.show;
  $('pageFilesText', HTMLElement).textContent = view.text;
  const count = $('pageFilesCount', HTMLElement);
  count.hidden = view.count === null;
  count.textContent = view.count ?? '';
  const action = $('pageFilesAction', HTMLButtonElement);
  action.hidden = view.action === null;
  action.textContent = view.action === 'choose' ? 'Choose files to download…' : view.action === 'allow' ? 'Allow reading pages' : 'Turn it on';
  action.onclick = () => {
    if (view.action === 'choose' && tab?.id !== undefined) {
      void ext.tabs.sendMessage(tab.id, { type: 'page.files.open' }).then(
        () => {
          window.close();
        },
        () => undefined,
      );
      return;
    }
    // Asked from the click itself, as the browser requires.
    void ext.permissions
      .request(PAGES)
      .catch(() => false)
      .then(async (granted) => {
        if (view.action === 'turnOn') await ext.storage.local.set({ settings: { ...s, pageButton: true } });
        $('pageFilesText', HTMLElement).textContent = granted ? 'Reload the page to look for files on it.' : 'Without access to pages the button can’t find files.';
        action.hidden = granted;
      });
  };
  $('pageFilesSiteRow', HTMLElement).hidden = view.siteSwitch === null;
  const site = $('pageFilesSite', HTMLInputElement);
  site.checked = view.siteSwitch ?? false;
  site.onchange = () => {
    let host: string;
    try {
      host = new URL(tab?.url ?? '').hostname;
    } catch {
      return;
    }
    const hidden = site.checked ? s.pageButtonHiddenSites.filter((d) => host !== d && !host.endsWith(`.${d}`)) : [...s.pageButtonHiddenSites, host];
    s.pageButtonHiddenSites = sanitizeSettings({ pageButtonHiddenSites: hidden }).pageButtonHiddenSites;
    void ext.storage.local.set({ settings: s });
  };
}

async function init() {
  const s = sanitizeSettings((await ext.storage.local.get('settings')).settings);
  showMode(s.mode);
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
    b.addEventListener('click', () => {
      const mode = sanitizeSettings({ ...s, mode: b.dataset.mode }).mode;
      s.mode = mode;
      showMode(mode);
      // Read again: the page card may have changed other settings since the popup opened (#426).
      void ext.storage.local.get('settings').then((r) => ext.storage.local.set({ settings: { ...sanitizeSettings(r.settings), mode } }));
    });
  }
  $('form', HTMLElement).addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('url', HTMLInputElement);
    const out = $('result', HTMLElement);
    out.textContent = 'Sending…';
    out.className = 'hint';
    void send<Response>({ type: 'add', url: input.value }).then((r) => {
      out.textContent = r.ok ? `Sent. ${SHORT_NAME} shows it in Downloads.` : r.error.message;
      out.className = r.ok ? 'hint ok' : 'hint err';
      if (r.ok) input.value = '';
      void renderRecent();
    });
  });
  $('options', HTMLElement).addEventListener('click', () => void ext.runtime.openOptionsPage());
  $('retry', HTMLElement).addEventListener('click', () => void refreshStatus());
  void refreshStatus();
  void renderRecent();
  void renderPageFiles();
}

void init();
