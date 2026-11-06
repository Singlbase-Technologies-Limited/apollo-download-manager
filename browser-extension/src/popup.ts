import type { Response } from './shared/protocol';
import { ext, send } from './shared/ext';
import { sanitizeSettings, type InterceptMode } from './shared/settings';
import { SHORT_NAME } from './shared/branding';
import { $ } from './shared/dom';
import { RECENT_KEY, sanitizeRecent } from './shared/recent';
import { ago, failureLabel, statusView } from './shared/popup-view';

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
      const where = document.createElement('span');
      where.className = 'hint';
      where.textContent = [e.host, ago(e.at, now)].filter(Boolean).join(' · ');
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

async function init() {
  const s = sanitizeSettings((await ext.storage.local.get('settings')).settings);
  showMode(s.mode);
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
    b.addEventListener('click', () => {
      const mode = sanitizeSettings({ ...s, mode: b.dataset.mode }).mode;
      s.mode = mode;
      showMode(mode);
      void ext.storage.local.set({ settings: s });
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
}

void init();
