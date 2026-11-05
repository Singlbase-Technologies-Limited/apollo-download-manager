import type { ReactNode } from 'react';

/** A section heading of the details panel (#349): readable at a glance, not small grey capitals. */
export const SECTION_HEADING = 'text-[12.5px] font-semibold text-fg';

/** A titled group of rows, so the panel reads as sections (V1 #45, #349). */
export function DetailsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border px-4 py-3" aria-label={title}>
      <h3 className={SECTION_HEADING}>{title}</h3>
      <dl className="mt-1.5">{children}</dl>
    </section>
  );
}

/** One fact of a section: its label, and its value. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-2 py-1 text-xs">
      <dt className="text-fg-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-fg">{children}</dd>
    </div>
  );
}
