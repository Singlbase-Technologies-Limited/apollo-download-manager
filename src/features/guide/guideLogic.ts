/**
 * The guide after Get started (#463): its steps, and where the bubble goes next to the control a step lights up.
 * PO decisions on #463 (2026-11-17): a spotlight on the real window; steps 4 to 6 light the Settings and Help buttons
 * and say where to look, without opening anything.
 */

/** The controls the guide points at, marked with `data-tour` in the window. */
export type TourTarget = 'add' | 'toolbar' | 'nav' | 'settings' | 'help';

export interface TourStep {
  target: TourTarget;
  title: string;
  text: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    target: 'add',
    title: 'Add a download',
    text: 'Click here or press Ctrl+N. Paste one link or many, one per line. You can also drop .torrent files on the window.',
  },
  {
    target: 'toolbar',
    title: 'Your downloads',
    text: 'Pause, resume, retry or remove the downloads you choose in the list. The button on the right opens the details: speed, time left and the link.',
  },
  {
    target: 'nav',
    title: 'Lists and categories',
    text: 'Show only what is downloading, finished or failed, or one category. Each category saves to its own folder.',
  },
  {
    target: 'settings',
    title: 'From your browser',
    text: 'With the browser extension, downloads come here by themselves. Open Settings, then Browser, to connect it and to choose whether Apollo DM asks before adding.',
  },
  {
    target: 'settings',
    title: 'Queue and schedule',
    text: 'Settings, then Queue and performance, sets how many files download at once, and when, for example only at night.',
  },
  {
    target: 'help',
    title: 'Torrents, and help',
    text: 'Magnet links and .torrent files work like any other link. Press Ctrl+, to search the settings, and find the user guide here, in Help.',
  },
];

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Room kept between the bubble and the window's edges, and between the bubble and what it points at. */
const EDGE = 8;
const GAP = 12;

/**
 * Where the bubble goes: beside the control (right, below, left, above, in that order, as there is room), kept inside
 * the window; in the middle when the control isn't on screen.
 */
export function placeBubble(target: Box | null, bubble: Size, view: Size): { left: number; top: number } {
  const clampX = (x: number) => Math.min(Math.max(EDGE, x), Math.max(EDGE, view.width - bubble.width - EDGE));
  const clampY = (y: number) => Math.min(Math.max(EDGE, y), Math.max(EDGE, view.height - bubble.height - EDGE));
  if (!target || target.width === 0 || target.height === 0) {
    return { left: clampX((view.width - bubble.width) / 2), top: clampY((view.height - bubble.height) / 2) };
  }
  const right = target.left + target.width + GAP;
  if (right + bubble.width <= view.width - EDGE) return { left: right, top: clampY(target.top) };
  const below = target.top + target.height + GAP;
  if (below + bubble.height <= view.height - EDGE) return { left: clampX(target.left + target.width - bubble.width), top: below };
  const left = target.left - GAP - bubble.width;
  if (left >= EDGE) return { left, top: clampY(target.top) };
  const above = target.top - GAP - bubble.height;
  if (above >= EDGE) return { left: clampX(target.left), top: above };
  return { left: clampX((view.width - bubble.width) / 2), top: clampY((view.height - bubble.height) / 2) };
}
