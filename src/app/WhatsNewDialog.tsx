import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import type { AppInfo } from '../contract';
import { Blocks, type Block } from '../features/help/blocks';
import changelog from './changelog.generated.json';

/*
 * What's new (#496): the changes of the running version from CHANGELOG.md, then the earlier versions'. `pnpm guide`
 * bundles the changelog as typed blocks (scripts/guide-lib.mjs), so the window works offline, fetches nothing and
 * inserts no HTML. A version with no notes of its own (a development build) says so and shows the latest.
 */

interface Version {
  version: string;
  date: string;
  blocks: Block[];
}

const VERSIONS = (changelog as unknown as { versions: Version[] }).versions;

/** The changelog's own headings sit under the version's, one level down. */
const nested = (blocks: Block[]): Block[] => blocks.map((b) => (b.type === 'heading' ? { ...b, level: b.level + 1 } : b));

export function WhatsNewDialog({ app, onClose }: { app: AppInfo; onClose: () => void }) {
  const at = VERSIONS.findIndex((v) => v.version === app.version);
  const shown = at >= 0 ? VERSIONS.slice(at) : VERSIONS;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} title="What’s new" description={`Apollo Download Manager ${app.version}`} footer={<Button onClick={onClose}>Close</Button>}>
      <div className="-mr-2 max-h-[60vh] overflow-y-auto pr-2 text-[13px] leading-relaxed text-fg">
        {at < 0 ? (
          <p className="mb-3 text-fg-muted">This version ({app.version}) has no notes of its own yet. The latest released notes follow.</p>
        ) : null}
        {shown.map((v) => (
          <section key={v.version} className="mb-5 last:mb-0">
            <h3 className="mb-1 text-[15px] font-semibold text-fg">{`Version ${v.version}, ${v.date}`}</h3>
            <Blocks blocks={nested(v.blocks)} headingIds={false} />
          </section>
        ))}
      </div>
    </Dialog>
  );
}
