import { AlertCircle, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Clock3, Layers, PanelLeftClose, Plus, type LucideIcon } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { CategoryGlyph } from '../components/CategoryGlyph';
import { Tooltip } from '../components/Tooltip';
import type { AppInfo } from '../contract';
import { countByView, type ListView } from '../downloads/views';
import { PANEL } from '../layout/panel';
import { cn } from '../lib/cn';
import { useCategories } from '../lib/queries';
import { useDownloadsStore } from '../stores/downloads';
import { useUiStore } from '../stores/ui';

const LIST_ITEMS: { view: ListView; label: string; icon: LucideIcon }[] = [
  { view: 'all', label: 'All Downloads', icon: Layers },
  { view: 'downloading', label: 'Downloading', icon: ArrowDownToLine },
  { view: 'queued', label: 'Queued', icon: Clock3 },
  { view: 'completed', label: 'Completed', icon: CheckCircle2 },
  { view: 'seeding', label: 'Seeding', icon: ArrowUpFromLine },
  { view: 'failed', label: 'Failed', icon: AlertCircle },
];

function NavButton({ active, icon: Icon, label, count, onClick, children }: { active: boolean; icon?: LucideIcon; label: string; count?: number; onClick: () => void; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] transition-colors',
        // The hover tints the row with the accent, so it shows against the sidebar in both themes (PO, #347).
        active ? 'bg-surface-3 font-medium text-fg' : 'text-fg-muted hover:bg-accent-soft hover:text-fg',
      )}
    >
      {Icon ? <Icon className={cn('size-4 shrink-0', active ? 'text-accent' : 'text-fg-subtle group-hover:text-accent')} aria-hidden /> : children}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 ? <span className="text-[11px] tabular-nums text-fg-subtle">{count}</span> : null}
    </button>
  );
}

const groupLabel = 'px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle';

/**
 * The lists panel beside the icon bar (#363): Add download, the download lists and the categories. Its width comes
 * from the shell (`--sidebar-w`). Collapsed, it isn't shown: the icon bar's Downloads button, or a drag of its edge,
 * brings it back. The logo is no longer here: only on the loader, the first-run screens and the title bar.
 */
export function Sidebar({ app, autoCompact }: { app: AppInfo; autoCompact: boolean }) {
  const view = useUiStore((s) => s.view);
  const categoryFilter = useUiStore((s) => s.categoryFilter);
  const setView = useUiStore((s) => s.setView);
  const setCategoryFilter = useUiStore((s) => s.setCategoryFilter);
  const setLayout = useUiStore((s) => s.setLayout);
  const openAdd = useUiStore((s) => s.openAdd);
  const downloads = useDownloadsStore((s) => s.snapshot?.downloads);
  const { data: categories } = useCategories();
  const counts = useMemo(() => countByView(downloads ?? []), [downloads]);
  const perCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of downloads ?? []) if (d.categoryId) m.set(d.categoryId, (m.get(d.categoryId) ?? 0) + 1);
    return m;
  }, [downloads]);

  return (
    <nav id="app-sidebar" aria-label="Primary" className={cn(PANEL, 'flex shrink-0 flex-col bg-sidebar')} style={{ width: 'var(--sidebar-w)' }}>
      {/* The button stays put while the list below it scrolls; a line marks where the scrolling starts. */}
      <div className="shrink-0 border-b border-border-strong px-2.5 pb-3 pt-3">
        <button
          type="button"
          onClick={() => { openAdd(); }}
          aria-keyshortcuts="Control+N"
          className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-md bg-accent px-2.5 text-[13px] font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-strong"
        >
          <Plus className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left">Add download</span>
        </button>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-2.5 py-2">
        <div className="space-y-0.5">
          {LIST_ITEMS.map((it) => (
            <NavButton key={it.view} active={view === it.view && categoryFilter === null} icon={it.icon} label={it.label} count={counts[it.view]} onClick={() => { setView(it.view); }} />
          ))}
        </div>
        {categories && categories.length > 0 ? (
          <div>
            <p className={groupLabel}>Categories</p>
            <div className="space-y-0.5">
              {categories.map((c) => (
                <NavButton key={c.id} active={categoryFilter === c.id} label={c.name} count={perCategory.get(c.id)} onClick={() => { setCategoryFilter(c.id); }}>
                  <CategoryGlyph icon={c.icon} color={c.color} className="size-4 shrink-0" />
                </NavButton>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center border-t border-border py-1.5 pl-4 pr-1.5 text-[10px] text-fg-subtle">
        <span className="min-w-0 flex-1 truncate">v{app.version}</span>
        {/* A window too narrow for it collapses it by itself; then there is nothing to collapse here. */}
        {autoCompact ? null : (
          <Tooltip label="Collapse navigation" side="right">
            <button
              type="button"
              onClick={() => { setLayout({ sidebarCollapsed: true }); }}
              aria-label="Collapse navigation"
              aria-controls="app-sidebar"
              className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-accent-soft hover:text-accent"
            >
              <PanelLeftClose className="size-4" aria-hidden />
            </button>
          </Tooltip>
        )}
      </div>
    </nav>
  );
}
