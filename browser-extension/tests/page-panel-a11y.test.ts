// @vitest-environment jsdom
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { mountPagePanel, type PagePanelStore } from '../src/shared/page-panel';
import { EMPTY_OUTCOME } from '../src/shared/protocol';

// axe-core (MPL-2.0, test only, unmodified; PO approval on #426, 2026-11-17). jsdom lays nothing out, so axe can't
// measure colour contrast here: the panel's colours are the app's tokens, which keep WCAG AA (src/index.css).
const RULES = { 'color-contrast': { enabled: false } };

const store: PagePanelStore = {
  position: null,
  size: null,
  tipSeen: false,
  savePosition: () => undefined,
  saveSize: () => undefined,
  markTipSeen: () => undefined,
  hideOnThisSite: () => undefined,
  send: () => Promise.resolve(EMPTY_OUTCOME),
};

function mounted() {
  document.body.innerHTML = '<main><h1>Files</h1></main>';
  const host = document.createElement('div');
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const ui = mountPagePanel(root, document, 'mirror.example.org', store);
  ui.update({
    files: [
      { url: 'https://mirror.example.org/a.iso', name: 'a.iso', group: 'Disk images' },
      { url: 'https://mirror.example.org/b.pdf', name: 'b.pdf', group: 'Documents' },
    ],
    skipped: [{ url: 'https://x.example/c.iso', name: 'c.iso', reason: 'domain is excluded' }],
  });
  return { ui, host };
}

async function violations(context: Element) {
  const r = await axe.run(context, { rules: RULES });
  // A node in a shadow root has a nested target, [[host, inner]]: axe did look inside the panel's root.
  expect(r.passes.some((p) => p.nodes.some((n) => n.target.some((t) => Array.isArray(t))))).toBe(true);
  return r.violations.map((v) => `${v.id}: ${JSON.stringify(v.nodes.map((n) => n.target))}`);
}

describe('the page button and panel are accessible (#426, axe)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('with the first-time tip showing', async () => {
    const { host } = mounted();
    expect(await violations(host)).toEqual([]);
  });

  it('with the panel open, skipped links shown', async () => {
    const { ui, host } = mounted();
    ui.open();
    const toggle = [...(host.shadowRoot?.querySelectorAll('button') ?? [])].find((b) => b.textContent.startsWith('Show 1 skipped'));
    toggle?.click();
    expect(await violations(host)).toEqual([]);
  });
});
