import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import type { AppInfo } from '../contract';

/** What's new, until a later issue fills it from the changelog (#363): where the release notes are, nothing fetched. */
export function WhatsNewDialog({ app, onClose }: { app: AppInfo; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} title="What’s new" description={`Apollo Download Manager ${app.version}`} footer={<Button onClick={onClose}>Close</Button>}>
      <p className="text-[13px] text-fg-muted">
        Each version’s changes are in its release notes, CHANGELOG.md, published with every release on the project’s GitHub page. A later
        version will show them here.
      </p>
    </Dialog>
  );
}
