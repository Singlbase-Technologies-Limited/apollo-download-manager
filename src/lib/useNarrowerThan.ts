import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Whether the element behind the returned ref is narrower than `threshold` px, followed with a ResizeObserver. The
 * state changes only when the answer does, so a window being resized doesn't re-render on every pixel. Before the
 * first measurement, and where nothing is measured, it is not narrow.
 */
export function useNarrowerThan<T extends HTMLElement>(threshold: number): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setNarrow(width > 0 && width < threshold);
    });
    observer.observe(el);
    return () => { observer.disconnect(); };
  }, [threshold]);
  return [ref, narrow];
}
