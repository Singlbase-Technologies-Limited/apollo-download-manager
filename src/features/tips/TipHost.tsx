import { useQuery } from '@tanstack/react-query';
import { Lightbulb, X } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '../../components/Button';
import { useConfirmStore } from '../../components/confirmStore';
import { Dialog } from '../../components/Dialog';
import { Toggle } from '../settings/fields';
import { api } from '../../lib/api';
import { useSettings, useShellSettings } from '../../lib/queries';
import { useDownloadsStore } from '../../stores/downloads';
import { useUiStore } from '../../stores/ui';
import { mayShow, TIPS, tipOf, useTipActions, useTipStore } from './tips';

/** Something else holds the user's attention: a dialog, the guide, a question, or a download asking for something. */
function useTipBlocked(): boolean {
  const ui = useUiStore((s) => s.addDialog.open || s.settingsOpen || s.guide !== null || s.tourStep !== null || s.loginRequest !== null || s.chooseFilesId !== null || s.startAtId !== null || s.newLinkId !== null);
  const asking = useConfirmStore((s) => s.options !== null);
  const page = useTipStore((s) => s.pageOpen);
  return ui || asking || page;
}

const useTray = () => useQuery({ queryKey: ['has-tray'], queryFn: api.hasTray, staleTime: Infinity, retry: false });

/**
 * Shows a tip asked for by what just happened, once nothing else is in the way (#460): in a card in the bottom right,
 * above the status bar, with the notifications moved above it (PO decision: "card in the corner"). It is read out
 * politely and never takes the focus.
 */
export function TipHost() {
  const { data: shell } = useShellSettings();
  const { data: settings } = useSettings();
  const { data: tray = false } = useTray();
  const blocked = useTipBlocked();
  const { pending, current, sessionUsed, show, drop, close } = useTipStore();
  const actions = useTipActions();

  // A download that failed because the connection dropped (#318) asks for the network tip.
  const droppedConnection = useDownloadsStore((s) => s.snapshot?.downloads.some((d) => d.status === 'failed' && d.error?.noNetwork === true) ?? false);
  useEffect(() => {
    if (droppedConnection) useTipStore.getState().request('restartOnNetwork');
  }, [droppedConnection]);

  useEffect(() => {
    if (pending === null || blocked || !shell || !settings) return;
    if (mayShow(pending, { guide: shell.guide, tips: shell.tips, settings, tray, sessionUsed })) {
      show(pending);
      void actions.markShown(pending);
    } else {
      drop();
    }
  }, [pending, blocked, shell, settings, tray, sessionUsed, show, drop, actions]);

  const tip = current !== null && !blocked ? tipOf(current) : null;
  return (
    // The live region is always there, so the tip is announced when it appears.
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-10 right-4 z-40 w-[360px] max-w-[calc(100vw-2rem)]">
      {tip ? (
        <section aria-label="Tip" className="pointer-events-auto flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-3.5 text-[13px] shadow-panel">
          <div className="flex items-center gap-2">
            <Lightbulb className="size-4 text-accent" aria-hidden />
            <span className="flex-1 text-xs font-semibold text-accent">Tip</span>
            <Button variant="ghost" size="icon-sm" aria-label="Dismiss tip" onClick={() => { close(); void actions.dismiss(tip.id); }}>
              <X className="size-4" aria-hidden />
            </Button>
          </div>
          <p className="leading-relaxed text-fg">{tip.text}</p>
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => { close(); void actions.dismiss(tip.id); }}>
              Dismiss
            </Button>
            <Button variant="primary" size="sm" onClick={() => { close(); void actions.turnOn(tip.id); }}>
              {tip.action}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** "Show tips" (#460): in Settings, General, and on the Tips page. Saved with the tips, never by the Settings form. */
export function ShowTipsToggle() {
  const { data: shell } = useShellSettings();
  const { setEnabled } = useTipActions();
  return (
    <Toggle
      title="Show tips"
      description="Now and then, a short tip about a feature, at the moment it helps. Help, then Tips, lists them all."
      checked={shell?.tips.enabled ?? true}
      disabled={!shell}
      onChange={(v) => { void setEnabled(v); }}
    />
  );
}

/** Help, then Tips (#460, PO decision: "Add a tips page"): every tip, dismissed ones too, with its action. */
export function TipsPage() {
  const open = useTipStore((s) => s.pageOpen);
  const closePage = useTipStore((s) => s.closePage);
  const { data: shell } = useShellSettings();
  const { data: settings } = useSettings();
  const { data: tray = false } = useTray();
  const { turnOn } = useTipActions();
  if (!open) return null;
  const state = (id: (typeof TIPS)[number]['id']) => (shell?.tips.dismissed.includes(id) ? 'Dismissed' : shell?.tips.shown.includes(id) ? 'Shown' : 'Not shown yet');
  return (
    <Dialog open onOpenChange={(o) => { if (!o) closePage(); }} title="Tips" description="A tip shows at the moment it helps, at most one a session, until you dismiss it or turn its feature on. Here they all are.">
      <div className="flex flex-col gap-3">
        <ShowTipsToggle />
        <ul className="flex flex-col gap-2">
          {TIPS.filter((t) => !t.needsTray || tray).map((t) => {
            const on = settings !== undefined && !t.helps(settings);
            return (
              <li key={t.id} className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-2 p-3">
                <div className="flex items-baseline gap-2">
                  <h3 className="flex-1 text-[13px] font-semibold text-fg">{t.title}</h3>
                  <span className="text-xs text-fg-subtle">{state(t.id)}</span>
                </div>
                <p className="text-[13px] text-fg-muted">{t.text}</p>
                <div>
                  <Button size="sm" disabled={on || settings === undefined} onClick={() => { void turnOn(t.id); }}>
                    {on ? 'Already on' : t.action}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Dialog>
  );
}
