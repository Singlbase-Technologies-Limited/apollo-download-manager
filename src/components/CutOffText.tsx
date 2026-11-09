import { useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { Tooltip } from './Tooltip';

/**
 * A line of text that ends in "…" when it doesn't fit, and then shows itself in full in the window's tooltip on
 * hover (#424). A text that fits shows no tooltip, so short names don't get pointless ones. Whether it is cut off is
 * measured only when the tooltip would open, never on every render, so a long list stays fast.
 */
export function CutOffText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const cutOff = () => {
    const el = ref.current;
    return el !== null && el.scrollWidth > el.clientWidth;
  };
  return (
    <Tooltip label={text} open={open} onOpenChange={(next) => { setOpen(next && cutOff()); }}>
      <span ref={ref} className={cn('truncate', className)}>
        {text}
      </span>
    </Tooltip>
  );
}
