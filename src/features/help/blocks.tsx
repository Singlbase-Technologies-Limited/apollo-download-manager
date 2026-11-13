import { Fragment } from 'react';
import { cn } from '../../lib/cn';
import { domId } from './anchors';

/*
 * Typed blocks from Markdown (scripts/guide-lib.mjs), drawn as React elements: the in-app guide (#354) and the What's
 * new window (#496) share them. No HTML from a document is ever inserted.
 */

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'break' }
  | { type: 'strong' | 'em' | 'strike'; content: Inline[] }
  | { type: 'link'; to: { page: string; anchor?: string } | { url: string }; content: Inline[] };

export type Block =
  | { type: 'heading'; level: number; id: string; content: Inline[] }
  | { type: 'paragraph'; content: Inline[] }
  | { type: 'list'; ordered: boolean; items: Block[][] }
  | { type: 'quote'; content: Block[] }
  | { type: 'codeBlock'; text: string }
  | { type: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { type: 'rule' };

/** Where a link to a guide page goes; without it (What's new), such a link is shown as its text. */
export type Go = (page: string, anchor: string | null) => void;


export function Inlines({ content, go }: { content: Inline[]; go?: Go }) {
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
            if (!go) return <Fragment key={i}><Inlines content={n.content} /></Fragment>;
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

/** `headingIds`: whether headings get their element ids, which only the guide links to. */
export function Blocks({ blocks, go, headingIds = true }: { blocks: Block[]; go?: Go; headingIds?: boolean }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'heading': {
            const Tag = b.level <= 1 ? 'h1' : b.level === 2 ? 'h2' : b.level === 3 ? 'h3' : 'h4';
            const size = b.level === 1 ? 'mt-0 text-2xl' : b.level === 2 ? 'mt-7 text-lg' : 'mt-5 text-[15px]';
            return (
              <Tag key={i} id={headingIds ? domId(b.id) : undefined} tabIndex={headingIds ? -1 : undefined} className={cn('mb-2 font-semibold text-fg outline-none', size)}>
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
                  <li key={j} className="[&>p]:my-0"><Blocks blocks={item} go={go} headingIds={headingIds} /></li>
                ))}
              </Tag>
            );
          }
          case 'quote':
            return <blockquote key={i} className="my-3 rounded-md bg-surface-2 px-4 py-1 text-fg-muted"><Blocks blocks={b.content} go={go} headingIds={headingIds} /></blockquote>;
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
