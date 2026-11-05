import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import branding from '../../branding.json';
import { createBackground, type ExtApi } from '../src/background-core';
import { EXTENSION_NAME, NATIVE_HOST_NAME, SHORT_NAME } from '../src/shared/branding';
import { sendNative } from '../src/shared/native';
import { DEFAULT_SETTINGS } from '../src/shared/settings';

/** V1's native host and extension name (V1 `branding.json` at e9d717a8). V2 must use neither. */
const V1_NATIVE_HOST = 'com.velocity.download_manager';
const V1_EXTENSION_NAME = 'Velocity Download Manager';

describe('V2 identity (#64)', () => {
  it("talks only to V2's development native host in a development build", async () => {
    const hosts: string[] = [];
    await sendNative({ sendNativeMessage: (app) => (hosts.push(app), Promise.resolve({ v: 1, id: 'p', ok: true, result: {} })) }, { v: 1, id: 'p', type: 'ping' });
    expect(hosts).toEqual([branding.nativeHostName]);
    expect(NATIVE_HOST_NAME).not.toBe(V1_NATIVE_HOST);
    expect(NATIVE_HOST_NAME).not.toBe(branding.releaseNativeHostName);
  });

  it('names itself V2 everywhere a user sees it next to V1', () => {
    expect(EXTENSION_NAME).toBe(branding.extensionName);
    expect(EXTENSION_NAME).not.toBe(V1_EXTENSION_NAME);
    // PO rule on #347: "Apollo Download Manager", or "Apollo DM" for short, never "Apollo" alone.
    expect(EXTENSION_NAME).toBe('Apollo Download Manager (dev)');
    expect(SHORT_NAME).toBe('Apollo DM');
  });

  it('says which app failed in the badge title', async () => {
    const badges: string[] = [];
    const api = {
      selfId: 'self',
      sendNativeMessage: () => Promise.reject(new Error('Specified native messaging host not found.')),
      getSettings: () => Promise.resolve(DEFAULT_SETTINGS),
      setBadge: (_text: string, title: string) => (badges.push(title), Promise.resolve()),
      startBrowserDownload: () => Promise.resolve(),
    } as unknown as ExtApi;
    const r = await createBackground(api).onContextMenu({ linkUrl: 'https://cdn.test/a.zip' });
    expect(r).toMatchObject({ ok: false, error: { code: 'HOST_NOT_INSTALLED' } });
    expect(badges).toEqual([expect.stringMatching(/^Apollo DM: The connection to Apollo DM is not set up/) as string]);
  });

  it("keeps the extension pages' text on the product's name", () => {
    for (const page of ['popup.html', 'options.html', 'prompt.html']) {
      const html = readFileSync(new URL(`../static/${page}`, import.meta.url), 'utf8');
      const text = html.replace(/<[^>]*>/g, ' ');
      expect(text.match(/Velocity/g), page).toBeNull();
      // Every visible "Apollo" is the full name or the short form "Apollo DM", never "Apollo" alone.
      expect(text.match(/Apollo(?! Download Manager| DM)/g), page).toBeNull();
      expect(text, page).toMatch(/Apollo (Download Manager|DM)/);
    }
  });
});
