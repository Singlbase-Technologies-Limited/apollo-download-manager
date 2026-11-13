import { Check, Power } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { DropdownMenu, type MenuSpec } from '../../components/Menu';
import type { DownloadRecord, DownloadStatus, FinishAction } from '../../contract';
import { api } from '../../lib/api';
import { toApiError } from '../../lib/errors';
import { useDownloadsStore } from '../../stores/downloads';

/** What happens once the downloads finish (#467): nothing, the computer sleeps or shuts down, or the app closes. */
type Choice = 'nothing' | FinishAction | 'close';

const LABELS: Record<Choice, string> = { nothing: 'Do nothing', sleep: 'Sleep', shutDown: 'Shut down', close: 'Close Apollo Download Manager' };
const DOING: Record<Exclude<Choice, 'nothing'>, string> = { sleep: 'put the computer to sleep', shutDown: 'shut down the computer', close: 'close' };
const NOW: Record<Exclude<Choice, 'nothing'>, string> = { sleep: 'Sleep now', shutDown: 'Shut down now', close: 'Close now' };

/** The seconds the user has to change their mind (#467). */
export const COUNTDOWN_SECONDS = 60;

/** Statuses that still have work to do. Paused, failed, seeding and choosing-files downloads wait for the user, so they don't. */
const UNFINISHED: ReadonlySet<DownloadStatus> = new Set(['queued', 'connecting', 'downloading', 'verifying', 'retrying', 'stalled', 'fetchingMetadata', 'waitingForNetwork']);

const unfinished = (downloads: readonly DownloadRecord[] | undefined) => (downloads ?? []).some((d) => UNFINISHED.has(d.status));

/**
 * The status bar's "When downloads finish" choice and its countdown (#467). It acts once, when downloads that were running
 * have all finished, after a minute the user can cancel, and then goes back to doing nothing.
 */
export function WhenFinished() {
  const [choice, setChoice] = useState<Choice>('nothing');
  const [left, setLeft] = useState<number | null>(null);

  // Downloads that were running and have all finished start the countdown; one starting again stops it.
  useEffect(() => {
    if (choice === 'nothing') return undefined;
    return useDownloadsStore.subscribe((now, before) => {
      const busy = unfinished(now.snapshot?.downloads);
      if (busy) setLeft(null);
      else if (unfinished(before.snapshot?.downloads)) setLeft(COUNTDOWN_SECONDS);
    });
  }, [choice]);

  const act = (what: Exclude<Choice, 'nothing'>) => {
    setLeft(null);
    setChoice('nothing');
    const done = what === 'close' ? api.quit() : api.finishDownloads(what);
    done.catch((e: unknown) => { toast.error(toApiError(e).message); });
  };

  useEffect(() => {
    if (left === null || choice === 'nothing') return undefined;
    const what = choice;
    const timer = window.setTimeout(() => {
      if (left <= 1) act(what);
      else setLeft(left - 1);
    }, 1000);
    return () => { window.clearTimeout(timer); };
  });

  const items: MenuSpec = (Object.keys(LABELS) as Choice[]).map((c) => ({
    label: LABELS[c],
    icon: c === choice ? <Check /> : <span className="size-4" />,
    onSelect: () => {
      setChoice(c);
      setLeft(null);
    },
  }));
  const label = `When downloads finish: ${LABELS[choice]}`;
  const counting = left !== null && choice !== 'nothing' ? choice : null;

  return (
    <>
      <DropdownMenu
        align="start"
        items={items}
        trigger={
          <button type="button" aria-label={label} className="flex items-center gap-1 rounded px-1 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent">
            <Power className={choice === 'nothing' ? 'size-3.5' : 'size-3.5 text-accent'} aria-hidden />
            {choice === 'nothing' ? null : <span>{`Then: ${LABELS[choice]}`}</span>}
          </button>
        }
      />
      {counting ? (
        <Dialog
          open
          onOpenChange={(o) => {
            if (!o) {
              setLeft(null);
              setChoice('nothing');
            }
          }}
          title="Downloads finished"
          footer={
            <>
              <Button variant="ghost" onClick={() => { setLeft(null); setChoice('nothing'); }}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => { act(counting); }}>
                {NOW[counting]}
              </Button>
            </>
          }
        >
          <p className="text-[13px]" aria-live="polite">{`All downloads have finished. Apollo Download Manager will ${DOING[counting]} in ${String(left)} seconds.`}</p>
        </Dialog>
      ) : null}
    </>
  );
}
