import { useEffect, useRef } from 'react';
import type { DownloadRecord } from '../../contract';
import { useDownloadsStore } from '../../stores/downloads';
import { useUiStore } from '../../stores/ui';

const refusedLogin = (d: DownloadRecord) => d.status === 'failed' && d.error?.loginRequired === true;

/**
 * Opens the login window when a download fails because the server refused its login (#249), then retries with
 * the login given. Once per failure: a download that fails so again, after a retry with a wrong password, asks
 * again. Failures already in the list when the window opens don't ask; their row says what happened.
 */
export function useLoginPrompt() {
  const downloads = useDownloadsStore((s) => s.snapshot?.downloads);
  const askLogin = useUiStore((s) => s.askLogin);
  // The downloads already failed on a refused login, by id; null until the first snapshot.
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!downloads) return;
    const now = new Set(downloads.filter(refusedLogin).map((d) => d.id));
    const before = known.current;
    known.current = now;
    if (!before) return;
    const fresh = [...now].find((id) => !before.has(id));
    if (fresh && useUiStore.getState().loginRequest === null) askLogin({ id: fresh, then: 'retry' });
  }, [downloads, askLogin]);
}
