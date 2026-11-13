import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { contentClass, overlayClass } from '../../components/dialogStyles';
import { useReturnFocus } from '../../components/returnFocus';
import { cn } from '../../lib/cn';
import { useUiStore } from '../../stores/ui';
import data from './guide.generated.json';

/*
 * The in-app user guide (#354, PO: layout A, contents on the left). Its pages are the user guides in docs/user/,
 * built into guide.generated.json by `pnpm guide` (scripts/guide-lib.mjs), so it works offline and says what the
 * website says. The data is typed blocks, drawn here as React elements: no HTML from the guides is ever inserted.
 */

type Inline =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'break' }
  | { type: 'strong' | 'em' | 'strike'; content: Inline[] }
  | { type: 'link'; to: { page: string; anchor?: string } | { url: string }; content: Inline[] };

type Block =
  | { type: 'heading'; level: number; id: string; content: Inline[] }
  | { type: 'paragraph'; content: Inline[] }
  | { type: 'list'; ordered: boolean; items: Block[][] }
  | { type: 'quote'; content: Block[] }
  | { type: 'codeBlock'; text: string }
  | { type: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { type: 'rule' };

interface Page {
  id: string;
  title: string;
  headings: { id: string; level: number; text: string }[];
  blocks: Block[];
  sections: { anchor: string; heading: string; text: string }[];
}

/** The generator always writes the index page first (scripts/guide-lib.mjs), so there is at least one page. */
const PAGES = (data as unknown as { pages: [Page, ...Page[]] }).pages;
/** The sidebar's groups, as docs/user/README.md sets them: the website shows the same ones (#488). */
const GROUPS = (data as unknown as { groups: { title: string; pages: string[] }[] }).groups.map((g) => ({
  title: g.title,
  pages: g.pages.map((id) => {
    const page = PAGES.find((p) => p.id === id);
    if (!page) throw new Error(`the guide's group ${g.title} lists a page it doesn't have: ${id}`);
    return page;
  }),
}));
const pageName = (p: Page) => (p.id === 'index' ? 'Introduction' : p.title);
const pageById = (id: string): Page => PAGES.find((p) => p.id === id) ?? PAGES[0];
/** A heading's element id: prefixed, so a guide anchor never clashes with the app's own ids. */
const domId = (anchor: string) => `guide-${anchor}`;

interface Result {
  page: Page;
  anchor: string;
  heading: string;
  snippet: string;
}

/** Sections whose heading or text holds every word of `query`, headings first. */
function search(query: string): Result[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const hits: (Result & { rank: number })[] = [];
  for (const page of PAGES) {
    for (const s of page.sections) {
      const heading = s.heading.toLowerCase();
      const text = s.text.toLowerCase();
      if (!words.every((w) => heading.includes(w) || text.includes(w))) continue;
      const at = text.indexOf(words[0] ?? '');
      const snippet = at < 0 ? s.text.slice(0, 120) : `${at > 40 ? '…' : ''}${s.text.slice(Math.max(0, at - 40), at + 80)}…`;
      hits.push({ page, anchor: s.anchor, heading: s.heading, snippet, rank: words.every((w) => heading.includes(w)) ? 0 : 1 });
    }
  }
  return hits.sort((a, b) => a.rank - b.rank).slice(0, 50);
}

function Inlines({ content, go }: { content: Inline[]; go: (page: string, anchor: string | null) => void }) {
  return (
    <>
      {content.map((n, i) => {
        switch (n.type) {
          case 'text':
            return <Fragment key={i}>{n.text}</Fragment>;
          case 'code':
            return <code key={i} className="rounded bg-surface-3 px-1 py-px font-mono text-[0.92em]">{n.text}</code>;
          case 'break':
            return <br key={i} />;
          case 'strong':
            return <strong key={i} className="font-semibold"><Inlines content={n.content} go={go} /></strong>;
          case 'em':
            return <em key={i}><Inlines content={n.content} go={go} /></em>;
          case 'strike':
            return <s key={i}><Inlines content={n.content} go={go} /></s>;
          case 'link':
            if ('url' in n.to) {
              // The app opens no web page from here: the address is shown to copy.
              return <span key={i}><Inlines content={n.content} go={go} /> (<span className="break-all font-mono text-[0.92em]">{n.to.url}</span>)</span>;
            }
            {
              const to = n.to;
              return (
                <a
                  key={i}
                  href={`#${domId(to.anchor ?? to.page)}`}
                  className="text-accent underline-offset-2 hover:underline"
                  onClick={(e) => { e.preventDefault(); go(to.page, to.anchor ?? null); }}
                >
                  <Inlines content={n.content} go={go} />
                </a>
              );
            }
        }
      })}
    </>
  );
}

function Blocks({ blocks, go }: { blocks: Block[]; go: (page: string, anchor: string | null) => void }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'heading': {
            const Tag = b.level <= 1 ? 'h1' : b.level === 2 ? 'h2' : b.level === 3 ? 'h3' : 'h4';
            const size = b.level === 1 ? 'mt-0 text-2xl' : b.level === 2 ? 'mt-7 text-lg' : 'mt-5 text-[15px]';
            return (
              <Tag key={i} id={domId(b.id)} tabIndex={-1} className={cn('mb-2 font-semibold text-fg outline-none', size)}>
                <Inlines content={b.content} go={go} />
              </Tag>
            );
          }
          case 'paragraph':
            return <p key={i} className="my-2.5"><Inlines content={b.content} go={go} /></p>;
          case 'list': {
            const Tag = b.ordered ? 'ol' : 'ul';
            return (
              <Tag key={i} className={cn('my-2.5 flex flex-col gap-1 pl-5', b.ordered ? 'list-decimal' : 'list-disc')}>
                {b.items.map((item, j) => (
                  <li key={j} className="[&>p]:my-0"><Blocks blocks={item} go={go} /></li>
                ))}
              </Tag>
            );
          }
          case 'quote':
            return <blockquote key={i} className="my-3 rounded-md bg-surface-2 px-4 py-1 text-fg-muted"><Blocks blocks={b.content} go={go} /></blockquote>;
          case 'codeBlock':
            return <pre key={i} className="my-3 overflow-x-auto rounded-md bg-surface-3 p-3 font-mono text-xs">{b.text}</pre>;
          case 'table':
            return (
              <div key={i} className="my-3 overflow-x-auto rounded-md border border-border">
                <table className="w-full border-collapse text-left text-[13px]">
                  <thead className="bg-surface-2">
                    <tr>{b.head.map((c, j) => <th key={j} scope="col" className="border-b border-border px-3 py-2 font-semibold"><Inlines content={c} go={go} /></th>)}</tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className="border-b border-border last:border-b-0">
                        {r.map((c, k) => <td key={k} className="px-3 py-2 align-top"><Inlines content={c} go={go} /></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'rule':
            return <hr key={i} className="my-5 border-border" />;
        }
      })}
    </>
  );
}

