import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Field';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import type { DownloadRecord } from '../../contract';
import { displayName, FINISHED } from '../../downloads/list';
import { keys, useCategories, useTorrentDetails } from '../../lib/queries';
import { RememberTrackers } from '../torrents/RememberTrackers';
import type { DownloadActions } from './useDownloadActions';

const NO_CATEGORY = '__none';
const KIB = 1024;

/** A whole number at or above `min`, or null. */
const wholeAtLeast = (text: string, min: number) => {
  const n = Number(text);
  return text.trim() !== '' && Number.isInteger(n) && n >= min ? n : null;
};

/**
 * A download's own settings (#349): its category, speed limit and connections, and a torrent's upload limit. The
 * details panel only shows them, so nothing is changed by accident (PO decision). Each opening starts from the saved
 * values; Save sends only what changed, Cancel sends nothing.
 */
export function EditDownloadDialog({ download: d, actions, onClose }: { download: DownloadRecord; actions: DownloadActions; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: categories } = useCategories();
  const torrent = d.kind === 'torrent' || d.kind === 'magnet';
  const finished = FINISHED.includes(d.status);
  const torrentDetails = useTorrentDetails(d.id, torrent);
  const savedKib = d.speedLimitBps === null ? 0 : Math.round(d.speedLimitBps / KIB);
  const savedUpload = torrentDetails.data ? Math.round(torrentDetails.data.uploadLimitBps / KIB) : null;

  const [category, setCategory] = useState(d.categoryId ?? NO_CATEGORY);
  const [speed, setSpeed] = useState(String(savedKib));
  const [connections, setConnections] = useState(String(d.requestedConnections ?? ''));
  const [upload, setUpload] = useState<string | null>(null);
  // `null` until changed: the saved value shows (#472).
  const [trackers, setTrackers] = useState<boolean | null>(null);

  const showsSpeed = !finished && d.status !== 'seeding';
  const showsConnections = !torrent && !finished;
  const showsUpload = torrent && !finished && d.status !== 'fetchingMetadata' && savedUpload !== null;
  const savedTrackers = torrent && torrentDetails.data ? torrentDetails.data.trackersSaved : null;
  const speedKib = wholeAtLeast(speed, 0);
  const wanted = wholeAtLeast(connections, 1);
  const uploadKib = upload === null ? savedUpload : wholeAtLeast(upload, 0);
  const invalid = (showsSpeed && speedKib === null) || (showsConnections && wanted === null) || (showsUpload && uploadKib === null);

  const save = () => {
    const chosen = category === NO_CATEGORY ? null : category;
    if (chosen !== d.categoryId) void actions.setCategory(d.id, chosen);
    if (showsSpeed && speedKib !== null && speedKib !== savedKib) void actions.setSpeedLimit(d.id, speedKib);
    if (showsConnections && wanted !== null && wanted !== d.requestedConnections) void actions.setConnections(d.id, wanted);
    if (showsUpload && uploadKib !== null && uploadKib !== savedUpload) {
      void actions.setUploadLimit(d.id, uploadKib).then(() => qc.invalidateQueries({ queryKey: keys.torrent(d.id) }));
    }
    if (savedTrackers !== null && trackers !== null && trackers !== savedTrackers) {
      void actions.rememberTrackers(d.id, trackers).then(() => qc.invalidateQueries({ queryKey: keys.torrent(d.id) }));
    }
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Edit download"
      description={displayName(d)}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={invalid} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Category">
          {(p) => <Select {...p} value={category} onValueChange={setCategory} options={[{ value: NO_CATEGORY, label: 'None' }, ...(categories ?? []).map((c) => ({ value: c.id, label: c.name }))]} />}
        </Field>
        {showsSpeed ? (
          <Field label="Speed limit (KiB/s)" hint="0 for no limit. The limit in Settings still applies to all downloads together.">
            {(p) => <Input {...p} type="number" min={0} inputMode="numeric" className="w-32" value={speed} onChange={(e) => { setSpeed(e.target.value); }} />}
          </Field>
        ) : null}
        {showsConnections ? (
          <Field label="Connections" hint="The most this download may use. A running download changes at once.">
            {(p) => <Input {...p} type="number" min={1} inputMode="numeric" className="w-24" value={connections} onChange={(e) => { setConnections(e.target.value); }} />}
          </Field>
        ) : null}
        {showsUpload ? (
          <Field label="Upload limit (KiB/s)" hint="0 for no limit.">
            {(p) => <Input {...p} type="number" min={0} inputMode="numeric" className="w-32" value={upload ?? String(savedUpload)} onChange={(e) => { setUpload(e.target.value); }} />}
          </Field>
        ) : null}
        {savedTrackers !== null ? <RememberTrackers checked={trackers ?? savedTrackers} onChange={setTrackers} /> : null}
      </div>
    </Dialog>
  );
}
