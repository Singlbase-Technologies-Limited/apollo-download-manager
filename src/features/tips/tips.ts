/**
 * The tips (#460): one sentence about a feature the user may not know, shown at the moment it helps, in a card
 * in the corner (PO decisions on #460, 2026-11-17). None repeats what the guide after Get started shows (#463), and none
 * shows before the guide was finished or skipped.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { create } from 'zustand';
import type { GuideState, Settings, ShellSettings, TipId, TipsSettings } from '../../contract';
import { api } from '../../lib/api';
import { toApiError } from '../../lib/errors';
import { keys } from '../../lib/queries';

export interface TipDef {
  id: TipId;
  /** Where the Tips page lists it. */
  title: string;
  text: string;
  /** The button that turns the feature on. */
  action: string;
  /** Whether the feature is still off, so the tip still helps. */
  helps: (s: Settings) => boolean;
  turnOn: (s: Settings) => Settings;
  /** Only where the desktop has a tray. */
  needsTray: boolean;
}

export const TIPS: readonly TipDef[] = [
  {
    id: 'restartOnNetwork',
    title: 'When the connection drops',
    text: 'A download stopped because the connection dropped. Apollo DM can wait, and restart downloads by itself when the network is back.',
    action: 'Restart them by themselves',
    helps: (s) => !s.queue.restartOnNetwork,
    turnOn: (s) => ({ ...s, queue: { ...s.queue, restartOnNetwork: true } }),
    needsTray: false,
  },
  {
    id: 'closeToTray',
    title: 'Downloading with the window closed',
    text: 'Closing the window can keep Apollo DM running in the tray, so your downloads carry on.',
    action: 'Close to the tray',
    helps: (s) => !s.general.closeToTray,
    turnOn: (s) => ({ ...s, general: { ...s.general, closeToTray: true } }),
    needsTray: true,
  },
  {
    id: 'chooseMagnetFiles',
    title: 'Choosing a torrent’s files',
    text: 'Apollo DM can show a magnet link’s files before it downloads them, so you take only the ones you want.',
    action: 'Show me the files first',
    helps: (s) => !s.newTorrents.chooseFilesForMagnets,
    turnOn: (s) => ({ ...s, newTorrents: { ...s.newTorrents, chooseFilesForMagnets: true } }),
    needsTray: false,
  },
];

export const tipOf = (id: TipId): TipDef => TIPS.find((t) => t.id === id) ?? (TIPS[0] as TipDef);

export interface TipContext {
  guide: GuideState;
  tips: TipsSettings;
  settings: Settings | undefined;
  tray: boolean;
  /** A tip was shown in this session already: at most one per session. */
  sessionUsed: boolean;
}

/** Whether the tip `id` may show now: after the guide, with tips on, once per session, never dismissed, still useful. */
export function mayShow(id: TipId, c: TipContext): boolean {
  const tip = tipOf(id);
  return (
    c.guide !== 'unseen' &&
    c.tips.enabled &&
    !c.sessionUsed &&
    !c.tips.dismissed.includes(id) &&
    c.settings !== undefined &&
    tip.helps(c.settings) &&
    (!tip.needsTray || c.tray)
  );
}

interface TipStore {
  /** Asked for by what just happened, waiting until nothing else is in the way. */
  pending: TipId | null;
  /** On screen. */
  current: TipId | null;
  sessionUsed: boolean;
  /** The Tips page under Help. */
  pageOpen: boolean;
  request: (id: TipId) => void;
  show: (id: TipId) => void;
  drop: () => void;
  close: () => void;
  openPage: () => void;
  closePage: () => void;
}

export const useTipStore = create<TipStore>((set) => ({
  pending: null,
  current: null,
  sessionUsed: false,
  pageOpen: false,
  request: (id) => { set((s) => (s.sessionUsed || s.current !== null ? s : { pending: id })); },
  show: (id) => { set({ current: id, pending: null, sessionUsed: true }); },
  drop: () => { set({ pending: null }); },
  close: () => { set({ current: null }); },
  openPage: () => { set({ pageOpen: true }); },
  closePage: () => { set({ pageOpen: false }); },
}));

/** The tip on screen, if any: the notifications move above it, so the two never overlap. */
export const useTipVisible = () => useTipStore((s) => s.current !== null);

/** What to save in the tips' state, as a function of what is saved now. */
export const withShown = (t: TipsSettings, id: TipId): TipsSettings => (t.shown.includes(id) ? t : { ...t, shown: [...t.shown, id] });
export const withDismissed = (t: TipsSettings, id: TipId): TipsSettings => (t.dismissed.includes(id) ? t : { ...t, dismissed: [...t.dismissed, id] });

/** Saves the tips' state and turns features on, through their own commands; a failure is said, never hidden. */
export function useTipActions() {
  const qc = useQueryClient();
  const save = useCallback(
    (change: (t: TipsSettings) => TipsSettings) => {
      const now = qc.getQueryData<ShellSettings>(keys.shellSettings);
      if (!now) return Promise.resolve();
      return api.setTips(change(now.tips)).then(
        (settings) => { qc.setQueryData(keys.shellSettings, settings); },
        (e: unknown) => { toast.error(`The tips couldn’t be saved: ${toApiError(e).message}`); },
      );
    },
    [qc],
  );
  const turnOn = useCallback(
    async (id: TipId) => {
      try {
        const settings = qc.getQueryData<Settings>(keys.settings) ?? (await api.settings());
        qc.setQueryData(keys.settings, await api.setSettings(tipOf(id).turnOn(settings)));
        toast.success('Turned on. You can change it in Settings.');
        await save((t) => withDismissed(t, id));
      } catch (e) {
        toast.error(`The setting couldn’t be changed: ${toApiError(e).message}`);
      }
    },
    [qc, save],
  );
  return {
    markShown: (id: TipId) => save((t) => withShown(t, id)),
    dismiss: (id: TipId) => save((t) => withDismissed(t, id)),
    setEnabled: (enabled: boolean) => save((t) => ({ ...t, enabled })),
    turnOn,
  };
}