export function GuideView() {
  const at = useUiStore((s) => s.guide);
  const openGuide = useUiStore((s) => s.openGuide);
  const [query, setQuery] = useState('');
  const main = useRef<HTMLElement>(null);
  const page = pageById(at?.page ?? 'index');
  const index = PAGES.indexOf(page);
  const prev = index > 0 ? PAGES[index - 1] : undefined;
  const next = PAGES[index + 1];
  const results = useMemo(() => search(query), [query]);

  const go = (to: string, anchor: string | null) => {
    setQuery('');
    openGuide(to, anchor ?? undefined);
  };

  // A new page or heading: scroll to it and move focus there, so a screen reader reads on from it. A task later,
  // since this runs before the dialog's focus scope is set up, and a window under it (Settings) would take focus back.
  useEffect(() => {
    if (!at) return;
    const timer = setTimeout(() => {
      const target = at.anchor ? document.getElementById(domId(at.anchor)) : main.current?.querySelector<HTMLElement>('h1');
      if (at.anchor && target) target.scrollIntoView({ block: 'start' });
      else if (main.current) main.current.scrollTop = 0;
      target?.focus({ preventScroll: true });
    }, 0);
    return () => { clearTimeout(timer); };
  }, [at]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-surface-2 px-4">
        <DialogPrimitive.Title className="text-[13px] font-semibold">User guide</DialogPrimitive.Title>
        <span className="text-xs text-fg-subtle">Works offline</span>
        <DialogPrimitive.Close className="ml-auto flex size-7 items-center justify-center rounded-md text-fg-muted hover:bg-surface-3 hover:text-fg" aria-label="Close">
          <X className="size-4" aria-hidden />
        </DialogPrimitive.Close>
      </header>
      <div className="flex min-h-0 flex-1 flex-wrap">
        <nav aria-label="Guide contents" className="flex max-h-full w-full shrink-0 flex-col gap-0.5 overflow-y-auto border-border bg-surface-2 p-3 sm:w-64 sm:border-r">
          <label htmlFor="guide-search" className="mb-1 text-xs text-fg-muted">Search the guide</label>
          <input
            id="guide-search"
            type="search"
            autoComplete="off"
            value={query}
            placeholder="For example: proxy, schedule, SFTP"
            onChange={(e) => { setQuery(e.target.value); }}
            className="mb-2 h-8 rounded-md border border-border-strong bg-surface px-2.5 text-[13px] text-fg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {query.trim() !== '' ? (
            <>
              <p role="status" className="mb-1 text-xs text-fg-muted">{results.length === 0 ? 'No results' : `${String(results.length)} ${results.length === 1 ? 'result' : 'results'}`}</p>
              <ul aria-label="Search results" className="flex flex-col gap-0.5">
                {results.map((r) => (
                  <li key={`${r.page.id}#${r.anchor}`}>
                    <button type="button" className="w-full rounded-md px-2 py-1.5 text-left hover:bg-row-hover" onClick={() => { go(r.page.id, r.anchor); }}>
                      <span className="block text-[13px] font-medium text-fg">{r.page.title === r.heading ? r.heading : `${r.page.title} › ${r.heading}`}</span>
                      <span className="block text-xs text-fg-muted">{r.snippet}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            // The website's groups (#488): a small bold heading over each, which names its list for a screen reader.
            GROUPS.map((g, gi) => (
              <div key={g.title} className={cn(gi > 0 && 'mt-4')}>
                <p id={`guide-group-${String(gi)}`} className="mb-1 px-2 text-xs font-bold text-fg">{g.title}</p>
                <ul aria-labelledby={`guide-group-${String(gi)}`} className="flex flex-col gap-0.5">
                  {g.pages.map((p) => (
                    <li key={p.id} className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        aria-current={p.id === page.id ? 'page' : undefined}
                        className={cn('rounded-md px-2 py-1.5 text-left text-[13px]', p.id === page.id ? 'bg-row-selected font-semibold text-accent-strong' : 'text-fg hover:bg-row-hover')}
                        onClick={() => { go(p.id, null); }}
                      >
                        {pageName(p)}
                      </button>
                      {p.id === page.id
                        ? p.headings.filter((h) => h.level === 2).map((h) => (
                          <a key={h.id} href={`#${domId(h.id)}`} className="rounded-md py-1 pl-5 pr-2 text-xs text-fg-muted hover:bg-row-hover hover:text-fg" onClick={(e) => { e.preventDefault(); go(p.id, h.id); }}>
                            {h.text}
                          </a>
                        ))
                        : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </nav>
        <main ref={main} className="min-w-0 max-h-full flex-[999_1_32rem] overflow-y-auto px-6 py-6 sm:px-10">
          <article className="mx-auto max-w-[44rem] text-[13px] leading-relaxed text-fg">
            <Blocks blocks={page.blocks} go={go} />
          </article>
          <nav aria-label="Pages" className="mx-auto mt-8 flex max-w-[44rem] justify-between gap-4 border-t border-border pt-4">
            {prev ? (
              <button type="button" className="flex items-center gap-1 text-left text-[13px] text-accent hover:underline" aria-label={`Previous: ${prev.title}`} onClick={() => { go(prev.id, null); }}>
                <ChevronLeft className="size-4" aria-hidden /> {pageName(prev)}
              </button>
            ) : <span />}
            {next ? (
              <button type="button" className="flex items-center gap-1 text-right text-[13px] text-accent hover:underline" aria-label={`Next: ${next.title}`} onClick={() => { go(next.id, null); }}>
                {next.title} <ChevronRight className="size-4" aria-hidden />
              </button>
            ) : null}
          </nav>
        </main>
      </div>
    </div>
  );
}

/**
 * The user guide in a window over the app, as Settings is (#364): Close, Escape or a click outside closes it. Focus
 * goes to the page's title or the heading it opened at (GuideView), not to the first button, as Radix would do.
 */
export function GuideDialog(): ReactNode {
  const open = useUiStore((s) => s.guide !== null);
  const close = useUiStore((s) => s.closeGuide);
  const returnFocus = useReturnFocus(open);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClass} />
        <DialogPrimitive.Content className={cn(contentClass, 'h-[calc(100vh-6rem)] max-h-none w-[min(72rem,calc(100vw-2rem))] max-w-none overflow-hidden p-0')} aria-describedby={undefined} onOpenAutoFocus={(e) => { e.preventDefault(); }} {...returnFocus}>
          {open ? <GuideView /> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
