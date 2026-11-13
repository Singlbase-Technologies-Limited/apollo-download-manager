import { Checkbox } from '../../components/Checkbox';

/**
 * How a torrent's pieces come in (#470, PO decision: two separate switches), in the Add dialog and the Edit dialog. In
 * order lets a player open a file while it downloads, but gives the swarm fewer rare pieces, so it can be slower.
 */
export function OrderFields({
  inOrder,
  endsFirst,
  onInOrder,
  onEndsFirst,
}: {
  inOrder: boolean;
  endsFirst: boolean;
  onInOrder: (on: boolean) => void;
  onEndsFirst: (on: boolean) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Checkbox checked={inOrder} onChange={onInOrder}>
        Download in order, to watch or listen while it downloads (can be slower)
      </Checkbox>
      <Checkbox checked={endsFirst} onChange={onEndsFirst}>
        First and last pieces first, so a player can open each file early
      </Checkbox>
    </div>
  );
}
