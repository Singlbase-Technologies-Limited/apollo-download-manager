import { describe, expect, it } from 'vitest';
import { installMagnetClicks, syncMagnetCapture, type MagnetCaptureApi } from '../src/shared/magnet-capture';
import { DEFAULT_SETTINGS } from '../src/shared/settings';

function fakeApi(over: { captureTorrents?: boolean; granted?: boolean; registered?: boolean; tabs?: { id?: number; url?: string }[] } = {}) {
  const log: string[] = [];
  let registered = over.registered ?? false;
  const api: MagnetCaptureApi = {
    getSettings: () => Promise.resolve({ ...DEFAULT_SETTINGS, captureTorrents: over.captureTorrents ?? true }),
    hasPageAccess: () => Promise.resolve(over.granted ?? true),
    isRegistered: () => Promise.resolve(registered),
    register: () => ((registered = true), log.push('register'), Promise.resolve()),
    unregister: () => ((registered = false), log.push('unregister'), Promise.resolve()),
    openTabs: () => Promise.resolve(over.tabs ?? []),
    inject: (tabId) => (log.push(`inject:${String(tabId)}`), Promise.resolve()),
  };
  return { api, log };
}

describe('magnet capture (#416)', () => {
  it('reaches the web pages already open when capture starts, not only pages loaded later', async () => {
    const { api, log } = fakeApi({
      tabs: [
        { id: 1, url: 'https://site.example/page' },
        { id: 2, url: 'http://127.0.0.1:8356/' },
        { id: 3, url: 'chrome://extensions/' },
        { id: 4, url: 'about:blank' },
        { id: 5 },
      ],
    });
    await syncMagnetCapture(api);
    expect(log).toEqual(['register', 'inject:1', 'inject:2']);
  });

  it('injects nothing when capture was already on, since the open pages have it', async () => {
    const { api, log } = fakeApi({ registered: true, tabs: [{ id: 1, url: 'https://site.example/' }] });
    await syncMagnetCapture(api);
    expect(log).toEqual([]);
  });

  it('stops without page access, or with capture off', async () => {
    for (const over of [{ granted: false }, { captureTorrents: false }]) {
      const { api, log } = fakeApi({ ...over, registered: true, tabs: [{ id: 1, url: 'https://site.example/' }] });
      await syncMagnetCapture(api);
      expect(log).toEqual(['unregister']);
    }
  });

  it('carries on past a tab it may not reach', async () => {
    const { api, log } = fakeApi({ tabs: [{ id: 1, url: 'https://a.example/' }, { id: 2, url: 'https://b.example/' }] });
    api.inject = (tabId) => (tabId === 1 ? Promise.reject(new Error('no access')) : (log.push(`inject:${String(tabId)}`), Promise.resolve()));
    await syncMagnetCapture(api);
    expect(log).toEqual(['register', 'inject:2']);
  });

  it('listens for clicks once per page, however often the script runs', () => {
    const added: string[] = [];
    const scope: Record<string, unknown> = {};
    const doc = { addEventListener: (type: string) => added.push(type) };
    expect(installMagnetClicks(scope, doc, () => undefined)).toBe(true);
    expect(installMagnetClicks(scope, doc, () => undefined)).toBe(false);
    expect(added).toEqual(['click']);
  });
});
