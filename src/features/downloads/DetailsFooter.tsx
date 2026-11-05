import { Copy, FileSearch, FolderOpen, ListChecks, MoreHorizontal, Pause, Play, Radio, RotateCcw, SlidersHorizontal, UploadCloud, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../../components/Button';
import { DropdownMenu, type MenuSpec } from '../../components/Menu';
import { Tooltip } from '../../components/Tooltip';
import type { DownloadRecord } from '../../contract';
import { actionsFor, canOpenFile, FINISHED } from '../../downloads/list';
import { useSwarm } from '../../lib/queries';
import { useUiStore } from '../../stores/ui';
import type { DownloadActions } from './useDownloadActions';

interface MainAction {
  label: string;
  icon: ReactNode;
  run: () => void;
}

/** The one action that fits the download's state, shown first (#349); none for a download nothing can move on. */
function mainAction(d: DownloadRecord, actions: DownloadActions, chooseFiles: (id: string) => void): MainAction | null {
  const can = actionsFor(d);
  const confirm = d.status === 'failed' ? d.error?.confirm : null;
  // The user's answer, for this download only (#67): a plain retry would only stop at the same place.
  if (confirm) return { label: confirm.kind === 'insecureRedirect' ? 'Continue over http' : 'Download anyway', icon: <RotateCcw />, run: () => void actions.allow(d.id, confirm.kind) };
  if (d.status === 'choosingFiles') return { label: 'Choose files…', icon: <ListChecks />, run: () => { chooseFiles(d.id); } };
  if (can.retry) return { label: 'Retry', icon: <RotateCcw />, run: () => void actions.retry([d.id]) };
  if (can.resume) return { label: 'Resume', icon: <Play />, run: () => void actions.resume([d.id]) };
  if (canOpenFile(d)) return { label: 'Open file', icon: <FileSearch />, run: () => void actions.openFile(d) };
  if (can.pause) return { label: 'Pause', icon: <Pause />, run: () => void actions.pause([d.id]) };
  return null;
}

/**
 * The details panel's actions (#349), and only here: the sections above only show. The action that fits the state
 * comes first, then Open folder and Edit…; the rest is in the menu, so nothing wraps in a narrow panel.
 */
export function DetailsFooter({ d, actions, busy, onEdit }: { d: DownloadRecord; actions: DownloadActions; busy: boolean; onEdit: () => void }) {
  const chooseFiles = useUiStore((s) => s.openChooseFiles);
  const torrent = d.kind === 'torrent' || d.kind === 'magnet';
  const live = torrent && !FINISHED.includes(d.status);
  // Shared with the torrent section's query: Re-announce needs the helper to have the torrent.
  const { trackers } = useSwarm(d.id, live);
  const can = actionsFor(d);
  const main = mainAction(d, actions, chooseFiles);
  const queued = d.torrent?.seedQueued === true;

  const menu: MenuSpec = [
    { label: 'Copy link', icon: <Copy />, onSelect: () => void actions.copyLink(d) },
    ...(main?.label !== 'Pause' && can.pause && !can.stopSeeding ? [{ label: 'Pause', icon: <Pause />, disabled: busy, onSelect: () => void actions.pause([d.id]) }] : []),
    ...(can.stopSeeding ? [{ label: queued ? 'Leave seeding queue' : 'Stop seeding', icon: <UploadCloud />, disabled: busy, onSelect: () => void actions.stopSeeding([d.id]) }] : []),
    ...(live && trackers.isSuccess && d.status !== 'paused' ? [{ label: 'Re-announce', icon: <Radio />, disabled: busy, onSelect: () => void actions.reannounce(d.id) }] : []),
    'separator' as const,
    { label: 'Remove from list…', icon: <X />, destructive: true, disabled: busy, onSelect: () => void actions.remove([d]) },
  ];

  return (
    <div role="group" aria-label="Actions for this download" className="flex items-center gap-1.5 border-t border-border-strong bg-surface px-3 py-2.5">
      {main ? (
        <Button size="sm" variant="primary" disabled={busy} onClick={main.run}>
          {main.icon} {main.label}
        </Button>
      ) : null}
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => void actions.openFolder(d.id)}>
        <FolderOpen /> Open folder
      </Button>
      <Button size="sm" variant="secondary" onClick={onEdit}>
        <SlidersHorizontal /> Edit…
      </Button>
      <div className="flex-1" />
      <DropdownMenu
        trigger={
          <Tooltip label="More actions">
            <Button size="icon-sm" variant="ghost" aria-label="More actions for this download">
              <MoreHorizontal />
            </Button>
          </Tooltip>
        }
        items={menu}
      />
    </div>
  );
}
