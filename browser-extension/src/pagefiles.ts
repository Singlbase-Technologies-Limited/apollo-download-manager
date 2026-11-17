/**
 * Optional content script (#426), registered only while "Show a download button on pages with files" is on and the
 * user granted access to pages. It reads the page's links for files, shows the button when it finds some, and sends
 * the files the user chooses to the background, which hands them to Apollo Download Manager. It reads nothing else.
 */
import { ext } from './shared/ext';
import { hiddenOn } from './shared/page-files';
import { mountPagePanel, type PagePanelUi, type Point, type Size } from './shared/page-panel';
import { linksIn, PageFileList, watchAddedLinks } from './shared/page-scan';
import type { BatchOutcome, PageLinkPayload } from './shared/protocol';
import { sanitizeSettings, type ExtensionSettings } from './shared/settings';
import { pageMessageOf, PAGE_POSITIONS_KEY, PAGE_SIZE_KEY, PAGE_TIP_KEY, rememberPosition } from './shared/page-store';

const INSTALLED = '__apolloPageFiles';
const scope = globalThis as Record<string, unknown>;

async function start() {
  const stored = await ext.storage.local.get(['settings', PAGE_POSITIONS_KEY, PAGE_SIZE_KEY, PAGE_TIP_KEY]);
  let settings: ExtensionSettings = sanitizeSettings(stored.settings);
  const host = location.hostname;
  const positions = (typeof stored[PAGE_POSITIONS_KEY] === 'object' && stored[PAGE_POSITIONS_KEY] !== null ? stored[PAGE_POSITIONS_KEY] : {}) as Record<string, unknown>;
  const asPoint = (v: unknown): Point | null => {
    const p = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
    return typeof p.right === 'number' && typeof p.bottom === 'number' && Number.isFinite(p.right) && Number.isFinite(p.bottom) ? { right: p.right, bottom: p.bottom } : null;
  };
  const asSize = (v: unknown): Size | null => {
    const s = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
    return typeof s.width === 'number' && typeof s.height === 'number' && s.width > 0 && s.height > 0 ? { width: s.width, height: s.height } : null;
  };
  let tipSeen = stored[PAGE_TIP_KEY] === true;
  let size = asSize(stored[PAGE_SIZE_KEY]);

  const list = new PageFileList(() => location.href, settings);
  list.add(linksIn(document));

  let ui: PagePanelUi | null = null;
  let frame: HTMLElement | null = null;
  const mount = () => {
    if (ui) return ui;
    frame = document.createElement('apollo-dm-page-files');
    // The page's styles can't size or hide the frame: it has none, and its contents sit in a closed shadow root.
    frame.style.setProperty('all', 'initial', 'important');
    frame.style.setProperty('position', 'fixed', 'important');
    frame.style.setProperty('z-index', '2147483647', 'important');
    const shadow = frame.attachShadow({ mode: 'closed' });
    document.documentElement.append(frame);
    ui = mountPagePanel(shadow, document, host, {
      position: asPoint(positions[host]),
      size,
      tipSeen,
      savePosition: (p) => {
        void ext.storage.local.get(PAGE_POSITIONS_KEY).then((s) => ext.storage.local.set({ [PAGE_POSITIONS_KEY]: rememberPosition(s[PAGE_POSITIONS_KEY], host, p) }));
      },
      saveSize: (s) => {
        size = s;
        void ext.storage.local.set({ [PAGE_SIZE_KEY]: s });
      },
      markTipSeen: () => {
        tipSeen = true;
        void ext.storage.local.set({ [PAGE_TIP_KEY]: true });
      },
      hideOnThisSite: () => {
        void ext.storage.local.get('settings').then((s) => {
          const now = sanitizeSettings(s.settings);
          return ext.storage.local.set({ settings: sanitizeSettings({ ...now, pageButtonHiddenSites: [...now.pageButtonHiddenSites, host] }) });
        });
      },
      send: (links: PageLinkPayload[]) => ext.runtime.sendMessage<unknown, BatchOutcome>({ type: 'page.send', links }),
    });
    ui.update(list.found);
    return ui;
  };
  const unmount = () => {
    ui?.destroy();
    frame?.remove();
    ui = null;
    frame = null;
  };
  const wanted = () => settings.pageButton && !hiddenOn(location.href, settings.pageButtonHiddenSites);
  if (wanted() && list.found.files.length > 0) mount();

  watchAddedLinks(document, (links) => {
    if (!list.add(links)) return;
    if (ui) ui.update(list.found);
    else if (wanted()) mount();
  });

  // Turning the button off, or hiding it on this site, takes it away at once, without a reload.
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !('settings' in changes)) return;
    settings = sanitizeSettings(changes.settings.newValue);
    if (!wanted()) unmount();
    else if (list.found.files.length > 0) mount();
  });

  // The toolbar popup and the keyboard shortcut (#426).
  ext.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
    if (sender.id !== ext.runtime.id) return false;
    const m = pageMessageOf(msg);
    if (m === 'list') {
      sendResponse({ files: list.found.files.length, groups: countGroups(), hidden: !wanted() });
      return false;
    }
    if (m === 'open') {
      sendResponse({ opened: list.found.files.length > 0 && mount().open() });
      return false;
    }
    return false;
  });

  function countGroups(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const f of list.found.files) out[f.group] = (out[f.group] ?? 0) + 1;
    return out;
  }
}

// Installed once per page: the script runs again when it is put into a page that already has it.
if (!scope[INSTALLED] && location.protocol.startsWith('http')) {
  scope[INSTALLED] = true;
  void start();
}
