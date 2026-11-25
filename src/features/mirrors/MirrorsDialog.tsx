import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import type { DownloadMirrors } from '../../contract';
import { displayName } from '../../downloads/list';
import { api } from '../../lib/api';
import { toApiError } from '../../lib/errors';
import { useDownloadsStore } from '../../stores/downloads';
import { useUiStore } from '../../stores/ui';
import { MirrorPicker } from './MirrorPicker';
import { PROJECT_NAMES } from './projects';

/**
 * A download's mirrors (#324): the ones it uses, the ones its server announced, and its project's official list on
 * request. They change while it isn't running; a paused or failed one continues from where it stopped with them.
 */
export function MirrorsDialog() {
  const id = useUiStore((s) => s.mirrorsId);
  const close = useUiStore((s) => s.closeMirrors);
  return id ? <MirrorsForm key={id} id={id} onClose={close} /> : null;
}

function MirrorsForm({ id, onClose }: { id: string; onClose: () => void }) {
  const download = useDownloadsStore((s) => s.snapshot?.downloads.find((d) => d.id === id));
  const [mirrors, setMirrors] = useState<DownloadMirrors | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .downloadMirrors(id)
      .then((m) => { if (live) { setMirrors(m); setChosen(m.chosen); } })
      .catch((e: unknown) => { if (live) setError(toApiError(e).message); });
    return () => { live = false; };
  }, [id]);

  const save = () => {
    setSaving(true);
    setError(null);
    api
      .setMirrors(id, chosen)
      .then(onClose)
      .catch((e: unknown) => { setError(toApiError(e).message); })
      .finally(() => { setSaving(false); });
  };

  const changeable = mirrors?.changeable ?? false;
  const unchanged = mirrors !== null && JSON.stringify(mirrors.chosen) === JSON.stringify(chosen);
  return (
    <Dialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Mirrors"
      description={download ? `Other servers for ${displayName(download)}. It downloads from its own link and the mirrors you choose.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!changeable || saving || unchanged} onClick={save}>Use these mirrors</Button>
        </>
      }
    >
      {mirrors === null && error === null ? <p className="text-xs text-fg-muted">Loading…</p> : null}
      {mirrors !== null && !changeable ? (
        <p role="status" className="mb-2 text-xs text-fg-muted">Pause the download to change its mirrors; it continues from where it stopped.</p>
      ) : null}
      {mirrors !== null && download ? (
        <>
          {mirrors.official ? <p className="mb-2 text-xs text-fg-muted">{PROJECT_NAMES[mirrors.official]} publishes an official mirror list for this file.</p> : null}
          <MirrorPicker link={download.sourceUrl} chosen={chosen} onChange={setChosen} announced={mirrors.announced} disabled={!changeable} />
        </>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-xs text-danger">{error}</p> : null}
    </Dialog>
  );
}
