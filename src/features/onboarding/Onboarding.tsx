import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FolderOpen, ShieldCheck, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BrandLogo } from '../../components/BrandLogo';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Spinner } from '../../components/Spinner';
import type { AppInfo, EngineHealth } from '../../contract';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { ERROR_MESSAGES, toApiError } from '../../lib/errors';
import { keys } from '../../lib/queries';
import { useDownloadsStore } from '../../stores/downloads';
import { useUiStore } from '../../stores/ui';
import { BrowserSetup } from '../settings/BrowserSetup';
import { BROWSER_NAMES } from '../settings/browserNames';

function EngineStatus({ health }: { health: EngineHealth | undefined }) {
  const [icon, title, detail] =
    health?.state === 'running'
      ? [<CheckCircle2 key="i" className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />, 'The transfer engine is running', 'It runs on this computer, as its own process.']
      : health?.state === 'unavailable'
        ? [<XCircle key="i" className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />, 'The transfer engine isn’t available', ERROR_MESSAGES[health.code]]
        : [<Spinner key="i" className="mt-0.5" />, 'Starting the transfer engine…', 'This takes a moment.'];
  return (
    <div className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-xs" role="status" aria-label="Transfer engine">
      {icon}
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-fg-muted">{detail}</p>
      </div>
    </div>
  );
}

type Step = 'folder' | 'browser' | 'ready';
const STEPS: Step[] = ['folder', 'browser', 'ready'];

function Progress({ step }: { step: Step }) {
  const n = STEPS.indexOf(step) + 1;
  return (
    <div className="flex items-center gap-2 text-xs text-fg-muted">
      {STEPS.map((s, i) => (
        <span key={s} aria-hidden className={cn('h-1 w-6 rounded-full', i < n ? 'bg-accent' : 'bg-border')} />
      ))}
      <span className="ml-1">{`Step ${String(n)} of ${String(STEPS.length)}${step === 'browser' ? ' · optional' : ''}`}</span>
    </div>
  );
}

/** The browsers registered for this copy, by name, from the browser list's own query. */
function useRegisteredNames(): string[] {
  const integration = useQuery({ queryKey: ['browser-integration'], queryFn: api.browserIntegration });
  return (integration.data?.registrations ?? []).filter((r) => r.registered && r.hostMatches).map((r) => BROWSER_NAMES[r.browser]);
}

/**
 * The first-run setup (V1's Onboarding), one step at a time (#372, PO: mockup A): the download folder, with the
 * engine's state; the browser, optional and skippable (#65, #241); then a summary and Get started. Unlike V1 it
 * doesn't wait for the engine: V2's window works without one and says why (#58). In a small window the card scrolls
 * from its top (`m-auto`, not centring that overflows upwards), so the logo is never cut off.
 */
