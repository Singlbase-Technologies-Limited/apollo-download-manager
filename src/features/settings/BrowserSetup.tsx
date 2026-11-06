import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Spinner';
import type { Browser, Registration } from '../../contract';
import { api } from '../../lib/api';
import { copyText } from '../../lib/clipboard';
import { toApiError } from '../../lib/errors';
import { BROWSER_NAMES } from './browserNames';


function statusText(r: Registration): string {
  if (!r.registered) return 'Not registered';
  if (!r.hostMatches) return 'Registered for another copy of Apollo Download Manager. Register again to use this one.';
  return 'Registered';
}

/**
 * Setting up browser integration (#241), in Settings, Browser and in Get started: each browser
 * installed here, and any still registered, with Register or Unregister and "Get the extension",
 * which opens the extension's store page in that browser. The store pages come with #240; until
 * then the button is off and says why.
 */
export function BrowserSetup() {
  const qc = useQueryClient();
  const integration = useQuery({ queryKey: ['browser-integration'], queryFn: api.browserIntegration });
  const [busy, setBusy] = useState<Browser | null>(null);
  const [unopened, setUnopened] = useState<{ browser: Browser; url: string } | null>(null);

  const change = async (browser: Browser, register: boolean) => {
    setBusy(browser);
    try {
      qc.setQueryData(['browser-integration'], await (register ? api.registerBrowser(browser) : api.unregisterBrowser(browser)));
      toast.success(`${register ? 'Registered with' : 'Unregistered from'} ${BROWSER_NAMES[browser]}`);
    } catch (e) {
      toast.error(toApiError(e).message);
    } finally {
      setBusy(null);
    }
  };

  const open = async (r: Registration) => {
    if (r.storeUrl === null) return;
    setUnopened(null);
    try {
      await api.openExtensionPage(r.browser);
    } catch {
      setUnopened({ browser: r.browser, url: r.storeUrl });
    }
  };

  if (integration.isPending) {
    return (
      <div className="flex items-center gap-2 py-2.5 text-xs text-fg-muted">
        <Spinner /> Checking the browsers…
      </div>
    );
  }
  if (integration.isError) {
    return (
      <p role="alert" className="py-2.5 text-xs text-danger">
        {toApiError(integration.error).message}
      </p>
    );
  }
  const { hostPath, registrations } = integration.data;
  const shown = registrations.filter((r) => r.found !== null || r.registered);
  const noStore = shown.some((r) => r.storeUrl === null);
  return (
    <div className="flex flex-col">
      {hostPath === null ? (
        <p role="alert" className="py-2.5 text-xs text-danger">
          The browser connection program isn’t installed beside Apollo Download Manager, so no browser can be registered. Reinstall Apollo Download Manager.
        </p>
      ) : null}
      {shown.length === 0 ? (
        <p className="py-2.5 text-xs text-fg-muted">No supported browser was found on this computer. Apollo Download Manager works with Chrome, Chromium, Edge, Brave and Firefox.</p>
      ) : null}
      {shown.map((r) => (
        <div key={r.browser} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
          <div className="min-w-0">
            <p className="text-[13px]">{BROWSER_NAMES[r.browser]}</p>
            <p className="text-xs text-fg-muted">{statusText(r)}</p>
            {r.found === null ? <p className="text-xs text-fg-subtle">This browser isn’t installed any more. Unregister it to tidy up.</p> : null}
            {r.found?.sandboxed ? <p className="text-xs text-warning">Installed as a Snap or Flatpak. It may not work with a Snap or Flatpak browser, which may not be allowed to start Apollo Download Manager’s connection.</p> : null}
            {unopened?.browser === r.browser ? (
              <div role="alert" className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-danger">{BROWSER_NAMES[r.browser]} didn’t open. Open this link in it:</span>
                <span className="break-all font-mono text-fg">{unopened.url}</span>
                <Button size="sm" variant="ghost" onClick={() => void copyText(unopened.url, 'Link')}>
                  Copy the link
                </Button>
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {r.found !== null ? (
              <Button size="sm" variant="secondary" aria-label={`Get the extension for ${BROWSER_NAMES[r.browser]}`} disabled={r.storeUrl === null} onClick={() => void open(r)}>
                Get the extension
              </Button>
            ) : null}
            {r.registered && r.hostMatches ? (
              <Button size="sm" variant="secondary" aria-label={`Unregister from ${BROWSER_NAMES[r.browser]}`} busy={busy === r.browser} disabled={busy !== null} onClick={() => void change(r.browser, false)}>
                Unregister
              </Button>
            ) : (
              <Button size="sm" variant="primary" aria-label={`Register with ${BROWSER_NAMES[r.browser]}`} busy={busy === r.browser} disabled={busy !== null || hostPath === null} onClick={() => void change(r.browser, true)}>
                Register
              </Button>
            )}
          </div>
        </div>
      ))}
      {noStore ? (
        <p className="mt-1 rounded-md bg-warning-soft px-3 py-2 text-xs text-fg">
          The extension isn’t in the browser stores yet, so “Get the extension” is off for now. It turns on in an update once the store pages are live.
        </p>
      ) : null}
    </div>
  );
}
