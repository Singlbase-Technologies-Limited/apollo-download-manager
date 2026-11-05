import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ReactElement, ReactNode } from 'react';

/**
 * The window's one tooltip (#348 H), in place of the browser's own `title` tooltips: it follows the theme,
 * opens after a short pause on hover and at once on keyboard focus, and closes on Escape. The trigger keeps
 * its own accessible name (`aria-label`); the tooltip only describes it. It appears without animation, so
 * reduced motion needs nothing more. `TooltipProvider` is mounted once, in `App`.
 */
export function TooltipProvider({ children }: { children: ReactNode }) {
  // A short pause before the first tooltip; moving on to the next one shows it at once.
  return (
    <TooltipPrimitive.Provider delayDuration={400} skipDelayDuration={300}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export function Tooltip({
  label,
  shortcut,
  side = 'top',
  children,
}: {
  label: string;
  /** Shown beside the label, as the menus show theirs, e.g. "Ctrl+N". */
  shortcut?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** One element that takes a ref and focus, usually a button. */
  children: ReactElement;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="z-50 flex max-w-72 select-none items-center gap-2 rounded-md bg-fg px-2 py-1 text-xs text-bg shadow-panel"
        >
          <span>{label}</span>
          {shortcut ? <span className="text-[11px] opacity-70">{shortcut}</span> : null}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
