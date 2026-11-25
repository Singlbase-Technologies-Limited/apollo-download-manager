import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '../../components/Button';
import type { ShellSettings } from '../../contract';
import { api } from '../../lib/api';
import { toApiError } from '../../lib/errors';
import { keys } from '../../lib/queries';
import { useUiStore } from '../../stores/ui';
import { placeBubble, TOUR_STEPS, type Box } from './guideLogic';

/** Saves how the guide ended, the first time only: a replay from Help changes nothing. */
function useEndTour() {
  const qc = useQueryClient();
  const endTour = useUiStore((s) => s.endTour);
  return useCallback(
    (how: 'finished' | 'skipped') => {
      endTour();
      if (qc.getQueryData<ShellSettings>(keys.shellSettings)?.guide !== 'unseen') return;
      api.setGuideState(how).then(
        (settings) => { qc.setQueryData(keys.shellSettings, settings); },
        (e: unknown) => { toast.error(`The guide couldn’t be marked as seen: ${toApiError(e).message}`); },
      );
    },
    [qc, endTour],
  );
}

/** The control a step lights up, by its `data-tour` mark; `null` when it isn't on screen. */
function boxOf(target: string): Box | null {
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
}

const sameBox = (a: Box | null, b: Box | null) => a === b || (a !== null && b !== null && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height);

/**
 * The guide after Get started (#463, PO decision 2026-11-17: a spotlight on the real window): the window dims, the
 * step's control is lit, and a bubble beside it says what it does, with Skip the guide, Back and Next. The keyboard
 * stays in the bubble, Escape skips, and each step's title takes the focus, so it is read out.
 */
export function GuideTour() {
  const step = useUiStore((s) => s.tourStep);
  const setStep = useUiStore((s) => s.setTourStep);
  const end = useEndTour();
  const bubbleRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const current = step === null ? null : TOUR_STEPS[step];

  // The control can move as the window lays itself out (the sidebar shown for the guide, a resized window): measured
  // after each change, never on every frame.
  const measure = useCallback(() => {
    if (!current) return;
    const next = boxOf(current.target);
    setBox((prev) => (sameBox(prev, next) ? prev : next));
    const b = bubbleRef.current?.getBoundingClientRect();
    setPlace(placeBubble(next, { width: b?.width || 320, height: b?.height || 180 }, { width: window.innerWidth, height: window.innerHeight }));
  }, [current]);

  useLayoutEffect(() => {
    titleRef.current?.focus();
    // In the next frame, once the step is drawn; once more after the sidebar has slid in for the guide.
    const frame = window.requestAnimationFrame(measure);
    const timer = window.setTimeout(measure, 250);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [measure]);

  useEffect(() => {
    if (step === null) return;
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(document.body);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [step, measure]);

  if (step === null || !current) return null;
  const last = step === TOUR_STEPS.length - 1;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      end('skipped');
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...(bubbleRef.current?.querySelectorAll<HTMLElement>('button, [tabindex="-1"]') ?? [])];
    const first = items[0];
    const lastItem = items[items.length - 1];
    if (!first || !lastItem) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      lastItem.focus();
    } else if (!e.shiftKey && document.activeElement === lastItem) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60]" data-testid="guide-tour">
      {/* The dim layer, with the lit control cut out of it; it takes the clicks, so the window waits for the guide. */}
      {box ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-lg ring-2 ring-accent transition-all motion-reduce:transition-none"
          style={{ left: box.left - 4, top: box.top - 4, width: box.width + 8, height: box.height + 8, boxShadow: '0 0 0 9999px rgb(11 18 32 / 0.55)' }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-[rgb(11_18_32/0.55)]" />
      )}
      <div
        ref={bubbleRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-step-title"
        aria-describedby="guide-step-text"
        onKeyDown={onKeyDown}
        className="fixed flex w-80 max-w-[calc(100vw-1rem)] flex-col gap-2 rounded-xl border border-border bg-surface p-4 shadow-panel"
        style={place ? { left: place.left, top: place.top } : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
      >
        <p className="text-xs font-medium text-fg-subtle">
          Step {step + 1} of {TOUR_STEPS.length}
        </p>
        <h2 id="guide-step-title" ref={titleRef} tabIndex={-1} className="text-base font-semibold text-fg outline-none">
          {current.title}
        </h2>
        <p id="guide-step-text" className="text-[13px] leading-relaxed text-fg-muted">
          {current.text}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { end('skipped'); }}>
            Skip the guide
          </Button>
          <span className="flex-1" />
          {step > 0 ? (
            <Button size="sm" onClick={() => { setStep(step - 1); }}>
              Back
            </Button>
          ) : null}
          <Button variant="primary" size="sm" onClick={() => { if (last) end('finished'); else setStep(step + 1); }}>
            {last ? 'Done' : 'Next'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The offer on the first view after Get started (#463, PO decision 2026-11-17: upgraders from 0.2.0 too, as a new
 * quick tour). It stays until the user answers: Show me around starts the guide, Skip saves that it was skipped.
 */
export function GuideOffer({ settings }: { settings: ShellSettings }) {
  const tourStep = useUiStore((s) => s.tourStep);
  const startTour = useUiStore((s) => s.startTour);
  const end = useEndTour();
  if (!settings.onboardingCompleted || settings.guide !== 'unseen' || tourStep !== null) return null;
  const title = settings.guideWelcome ? 'Welcome to Apollo Download Manager' : 'New: a quick tour of the window';
  const text = settings.guideWelcome
    ? 'Want a quick look around this window? It has 6 short steps, and you can stop at any time.'
    : 'See where everything is in 6 short steps, and stop at any time.';
  return (
    <section aria-labelledby="guide-offer-title" className="mx-1 mb-1 flex flex-wrap items-center gap-3 rounded-lg border border-accent/30 bg-accent-soft px-4 py-3">
      <div className="min-w-0 flex-1">
        <h2 id="guide-offer-title" className="text-sm font-semibold text-fg">
          {title}
        </h2>
        <p className="text-[13px] text-fg-muted">{text}</p>
      </div>
      <Button variant="ghost" onClick={() => { end('skipped'); }}>
        Skip
      </Button>
      <Button variant="primary" onClick={startTour}>
        Show me around
      </Button>
    </section>
  );
}
