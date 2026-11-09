import { File as FileIcon, Folder, Magnet } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '../../components/Badge';
import { CategoryGlyph } from '../../components/CategoryGlyph';
import { ProgressBar } from '../../components/ProgressBar';
import { COLUMN_MAX_WIDTH, COLUMN_MIN_WIDTH, type Category, type ColumnId, type DownloadRecord } from '../../contract';
import { CutOffText } from '../../components/CutOffText';
import { Tooltip } from '../../components/Tooltip';
import { STATUS_TONE, averageSpeedOf, displayName, etaSeconds, percentOf, statusHelp, statusLabel, type SortKey } from '../../downloads/list';
import { formatBytes, formatDuration, formatPercent, formatShortDate, formatSpeed, formatTransferredBytes } from '../../lib/format';

/** What a cell needs besides its download. */
export interface CellContext {
  category: Category | undefined;
  /** Now, in ms since the Unix epoch, for the retry countdown. */
  now: number;
  needsLogin: boolean;
  /** Settings' number of simultaneous downloads, when known, for the status help. */
  maxConcurrent?: number;
  /** The keyboard has moved to this row: its cut-off values show in full without a hover (#424). */
  keyboardFocus?: boolean;
}

/** The id of the hidden status help that describes a download's row (#424). */
export const statusHelpId = (id: string) => `status-help-${id}`;

export interface ColumnDef {
  id: ColumnId;
  label: string;
  /** Its CSS grid width until the user resizes it. */
  width: string;
  /** Narrowest useful width in px. */
  minWidth: number;
  align?: 'right';
  sort?: SortKey;
  render: (d: DownloadRecord, ctx: CellContext) => ReactNode;
}

const torrent = (d: DownloadRecord) => d.kind === 'torrent' || d.kind === 'magnet';

/** Moving data now, so a speed means something. */
const moving = (d: DownloadRecord) => d.status === 'downloading';

// V1's columns (src/features/downloads/columns.tsx), on V2's records. Speeds and times show only while they are real.
export const ALL_COLUMNS: readonly ColumnDef[] = [
  {
    id: 'name',
    label: 'Name',
    width: 'minmax(160px, 3fr)',
    minWidth: 160,
    sort: 'name',
    render: (d, { category, keyboardFocus }) => (
      <span className="flex min-w-0 items-center gap-2">
        {category ? (
          <CategoryGlyph icon={category.icon} color={category.color} className="size-4 shrink-0" />
        ) : (d.fileCount ?? 0) > 1 ? (
          // Without a category: a folder only for a torrent of several files (#313).
          <Folder className="size-4 shrink-0" aria-hidden />
        ) : (
          <FileIcon className="size-4 shrink-0" aria-hidden />
        )}
        <CutOffText text={displayName(d)} className="font-medium text-fg" showNow={keyboardFocus} />
        {torrent(d) ? (
          <Tooltip label="Torrent">
            <span className="flex shrink-0 items-center text-fg-subtle">
              <Magnet className="size-3.5" aria-hidden />
              <span className="sr-only">Torrent</span>
            </span>
          </Tooltip>
        ) : null}
      </span>
    ),
  },
  { id: 'size', label: 'Size', width: '84px', minWidth: 84, align: 'right', sort: 'size', render: (d) => formatBytes(d.progress.totalBytes) },
  { id: 'downloaded', label: 'Downloaded', width: '96px', minWidth: 96, align: 'right', render: (d) => formatTransferredBytes(d.progress.completedBytes) },
  {
    id: 'progress',
    label: 'Progress',
    width: 'minmax(100px, 1.2fr)',
    minWidth: 100,
    sort: 'progress',
    render: (d) => {
      const pct = percentOf(d);
      const animated = d.status === 'downloading' || d.status === 'connecting' || d.status === 'verifying' || d.status === 'fetchingMetadata';
      return (
        <span className="flex w-full items-center gap-2">
          <ProgressBar value={pct} tone={STATUS_TONE[d.status]} animated={animated} label={`${displayName(d)} progress`} className="flex-1" />
          <span className="w-10 text-right tabular-nums text-fg-muted">{formatPercent(pct)}</span>
        </span>
      );
    },
  },
  {
    id: 'speed',
    label: 'Speed',
    width: '88px',
    minWidth: 88,
    align: 'right',
    sort: 'speed',
    render: (d) => (moving(d) ? formatSpeed(d.progress.downloadSpeedBps) : d.status === 'seeding' ? `↑ ${formatSpeed(d.progress.uploadSpeedBps)}` : '—'),
  },
  { id: 'avgSpeed', label: 'Avg. speed', width: '88px', minWidth: 88, align: 'right', render: (d) => formatSpeed(averageSpeedOf(d)) },
  {
    id: 'eta',
    label: 'Time left',
    width: '80px',
    minWidth: 80,
    align: 'right',
    sort: 'eta',
    render: (d, { now }) => (d.status === 'retrying' && d.retryAtMs !== null ? formatDuration(Math.max(0, (d.retryAtMs - now) / 1000)) : formatDuration(etaSeconds(d))),
  },
  {
    id: 'status',
    label: 'Status',
    width: '132px',
    minWidth: 118,
    sort: 'status',
    // Hovering says what the status means and what to do (#424); the same text describes the row for screen readers.
    render: (d, { now, needsLogin, maxConcurrent }) => {
      const help = statusHelp(d, { needsLogin, maxConcurrent });
      return (
        <>
          <Tooltip label={help}>
            <span>
              <Badge tone={needsLogin ? 'warning' : STATUS_TONE[d.status]}>{statusLabel(d, now, { needsLogin })}</Badge>
            </span>
          </Tooltip>
          <span id={statusHelpId(d.id)} className="sr-only">
            {help}
          </span>
        </>
      );
    },
  },
  { id: 'category', label: 'Category', width: '104px', minWidth: 104, sort: 'category', render: (_d, { category, keyboardFocus }) => <CutOffText text={category?.name ?? '—'} showNow={keyboardFocus} /> },
  {
    id: 'destination',
    label: 'Destination',
    width: 'minmax(140px, 1.5fr)',
    minWidth: 140,
    render: (d, { keyboardFocus }) => <CutOffText text={d.directory} showNow={keyboardFocus} />,
  },
  { id: 'added', label: 'Added', width: '132px', minWidth: 132, sort: 'added', render: (d) => formatShortDate(d.createdAtMs) },
  { id: 'started', label: 'Started', width: '132px', minWidth: 132, render: (d) => formatShortDate(d.startedAtMs) },
  { id: 'completed', label: 'Completed', width: '132px', minWidth: 132, sort: 'completed', render: (d) => formatShortDate(d.completedAtMs) },
];

/** A dragged or keyed width, within the column's own minimum and the bound Rust checks. */
export function clampColumnWidth(c: Pick<ColumnDef, 'minWidth'>, px: number): number {
  return Math.round(Math.min(COLUMN_MAX_WIDTH, Math.max(COLUMN_MIN_WIDTH, c.minWidth, px)));
}

/** The chosen columns in their order, always with Name. */
export function columnsFor(ids: readonly ColumnId[]): ColumnDef[] {
  const chosen = ids.map((id) => ALL_COLUMNS.find((c) => c.id === id)).filter((c): c is ColumnDef => c !== undefined);
  const name = ALL_COLUMNS[0];
  return chosen.some((c) => c.id === 'name') || !name ? chosen : [name, ...chosen];
}
