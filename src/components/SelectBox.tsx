import { CheckInput } from './CheckInput';

/** A checkbox that can also be partly checked (`'mixed'`): a list's select-all, or a folder of a torrent (#59, #63). */
export function SelectBox({ checked, label, onChange, disabled }: { checked: boolean | 'mixed'; label: string; onChange: () => void; disabled?: boolean }) {
  return (
    <CheckInput aria-label={label} checked={checked === true} mixed={checked === 'mixed'} disabled={disabled} onChange={onChange} />
  );
}
