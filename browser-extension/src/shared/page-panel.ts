/**
 * The download button on pages with files, its first-time tip, and the panel to choose files (#426). It draws into
 * the root it is given: the content script gives it a closed shadow root, so the page's styles can't reach it and its
 * own don't leak. Every text from the page is set as text, never as HTML.
 */
import { SHORT_NAME } from './branding';
import { FILE_GROUPS, outcomeText, type FileGroup, type PageFile, type PageFiles } from './page-files';
import type { BatchOutcome, PageLinkPayload } from './protocol';

export interface Point {
  /** Distance from the window's right edge, px. */
  right: number;
  /** Distance from the window's bottom edge, px. */
  bottom: number;
}

export interface Size {
  width: number;
  height: number;
}

/** What the button keeps between pages, and how it reaches the extension. */
export interface PagePanelStore {
  position: Point | null;
  size: Size | null;
  tipSeen: boolean;
  savePosition(p: Point): void;
  saveSize(s: Size): void;
  markTipSeen(): void;
  hideOnThisSite(): void;
  send(links: PageLinkPayload[]): Promise<BatchOutcome>;
}

export interface PagePanelUi {
  /** Shows the files found so far: the button appears with the first one. */
  update(found: PageFiles): void;
  /** Opens the panel, as the keyboard shortcut and the toolbar popup do; only when files were found. */
  open(): boolean;
  destroy(): void;
}

const DEFAULT_POINT: Point = { right: 24, bottom: 24 };
/** As many files as one send takes: the Add dialog's limit (`MAX_ADD`), which the background checks again. */
export const MAX_SEND = 500;
const MIN_SIZE: Size = { width: 300, height: 320 };
const DEFAULT_SIZE: Size = { width: 380, height: 520 };
const MARGIN = 8;
/** How far the pointer must move before a press on the button is a drag, not a click. */
const DRAG_SLOP = 4;

