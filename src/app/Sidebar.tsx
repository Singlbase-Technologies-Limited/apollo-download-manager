import { AlertCircle, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Clock3, FolderCog, History, Layers, PanelLeftClose, PanelLeftOpen, Plus, type LucideIcon } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { CategoryGlyph } from '../components/CategoryGlyph';
import { navGroupTitle, navItemClass } from '../components/navStyles';
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

function NavButton({
  active,
  icon: Icon,
  label,
  count,
  onClick,
  compact,
  children,
}: {
  active: boolean;
  icon?: LucideIcon;
  label: string;
  count?: number;
  onClick: () => void;
  compact: boolean;
  children?: ReactNode;
}) {
  const counted = count !== undefined && count > 0;
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(navItemClass(active), compact && 'relative justify-center px-0')}
    >
      {Icon ? <Icon className={cn('size-4 shrink-0', active ? 'text-accent' : 'text-fg-subtle group-hover:text-accent')} aria-hidden /> : children}
      <span className={compact ? 'sr-only' : 'min-w-0 flex-1 truncate'}>{label}</span>
      {counted && !compact ? <span className="text-[11px] tabular-nums text-fg-subtle">{count}</span> : null}
      {counted && compact ? <span className="sr-only">, {count}</span> : null}
    </button>
  );
  // Icons only: the label stays the accessible name and shows in a tooltip beside the rail.
  return compact ? <Tooltip label={label} side="right">{button}</Tooltip> : button;
}

const groupLabel = navGroupTitle;

/**
 * The navigation (V1's Sidebar). Its width comes from the shell (`--sidebar-w`); `compact` shows icons
 * only, because the user collapsed it or the window is too narrow.
 */
export function Sidebar({ app, compact, autoCompact }: { app: AppInfo; compact: boolean; autoCompact: boolean }) {
  const view = useUiStore((s) => s.view);
  const categoryFilter = useUiStore((s) => s.categoryFilter);
  const setView = useUiStore((s) => s.setView);
  const setCategoryFilter = useUiStore((s) => s.setCategoryFilter);
  const collapsed = useUiStore((s) => s.layout.sidebarCollapsed);
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

  const addButton = (
    <button
      type="button"
      onClick={() => { openAdd(); }}
      aria-keyshortcuts="Control+N"
      className={cn(
        'flex h-8 w-full cursor-pointer items-center gap-2 rounded-md bg-accent text-[13px] font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-strong',
        compact ? 'justify-center' : 'px-2.5',
      )}
    >
      <Plus className="size-4 shrink-0" aria-hidden />
      <span className={compact ? 'sr-only' : 'min-w-0 flex-1 truncate text-left'}>Add download</span>
    </button>
  );

  // Collapsing sits in the footer; when the window is too narrow, the shell collapses it instead.
  const toggle = autoCompact ? null : (
    <Tooltip label={collapsed ? 'Expand navigation' : 'Collapse navigation'} side="right">
      <button
        type="button"
        onClick={() => { setLayout({ sidebarCollapsed: !collapsed }); }}
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-accent-soft hover:text-accent"
      >
        {collapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
      </button>
    </Tooltip>
  );

  return (
    <nav id="app-sidebar" aria-label="Primary" data-mode={compact ? 'rail' : 'full'} className={cn(PANEL, 'flex shrink-0 flex-col bg-sidebar')} style={{ width: 'var(--sidebar-w)' }}>
      {/* The logo is no longer here: only on the loader, the first-run screens and the title bar (#363). The button
          stays put while the list below it scrolls; a line marks where the scrolling starts. */}
      <div className={cn('shrink-0 border-b border-border-strong pb-3 pt-3', compact ? 'px-2' : 'px-2.5')}>
        {compact ? <Tooltip label="Add download" shortcut="Ctrl+N" side="right">{addButton}</Tooltip> : addButton}
      </div>
      <div className={cn('flex-1 space-y-5 overflow-y-auto overflow-x-hidden py-2', compact ? 'px-2' : 'px-2.5')}>
        <div className="space-y-0.5">
          {LIST_ITEMS.map((it) => (
            <NavButton key={it.view} compact={compact} active={view === it.view && categoryFilter === null} icon={it.icon} label={it.label} count={counts[it.view]} onClick={() => { setView(it.view); }} />
          ))}
        </div>
        {categories && categories.length > 0 ? (
          <div className={cn(compact && 'border-t border-border pt-3')}>
            <p className={compact ? 'sr-only' : groupLabel}>Categories</p>
            <div className="space-y-0.5">
              {categories.map((c) => (
                <NavButton key={c.id} compact={compact} active={categoryFilter === c.id} label={c.name} count={perCategory.get(c.id)} onClick={() => { setCategoryFilter(c.id); }}>
                  <CategoryGlyph icon={c.icon} color={c.color} className="size-4 shrink-0" />
                </NavButton>
              ))}
            </div>
          </div>
        ) : null}
        <div className={cn('space-y-0.5', compact && 'border-t border-border pt-3')}>
          <p className={compact ? 'sr-only' : groupLabel}>Library</p>
          <NavButton compact={compact} active={view === 'history'} icon={History} label="History" onClick={() => { setView('history'); }} />
          <NavButton compact={compact} active={view === 'categories'} icon={FolderCog} label="Categories" onClick={() => { setView('categories'); }} />
        </div>
      </div>
      {/* Settings is the title bar's gear (#363, option B); the footer has the version and collapse. */}
      <div className={cn('flex shrink-0 items-center border-t border-border py-1.5 text-[10px] text-fg-subtle', compact ? 'justify-center' : 'pl-4 pr-1.5')}>
        {compact ? null : <span className="min-w-0 flex-1 truncate">v{app.version}</span>}
        {toggle}
      </div>
    </nav>
  );
}
