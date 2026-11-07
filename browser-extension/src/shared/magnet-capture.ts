/**
 * Magnet link capture: the optional click script, registered only while "Send magnet links and
 * .torrent downloads to Apollo Download Manager" is on and the user granted access to pages.
 */
import { sanitizeSettings, type ExtensionSettings } from './settings';

/** What capture needs from the browser, so the rules run without one in tests. */
export interface MagnetCaptureApi {
  getSettings(): Promise<ExtensionSettings>;
  hasPageAccess(): Promise<boolean>;
  isRegistered(): Promise<boolean>;
  register(): Promise<void>;
  unregister(): Promise<void>;
  openTabs(): Promise<{ id?: number; url?: string }[]>;
  inject(tabId: number): Promise<void>;
}

/**
 * Registers the click script while capture is on and pages may be read, and removes it otherwise.
 * A registered script reaches only pages loaded afterwards, so when capture starts it is also put
 * into the web pages already open (#416). Nothing is injected when it was registered before:
 * those pages have it.
 */
export async function syncMagnetCapture(api: MagnetCaptureApi): Promise<void> {
  const s = sanitizeSettings(await api.getSettings());
  const granted = await api.hasPageAccess().catch(() => false);
  const registered = await api.isRegistered().catch(() => false);
  if (s.captureTorrents && s.mode !== 'off' && granted) {
    if (registered) return;
    await api.register();
    for (const tab of await api.openTabs().catch(() => [])) {
      // Only web pages: the browser's own pages and blank tabs can't be reached and have no links to catch.
      if (tab.id === undefined || !/^https?:\/\//i.test(tab.url ?? '')) continue;
      // A tab the browser won't let the script into (a store page, a closed tab) stays as it was.
      await api.inject(tab.id).catch(() => undefined);
    }
  } else if (registered) {
    await api.unregister();
  }
}

const INSTALLED = '__apolloMagnetClicks';

/**
 * Catches plain clicks on magnet links and hands each to `send`. It reads nothing else from the
 * page. Installed once per page: the script runs again when it is put into an open page that
 * already has it. Returns whether it was installed now.
 */
export function installMagnetClicks(
  scope: Record<string, unknown>,
  doc: { addEventListener(type: 'click', listener: (e: MouseEvent) => void, capture: boolean): void },
  send: (url: string) => void,
): boolean {
  if (scope[INSTALLED]) return false;
  scope[INSTALLED] = true;
  doc.addEventListener(
    'click',
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest('a[href]');
      const href = a?.getAttribute('href') ?? '';
      if (!/^magnet:\?/i.test(href) || href.length > 8192) return;
      e.preventDefault();
      send(href);
    },
    true,
  );
  return true;
}
