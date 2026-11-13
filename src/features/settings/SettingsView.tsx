import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { RotateCcw, Search, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { availability } from '../../capabilities';
import { CapabilityOption } from '../../CapabilityOption';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { confirmAction } from '../../components/confirmStore';
import { contentClass, overlayClass } from '../../components/dialogStyles';
import { navItemClass } from '../../components/navStyles';
import { useReturnFocus } from '../../components/returnFocus';
import { Spinner } from '../../components/Spinner';
import type { AppearanceSettings, Density, PerformanceProfile, Preallocation, ProxyKind, Settings, ShellSettings, Theme, TimeFormat } from '../../contract';
import { api } from '../../lib/api';
import { toApiError } from '../../lib/errors';
import { cn } from '../../lib/cn';
import { keys, useCapabilities, useSettings, useShellSettings } from '../../lib/queries';
import { useUiStore, type SettingsSection } from '../../stores/ui';
import { DiagnosticsPanel } from '../diagnostics/DiagnosticsPanel';
import { SeedingFields } from '../torrents/SeedingFields';
import { portMapText } from '../torrents/torrentLogic';
import { Input } from '../../components/Input';
import { BrowserSetup } from './BrowserSetup';
import { Action, Choice, Group, Num, Text, TimeSetting, Toggle } from './fields';
import { searchSettings } from './settingsIndex';
import { useDownloadsStore } from '../../stores/downloads';
import { formatWhen, formatWindow } from '../../lib/format';

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'performance', label: 'Queue and performance' },
  { id: 'bittorrent', label: 'BitTorrent' },
  { id: 'browser', label: 'Browser' },
  { id: 'proxy', label: 'Proxy' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'storage', label: 'History and storage' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'about', label: 'About and diagnostics' },
];

/**
 * This section's part of the user guide (#354). The guide's Settings page has one heading per section, named as
 * the section is, so its anchor is the label's, made the way GitHub and `pnpm guide` make anchors.
 */
