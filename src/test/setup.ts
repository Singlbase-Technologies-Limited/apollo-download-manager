// Every UI test runs in jsdom (vite.config.ts), with Tauri's IPC mocked per test (#29).
import { clearMocks } from '@tauri-apps/api/mocks';
import { cleanup, configure } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach } from 'vitest';

// jsdom lacks the browser APIs Radix and the splitter use.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!('ResizeObserver' in globalThis)) globalThis.ResizeObserver = ResizeObserverStub;
const stub = (name: 'scrollIntoView' | 'hasPointerCapture' | 'setPointerCapture' | 'releasePointerCapture', value: () => unknown) => {
  if (!(name in Element.prototype)) Object.defineProperty(Element.prototype, name, { configurable: true, value });
};
stub('scrollIntoView', () => undefined);
stub('hasPointerCapture', () => false);
stub('setPointerCapture', () => undefined);
stub('releasePointerCapture', () => undefined);

afterEach(() => {
  cleanup();
  // Sonner's store outlives the render and replays its toasts to the next Toaster, so a file's later tests drew and
  // searched every earlier toast (#371).
  toast.dismiss();
  clearMocks();
});

// The toast library adds its stylesheet to the page when imported. `findByRole` styles every element to see if it's
// hidden, and jsdom checks each one against every rule, so those 97 rules cost more than the app's own render. None of
// them hide anything (#371).
document.head.querySelectorAll('style').forEach((style) => { style.remove(); });

// `findBy…` and `waitFor` wait up to 3 s, not Testing Library's 1 s: on a busy CI runner the app's first render took
// a little over a second (#206). Still well inside Vitest's 5 s per test.
configure({ asyncUtilTimeout: 3000 });

// jsdom does no layout; elements get a plausible size so the virtualised download list draws its rows (V1's setup).
for (const [name, px] of [['offsetHeight', 800], ['offsetWidth', 1200], ['clientHeight', 800], ['clientWidth', 1200]] as const) {
  Object.defineProperty(HTMLElement.prototype, name, { configurable: true, get: () => px });
}