export function Onboarding({ app, defaultDirectory }: { app: AppInfo; defaultDirectory: string }) {
  const qc = useQueryClient();
  const engine = useDownloadsStore((s) => s.snapshot?.engine);
  const openGuide = useUiStore((s) => s.openGuide);
  const [step, setStep] = useState<Step>('folder');
  const [directory, setDirectory] = useState(defaultDirectory);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const registered = useRegisteredNames();
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  // Each new step's heading takes focus, so a screen reader reads on from it; not the first, which the window
  // opens with.
  useEffect(() => {
    if (moved.current) heading.current?.focus();
    moved.current = true;
  }, [step]);

  const browse = async () => {
    setError(null);
    try {
      const chosen = await api.chooseDirectory(directory.trim() || null);
      if (chosen) setDirectory(chosen);
    } catch (e) {
      setError(toApiError(e).message);
    }
  };

  const finish = async () => {
    setError(null);
    setSaving(true);
    try {
      qc.setQueryData(keys.shellSettings, await api.completeOnboarding(directory.trim()));
    } catch (e) {
      setError(toApiError(e).message);
      setSaving(false);
    }
  };

  const go = (to: Step) => {
    setError(null);
    setStep(to);
  };

  // A missing folder is said here, where it can be changed, not only by Get started (#403).
  const leaveFolder = async () => {
    setError(null);
    setChecking(true);
    try {
      const check = await api.checkDestination('', directory.trim(), null, null);
      if (check.directoryExists) go('browser');
      else setError(ERROR_MESSAGES.DESTINATION_MISSING);
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setChecking(false);
    }
  };
  const headingClass = 'text-lg font-semibold outline-none';

  return (
    <div className="flex h-full overflow-y-auto bg-bg p-4 sm:p-8">
      <div className="m-auto flex w-full max-w-lg flex-col gap-5 rounded-2xl border border-border bg-surface p-6 shadow-panel sm:p-8">
        <Progress step={step} />

        {step === 'folder' ? (
          <>
            <div className="flex flex-col gap-3">
              <BrandLogo className="h-9 w-auto self-start" />
              <div>
                <h1 ref={heading} tabIndex={-1} className={headingClass}>
                  Welcome to {app.name}
                </h1>
                <p className="text-xs text-fg-muted">{`Version ${app.version}. Two quick choices, and you’re ready.`}</p>
              </div>
            </div>
            <section className="flex flex-col gap-2" aria-labelledby="onboarding-folder">
              <h2 id="onboarding-folder" className="text-[15px] font-semibold">
                Where should downloads go?
              </h2>
              <div className="flex gap-2">
                <Input aria-label="Download folder" value={directory} onChange={(e) => { setDirectory(e.target.value); }} placeholder="Choose a folder" />
                <Button variant="secondary" onClick={() => void browse()}>
                  <FolderOpen aria-hidden /> Browse…
                </Button>
              </div>
              <p className="text-xs text-fg-subtle">Choose a folder that exists. You can change it later in Settings.</p>
            </section>
            <EngineStatus health={engine} />
          </>
        ) : step === 'browser' ? (
          <>
            <div>
              <h1 ref={heading} tabIndex={-1} className={headingClass}>
                Send downloads from your browser?
              </h1>
              <p className="mt-1 text-[13px] text-fg-muted">Register a browser so its downloads can come here. You can skip this and do it later in Settings, Browser.</p>
            </div>
            <BrowserSetup />
          </>
        ) : (
          <>
            <div>
              <h1 ref={heading} tabIndex={-1} className={headingClass}>
                You’re ready
              </h1>
              <p className="mt-1 text-[13px] text-fg-muted">Here’s what you chose. Everything can be changed later in Settings.</p>
            </div>
            <dl className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-lg bg-surface-2 px-4 py-3 text-[13px]">
              <dt className="text-fg-muted">Downloads go to</dt>
              <dd className="break-all font-medium">{directory.trim()}</dd>
              <dt className="text-fg-muted">Browsers</dt>
              <dd className="font-medium">{registered.length > 0 ? registered.join(', ') : 'None yet'}</dd>
            </dl>
            <p className="flex items-start gap-2 text-xs text-fg-muted">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              No analytics or telemetry. Your downloads, history and settings stay on this computer.
            </p>
            <p className="text-xs text-fg-muted">
              New here?{' '}
              <button type="button" className="text-accent underline-offset-2 hover:underline" onClick={() => { openGuide(); }}>
                Open the user guide
              </button>
            </p>
          </>
        )}

        {error ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {step !== 'folder' ? (
            <Button variant="secondary" onClick={() => { go(step === 'ready' ? 'browser' : 'folder'); }}>
              Back
            </Button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-fg-muted">
              <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden /> No analytics or telemetry.
            </span>
          )}
          <span className="flex-1" />
          {step === 'browser' ? (
            <Button variant="ghost" onClick={() => { go('ready'); }}>
              Skip
            </Button>
          ) : null}
          {step === 'ready' ? (
            <Button variant="primary" size="lg" busy={saving} disabled={!directory.trim()} onClick={() => void finish()}>
              Get started
            </Button>
          ) : (
            <Button variant="primary" busy={checking} disabled={!directory.trim()} onClick={() => { if (step === 'folder') void leaveFolder(); else go('ready'); }}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
