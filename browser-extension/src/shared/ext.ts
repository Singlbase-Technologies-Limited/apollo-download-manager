/**
 * Picks the WebExtension namespace: `browser` when the browser provides it (Firefox, newer
 * Chrome), otherwise `chrome`. A page element whose id is `browser` is also a global, so in a
 * Chrome without its own `browser` API (Chrome 116, #411) `globalThis.browser` can be that
 * element: only an object with `runtime` counts as the API.
 */
export function pickExtensionApi<T>(scope: { browser?: unknown; chrome?: T }): T {
  const b = scope.browser as { runtime?: unknown } | undefined;
  return (b && typeof b === 'object' && typeof b.runtime === 'object' && b.runtime !== null ? b : scope.chrome) as T;
}

/** The WebExtension namespace: `browser` in Firefox (promise-based), `chrome` in Chromium (MV3 promises). */
export const ext: typeof chrome = pickExtensionApi(globalThis as { browser?: unknown; chrome?: typeof chrome });

export async function send<T>(message: unknown): Promise<T> {
  const reply: unknown = await ext.runtime.sendMessage(message);
  return reply as T;
}
