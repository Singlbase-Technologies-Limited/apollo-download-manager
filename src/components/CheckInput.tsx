import type { InputHTMLAttributes, Ref } from 'react';
import { cn } from '../lib/cn';

/**
 * The window's one checkbox (#348 G), drawn by the `check-input` class (index.css): a native input, so the keyboard,
 * forms and screen readers work as everywhere, with the app's look in both themes. `mixed` shows it partly checked.
 * Every checkbox goes through it, or through `Checkbox`, `SelectBox` and `Toggle`, which use it.
 */
export function CheckInput({ mixed = false, className, ref, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { mixed?: boolean; ref?: Ref<HTMLInputElement> }) {
  return (
    <input
      {...props}
      type="checkbox"
      aria-checked={mixed ? 'mixed' : undefined}
      className={cn('check-input', className)}
      ref={(el) => {
        if (el) el.indeterminate = mixed;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
    />
  );
}
