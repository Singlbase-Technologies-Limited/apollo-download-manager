import { BrandLogo } from '../components/BrandLogo';

/**
 * What the window shows while it starts (#363): the full logo, its only place in the main window besides the
 * first-run screens, with a thin moving bar. It lasts exactly as long as loading does, never longer; under reduced
 * motion the bar stands still (index.css).
 */
export function StartupLoader() {
  return (
    <div role="status" aria-label="Starting Apollo Download Manager" className="flex h-full flex-col items-center justify-center gap-5">
      <BrandLogo className="h-auto w-40 max-w-[50%]" />
      <div className="h-[3px] w-32 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        <div className="loader-bar h-full w-2/5 rounded-full bg-accent" />
      </div>
      <span className="text-xs text-fg-muted">Starting…</span>
    </div>
  );
}
