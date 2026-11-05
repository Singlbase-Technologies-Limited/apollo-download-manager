import { Copy } from 'lucide-react';
import { Button } from '../../components/Button';
import { Tooltip } from '../../components/Tooltip';
import { copyText } from '../../lib/clipboard';

/**
 * A long value in the details panel, such as a link or a folder (#349): shown short, in at most two lines, with the
 * full value in a tooltip, read whole by screen readers, and a button that copies all of it.
 */
export function CopyableValue({ value, shown, what }: { value: string; shown: string; what: string }) {
  const short = shown !== value;
  return (
    <span className="flex min-w-0 items-start gap-1">
      {short ? (
        <>
          <Tooltip label={value}>
            <span className="line-clamp-2 min-w-0 flex-1 break-all" aria-hidden>
              {shown}
            </span>
          </Tooltip>
          <span className="sr-only">{value}</span>
        </>
      ) : (
        <span className="line-clamp-2 min-w-0 flex-1 break-all">{value}</span>
      )}
      <Tooltip label={`Copy ${what.toLowerCase()}`}>
        <Button variant="ghost" size="icon-sm" className="-my-1 size-6 shrink-0" aria-label={`Copy ${what.toLowerCase()}`} onClick={() => void copyText(value, what)}>
          <Copy className="size-3.5" aria-hidden />
        </Button>
      </Tooltip>
    </span>
  );
}
