import { ArrowDownToLine, FolderCog, History, MessageSquare, ScrollText, Settings, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { Tooltip } from '../components/Tooltip';
import type { AppInfo } from '../contract';
import { api } from '../lib/api';
import { toApiError } from '../lib/errors';
import { cn } from '../lib/cn';
import { useUiStore, type View } from '../stores/ui';
import { toast } from 'sonner';

function BarButton({ label, icon: Icon, current, expanded, shortcut, onClick }: { label: string; icon: LucideIcon; current?: boolean; expanded?: boolean; shortcut?: string; onClick: () => void }) {
  return (
    <Tooltip label={label} shortcut={shortcut} side="right">
      <button
        type="button"
        aria-label={label}
        aria-current={current ? 'page' : undefined}
        aria-expanded={expanded}
        aria-controls={expanded === undefined ? undefined : 'app-sidebar'}
        onClick={onClick}
        className={cn(
          'flex size-10 cursor-pointer items-center justify-center rounded-md transition-colors',
          current ? 'bg-surface text-accent shadow-[inset_2px_0_0_var(--accent)]' : 'text-fg-muted hover:bg-accent-soft hover:text-accent',
        )}
      >
        <Icon className="size-5" aria-hidden />
      </button>
    </Tooltip>
  );
}

/** What's new, until a later issue fills it from the changelog (#363): where the release notes are, nothing fetched. */
function WhatsNewDialog({ app, onClose }: { app: AppInfo; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} title="What’s new" description={`Apollo Download Manager ${app.version}`} footer={<Button onClick={onClose}>Close</Button>}>
      <p className="text-[13px] text-fg-muted">
        Each version’s changes are in its release notes, CHANGELOG.md, published with every release on the project’s GitHub page. A later
        version will show them here.
      </p>
    </Dialog>
  );
}

const isList = (v: View) => v !== 'history' && v !== 'categories' && v !== 'settings';

/**
 * The icon bar on the window's left (#363, PO decision: option C, like VS Code's): the sections at the top, What's
 * new, Feedback and Settings at the bottom. Always there, at every window size; the lists panel beside it collapses.
 */
export function ActivityBar({ app, listsShown }: { app: AppInfo; /** The lists panel is open beside the bar. */ listsShown: boolean }) {
  const view = useUiStore((s) => s.view);
  const setView = useUiStore((s) => s.setView);
  const setLayout = useUiStore((s) => s.setLayout);
  // On another section, Downloads goes back to the lists; on them, it shows or hides their panel, as VS Code's does.
  const downloads = () => {
    if (!isList(view)) {
      setView('all');
      setLayout({ sidebarCollapsed: false });
    } else setLayout({ sidebarCollapsed: listsShown });
  };
  const [whatsNew, setWhatsNew] = useState(false);
  const feedback = () => {
    api.openFeedbackPage().catch((e: unknown) => { toast.error(`The feedback page couldn’t be opened: ${toApiError(e).message}`); });
  };
  return (
    <nav aria-label="Sections" className="flex w-12 shrink-0 flex-col items-center gap-1 py-2">
      <BarButton label="Downloads" icon={ArrowDownToLine} current={isList(view)} expanded={isList(view) ? listsShown : undefined} onClick={downloads} />
      <BarButton label="History" icon={History} current={view === 'history'} onClick={() => { setView('history'); }} />
      <BarButton label="Categories" icon={FolderCog} current={view === 'categories'} onClick={() => { setView('categories'); }} />
      <div className="flex-1" />
      <BarButton label="What’s new" icon={ScrollText} onClick={() => { setWhatsNew(true); }} />
      <BarButton label="Feedback" icon={MessageSquare} onClick={feedback} />
      <BarButton label="Settings" icon={Settings} shortcut="Ctrl+," current={view === 'settings'} onClick={() => { setView('settings'); }} />
      {whatsNew ? <WhatsNewDialog app={app} onClose={() => { setWhatsNew(false); }} /> : null}
    </nav>
  );
}
