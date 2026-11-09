import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { Tooltip } from './Tooltip';

/**
 * A line of text that ends in "…" when it doesn't fit, and then shows itself in full in the window's tooltip on
 * hover (#424). A text that fits shows no tooltip, so short names don't get pointless ones. Whether it is cut off is
 * measured only when the tooltip would open, never on every render, so a long list stays fast. `showNow` shows it
 * without a hover, for a row the keyboard has reached; it still shows only when the text is cut off.
 */
export function CutOffText({ text, className, showNow = false }: { text: string; className?: string; showNow?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [shownNow, setShownNow] = useState(false);
  const cutOff = () => {
    const el = ref.current;
    return el !== null && el.scrollWidth > el.clientWidth;
  };
  // Measured once each time the keyboard arrives or leaves, after layout, not on every render.
  useEffect(() => {
    const measure = setTimeout(() => { setShownNow(showNow && cutOff()); }, 0);
    return () => { clearTimeout(measure); };
  }, [showNow, text]);
  return (
    <Tooltip label={text} open={open || shownNow} onOpenChange={(next) => { setOpen(next && cutOff()); if (!next) setShownNow(false); }}>
      <span ref={ref} className={cn('truncate', className)}>
        {text}
      </span>
    </Tooltip>
  );
}
