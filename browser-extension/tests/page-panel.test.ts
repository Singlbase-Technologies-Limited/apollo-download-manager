// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clampPoint, mountPagePanel, panelPlace, type PagePanelStore } from '../src/shared/page-panel';
import { linksIn, PageFileList, watchAddedLinks } from '../src/shared/page-scan';
import { EMPTY_OUTCOME, type BatchOutcome, type PageLinkPayload } from '../src/shared/protocol';
import { DEFAULT_SETTINGS } from '../src/shared/settings';

const BASE = 'https://mirror.example.org/files/';

function page(html: string) {
  document.body.innerHTML = html;
}

describe('reading a page for files (#426)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('finds the files on a static page, and none on a page without', () => {
    page(Array.from({ length: 50 }, (_, i) => `<a href="f${String(i)}.zip">f${String(i)}</a>`).join('') + '<a href="about.html">About</a>');
    const list = new PageFileList(() => BASE, DEFAULT_SETTINGS);
    list.add(linksIn(document));
    expect(list.found.files).toHaveLength(50);
    page('<a href="/">Home</a><p>No files here.</p>');
    const none = new PageFileList(() => BASE, DEFAULT_SETTINGS);
    expect(none.add(linksIn(document))).toBe(false);
    expect(none.found.files).toEqual([]);
  });

  it('reads media sources and the download attribute', () => {
    page('<video src="clip.mp4"></video><audio><source src="song.flac"></audio><a href="get?id=1" download="tool.msi">Get</a>');
    const list = new PageFileList(() => BASE, DEFAULT_SETTINGS);
    list.add(linksIn(document));
    expect(list.found.files.map((f) => f.name)).toEqual(['clip.mp4', 'song.flac', 'tool.msi']);
  });

  it('picks up 20 links a page adds 2 s after loading, once it has been still for a moment', async () => {
    page('<a href="first.iso">first</a>');
    const list = new PageFileList(() => BASE, DEFAULT_SETTINGS);
    list.add(linksIn(document));
    const seen: number[] = [];
    const stop = watchAddedLinks(document, (links) => {
      list.add(links);
      seen.push(list.found.files.length);
    });
    await vi.advanceTimersByTimeAsync(2000);
    const box = document.createElement('div');
    box.innerHTML = Array.from({ length: 20 }, (_, i) => `<a href="late-${String(i)}.pdf">late</a>`).join('') + '<a href="first.iso">again</a>';
    document.body.append(box);
    await vi.advanceTimersByTimeAsync(100);
    expect(seen).toEqual([]);
    await vi.advanceTimersByTimeAsync(500);
    expect(seen).toEqual([21]);
    stop();
  });
});

function fakeStore(over: Partial<PagePanelStore> = {}) {
  const log: string[] = [];
  const sent: PageLinkPayload[][] = [];
  let answer: BatchOutcome = { ...EMPTY_OUTCOME, added: 2 };
  const store: PagePanelStore = {
    position: null,
    size: null,
    tipSeen: false,
    savePosition: () => log.push('position'),
    saveSize: () => log.push('size'),
    markTipSeen: () => log.push('tipSeen'),
    hideOnThisSite: () => log.push('hide'),
    send: (links) => {
      sent.push(links);
      return Promise.resolve(answer);
    },
    ...over,
  };
  return { store, log, sent, answerWith: (o: BatchOutcome) => (answer = o) };
}

function files(n: number, ext = 'iso') {
  return { files: Array.from({ length: n }, (_, i) => ({ url: `${BASE}f${String(i)}.${ext}`, name: `f${String(i)}.${ext}`, group: 'Disk images' as const })), skipped: [] };
}