export const PANEL_STYLE = `
:host { all: initial; }
* { box-sizing: border-box; }
.layer { --bg: #ffffff; --bg-2: #f8fafc; --chip: #eef2f6; --border: #e1e6ed; --border-strong: #cbd3de; --fg: #0b1220; --fg-muted: #3d495c;
  --fg-subtle: #4f5a6c; --accent: #1b68cb; --accent-strong: #1659b3; --accent-soft: #e5effc; --accent-fg: #ffffff; --row-on: #e2ecfb;
  --ok: #14793a; --err: #c2271d; --ring: #3b82f6; --shadow: 0 2px 4px rgb(15 23 42 / 0.08), 0 16px 40px rgb(15 23 42 / 0.22);
  font: 13px/1.45 Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--fg); }
@media (prefers-color-scheme: dark) {
  .layer { --bg: #131922; --bg-2: #171e29; --chip: #1d2532; --border: #253041; --border-strong: #334155; --fg: #eef2f7; --fg-muted: #b0bacb;
    --fg-subtle: #9ea8b9; --accent: #5092f0; --accent-strong: #6aa3f5; --accent-soft: #172a45; --accent-fg: #06101f; --row-on: #1b2b44;
    --ok: #4ade80; --err: #f87171; --ring: #60a5fa; --shadow: 0 2px 4px rgb(0 0 0 / 0.4), 0 16px 40px rgb(0 0 0 / 0.5); }
}
[hidden] { display: none !important; }
button, input { font: inherit; color: inherit; margin: 0; }
button { cursor: pointer; }
:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
.fab { position: fixed; display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 16px 0 12px; border: 0; border-radius: 22px;
  background: var(--accent); color: var(--accent-fg); font-weight: 600; font-size: 14px; box-shadow: var(--shadow); touch-action: none; user-select: none; }
.fab:hover { background: var(--accent-strong); }
.fab.dragging { cursor: grabbing; }
.fab svg { flex-shrink: 0; }
.bubble, .panel { position: fixed; background: var(--bg); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow); }
.bubble { width: 320px; max-width: calc(100vw - 16px); padding: 14px 14px 12px 16px; display: flex; flex-direction: column; gap: 10px; }
.bubble p { margin: 0; color: var(--fg-muted); }
.bubble .lead { color: var(--fg); font-weight: 600; }
.row { display: flex; gap: 8px; align-items: center; }
.end { justify-content: flex-end; }
.btn { height: 32px; padding: 0 12px; border-radius: 7px; border: 1px solid var(--border-strong); background: var(--bg); font-weight: 500; }
.btn.primary { border-color: transparent; background: var(--accent); color: var(--accent-fg); }
.btn.primary:hover { background: var(--accent-strong); }
.btn:disabled { opacity: 0.55; cursor: default; }
.icon { width: 30px; height: 30px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 7px; background: transparent; color: var(--fg-muted); }
.panel { display: flex; flex-direction: column; overflow: hidden; resize: both; min-width: ${String(MIN_SIZE.width)}px; min-height: ${String(MIN_SIZE.height)}px;
  max-width: calc(100vw - 16px); max-height: calc(100vh - 16px); }
.head { display: flex; align-items: center; gap: 10px; padding: 12px 10px 10px 16px; border-bottom: 1px solid var(--border); }
.head .title { flex: 1; min-width: 0; }
.head h2 { margin: 0; font-size: 14px; font-weight: 600; }
.sub { font-size: 12px; color: var(--fg-subtle); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tools { padding: 10px 16px 6px; display: flex; flex-direction: column; gap: 8px; }
.search { height: 32px; padding: 0 10px; border: 1px solid var(--border-strong); border-radius: 7px; background: var(--bg); width: 100%; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { height: 26px; padding: 0 10px; border-radius: 13px; border: 1px solid var(--border-strong); background: var(--bg); color: var(--fg-muted); font-size: 12px; font-weight: 500; }
.chip[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-strong); }
.check { display: flex; align-items: center; gap: 8px; min-width: 0; }
.check input { width: 16px; height: 16px; flex-shrink: 0; accent-color: var(--accent); }
.list { flex: 1; overflow: auto; padding: 0 8px 8px; }
.group { margin: 10px 8px 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--fg-subtle); }
.file { padding: 6px 8px; border-radius: 7px; }
.file.on { background: var(--row-on); }
.file .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.link { border: 0; background: transparent; color: var(--accent); padding: 4px 8px; font-size: 12px; }
.skipped { padding: 4px 8px; color: var(--fg-subtle); font-size: 12px; }
.skipped .name { color: var(--fg-muted); }
.empty { padding: 16px 8px; color: var(--fg-subtle); }
.foot { padding: 10px 16px; border-top: 1px solid var(--border); background: var(--bg-2); display: flex; flex-direction: column; gap: 6px; }
.foot .row { justify-content: space-between; }
.count { font-size: 12px; color: var(--fg-muted); }
.status { font-size: 12px; margin: 0; }
.status.ok { color: var(--ok); } .status.err { color: var(--err); }
@media (prefers-reduced-motion: no-preference) { .bubble, .panel { transition: opacity 120ms ease; } }
`;

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgIcon(doc: Document, paths: string[], size: number): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  for (const [k, v] of Object.entries({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) {
    svg.setAttribute(k, String(v));
  }
  for (const d of paths) {
    const p = doc.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

const DOWNLOAD_ICON = ['M12 3v12', 'm7 10 5 5 5-5', 'M5 21h14'];
const CLOSE_ICON = ['M18 6 6 18', 'm6 6 12 12'];

const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

/** Keeps a point inside the window. */
export function clampPoint(p: Point, view: Size, box: Size): Point {
  const clamp = (v: number, max: number) => Math.min(Math.max(MARGIN, v), Math.max(MARGIN, max));
  return { right: clamp(p.right, view.width - box.width - MARGIN), bottom: clamp(p.bottom, view.height - box.height - MARGIN) };
}

/**
 * Where the panel opens next to the button: toward the middle of the window, so it stays in view wherever the user
 * dragged the button. Returns CSS `left`/`top` in px.
 */
export function panelPlace(button: DOMRect, panel: Size, view: Size): { left: number; top: number } {
  const left = button.left + button.width / 2 > view.width / 2 ? button.right - panel.width : button.left;
  const top = button.top + button.height / 2 > view.height / 2 ? button.top - panel.height - MARGIN : button.bottom + MARGIN;
  const clamp = (v: number, size: number, max: number) => Math.min(Math.max(MARGIN, v), Math.max(MARGIN, max - size - MARGIN));
  return { left: clamp(left, panel.width, view.width), top: clamp(top, panel.height, view.height) };
}

export function mountPagePanel(root: ShadowRoot | HTMLElement, doc: Document, siteName: string, store: PagePanelStore): PagePanelUi {
  const win = doc.defaultView ?? window;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  };
  const button = (cls: string, text: string, type: 'button' | 'submit' = 'button') => {
    const b = el('button', cls, text);
    b.type = type;
    return b;
  };
  const view = (): Size => ({ width: win.innerWidth, height: win.innerHeight });

  // A constructed style sheet, which a page's style policy (CSP) doesn't block; a <style> where the browser can't
  // adopt one into this root.
  const style = el('style');
  let adopted = false;
  try {
    const sheet = new (win as unknown as { CSSStyleSheet: typeof CSSStyleSheet }).CSSStyleSheet();
    sheet.replaceSync(PANEL_STYLE);
    const r = root as ShadowRoot;
    if (!(r.adoptedStyleSheets as CSSStyleSheet[] | undefined)) throw new Error('This root takes no constructed style sheets.');
    r.adoptedStyleSheets = [...r.adoptedStyleSheets, sheet];
    adopted = true;
  } catch {
    style.textContent = PANEL_STYLE;
  }
  const layer = el('div', 'layer');
  root.append(...(adopted ? [] : [style]), layer);

  // The button.
  const fab = button('fab', '');
  const fabLabel = el('span');
  fab.append(svgIcon(doc, DOWNLOAD_ICON, 20), fabLabel);
  fab.hidden = true;
  fab.setAttribute('aria-haspopup', 'dialog');
  fab.setAttribute('aria-expanded', 'false');
  layer.append(fab);
  let point = store.position ?? DEFAULT_POINT;
  const placeFab = () => {
    const r = fab.getBoundingClientRect();
    point = clampPoint(point, view(), { width: r.width || 120, height: r.height || 44 });
    fab.style.right = `${String(point.right)}px`;
    fab.style.bottom = `${String(point.bottom)}px`;
  };

  // The first-time tip (PO decision, 2026-11-17: the button is on by default, so it says how to turn it off).
  const tip = el('div', 'bubble');
  tip.setAttribute('role', 'status');
  tip.hidden = true;
  const tipLead = el('p', 'lead');
  const tipText = el('p', '', `Click the button to choose which files to download. Don't want it? Hide it on this site here, or turn it off for every site in the extension's settings.`);
  const tipHide = button('btn', 'Hide on this site');
  const tipOk = button('btn primary', 'Got it');
  const tipRow = el('div', 'row end');
  tipRow.append(tipHide, tipOk);
  tip.append(tipLead, tipText, tipRow);
  layer.append(tip);
  let tipSeen = store.tipSeen;
  const placeTip = () => {
    const r = fab.getBoundingClientRect();
    const p = panelPlace(r, { width: Math.min(320, win.innerWidth - 16), height: tip.getBoundingClientRect().height || 140 }, view());
    tip.style.left = `${String(p.left)}px`;
    tip.style.top = `${String(p.top)}px`;
  };
  const closeTip = () => {
    tip.hidden = true;
    if (!tipSeen) {
      tipSeen = true;
      store.markTipSeen();
    }
  };
  tipOk.addEventListener('click', closeTip);
  tipHide.addEventListener('click', () => {
    closeTip();
    store.hideOnThisSite();
  });

  // The panel.
  const panel = el('section', 'panel');
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  const titleId = 'apollo-page-files-title';
  panel.setAttribute('aria-labelledby', titleId);
  const head = el('div', 'head');
  const headText = el('div', 'title');
  const title = el('h2');
  title.id = titleId;
  const sub = el('div', 'sub', siteName);
  headText.append(title, sub);
  const close = button('icon', '');
  close.setAttribute('aria-label', 'Close');
  close.append(svgIcon(doc, CLOSE_ICON, 16));
  head.append(svgIcon(doc, DOWNLOAD_ICON, 20), headText, close);

  const tools = el('div', 'tools');
  const search = el('input', 'search');
  search.type = 'search';
  search.placeholder = 'Search names';
  search.setAttribute('aria-label', 'Search names');
  const chips = el('div', 'chips');
  chips.setAttribute('role', 'group');
  chips.setAttribute('aria-label', 'File types');
  const allLabel = el('label', 'check');
  const all = el('input');
  all.type = 'checkbox';
  allLabel.append(all, doc.createTextNode('Select all shown'));
  tools.append(search, chips, allLabel);

  const list = el('div', 'list');
  const foot = el('div', 'foot');
  const footRow = el('div', 'row');
  const chosenText = el('span', 'count');
  const sendBtn = button('btn primary', '');
  footRow.append(chosenText, sendBtn);
  const status = el('p', 'status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  foot.append(footRow, status);
  panel.append(head, tools, list, foot);
  layer.append(panel);

  let found: PageFiles = { files: [], skipped: [] };
  const chosen = new Set<string>();
  let filter: FileGroup | 'All' = 'All';
  let showSkipped = false;
  let sending = false;

  const shown = (): PageFile[] => {
    const q = search.value.trim().toLowerCase();
    return found.files.filter((f) => (filter === 'All' || f.group === filter) && (!q || f.name.toLowerCase().includes(q)));
  };

  const renderFoot = () => {
    const n = found.files.filter((f) => chosen.has(f.url)).length;
    chosenText.textContent = n > MAX_SEND ? `${String(n)} chosen · at most ${String(MAX_SEND)} at a time` : `${String(n)} chosen`;
    sendBtn.textContent = n > 0 ? `Send ${String(n)} to ${SHORT_NAME}` : `Send to ${SHORT_NAME}`;
    // Kept focusable while sending, so the keyboard stays in the panel; a click then does nothing.
    sendBtn.disabled = n === 0 || n > MAX_SEND;
    sendBtn.setAttribute('aria-disabled', String(sending));
    const vis = shown();
    const on = vis.filter((f) => chosen.has(f.url)).length;
    all.checked = vis.length > 0 && on === vis.length;
    all.indeterminate = on > 0 && on < vis.length;
    all.disabled = vis.length === 0;
  };

  const renderChips = () => {
    const counts = new Map<FileGroup | 'All', number>([['All', found.files.length]]);
    for (const f of found.files) counts.set(f.group, (counts.get(f.group) ?? 0) + 1);
    if (filter !== 'All' && !counts.has(filter)) filter = 'All';
    chips.replaceChildren(
      ...(['All', ...FILE_GROUPS] as const)
        .filter((g) => counts.has(g))
        .map((g) => {
          const c = button('chip', `${g} ${String(counts.get(g) ?? 0)}`);
          c.dataset.group = g;
          c.setAttribute('aria-pressed', String(filter === g));
          c.addEventListener('click', () => {
            filter = g;
            renderChips();
            renderList();
            // The chips are drawn again: the keyboard stays on the one chosen.
            chips.querySelector<HTMLButtonElement>(`[data-group="${g}"]`)?.focus();
          });
          return c;
        }),
    );
  };

  const renderList = () => {
    const vis = shown();
    const rows: HTMLElement[] = [];
    for (const g of FILE_GROUPS) {
      const inGroup = vis.filter((f) => f.group === g);
      if (inGroup.length === 0) continue;
      rows.push(el('p', 'group', g));
      for (const f of inGroup) {
        const row = el('label', `check file${chosen.has(f.url) ? ' on' : ''}`);
        row.title = f.url;
        const box = el('input');
        box.type = 'checkbox';
        box.checked = chosen.has(f.url);
        box.addEventListener('change', () => {
          if (box.checked) chosen.add(f.url);
          else chosen.delete(f.url);
          row.classList.toggle('on', box.checked);
          renderFoot();
        });
        row.append(box, el('span', 'name', f.name));
        rows.push(row);
      }
    }
    if (vis.length === 0) rows.push(el('p', 'empty', found.files.length === 0 ? 'No files on this page.' : 'No file matches.'));
    if (found.skipped.length > 0) {
      const toggle = button('link skip-toggle', showSkipped ? `Hide ${plural(found.skipped.length, 'skipped link', 'skipped links')}` : `Show ${plural(found.skipped.length, 'skipped link', 'skipped links')}`);
      toggle.setAttribute('aria-expanded', String(showSkipped));
      toggle.addEventListener('click', () => {
        showSkipped = !showSkipped;
        renderList();
        list.querySelector<HTMLButtonElement>('.skip-toggle')?.focus();
      });
      rows.push(toggle);
      if (showSkipped) {
        for (const s of found.skipped) {
          const row = el('div', 'skipped');
          row.append(el('span', 'name', s.name), doc.createTextNode(` · ${s.reason}`));
          rows.push(row);
        }
      }
    }
    list.replaceChildren(...rows);
    renderFoot();
  };

  const render = () => {
    title.textContent = `${plural(found.files.length, 'file', 'files')} on this page`;
    renderChips();
    renderList();
  };

  search.addEventListener('input', renderList);
  all.addEventListener('change', () => {
    for (const f of shown()) {
      if (all.checked) chosen.add(f.url);
      else chosen.delete(f.url);
    }
    renderList();
  });

  sendBtn.addEventListener('click', () => {
    const links = found.files.filter((f) => chosen.has(f.url)).map((f) => ({ url: f.url, filename: f.name }));
    if (links.length === 0 || links.length > MAX_SEND || sending) return;
    sending = true;
    status.className = 'status';
    status.textContent = `Sending ${plural(links.length, 'file', 'files')}…`;
    renderFoot();
    void store
      .send(links)
      .then((o: BatchOutcome | undefined) => {
        // The background didn't answer with what happened, such as when it refused the message.
        if (typeof o !== 'object' || typeof o.added !== 'number' || !Array.isArray(o.failed)) throw new Error('no answer');
        const v = outcomeText(o);
        status.className = `status ${v.tone}`;
        status.textContent = v.text;
        if (v.tone === 'ok') chosen.clear();
      })
      // A failed send, or no usable answer: never a "Sending…" that stays.
      .catch(() => {
        status.className = 'status err';
        status.textContent = `The files couldn't be sent to ${SHORT_NAME}.`;
      })
      .finally(() => {
        sending = false;
        renderList();
        // With nothing left to send the button is off, and the browser takes the focus off it: the keyboard goes
        // back to the search, inside the panel.
        const active = 'activeElement' in root ? root.activeElement : doc.activeElement;
        if (!panel.hidden && (active === sendBtn ? sendBtn.disabled : !(active && panel.contains(active)))) search.focus();
      });
  });

  let size = store.size ?? DEFAULT_SIZE;
  const placePanel = () => {
    const v = view();
    size = { width: Math.min(Math.max(size.width, MIN_SIZE.width), v.width - 16), height: Math.min(Math.max(size.height, MIN_SIZE.height), v.height - 16) };
    panel.style.width = `${String(size.width)}px`;
    panel.style.height = `${String(size.height)}px`;
    const p = panelPlace(fab.getBoundingClientRect(), size, v);
    panel.style.left = `${String(p.left)}px`;
    panel.style.top = `${String(p.top)}px`;
  };

  const isOpen = () => !panel.hidden;
  const openPanel = () => {
    closeTip();
    render();
    panel.hidden = false;
    placePanel();
    fab.setAttribute('aria-expanded', 'true');
    status.textContent = '';
    search.focus();
  };
  const closePanel = (focusButton: boolean) => {
    if (!isOpen()) return;
    panel.hidden = true;
    fab.setAttribute('aria-expanded', 'false');
    if (focusButton) fab.focus();
  };
  close.addEventListener('click', () => {
    closePanel(true);
  });

  // The panel keeps the keyboard inside while open, and Escape closes it.
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closePanel(true);
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...panel.querySelectorAll<HTMLElement>('button, input')].filter((x) => !(x as HTMLButtonElement).disabled && x.offsetParent !== null);
    const first = items[0];
    const last = items[items.length - 1];
    const active = (root as ShadowRoot).activeElement ?? doc.activeElement;
    if (!first || !last) return;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // The size the user gives the panel is kept, once they let go.
  panel.addEventListener('pointerup', () => {
    const r = panel.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && (Math.round(r.width) !== size.width || Math.round(r.height) !== size.height)) {
      size = { width: Math.round(r.width), height: Math.round(r.height) };
      store.saveSize(size);
    }
  });

  // Dragging the button moves it out of the page's way; a press without moving is a click.
  let drag: { x: number; y: number; start: Point; moved: boolean } | null = null;
  fab.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, start: point, moved: false };
    fab.setPointerCapture(e.pointerId);
  });
  fab.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
    drag.moved = true;
    fab.classList.add('dragging');
    point = { right: drag.start.right - dx, bottom: drag.start.bottom - dy };
    placeFab();
    if (!tip.hidden) placeTip();
    if (isOpen()) placePanel();
  });
  const endDrag = () => {
    if (drag?.moved) store.savePosition(point);
    fab.classList.remove('dragging');
  };
  fab.addEventListener('pointerup', endDrag);
  fab.addEventListener('pointercancel', () => {
    endDrag();
    drag = null;
  });
  fab.addEventListener('click', (e) => {
    const moved = drag?.moved ?? false;
    drag = null;
    if (moved) {
      e.preventDefault();
      return;
    }
    if (isOpen()) closePanel(false);
    else openPanel();
  });

  const onResize = () => {
    if (fab.hidden) return;
    placeFab();
    if (!tip.hidden) placeTip();
    if (isOpen()) placePanel();
  };
  win.addEventListener('resize', onResize);

  return {
    update(next) {
      found = next;
      const n = found.files.length;
      if (n === 0) return;
      fabLabel.textContent = plural(n, 'file', 'files');
      fab.setAttribute('aria-label', `${SHORT_NAME}: ${plural(n, 'file', 'files')} on this page`);
      tipLead.textContent = `${SHORT_NAME} found ${plural(n, 'file', 'files')} on this page`;
      if (fab.hidden) {
        fab.hidden = false;
        placeFab();
        if (!tipSeen) {
          tip.hidden = false;
          placeTip();
        }
      }
      if (isOpen()) render();
    },
    open() {
      if (found.files.length === 0) return false;
      if (!isOpen()) openPanel();
      return true;
    },
    destroy() {
      win.removeEventListener('resize', onResize);
      style.remove();
      layer.remove();
    },
  };
}
