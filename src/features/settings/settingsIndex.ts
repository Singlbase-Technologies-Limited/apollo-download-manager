import type { SettingsSection } from '../../stores/ui';

/**
 * Every setting's name, by the section it is in, for the search in Settings (#364). A test opens each section and
 * checks that each name here is really shown there, so the search can't point at a setting that moved or went.
 */
export const SETTINGS_INDEX: Record<Exclude<SettingsSection, 'about'>, readonly string[]> = {
  general: ['Close to tray', 'Start minimized', 'Confirm before quitting with active downloads'],
  downloads: ['Sort into categories by file type', 'A folder for each category'],
  performance: [
    'Simultaneous downloads',
    'Start new downloads at once',
    'Restart downloads when the network is back',
    'Speed limit for direct downloads (KiB/s, 0 for none)',
    'Use the schedule',
    // "Connections to one server" and "Smallest piece" show only with the Custom profile: Profile leads to them.
    'Profile',
    'Connections for all downloads together',
  ],
  bittorrent: [
    'DHT',
    'Peer exchange',
    'Local peer discovery',
    'Peers per torrent',
    'Torrents seeding at once',
    'Upload limit for all torrents (KiB/s, 0 for none)',
    'Download limit for all torrents (KiB/s, 0 for none)',
    'Extra trackers',
    'DHT bootstrap nodes',
    'Listening port (0 for any)',
    'Ask the router to forward the port (UPnP, NAT-PMP)',
    'Choose files of magnet links before downloading',
    'Upload limit for each new torrent (KiB/s, 0 for none)',
  ],
  browser: ['Take links from the browser', 'Ask before adding', 'Browsers'],
  proxy: ['Type', 'Host', 'Port', 'User name', 'Remember the password in the system keychain'],
  notifications: ['A download completes', 'A download fails', 'A download starts', 'An engine stops and won’t start again'],
  appearance: ['Theme', 'List density', 'Time format'],
  storage: ['Keep history for (days, 0 for ever)', 'Most history entries'],
  advanced: [
    'User agent',
    'Failures in a row before giving up',
    'Longest wait before a retry (s)',
    'Times a failed download starts again',
    'Shown as stalled after (s without data)',
    'A request starts again after (s without data)',
    'Connect timeout (s)',
    'Preallocation',
    'Write buffer per connection (MiB)',
  ],
};

/** The settings whose name holds every word of `query`, case and accents aside, in section order. */
export function searchSettings(query: string): { section: Exclude<SettingsSection, 'about'>; title: string }[] {
  const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const words = fold(query).split(/\s+/).filter((w) => w !== '');
  if (words.length === 0) return [];
  return (Object.entries(SETTINGS_INDEX) as [Exclude<SettingsSection, 'about'>, readonly string[]][]).flatMap(([section, titles]) =>
    titles.filter((t) => words.every((w) => fold(t).includes(w))).map((title) => ({ section, title })),
  );
}
