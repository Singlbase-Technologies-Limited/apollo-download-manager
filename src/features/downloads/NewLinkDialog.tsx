import { useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Field';
import { Input } from '../../components/Input';
import { displayName } from '../../downloads/list';
import { api } from '../../lib/api';
import { toApiError } from '../../lib/errors';
import { useDownloadsStore } from '../../stores/downloads';
import { useUiStore } from '../../stores/ui';

/**
 * A new link for a download whose link expired (#466, PO decisions): the core checks it as an added link, and the
 * download continues from where it stopped. A file of another size is refused later, with every byte kept; the user
 * can start the link as a new download instead.
 */
export function NewLinkDialog() {
  const id = useUiStore((s) => s.newLinkId);
  const close = useUiStore((s) => s.closeNewLink);
  return id ? <NewLinkForm key={id} id={id} onClose={close} /> : null;
}

function NewLinkForm({ id, onClose }: { id: string; onClose: () => void }) {
  const download = useDownloadsStore((s) => s.snapshot?.downloads.find((d) => d.id === id));
  const openAdd = useUiStore((s) => s.openAdd);
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const trimmed = link.trim();

  const send = () => {
    setSending(true);
    setError(null);
    api
      .useNewLink(id, trimmed)
      .then(onClose)
      .catch((e: unknown) => { setError(toApiError(e).message); })
      .finally(() => { setSending(false); });
  };
  const startNew = () => {
    onClose();
    openAdd({ links: trimmed });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Use a new link"
      description={download ? `A fresh link for ${displayName(download)}, for example a new one from the browser. It continues from where it stopped.` : undefined}
      footer={
        <>
          <Button variant="ghost" disabled={sending || trimmed === ''} onClick={startNew}>Start as a new download</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={sending || trimmed === ''} onClick={send}>Continue with this link</Button>
        </>
      }
    >
      <Field label="New link" error={error}>
        {(props) => (
          <Input
            {...props}
            value={link}
            autoFocus
            spellCheck={false}
            placeholder="https://"
            onChange={(e) => { setLink(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && trimmed !== '' && !sending) send(); }}
          />
        )}
      </Field>
      <p className="mt-2 text-xs text-fg-muted">
        If the new link is for a file of another size, nothing is changed and the download says so. On another server, the
        download&apos;s login and custom headers aren&apos;t sent, and a saved login is deleted.
      </p>
    </Dialog>
  );
}
