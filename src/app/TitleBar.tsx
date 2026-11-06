import { BookOpen, Copy, HelpCircle, Info, MessageSquare, Minus, ScrollText, Settings, Square, X } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { BrandIcon } from '../components/BrandIcon';
import { DropdownMenu } from '../components/Menu';
import { Tooltip } from '../components/Tooltip';
import type { AppInfo, MaximizeButtonState } from '../contract';
import { api } from '../lib/api';
import { toApiError } from '../lib/errors';
import { onMaximizeButton } from '../lib/events';
import { useUiStore } from '../stores/ui';
import { WhatsNewDialog } from './WhatsNewDialog';
import { cn } from '../lib/cn';
import { closeWindow, minimizeWindow, toggleMaximizeWindow, watchMaximized } from '../lib/window';

function WindowButton({ label, onClick, danger, children, ref, native }: { label: string; onClick: () => Promise<void>; danger?: boolean; children: ReactNode; ref?: Ref<HTMLButtonElement>; native?: MaximizeButtonState }) {
  return (
    <Tooltip label={label} side="bottom">
      <button
        ref={ref}
        type="button"
        aria-label={label}
        data-native={native}
        onClick={() => void onClick()}
        className={cn(
          'flex h-full w-11 cursor-pointer items-center justify-center text-fg-muted transition-colors',
          danger ? 'hover:bg-[#c42b1c] hover:text-white' : 'hover:bg-fg/10 hover:text-fg data-[native=hover]:bg-fg/10 data-[native=hover]:text-fg data-[native=pressed]:bg-fg/20 data-[native=pressed]:text-fg',
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/**
 * The window's own title bar, in the frame colour so it reads as part of the app, like VS Code's (PO, #347).
 * The bar drags the window and a double-click maximises it; the icon and title let the drag through.
 */
/**
 * The title bar's own buttons (#363, PO decision 2026-11-06: option B): a "?" help menu with the User guide (#354), What's new, Send
 * feedback… and About, and a gear for Settings (#364), always visible at any window size.
 */
function AppButtons({ app }: { app: AppInfo }) {
  const openSettings = useUiStore((s) => s.openSettings);
  const openGuide = useUiStore((s) => s.openGuide);
  const [whatsNew, setWhatsNew] = useState(false);
  const feedback = () => {
    api.openFeedbackPage().catch((e: unknown) => { toast.error(`The feedback page couldn’t be opened: ${toApiError(e).message}`); });
  };
  const iconButton = 'flex size-7 cursor-pointer items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-fg/10 hover:text-fg data-[state=open]:bg-accent-soft data-[state=open]:text-accent';
  return (
    <div className="mr-1.5 flex items-center gap-0.5">
      <DropdownMenu
        trigger={
          <Tooltip label="Help" side="bottom">
            <button type="button" aria-label="Help" className={iconButton}>
              <HelpCircle className="size-4" aria-hidden />
            </button>
          </Tooltip>
        }
        items={[
          { label: 'User guide', icon: <BookOpen />, onSelect: () => { openGuide(); } },
          { label: 'What’s new', icon: <ScrollText />, onSelect: () => { setWhatsNew(true); } },
          { label: 'Send feedback…', icon: <MessageSquare />, onSelect: feedback },
          'separator',
          { label: 'About Apollo DM', icon: <Info />, onSelect: () => { openSettings('about'); } },
        ]}
      />
      <Tooltip label="Settings" shortcut="Ctrl+," side="bottom">
        <button type="button" aria-label="Settings" className={iconButton} onClick={() => { openSettings(); }}>
          <Settings className="size-4" aria-hidden />
        </button>
      </Tooltip>
      {whatsNew ? <WhatsNewDialog app={app} onClose={() => { setWhatsNew(false); }} /> : null}
    </div>
  );
}

/**
 * On Windows 11 a native window covers the maximise button so the system offers its snap layouts (#359). It needs to
 * know where the button is, and it says what the mouse is doing there, since the button itself no longer hears it.
 */
function useMaximizeButton() {
  const button = useRef<HTMLButtonElement>(null);
  const [native, setNative] = useState<MaximizeButtonState>('idle');
  useEffect(() => {
    const report = () => {
      const r = button.current?.getBoundingClientRect();
      if (!r || r.width === 0) return;
      // Only the snap layouts depend on it; the button works either way.
      api.setMaximizeButtonRect({ x: r.x, y: r.y, width: r.width, height: r.height }).catch((e: unknown) => { console.warn('The maximise button could not be placed:', e); });
    };
    report();
    window.addEventListener('resize', report);
    let disposed = false;
    let stop: (() => void) | undefined;
    onMaximizeButton(setNative)
      .then((s) => {
        if (disposed) s();
        else stop = s;
      })
      .catch((e: unknown) => { console.warn('The maximise button will not show the mouse:', e); });
    return () => {
      disposed = true;
      stop?.();
      window.removeEventListener('resize', report);
    };
  }, []);
  return { button, native };
}

/** `app` once the main window is set up: then its Help and Settings buttons show (#363). */
export function TitleBar({ title, app }: { title: string; app?: AppInfo }) {
  const [maximized, setMaximized] = useState(false);
  const { button, native } = useMaximizeButton();
  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;
    watchMaximized(setMaximized)
      .then((s) => {
        if (disposed) s();
        else stop = s;
      })
      // Only the maximise button's icon depends on it; the buttons work either way.
      .catch((e: unknown) => { console.warn('The window size could not be read:', e); });
    return () => {
      disposed = true;
      stop?.();
    };
  }, []);

  return (
    <header data-tauri-drag-region className="flex h-8 shrink-0 select-none items-center bg-frame">
      {/* The A mark, a little bigger than before so it reads at a glance (#363); the full logo isn't in the main window. */}
      <span className="pointer-events-none flex items-center gap-2 pl-3 text-xs text-fg-muted">
        <BrandIcon className="size-5" />
        <span>{title}</span>
      </span>
      <div className="flex-1" data-tauri-drag-region />
      {app ? <AppButtons app={app} /> : null}
      <div className="flex h-full">
        <WindowButton label="Minimize" onClick={minimizeWindow}>
          <Minus className="size-4" aria-hidden />
        </WindowButton>
        <WindowButton ref={button} native={native} label={maximized ? 'Restore' : 'Maximize'} onClick={toggleMaximizeWindow}>
          {maximized ? <Copy className="size-3.5 -scale-x-100" aria-hidden /> : <Square className="size-3.5" aria-hidden />}
        </WindowButton>
        <WindowButton label="Close" onClick={closeWindow} danger>
          <X className="size-4" aria-hidden />
        </WindowButton>
      </div>
    </header>
  );
}
