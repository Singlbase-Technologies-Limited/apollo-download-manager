import { describe, expect, it } from 'vitest';
import { pickExtensionApi } from '../src/shared/ext';

describe('the WebExtension namespace (#411)', () => {
  const chromeApi = { runtime: { id: 'chrome-api' } };
  const browserApi = { runtime: { id: 'browser-api' } };

  it("uses the browser's own `browser` API when there is one (Firefox, newer Chrome)", () => {
    expect(pickExtensionApi({ browser: browserApi, chrome: chromeApi })).toBe(browserApi);
    expect(pickExtensionApi({ browser: browserApi })).toBe(browserApi);
  });

  it('uses `chrome` when there is no `browser` API', () => {
    expect(pickExtensionApi({ chrome: chromeApi })).toBe(chromeApi);
  });

  it('ignores a page element named "browser", as in Chrome 116, where an id becomes a global', () => {
    // prompt.html has <button id="browser">: without a `browser` API of its own, Chrome 116
    // exposes that button as `globalThis.browser`.
    const button = { id: 'browser', tagName: 'BUTTON', click() {} };
    expect(pickExtensionApi({ browser: button, chrome: chromeApi })).toBe(chromeApi);
  });
});
