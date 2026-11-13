import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import changelog from './changelog.generated.json';
import { WhatsNewDialog } from './WhatsNewDialog';

const app = (version: string) => ({ name: 'Apollo Download Manager', version, commandApiVersion: 35 });
const released = (changelog as { versions: { version: string }[] }).versions.map((v) => v.version);

// #496: What's new shows the changelog, bundled with the app.
describe('What’s new', () => {
  it('shows the running version first, then every earlier one, newest first', () => {
    render(<WhatsNewDialog app={app('0.2.0')} onClose={() => undefined} />);
    const dialog = screen.getByRole('dialog', { name: 'What’s new' });
    const headings = within(dialog).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(released.map((v, i) => `Version ${v}, ${(changelog as { versions: { date: string }[] }).versions[i]?.date ?? ''}`));
    expect(dialog.textContent).toContain('The first version named Apollo Download Manager');
  });

  it('says so when this version has no notes of its own, and shows the latest', () => {
    render(<WhatsNewDialog app={app('9.9.9')} onClose={() => undefined} />);
    const dialog = screen.getByRole('dialog', { name: 'What’s new' });
    expect(within(dialog).getByText(/This version \(9\.9\.9\) has no notes of its own yet/)).toBeTruthy();
    expect(within(dialog).getAllByRole('heading', { level: 3 })[0]?.textContent).toBe(`Version ${released[0] ?? ''}, ${(changelog as { versions: { date: string }[] }).versions[0]?.date ?? ''}`);
  });

  it('shows a link only as its address, opening nothing', () => {
    render(<WhatsNewDialog app={app('0.2.0')} onClose={() => undefined} />);
    expect(within(screen.getByRole('dialog', { name: 'What’s new' })).queryAllByRole('link')).toEqual([]);
  });
});