describe('the page button and panel (#426)', () => {
  let root: ShadowRoot;
  beforeEach(() => {
    const host = document.createElement('div');
    document.body.append(host);
    root = host.attachShadow({ mode: 'open' });
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });
  function q(sel: string): HTMLElement | null {
    return root.querySelector<HTMLElement>(sel);
  }
  const button = (name: string | RegExp) => [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent).match(name)) ?? null;

  it('shows no button until a file is found', () => {
    const { store } = fakeStore();
    const ui = mountPagePanel(root, document, 'mirror.example.org', store);
    ui.update({ files: [], skipped: [] });
    expect(q('.fab')?.hidden).toBe(true);
    expect(ui.open()).toBe(false);
    ui.update(files(3));
    expect(q('.fab')?.hidden).toBe(false);
    expect(button(/3 files on this page/)).not.toBeNull();
  });

  it('says once how to turn the button off', () => {
    const { store, log } = fakeStore();
    const ui = mountPagePanel(root, document, 'mirror.example.org', store);
    ui.update(files(10));
    const tip = q('.bubble');
    expect(tip?.hidden).toBe(false);
    expect(tip?.textContent).toContain('found 10 files on this page');
    expect(tip?.textContent).toContain("turn it off for every site in the extension's settings");
    button('Got it')?.click();
    expect(tip?.hidden).toBe(true);
    expect(log).toEqual(['tipSeen']);
  });

  it('hides itself on this site from the tip', () => {
    const { store, log } = fakeStore();
    mountPagePanel(root, document, 'mirror.example.org', store).update(files(1));
    button('Hide on this site')?.click();
    expect(log).toEqual(['tipSeen', 'hide']);
  });

  it('shows no tip once it was seen', () => {
    const { store } = fakeStore({ tipSeen: true });
    mountPagePanel(root, document, 'mirror.example.org', store).update(files(2));
    expect(q('.bubble')?.hidden).toBe(true);
  });

  it('lets the user choose files and sends them in one go', async () => {
    const { store, sent } = fakeStore({ tipSeen: true });
    const ui = mountPagePanel(root, document, 'mirror.example.org', store);
    ui.update({ files: [...files(2).files, { url: `${BASE}notes.pdf`, name: 'notes.pdf', group: 'Documents' }], skipped: [{ url: 'https://x.example/a.iso', name: 'a.iso', reason: 'domain is excluded' }] });
    q('.fab')?.click();
    const dialog = q('[role="dialog"]');
    expect(dialog?.hidden).toBe(false);
    expect(dialog?.textContent).toContain('3 files on this page');
    expect(root.activeElement).toBe(q('input[type="search"]'));
    expect([...root.querySelectorAll('.chip')].map((c) => c.textContent)).toEqual(['All 3', 'Disk images 2', 'Documents 1']);
    expect(button(/^Send to/)?.disabled).toBe(true);

    button('Documents 1')?.click();
    const all = q('.tools input[type="checkbox"]');
    all?.click();
    button('All 3')?.click();
    const boxes = [...root.querySelectorAll<HTMLInputElement>('.file input')];
    expect(boxes.map((b) => b.checked)).toEqual([false, false, true]);
    boxes[0]?.click();
    expect(q('.count')?.textContent).toBe('2 chosen');

    button('Show 1 skipped link')?.click();
    expect(q('.skipped')?.textContent).toBe('a.iso · domain is excluded');

    button('Send 2 to Apollo DM')?.click();
    await vi.waitFor(() => {
      expect(q('.status')?.textContent).toBe('Sent 2 to Apollo DM.');
    });
    expect(sent).toEqual([[{ url: `${BASE}f0.iso`, filename: 'f0.iso' }, { url: `${BASE}notes.pdf`, filename: 'notes.pdf' }]]);
    expect(q('.count')?.textContent).toBe('0 chosen');
  });

  it('says what failed and keeps the choice', async () => {
    const { store, answerWith } = fakeStore({ tipSeen: true });
    answerWith({ ...EMPTY_OUTCOME, error: { code: 'DESKTOP_NOT_RUNNING', message: 'Apollo DM isn’t running.' }, notSent: 1 });
    const ui = mountPagePanel(root, document, 'mirror.example.org', store);
    ui.update(files(1));
    ui.open();
    root.querySelector<HTMLInputElement>('.file input')?.click();
    button('Send 1 to Apollo DM')?.click();
    await vi.waitFor(() => {
      expect(q('.status')?.textContent).toBe("1 couldn't be sent: Apollo DM isn’t running.");
    });
    expect(q('.status')?.className).toBe('status err');
    expect(q('.count')?.textContent).toBe('1 chosen');
  });

  it('closes with Escape and gives the focus back to the button', () => {
    const { store } = fakeStore({ tipSeen: true });
    const ui = mountPagePanel(root, document, 'mirror.example.org', store);
    ui.update(files(1));
    ui.open();
    q('[role="dialog"]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(q('[role="dialog"]')?.hidden).toBe(true);
    expect(root.activeElement).toBe(q('.fab'));
  });

  it('never puts the page’s text in as markup', () => {
    const { store } = fakeStore({ tipSeen: true });
    const ui = mountPagePanel(root, document, 'mirror.example.org', store);
    ui.update({ files: [{ url: `${BASE}x.zip`, name: '<img src=x onerror=alert(1)>.zip', group: 'Compressed' }], skipped: [] });
    ui.open();
    expect(root.querySelector('img')).toBeNull();
    expect(q('.file .name')?.textContent).toBe('<img src=x onerror=alert(1)>.zip');
  });

  it('goes away completely', () => {
    const { store } = fakeStore();
    const ui = mountPagePanel(root, document, 'mirror.example.org', store);
    ui.update(files(1));
    ui.destroy();
    expect(root.querySelector('.layer')).toBeNull();
  });
});

describe('where the button and panel sit (#426)', () => {
  const view = { width: 1280, height: 800 };
  it('keeps the dragged button inside the window', () => {
    expect(clampPoint({ right: -50, bottom: 5000 }, view, { width: 120, height: 44 })).toEqual({ right: 8, bottom: 748 });
  });

  it('opens the panel toward the middle of the window', () => {
    const rect = (left: number, top: number) => ({ left, top, right: left + 120, bottom: top + 44, width: 120, height: 44, x: left, y: top, toJSON: () => ({}) });
    const size = { width: 380, height: 520 };
    // Bottom right: above it, right edges lined up.
    expect(panelPlace(rect(1136, 732), size, view)).toEqual({ left: 876, top: 204 });
    // Top left: below it.
    expect(panelPlace(rect(20, 20), size, view)).toEqual({ left: 20, top: 72 });
  });
});
