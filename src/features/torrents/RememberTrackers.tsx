import { Checkbox } from '../../components/Checkbox';

/**
 * Remembering a torrent's trackers in the system keychain (#472, ADR-0021), in the Add dialog and the Edit dialog, off
 * by default, as remembering a login is. A private tracker's address carries the user's passkey: without it, a private
 * torrent finds no peers after a restart.
 */
export function RememberTrackers({ checked, onChange }: { checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <Checkbox checked={checked} onChange={onChange}>
      Remember this torrent’s trackers in the system keychain, so a private torrent still finds peers after a restart
    </Checkbox>
  );
}
