import type { Browser } from '../../contract';

/** Each browser's name as the window shows it (#65, #241). */
export const BROWSER_NAMES: Record<Browser, string> = {
  chrome: 'Google Chrome',
  chromium: 'Chromium',
  edge: 'Microsoft Edge',
  brave: 'Brave',
  firefox: 'Mozilla Firefox',
};