function GuideLink({ section }: { section: SettingsSection }) {
  const openGuide = useUiStore((s) => s.openGuide);
  const label = SECTIONS.find((x) => x.id === section)?.label ?? '';
  const anchor = label.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
  return (
    <p className="text-right text-xs">
      <button type="button" className="text-accent underline-offset-2 hover:underline" onClick={() => { openGuide('settings', anchor); }}>
        {`${label} in the user guide`}
      </button>
    </p>
  );
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const PROFILE_TEXT: Record<PerformanceProfile, string> = {
  conservative: 'Up to 2 connections to a server, pieces of at least 20 MiB. Gentle on servers and slow networks.',
  balanced: 'Up to 8 connections to a server, pieces of at least 1 MiB. A good default for most servers.',
  maximum: 'Up to 16 connections to a server. Some servers slow down or block many connections.',
  custom: 'The values below.',
};

const KIB = 1024;

type Patch = (change: (s: Settings) => Settings) => void;

/**
 * The Settings screen (#30, V1's SettingsView): every section, saved whole through `set_settings`, which checks and
 * applies them at once. A change shows while it is saved, and a refusal says why and shows what is saved.
 */
export function SettingsView() {
  const section = useUiStore((s) => s.settingsSection);
  const setSection = useUiStore((s) => s.setSettingsSection);
  const qc = useQueryClient();
  const settings = useSettings();
  const [state, setState] = useState<{ kind: 'idle' | 'saving' | 'saved' } | { kind: 'error'; message: string }>({ kind: 'idle' });
  const [query, setQuery] = useState('');
  const found = searchSettings(query);

  const save = async (send: () => Promise<Settings>) => {
    setState({ kind: 'saving' });
    try {
      qc.setQueryData(keys.settings, await send());
      setState({ kind: 'saved' });
    } catch (e) {
      setState({ kind: 'error', message: toApiError(e).message });
      // What is saved is shown again.
      await qc.invalidateQueries({ queryKey: keys.settings });
    }
  };
  const patch: Patch = (change) => {
    const current = qc.getQueryData<Settings>(keys.settings);
    if (current) void save(() => api.setSettings(change(structuredClone(current))));
  };
  const reset = async () => {
    const ok = await confirmAction({
      title: 'Reset all settings?',
      description: 'Every setting returns to its default, except the download folder. Downloads, history and categories are kept.',
      confirmLabel: 'Reset settings',
      destructive: true,
    });
    if (!ok) return;
    await save(api.resetSettings);
    toast.success('Settings reset');
  };

  return (
    <>
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border pl-5 pr-3">
        <DialogPrimitive.Title asChild>
          <h1 className="text-[14px] font-semibold">Settings</h1>
        </DialogPrimitive.Title>
        {state.kind === 'error' ? null : (
          <p role="status" className="text-xs text-fg-subtle">
            {state.kind === 'saving' ? 'Saving…' : state.kind === 'saved' ? 'Saved. It applies at once.' : ''}
          </p>
        )}
        <div className="flex-1" />
        <DialogPrimitive.Close asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Close settings">
            <X />
          </Button>
        </DialogPrimitive.Close>
      </div>
      <div className="relative shrink-0 border-b border-border px-5 py-2.5">
        <Search className="pointer-events-none absolute left-7.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" aria-hidden />
        <Input type="search" aria-label="Search settings" placeholder="Search settings" value={query} onChange={(e) => { setQuery(e.target.value); }} className="pl-8" />
      </div>
    <div className="flex min-h-0 flex-1">
      <nav aria-label="Settings sections" className="w-44 shrink-0 space-y-0.5 overflow-y-auto border-r border-border bg-sidebar p-2.5 lg:w-52">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-current={section === s.id ? 'page' : undefined}
            onClick={() => { setSection(s.id); }}
            className={navItemClass(section === s.id)}
          >
            {s.label}
          </button>
        ))}
        <div className="mt-4 border-t border-border px-1 pt-3">
          <Button size="sm" variant="ghost" busy={state.kind === 'saving'} onClick={() => void reset()}>
            <RotateCcw /> Reset to defaults
          </Button>
        </div>
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-4 px-5 py-5 lg:px-8 lg:py-6">
          {state.kind === 'error' ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{`Not saved: ${state.message}`}</p>
          ) : null}
          {query.trim() === '' ? <GuideLink section={section} /> : null}
          {query.trim() !== '' ? (
            // #364: the settings whose name matches, by section; choosing one opens its section.
            found.length === 0 ? (
              <p className="text-[13px] text-fg-muted">{`No setting matches “${query.trim()}”.`}</p>
            ) : (
              <ul aria-label="Settings found" className="space-y-1">
                {found.map((r) => (
                  <li key={`${r.section}/${r.title}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setSection(r.section);
                        setQuery('');
                      }}
                      className="flex w-full cursor-pointer flex-col items-start rounded-md px-3 py-2 text-left hover:bg-accent-soft"
                    >
                      <span className="text-[13px] font-medium text-fg">{r.title}</span>
                      <span className="text-xs text-fg-subtle">{SECTIONS.find((x) => x.id === r.section)?.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : section === 'about' ? (
            <DiagnosticsPanel />
          ) : settings.isPending ? (
            <div className="flex items-center gap-2 text-fg-muted">
              <Spinner /> Loading settings…
            </div>
          ) : settings.isError ? (
            <p role="alert" className="text-xs text-danger">
              {toApiError(settings.error).message}
            </p>
          ) : section === 'appearance' ? (
            <AppearanceSection />
          ) : (
            <SectionContent section={section} s={settings.data} patch={patch} />
          )}
        </div>
      </div>
    </div>
    </>
  );
}

/**
 * Settings in a window over the app (#364, PO): the list stays behind it. Close, Escape or a click
 * outside closes it, and focus goes back to what opened it. It grows and shrinks with the window, leaving the title
 * bar and the status bar in view (PO, 2026-11-06).
 */
export function SettingsDialog() {
  const open = useUiStore((s) => s.settingsOpen);
  const close = useUiStore((s) => s.closeSettings);
  const returnFocus = useReturnFocus(open);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClass} />
        <DialogPrimitive.Content className={cn(contentClass, 'h-[calc(100vh-6rem)] max-h-none w-[min(80rem,calc(100vw-4rem))] max-w-none overflow-hidden')} aria-describedby={undefined} {...returnFocus}>
          <SettingsView />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function SectionContent({ section, s, patch }: { section: Exclude<SettingsSection, 'about' | 'appearance'>; s: Settings; patch: Patch }) {
  switch (section) {
    case 'general':
      return (
        <Group title="General">
          <Toggle title="Close to tray" description="Closing the window keeps downloads running in the tray, when there is one." checked={s.general.closeToTray} onChange={(v) => { patch((x) => ({ ...x, general: { ...x.general, closeToTray: v } })); }} />
          <Toggle title="Start Apollo Download Manager when I sign in" description="Opens with your computer, so queued downloads and seeding carry on after a restart." checked={s.general.startAtLogin} onChange={(v) => { patch((x) => ({ ...x, general: { ...x.general, startAtLogin: v } })); }} />
          <Toggle title="Keep the computer awake while downloading" description="It doesn’t go to sleep on its own while downloads are active. The screen can still turn off." checked={s.general.keepAwake} onChange={(v) => { patch((x) => ({ ...x, general: { ...x.general, keepAwake: v } })); }} />
          <Toggle title="Start minimized" description="Start hidden in the tray, also when it opens at sign-in." checked={s.general.startMinimized} onChange={(v) => { patch((x) => ({ ...x, general: { ...x.general, startMinimized: v } })); }} />
          <Toggle title="Confirm before quitting with active downloads" checked={s.general.confirmExitWithActive} onChange={(v) => { patch((x) => ({ ...x, general: { ...x.general, confirmExitWithActive: v } })); }} />
        </Group>
      );
    case 'downloads':
      return <DownloadsSection s={s} patch={patch} />;
    case 'performance':
      return <PerformanceSection s={s} patch={patch} />;
    case 'bittorrent':
      return <TorrentSection s={s} patch={patch} />;
    case 'notifications':
      return (
        <Group title="Notifications">
          <Toggle title="A download completes" checked={s.notifications.onComplete} onChange={(v) => { patch((x) => ({ ...x, notifications: { ...x.notifications, onComplete: v } })); }} />
          <Toggle title="A download fails" checked={s.notifications.onFailure} onChange={(v) => { patch((x) => ({ ...x, notifications: { ...x.notifications, onFailure: v } })); }} />
          <Toggle title="A download starts" checked={s.notifications.onStart} onChange={(v) => { patch((x) => ({ ...x, notifications: { ...x.notifications, onStart: v } })); }} />
          <Toggle title="An engine stops and won’t start again" checked={s.notifications.onEngineFailure} onChange={(v) => { patch((x) => ({ ...x, notifications: { ...x.notifications, onEngineFailure: v } })); }} />
        </Group>
      );
    case 'storage':
      return (
        <Group title="History" description="Entries are forgotten by age and by number when Apollo Download Manager starts and when these change. A download still in the list is never forgotten, and no file is ever deleted.">
          <Num title="Keep history for (days, 0 for ever)" value={s.storage.historyRetentionDays} min={0} max={3650} onChange={(v) => { patch((x) => ({ ...x, storage: { ...x.storage, historyRetentionDays: v } })); }} />
          <Num title="Most history entries" value={s.storage.maxHistoryEntries} min={100} max={1_000_000} onChange={(v) => { patch((x) => ({ ...x, storage: { ...x.storage, maxHistoryEntries: v } })); }} />
        </Group>
      );
    case 'advanced':
      return <AdvancedSection s={s} patch={patch} />;
    case 'browser':
      return <BrowserSection s={s} patch={patch} />;
    case 'proxy':
      return <ProxySection s={s} patch={patch} />;
  }
}

const PROXY_KINDS: { value: ProxyKind; label: string }[] = [
  { value: 'none', label: 'No proxy' },
  { value: 'http', label: 'HTTP' },
  { value: 'https', label: 'HTTPS' },
  { value: 'socks5', label: 'SOCKS5' },
];

/**
 * The proxy every download goes through (#192, ADR-0008). Its password is set on its own and never comes back to
 * the window: it is held in memory, and in the system keychain only when the user ticks "Remember" (ADR-0015).
 */
function ProxySection({ s, patch }: { s: Settings; patch: Patch }) {
  const qc = useQueryClient();
  const passwordSet = useQuery({ queryKey: ['proxy-password-set'], queryFn: api.proxyPasswordSet });
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const proxy = s.proxy;
  const setPasswordTo = async (value: string | null) => {
    setBusy(true);
    setProblem(null);
    try {
      await api.setProxyPassword(value);
      setPassword('');
      toast.success(value === null ? 'Proxy password cleared' : 'Proxy password saved');
    } catch (e) {
      setProblem(toApiError(e).message);
    } finally {
      setBusy(false);
      await qc.invalidateQueries({ queryKey: ['proxy-password-set'] });
    }
  };
  return (
    <>
      <Group
        title="Proxy"
        description="Every download goes through this proxy: HTTP, HTTPS, FTP, SFTP and torrents. Proxy settings of the system or the environment are never used. Fill in the host and port, then choose the type."
      >
        <Choice
          title="Type"
          description="SFTP and torrents can’t go through an HTTPS proxy."
          value={proxy.kind}
          options={PROXY_KINDS}
          onChange={(v) => { patch((x) => ({ ...x, proxy: { ...x.proxy, kind: v } })); }}
        />
        <Text title="Host" description="A name or an IP address, without http:// or a port." value={proxy.host === '' ? null : proxy.host} placeholder="proxy.example.com" onChange={(v) => { patch((x) => ({ ...x, proxy: { ...x.proxy, host: v ?? '' } })); }} />
        <Num title="Port" value={proxy.port} min={1} max={65_535} onChange={(v) => { patch((x) => ({ ...x, proxy: { ...x.proxy, port: v } })); }} />
      </Group>
      <Group title="Proxy login" description="Only for a proxy that asks for one. It is sent to the proxy alone, never to a server you download from.">
        <Text title="User name" value={proxy.userName === '' ? null : proxy.userName} onChange={(v) => { patch((x) => ({ ...x, proxy: { ...x.proxy, userName: v ?? '' } })); }} />
        <div className="flex items-center justify-between gap-4 py-2.5">
          <div className="min-w-0">
            <label htmlFor="proxy-password" className="text-[13px]">
              Password
            </label>
            <p className="text-xs text-fg-muted">
              {passwordSet.isPending ? 'Checking…' : passwordSet.data === true ? 'A password is set.' : 'No password is set.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Input id="proxy-password" type="password" autoComplete="off" className="h-8 w-44" value={password} onChange={(e) => { setPassword(e.target.value); }} />
            <Button size="sm" variant="secondary" busy={busy} disabled={busy || password === ''} onClick={() => void setPasswordTo(password)}>
              Save password
            </Button>
            <Button size="sm" variant="ghost" disabled={busy || passwordSet.data !== true} onClick={() => void setPasswordTo(null)}>
              Clear
            </Button>
          </div>
        </div>
        {problem === null ? null : (
          <p role="alert" className="py-2 text-xs text-danger">
            {problem}
          </p>
        )}
        <Toggle
          title="Remember the password in the system keychain"
          description="Unticked, Apollo Download Manager asks for it again after it restarts."
          checked={proxy.rememberPassword}
          onChange={(v) => { patch((x) => ({ ...x, proxy: { ...x.proxy, rememberPassword: v } })); }}
        />
      </Group>
    </>
  );
}

/** Links from the browser extension (#65, V1's Browser integration): what happens to them, and each browser's registration. */
function BrowserSection({ s, patch }: { s: Settings; patch: Patch }) {
  return (
    <>
      <Group title="Links from the browser" description="The Apollo Download Manager browser extension sends downloads here. It never sends cookies or logins.">
        <Toggle title="Take links from the browser" checked={s.browser.acceptRequests} onChange={(v) => { patch((x) => ({ ...x, browser: { ...x.browser, acceptRequests: v } })); }} />
        <Toggle
          title="Ask before adding"
          description="Open the Add dialog for each link instead of starting it at once. Torrents and magnet links always ask."
          checked={s.browser.confirmBeforeAdding}
          disabled={!s.browser.acceptRequests}
          onChange={(v) => { patch((x) => ({ ...x, browser: { ...x.browser, confirmBeforeAdding: v } })); }}
        />
      </Group>
      <Group
        title="Browsers"
        description="Register a browser so it can reach Apollo Download Manager, for your user only, then add the extension to it."
      >
        <BrowserSetup />
      </Group>
    </>
  );
}

function DownloadsSection({ s, patch }: { s: Settings; patch: Patch }) {
  const choose = async () => {
    try {
      const picked = await api.chooseDirectory(s.downloads.defaultDirectory || null);
      if (picked) patch((x) => ({ ...x, downloads: { ...x.downloads, defaultDirectory: picked } }));
    } catch (e) {
      toast.error(toApiError(e).message);
    }
  };
  return (
    <Group title="Downloads">
      <div className="flex items-center justify-between gap-4 py-2.5">
        <div className="min-w-0">
          <p className="text-[13px]">Download folder</p>
          <p className="truncate text-xs text-fg-muted">{s.downloads.defaultDirectory || 'The system’s Downloads folder'}</p>
        </div>
        <Button size="sm" onClick={() => void choose()}>
          Choose…
        </Button>
      </div>
      <Toggle title="Sort into categories by file type" checked={s.downloads.autoCategorize} onChange={(v) => { patch((x) => ({ ...x, downloads: { ...x.downloads, autoCategorize: v } })); }} />
      <Toggle title="A folder for each category" checked={s.downloads.categorySubfolders} onChange={(v) => { patch((x) => ({ ...x, downloads: { ...x.downloads, categorySubfolders: v } })); }} />
    </Group>
  );
}

/** When the schedule next runs, from the manager's snapshot, so it says what the saved settings do (#350). */
function ScheduleNext({ enabled }: { enabled: boolean }) {
  const next = useDownloadsStore((s) => s.snapshot?.schedule ?? null);
  const text = !enabled
    ? 'Off: downloads start as soon as a place among those running at once is free.'
    : next === null
      ? 'It never opens: choose at least one day, and a stop time other than the start.'
      : next.open
        ? `Open now, until ${formatWhen(next.closes)}.`
        : `Next: ${formatWindow(next.opens, next.closes)}`;
  return (
    <p role="status" className="py-1.5 text-xs text-fg-muted">
      {text}
    </p>
  );
}

function PerformanceSection({ s, patch }: { s: Settings; patch: Patch }) {
  const q = s.queue;
  const setDay = (day: number, on: boolean) => {
    patch((x) => {
      const days = new Set(x.queue.schedule.days);
      if (on) days.add(day);
      else days.delete(day);
      return { ...x, queue: { ...x.queue, schedule: { ...x.queue.schedule, days: [...days].sort((a, b) => a - b) } } };
    });
  };
  return (
    <>
      <Group title="Queue">
        <Num title="Simultaneous downloads" value={q.maxConcurrentDownloads} min={1} max={32} onChange={(v) => { patch((x) => ({ ...x, queue: { ...x.queue, maxConcurrentDownloads: v } })); }} />
        <Toggle title="Start new downloads at once" checked={q.startImmediately} onChange={(v) => { patch((x) => ({ ...x, queue: { ...x.queue, startImmediately: v } })); }} />
        <Toggle title="Restart downloads when the network is back" description="A download that failed because there was no network waits for it, and continues from where it stopped once the network returns." checked={q.restartOnNetwork} onChange={(v) => { patch((x) => ({ ...x, queue: { ...x.queue, restartOnNetwork: v } })); }} />
        <Num title="Speed limit for direct downloads (KiB/s, 0 for none)" description="Torrents have their own limit, under BitTorrent." value={s.advanced.globalDownloadLimitKib} min={0} max={2_000_000} onChange={(v) => { patch((x) => ({ ...x, advanced: { ...x.advanced, globalDownloadLimitKib: v } })); }} />
      </Group>
      <Group title="Schedule" description="While it is on, new downloads wait for this window, in local time. A download with its own start time starts then instead.">
        <Toggle title="Use the schedule" checked={q.schedule.enabled} onChange={(v) => { patch((x) => ({ ...x, queue: { ...x.queue, schedule: { ...x.queue.schedule, enabled: v } } })); }} />
        <ScheduleNext enabled={q.schedule.enabled} />
        <TimeSetting title="Start" value={q.schedule.startTime} onChange={(v) => { patch((x) => ({ ...x, queue: { ...x.queue, schedule: { ...x.queue.schedule, startTime: v } } })); }} />
        <TimeSetting title="Stop" description="Before the start, it stops the next day; 00:00 is midnight." value={q.schedule.stopTime ?? '00:00'} onChange={(v) => { patch((x) => ({ ...x, queue: { ...x.queue, schedule: { ...x.queue.schedule, stopTime: v } } })); }} />
        <div className="flex flex-wrap gap-3 py-2.5 text-xs">
          {DAYS.map((d, i) => (
            <Checkbox key={d} checked={q.schedule.days.includes(i)} onChange={(on) => { setDay(i, on); }}>
              {d}
            </Checkbox>
          ))}
        </div>
      </Group>
      <Group title="Performance" description="A profile caps the connections; within it, Apollo Download Manager keeps only the connections that help.">
        <Choice<PerformanceProfile>
          title="Profile"
          description={PROFILE_TEXT[s.performance.profile]}
          value={s.performance.profile}
          options={[
            { value: 'conservative', label: 'Conservative' },
            { value: 'balanced', label: 'Balanced' },
            { value: 'maximum', label: 'Maximum' },
            { value: 'custom', label: 'Custom' },
          ]}
          onChange={(v) => { patch((x) => ({ ...x, performance: { ...x.performance, profile: v } })); }}
        />
        {s.performance.profile === 'custom' ? (
          <>
            <Num title="Connections to one server" value={s.performance.custom.maxConnectionsPerServer} min={1} max={16} onChange={(v) => { patch((x) => ({ ...x, performance: { ...x.performance, custom: { ...x.performance.custom, maxConnectionsPerServer: v } } })); }} />
            <Num title="Smallest piece (MiB)" value={s.performance.custom.minSegmentMib} min={1} max={1024} onChange={(v) => { patch((x) => ({ ...x, performance: { ...x.performance, custom: { ...x.performance.custom, minSegmentMib: v } } })); }} />
          </>
        ) : null}
        <Num title="Connections for all downloads together" value={s.engine.connectionBudget} min={1} max={256} onChange={(v) => { patch((x) => ({ ...x, engine: { ...x.engine, connectionBudget: v } })); }} />
      </Group>
    </>
  );
}

function TorrentSection({ s, patch }: { s: Settings; patch: Patch }) {
  const t = s.torrent;
  const network = useQuery({ queryKey: ['torrent-network'], queryFn: api.torrentNetwork, retry: false });
  const adapters = useQuery({ queryKey: ['network-adapters'], queryFn: api.networkAdapters, retry: false });
  const kib = (bps: number) => Math.round(bps / KIB);
  // One adapter for torrents (#471): a saved one that is gone stays chosen, and says so.
  const ANY = '__any';
  const listed = adapters.data ?? [];
  const adapterOptions = [
    { value: ANY, label: 'Any adapter' },
    ...listed.map((a) => ({ value: a.id, label: a.up ? a.name : `${a.name} (not connected)` })),
    ...(t.networkAdapter !== null && !listed.some((a) => a.id === t.networkAdapter) ? [{ value: t.networkAdapter, label: 'The adapter chosen before (not found)' }] : []),
  ];
  return (
    <>
      <Group title="BitTorrent" description="Torrents run in Apollo Download Manager’s torrent helper, on libtorrent.">
        <Toggle title="BitTorrent" description="Add torrents and magnet links. Metalink has its own switch, under Advanced." checked={s.advanced.enableBittorrent} onChange={(v) => { patch((x) => ({ ...x, advanced: { ...x.advanced, enableBittorrent: v } })); }} />
        <Toggle title="DHT" description="Find peers without a tracker. Private torrents never use it." checked={t.dht} onChange={(v) => { patch((x) => ({ ...x, torrent: { ...x.torrent, dht: v } })); }} />
        <Toggle title="Peer exchange" checked={t.peerExchange} onChange={(v) => { patch((x) => ({ ...x, torrent: { ...x.torrent, peerExchange: v } })); }} />
        <Toggle title="Local peer discovery" checked={t.localPeerDiscovery} onChange={(v) => { patch((x) => ({ ...x, torrent: { ...x.torrent, localPeerDiscovery: v } })); }} />
        <Num title="Peers per torrent" value={t.maxPeersPerTorrent} min={1} max={512} onChange={(v) => { patch((x) => ({ ...x, torrent: { ...x.torrent, maxPeersPerTorrent: v } })); }} />
        <Num title="Torrents seeding at once" description="0 for no limit; the others wait to seed." value={t.maxActiveSeeds} min={0} max={1000} onChange={(v) => { patch((x) => ({ ...x, torrent: { ...x.torrent, maxActiveSeeds: v } })); }} />
        <Num title="Upload limit for all torrents (KiB/s, 0 for none)" value={kib(t.uploadLimit)} min={0} max={2_000_000} onChange={(v) => { patch((x) => ({ ...x, torrent: { ...x.torrent, uploadLimit: v * KIB } })); }} />
        <Num title="Download limit for all torrents (KiB/s, 0 for none)" value={kib(t.downloadLimit)} min={0} max={2_000_000} onChange={(v) => { patch((x) => ({ ...x, torrent: { ...x.torrent, downloadLimit: v * KIB } })); }} />
        <Text title="Extra trackers" description="Added to every public torrent, separated by spaces." value={t.extraTrackers.join(' ') || null} onChange={(v) => { patch((x) => ({ ...x, torrent: { ...x.torrent, extraTrackers: v ? v.split(/\s+/) : [] } })); }} />
        <Text title="DHT bootstrap nodes" description="host:port, separated by spaces; empty for libtorrent’s." value={t.dhtBootstrapNodes.join(' ') || null} onChange={(v) => { patch((x) => ({ ...x, torrent: { ...x.torrent, dhtBootstrapNodes: v ? v.split(/\s+/) : [] } })); }} />
      </Group>
      <Group title="Connection">
        <Num title="Listening port (0 for any)" value={t.listenPort} min={0} max={65535} onChange={(v) => { patch((x) => ({ ...x, torrent: { ...x.torrent, listenPort: v === 0 || v >= 1024 ? v : 1024 } })); }} />
        <Toggle title="Ask the router to forward the port (UPnP, NAT-PMP)" checked={t.portMapping} onChange={(v) => { patch((x) => ({ ...x, torrent: { ...x.torrent, portMapping: v } })); }} />
        <Choice
          title="Network adapter"
          description="Torrents use only this adapter, such as a VPN's. If it disconnects, they stop rather than use another."
          value={t.networkAdapter ?? ANY}
          options={adapterOptions}
          onChange={(v) => { patch((x) => ({ ...x, torrent: { ...x.torrent, networkAdapter: v === ANY ? null : v } })); }}
        />
        <div className="py-2.5 text-xs text-fg-muted">
          {network.isPending ? (
            'Asking the torrent helper…'
          ) : network.isError ? (
            toApiError(network.error).message
          ) : (
            <>
              {network.data.adapterMissing !== null ? (
                <p className="text-warning">The network adapter chosen for torrents isn’t connected: torrents connect through no other until it is.</p>
              ) : (
                <p>{network.data.listenError ? `Couldn’t listen: ${network.data.listenError}` : `Listening on port ${String(network.data.listenPort)}.`}</p>
              )}
              <p>{portMapText(network.data)}</p>
            </>
          )}
        </div>
      </Group>
      <Group title="New torrents" description="What the Add dialog starts with.">
        <Toggle title="Choose files of magnet links before downloading" checked={s.newTorrents.chooseFilesForMagnets} onChange={(v) => { patch((x) => ({ ...x, newTorrents: { ...x.newTorrents, chooseFilesForMagnets: v } })); }} />
        <div className="py-2.5">
          <SeedingFields value={s.newTorrents.seeding} onChange={(seeding) => { patch((x) => ({ ...x, newTorrents: { ...x.newTorrents, seeding } })); }} />
        </div>
        <Num title="Upload limit for each new torrent (KiB/s, 0 for none)" value={s.newTorrents.uploadLimitKib} min={0} max={2_000_000} onChange={(v) => { patch((x) => ({ ...x, newTorrents: { ...x.newTorrents, uploadLimitKib: v } })); }} />
      </Group>
    </>
  );
}

function AdvancedSection({ s, patch }: { s: Settings; patch: Patch }) {
  const { data: capabilities } = useCapabilities();
  const [forgetting, setForgetting] = useState(false);
  const forgetServers = async () => {
    setForgetting(true);
    try {
      await api.forgetLearnedServers();
      toast.success('Forgot what was learned about servers');
    } catch (e) {
      toast.error(toApiError(e).message);
    } finally {
      setForgetting(false);
    }
  };
  const e = s.engine;
  const engine = (change: Partial<Settings['engine']>) => { patch((x) => ({ ...x, engine: { ...x.engine, ...change } })); };
  return (
    <>
      <Group title="Protocols">
        {capabilities ? (
          <CapabilityOption label="Metalink" availability={availability(capabilities, 'metalink')} checked={s.advanced.enableMetalink} onChange={(v) => { patch((x) => ({ ...x, advanced: { ...x.advanced, enableMetalink: v } })); }} />
        ) : null}
        <Text title="User agent" description="What new downloads tell servers they are; empty for Apollo Download Manager’s own." value={s.advanced.userAgent} placeholder="ApolloDownloadManager/…" onChange={(v) => { patch((x) => ({ ...x, advanced: { ...x.advanced, userAgent: v } })); }} />
      </Group>
      <Group title="Retries and timeouts" description="For downloads that start or retry after a change.">
        <Num title="Failures in a row before giving up" value={e.failuresInARow} min={1} max={100} onChange={(v) => { engine({ failuresInARow: v }); }} />
        <Num title="Longest wait before a retry (s)" value={e.maxRetryWaitSecs} min={1} max={600} onChange={(v) => { engine({ maxRetryWaitSecs: v }); }} />
        <Num title="Times a failed download starts again" value={e.downloadRetries} min={0} max={10} onChange={(v) => { engine({ downloadRetries: v }); }} />
        <Num title="Shown as stalled after (s without data)" value={e.stalledAfterSecs} min={5} max={600} onChange={(v) => { engine({ stalledAfterSecs: v, resetAfterSecs: Math.max(v, e.resetAfterSecs) }); }} />
        <Num title="A request starts again after (s without data)" value={e.resetAfterSecs} min={Math.max(5, e.stalledAfterSecs)} max={3600} onChange={(v) => { engine({ resetAfterSecs: v }); }} />
        <Num title="Connect timeout (s)" value={e.connectTimeoutSecs} min={1} max={300} onChange={(v) => { engine({ connectTimeoutSecs: v }); }} />
      </Group>
      <Group title="Disk">
        <Choice<Preallocation>
          title="Preallocation"
          description="How room is made for a file. Sparse is fastest on most disks; full reserves the space at the start, so a full disk fails at once."
          value={e.preallocation}
          options={[
            { value: 'sparse', label: 'Sparse (default)' },
            { value: 'full', label: 'Full' },
            { value: 'none', label: 'None' },
          ]}
          onChange={(v) => { engine({ preallocation: v }); }}
        />
        <Num title="Write buffer per connection (MiB)" value={e.writeBufferMib} min={1} max={64} onChange={(v) => { engine({ writeBufferMib: v }); }} />
      </Group>
      <Group title="Servers">
        <Action
          title="What Apollo Download Manager learned about servers"
          description="How many connections each server allowed, so later downloads from it start at the right pace. Kept on this computer for 7 days, and never exported."
          label="Forget servers"
          busy={forgetting}
          onClick={() => void forgetServers()}
        />
      </Group>
    </>
  );
}

/** Theme, density and the time format, saved with the window's look (`set_appearance`), never over a panel width (#29). */
function AppearanceSection() {
  const qc = useQueryClient();
  const { data } = useShellSettings();
  const set = (change: Partial<AppearanceSettings>) => {
    const current = qc.getQueryData<ShellSettings>(keys.shellSettings);
    if (!current) return;
    api
      .setAppearance({ ...current.appearance, ...change })
      .then((appearance) => { qc.setQueryData<ShellSettings>(keys.shellSettings, (s) => (s ? { ...s, appearance } : s)); })
      .catch((e: unknown) => toast.error(toApiError(e).message));
  };
  if (!data) return null;
  return (
    <Group title="Appearance">
      <Choice<Theme>
        title="Theme"
        value={data.appearance.theme}
        options={[
          { value: 'system', label: 'Match the system' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
        onChange={(theme) => { set({ theme }); }}
      />
      <Choice<Density>
        title="List density"
        value={data.appearance.density}
        options={[
          { value: 'compact', label: 'Compact' },
          { value: 'comfortable', label: 'Comfortable' },
        ]}
        onChange={(density) => { set({ density }); }}
      />
      <Choice<TimeFormat>
        title="Time format"
        description="For every time the app shows, the schedule included."
        value={data.appearance.timeFormat}
        options={[
          { value: 'twentyFourHour', label: '24-hour (14:30)' },
          { value: 'twelveHour', label: '12-hour (2:30 PM)' },
        ]}
        onChange={(timeFormat) => { set({ timeFormat }); }}
      />
    </Group>
  );
}
