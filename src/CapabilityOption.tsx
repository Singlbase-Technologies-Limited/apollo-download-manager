// A control for something this build may lack (#57): disabled, with the reason, when it does.
import { useId } from 'react';
import type { Availability } from './capabilities';
import { CheckInput } from './components/CheckInput';

/** A checkbox for something the build may lack: disabled, with the reason, when it does. */
export function CapabilityOption(props: {
  label: string;
  availability: Availability;
  checked: boolean;
  onChange?: (checked: boolean) => void;
}) {
  const id = useId();
  const reasonId = `${id}-reason`;
  const { available, reason } = props.availability;
  return (
    // The box sits on its label's line, the reason under the label, as the other settings read (PO, 2026-11-06).
    <div className="py-2.5">
      <div className="flex items-center gap-2.5">
        <CheckInput
          id={id}
          checked={available && props.checked}
          disabled={!available}
          aria-describedby={reason ? reasonId : undefined}
          onChange={(e) => props.onChange?.(e.target.checked)}
        />
        <label htmlFor={id} className="text-[13px]">
          {props.label}
        </label>
      </div>
      {reason && (
        <p id={reasonId} className="ml-[1.625rem] mt-0.5 text-xs text-fg-muted">
          {reason}
        </p>
      )}
    </div>
  );
}
