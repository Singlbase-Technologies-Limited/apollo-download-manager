import { X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ProgressBar } from '../../components/ProgressBar';
import { ConnectionLine } from '../../ConnectionLine';
import { PANEL } from '../../layout/panel';
import { cn } from '../../lib/cn';
import type { Verification } from '../../contract';
import { averageSpeedOf, displayName, etaSeconds, nextTry, percentOf, RUNNING, STATUS_TONE, statusLabel } from '../../downloads/list';
import { formatDuration, formatPercent, formatShortDate, formatSpeed, formatTransferred } from '../../lib/format';
import { shortenPath, shortenUrl } from '../../lib/shorten';
import { useDownloadsStore } from '../../stores/downloads';
import { TorrentSection } from '../torrents/TorrentSection';
import { EditDownloadDialog } from './EditDownloadDialog';
import { DetailsFooter } from './DetailsFooter';
import { CopyableValue } from './CopyableValue';
import { DetailsGroup, Row } from './detailsParts';
import { ErrorNotice } from './ErrorNotice';
import type { DownloadActions } from './useDownloadActions';

/** Set by the shell from the saved width, fitted to the window. */
const PANEL_WIDTH = { width: 'var(--details-w, 20rem)' };

const VERIFICATION: Record<Verification, string> = {
  verified: 'Verified: its checksum matched',
  sizeVerified: 'Every byte arrived and the size matched; no checksum was given',
  notVerified: 'Not verified: it resumed without a way to tell the server’s file hadn’t changed',
};

function Shell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <aside id="details-panel" aria-label="Download details" className={cn(PANEL, 'flex min-w-0 shrink-0 flex-col items-center justify-center gap-3 bg-surface p-6 text-center text-xs text-fg-muted')} style={PANEL_WIDTH}>
      {children}
      <Button size="sm" onClick={onClose}>
        Close
      </Button>
    </aside>
  );
}

interface Props {
  id: string;
  /** The search or filter hides it from the list. */
  hidden: boolean;
  actions: DownloadActions;
  busy: boolean;
  needsLogin: boolean;
  now: number;
  onClose: () => void;
}

/**
 * The details of one download (V1's DetailsPanel, #61). Everything comes from the live snapshot, so switching rows shows
 * the new download at once and no late answer can show another; only what the engines report is shown.
 */
export function DetailsPanel({ id, hidden, actions, busy, needsLogin, now, onClose }: Props) {
  const d = useDownloadsStore((s) => s.snapshot?.downloads.find((x) => x.id === id));
  // A download's own settings are changed in a dialog: the panel only shows them (#349).
  const [editing, setEditing] = useState(false);

  if (!d) return <Shell onClose={onClose}>This download is no longer in the list.</Shell>;

  const torrent = d.kind === 'torrent' || d.kind === 'magnet';
  const pct = d.status === 'completed' || d.status === 'seeding' ? 100 : percentOf(d);


  const sized = d.status === 'choosingFiles' && d.progress.totalBytes === null;
  const summary = [
    // Before the choice, its size is unknown, which isn't "0 B of unknown size" (#276).
    sized ? 'Files not chosen yet' : formatTransferred(d.progress.completedBytes, d.progress.totalBytes),
    d.status === 'downloading' ? formatSpeed(d.progress.downloadSpeedBps) : null,
    d.status === 'downloading' && etaSeconds(d) !== null ? `${formatDuration(etaSeconds(d))} left` : null,
  ].filter((x) => x !== null);

  return (
    // The panel stands apart from the list: its sections on their own ground, between a white header and footer (#349).
    <aside id="details-panel" aria-label="Download details" className={cn(PANEL, 'flex min-w-0 shrink-0 flex-col bg-surface-2')} style={PANEL_WIDTH}>
      <div className="border-b border-border-strong bg-surface px-4 pb-3 pt-3">
        <div className="flex items-start gap-2">
          <h2 className="line-clamp-2 min-w-0 flex-1 break-all text-[14px] font-semibold leading-snug">{displayName(d)}</h2>
          <Button variant="ghost" size="icon-sm" className="-mr-1.5 -mt-0.5" aria-label="Close details" onClick={onClose}>
            <X />
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Badge tone={STATUS_TONE[d.status]}>{statusLabel(d, now, { needsLogin })}</Badge>
          <span className="ml-auto text-xl font-semibold tabular-nums">{formatPercent(pct)}</span>
        </div>
        <ProgressBar value={pct} tone={STATUS_TONE[d.status]} animated={d.status === 'downloading'} label="Progress" className="mt-2" />
        <p className="mt-1.5 text-xs tabular-nums text-fg-muted">{summary.join(' · ')}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {hidden || d.startedOver || d.error ? (
          <div className="space-y-3 px-4 pt-3">
            {hidden ? (
              <p role="status" className="rounded-md bg-surface px-3 py-2 text-xs text-fg-muted">
                This download is hidden by the search or filter. It stays here until you choose another.
              </p>
            ) : null}
            {d.startedOver ? (
              // The bytes it had were dropped: never silently, and with why (#257).
              <p role="status" className="min-w-0 break-words rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
                {d.startedOver}
              </p>
            ) : null}
            {/* Its actions (Retry, Allow) are in the footer, with the rest (#349). */}
            {d.error ? <ErrorNotice error={d.error} /> : null}
          </div>
        ) : null}

        <div className="mt-3 [&>section:first-child]:border-t-0">
          <DetailsGroup title="Transfer">
            {d.status === 'downloading' ? <Row label="Speed">{formatSpeed(d.progress.downloadSpeedBps)}</Row> : null}
            <Row label="Average speed">{formatSpeed(averageSpeedOf(d))}</Row>
            {d.status === 'downloading' ? <Row label="Time left">{formatDuration(etaSeconds(d))}</Row> : null}
            {torrent ? null : (
              <Row label="Connections">
                {/* What held its connections back while it ran says nothing once it stopped. */}
                {RUNNING.includes(d.status) ? <ConnectionLine active={d.progress.connections} detail={d.progress.connectionDetail} /> : <ConnectionLine active={0} detail={null} />}
              </Row>
            )}
            {nextTry(d, now) !== null ? <Row label="Next try">{nextTry(d, now)}</Row> : null}
            {d.verification ? <Row label="Verification">{VERIFICATION[d.verification]}</Row> : null}
          </DetailsGroup>

          {torrent ? <TorrentSection d={d} actions={actions} busy={busy} /> : null}

          <DetailsGroup title="Source and destination">
            <Row label="Link">
              <CopyableValue value={d.sourceUrl} shown={shortenUrl(d.sourceUrl)} what="Link" />
            </Row>
            <Row label="Folder">
              <CopyableValue value={d.directory} shown={shortenPath(d.directory)} what="Folder" />
            </Row>
            <Row label="File">{d.fileName ?? 'Named by the server once it answers'}</Row>
          </DetailsGroup>

          {/* Only the moments it has reached (#349): no "—" for a start that hasn't happened. */}
          <DetailsGroup title="Timeline">
            <Row label="Added">{formatShortDate(d.createdAtMs)}</Row>
            {d.startedAtMs !== null ? <Row label="Started">{formatShortDate(d.startedAtMs)}</Row> : null}
            {d.completedAtMs !== null ? <Row label="Completed">{formatShortDate(d.completedAtMs)}</Row> : null}
          </DetailsGroup>
        </div>
      </div>

      <DetailsFooter d={d} actions={actions} busy={busy} onEdit={() => { setEditing(true); }} />
      {editing ? <EditDownloadDialog key={d.id} download={d} actions={actions} onClose={() => { setEditing(false); }} /> : null}
    </aside>
  );
}
