import { ChevronRight, Copy } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Tooltip } from '../../components/Tooltip';
import type { FailureClass, TransferError } from '../../contract';
import { copyText } from '../../lib/clipboard';
import { cn } from '../../lib/cn';

const RETRY_HINT: Record<FailureClass, string> = {
  transient: 'Retrying may help once the cause is fixed.',
  throttled: 'The server asked Apollo Download Manager to slow down. Retrying later may help.',
  permanent: 'Retrying is unlikely to help without changing the request.',
};

/**
 * Why a download stopped, in plain words (#252): the message, the HTTP status and whether retrying may help.
 * The library's own text, when there is one, sits behind a closed "Technical details" toggle, ready to copy
 * for a bug report. `children` are the actions that go with it.
 */
export function ErrorNotice({ error, className, children }: { error: TransferError; className?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  return (
    // A long word, such as a host key's fingerprint or a path, wraps inside the panel (#248), as the rows do.
    <div role="alert" className={cn('min-w-0 break-words rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger', className)}>
      <p className="font-medium">{error.message}</p>
      <p className="mt-1 opacity-80">
        {error.httpStatus !== null ? `HTTP ${String(error.httpStatus)}. ` : ''}
        {RETRY_HINT[error.class]}
      </p>
      {error.detail ? (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailId}
            onClick={() => { setOpen((o) => !o); }}
            className="mt-2 flex cursor-pointer items-center gap-1 font-medium text-fg-muted hover:text-fg"
          >
            <ChevronRight className={cn('size-3.5 transition-transform motion-reduce:transition-none', open && 'rotate-90')} aria-hidden />
            Technical details
          </button>
          {open ? (
            <div id={detailId} className="relative mt-1.5 rounded-md border border-danger/30 bg-surface py-1.5 pl-2 pr-8">
              <code className="whitespace-pre-wrap break-all font-mono text-[11px] text-fg-muted">{error.detail}</code>
              <Tooltip label="Copy technical details">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Copy technical details"
                  className="absolute right-0.5 top-0.5"
                  onClick={() => void copyText(error.detail ?? '', 'Technical details')}
                >
                  <Copy aria-hidden />
                </Button>
              </Tooltip>
            </div>
          ) : null}
        </>
      ) : null}
      {children}
    </div>
  );
}
