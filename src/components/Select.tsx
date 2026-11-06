import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/cn';
import { fieldClass } from './fieldStyles';
import { menuContent } from './Menu';

export interface SelectOption {
  /** Never empty: an empty value means "nothing chosen" to the list. */
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * The window's one dropdown (#348 G). The closed box looks like the other fields, and the open list follows the
 * app's theme like the menus do (PO, 2026-11-05). Keyboard and screen readers work as with the system's list:
 * Enter, Space and the arrows open it, the arrows and typed letters move, Enter takes, Escape closes.
 * Name it with a `<label htmlFor={id}>`, the `Field` around it, or `aria-label`.
 */
export function Select({
  id,
  value,
  options,
  onValueChange,
  disabled,
  placeholder,
  className,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: {
  id?: string;
  value: string;
  options: readonly SelectOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  /** Shown while `value` matches no option. */
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}) {
  // The options are mounted only while the list is open: closed, Radix would keep every one of them in a hidden
  // fragment to find the chosen label, and a time field has 84. The box gets that label directly instead.
  const [open, setOpen] = useState(false);
  const chosen = options.find((o) => o.value === value);
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled} open={open} onOpenChange={setOpen}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        className={cn(
          fieldClass,
          'flex h-8 cursor-pointer items-center justify-between gap-2 text-left disabled:cursor-not-allowed data-[state=open]:border-accent data-[state=open]:ring-2 data-[state=open]:ring-accent/25',
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          <SelectPrimitive.Value placeholder={placeholder}>{chosen?.label}</SelectPrimitive.Value>
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-fg-subtle" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      {open ? (
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content position="popper" sideOffset={4} collisionPadding={8} className={cn(menuContent, 'max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden')}>
            <SelectPrimitive.Viewport>
              {options.map((o) => (
                <SelectPrimitive.Item
                  key={o.value}
                  value={o.value}
                  disabled={o.disabled}
                  className="relative flex cursor-pointer select-none items-center rounded-md py-1.5 pl-7 pr-2 outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-3 data-[state=checked]:font-medium"
                >
                  <SelectPrimitive.ItemIndicator className="absolute left-2 flex items-center">
                    <Check className="size-3.5 text-accent" aria-hidden />
                  </SelectPrimitive.ItemIndicator>
                  <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      ) : null}
    </SelectPrimitive.Root>
  );
}
