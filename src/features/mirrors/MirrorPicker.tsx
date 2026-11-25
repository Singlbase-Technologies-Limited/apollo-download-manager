import { useState } from 'react';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { Input } from '../../components/Input';
import { Spinner } from '../../components/Spinner';
import { MAX_MIRRORS, type MirrorCandidate } from '../../contract';
import { api } from '../../lib/api';
import { toApiError } from '../../lib/errors';
import { PROJECT_NAMES } from './projects';

const where = (c: MirrorCandidate) => (c.source.kind === 'announced' ? 'Named by the server' : `${PROJECT_NAMES[c.source.project]} list`);

/** A typed mirror the core will check again: here only that it is an `http`, `https` or `ftp` link. */
const looksLikeMirror = (s: string) => /^(https?|ftp):\/\/[^/\s]+/i.test(s);

/**
 * Mirrors for one link (#324, PO decisions): the ones its server announced, the ones its project's official list has,
 * fetched only when the user clicks "Find mirrors", and ones the user pastes; at most 8 chosen. The core checks each, and
 * the engine uses one only if it serves the same file.
 */
export function MirrorPicker({
  link,
  chosen,
  onChange,
  announced = [],
  disabled = false,
}: {
  link: string;
  chosen: string[];
  onChange: (chosen: string[]) => void;
  announced?: MirrorCandidate[];
  disabled?: boolean;
}) {
  const [found, setFound] = useState<MirrorCandidate[] | null>(null);
  const [looking, setLooking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [typed, setTyped] = useState('');

  const find = () => {
    setLooking(true);
    setProblem(null);
    api
      .findMirrors(link)
      .then((list) => {
        setFound(list);
        if (list.length === 0) setProblem('The official list has no other mirror for this file.');
      })
      .catch((e: unknown) => {
        const error = toApiError(e);
        setProblem(
          error.code === 'NOT_FOUND'
            ? 'This link isn’t on a server whose project list Apollo DM reads: Ubuntu, Debian, Fedora, Apache, Arch Linux, Linux Mint, openSUSE or GNU.'
            : error.code === 'IO'
              ? 'The mirror list couldn’t be fetched. Check your connection and try again.'
              : error.message,
        );
      })
      .finally(() => { setLooking(false); });
  };

  const offered: MirrorCandidate[] = [...announced, ...(found ?? [])].filter((c, i, all) => all.findIndex((o) => o.url === c.url) === i);
  const typedOnes = chosen.filter((url) => !offered.some((c) => c.url === url));
  const full = chosen.length >= MAX_MIRRORS;
  const toggle = (url: string, on: boolean) => { onChange(on ? [...chosen, url] : chosen.filter((u) => u !== url)); };
  const addTyped = () => {
    const url = typed.trim();
    if (!looksLikeMirror(url) || chosen.includes(url) || full) return;
    onChange([...chosen, url]);
    setTyped('');
  };

  return (
    <section aria-label="Mirrors" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={disabled || looking} onClick={find}>
          {looking ? <Spinner /> : null}
          {found === null ? 'Find mirrors' : 'Find again'}
        </Button>
        <span className="text-xs text-fg-muted" aria-live="polite">
          {looking ? 'Reading the official mirror list…' : `${String(chosen.length)} of ${String(MAX_MIRRORS)} chosen`}
        </span>
      </div>
      {problem ? <p role="status" className="text-xs text-fg-muted">{problem}</p> : null}
      {offered.length + typedOnes.length > 0 ? (
        <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-border p-2">
          {[...offered.map((c) => ({ url: c.url, note: `${where(c)}${c.country ? ` · ${c.country}` : ''}` })), ...typedOnes.map((url) => ({ url, note: 'Added by you' }))].map(({ url, note }) => {
            const on = chosen.includes(url);
            return (
              <li key={url}>
                <Checkbox checked={on} disabled={disabled || (!on && full)} onChange={(v) => { toggle(url, v); }}>
                  <span className="min-w-0 flex-1 truncate" title={url}>{url}</span>
                  <span className="shrink-0 text-fg-subtle">{note}</span>
                </Checkbox>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="flex items-center gap-2">
        <Input
          aria-label="A mirror’s link"
          className="flex-1"
          value={typed}
          disabled={disabled || full}
          spellCheck={false}
          placeholder="https:// — a mirror of the same file"
          onChange={(e) => { setTyped(e.target.value); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTyped(); } }}
        />
        <Button size="sm" variant="secondary" disabled={disabled || full || !looksLikeMirror(typed.trim())} onClick={addTyped}>Add</Button>
      </div>
      <p className="text-xs text-fg-subtle">A mirror is used only if it serves exactly the same file.</p>
    </section>
  );
}
