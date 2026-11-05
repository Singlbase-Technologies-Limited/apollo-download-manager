import { cn } from '../lib/cn';

/**
 * One look for every navigation item: the main navigation's and the Settings sections' (PO, 2026-11-06). The hover
 * tints the row with the accent, so it shows against the panel in both themes (PO, #347).
 */
export function navItemClass(active: boolean) {
  return cn(
    'group flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] transition-colors',
    active ? 'bg-surface-3 font-medium text-fg' : 'text-fg-muted hover:bg-accent-soft hover:text-fg',
  );
}

/** A group's title in a navigation, as the details panel's section titles read (PO, 2026-11-06). */
export const navGroupTitle = 'px-2.5 pb-1 text-[12.5px] font-semibold text-fg';
