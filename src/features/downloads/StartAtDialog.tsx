import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { StartAtFields } from '../../components/StartAtFields';
import { displayName } from '../../downloads/list';
import { api } from '../../lib/api';
import { nextFullHour } from '../../lib/format';
import { toApiError } from '../../lib/errors';
import { useDownloadsStore } from '../../stores/downloads';
import { useUiStore } from '../../stores/ui';

/**
 * Gives a waiting download its own start time, or takes it away (#350, PO decision: from the download's menu too). Its
 * own time beats the schedule's window, and a time already past starts it at once.
 */
export function StartAtDialog() {
  const id = useUiStore((s) => s.startAtId);
  const close = useUiStore((s) => s.closeStartAt);
  return id ? <StartAtForm key={id} id={id} onClose={close} /> : null;
}

function StartAtForm({ id, onClose }: { id: string; onClose: () => void }) {
  const download = useDownloadsStore((s) => s.snapshot?.downloads.find((d) => d.id === id));
  const own = download?.waitsUntil?.reason === 'chosenTime' ? download.waitsUntil.at : null;
  const [at, setAt] = useState(own ?? nextFullHour());
  const [sending, setSending] = useState(false);
  const send = (startAt: string | null) => {
    setSending(true);
    api
      .setStartAt(id, startAt)
      .then(onClose)
      .catch((e: unknown) => { toast.error(toApiError(e).message); })
      .finally(() => { setSending(false); });
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Start at"
      description={download ? `When ${displayName(download)} starts. Its own time comes before the schedule; a time already past starts it now.` : undefined}
      footer={
        <>
          {own ? <Button variant="ghost" disabled={sending} onClick={() => { send(null); }}>Clear the time</Button> : null}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={sending} onClick={() => { send(at); }}>Start at this time</Button>
        </>
      }
    >
      <StartAtFields value={at} onChange={setAt} disabled={sending} />
    </Dialog>
  );
}
