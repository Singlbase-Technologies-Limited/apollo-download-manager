// The developer pages' diagrams (#484): Mermaid, served by the site itself (site-lib.mjs, mermaidFiles), draws each
// `pre.mermaid` the page holds, in the site's colours, and again when the theme switch changes them. Only pages with a
// diagram load this. Without scripts, or if drawing fails, the diagram's text stays on the page.
import mermaid from './mermaid/mermaid.esm.min.mjs';

const blocks = [...document.querySelectorAll('pre.mermaid')];
// The text each diagram was drawn from, kept before Mermaid replaces it with the drawing.
for (const pre of blocks) pre.dataset.source = pre.textContent;

/** Mermaid's colours from the page's own (site/style.css), so a diagram matches the light or dark theme. */
function themeVariables() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  return {
    darkMode: document.documentElement.dataset.theme === 'dark',
    background: v('--surface'),
    fontFamily: getComputedStyle(document.body).fontFamily,
    fontSize: '14px',
    primaryColor: v('--accent-soft'),
    primaryBorderColor: v('--accent'),
    primaryTextColor: v('--fg'),
    secondaryColor: v('--surface-3'),
    tertiaryColor: v('--surface-2'),
    lineColor: v('--fg-subtle'),
    textColor: v('--fg'),
    mainBkg: v('--accent-soft'),
    nodeBorder: v('--accent'),
    clusterBkg: v('--surface-2'),
    clusterBorder: v('--border-strong'),
    edgeLabelBackground: v('--surface'),
    actorBkg: v('--accent-soft'),
    actorBorder: v('--accent'),
    actorTextColor: v('--fg'),
    actorLineColor: v('--border-strong'),
    signalColor: v('--fg'),
    signalTextColor: v('--fg'),
    labelBoxBkgColor: v('--surface-3'),
    labelBoxBorderColor: v('--border-strong'),
    labelTextColor: v('--fg'),
    loopTextColor: v('--fg'),
    noteBkgColor: v('--warning-soft'),
    noteBorderColor: v('--warning'),
    noteTextColor: v('--fg'),
    activationBkgColor: v('--surface-3'),
    activationBorderColor: v('--border-strong'),
    sequenceNumberColor: v('--accent-fg'),
  };
}

let drawing = Promise.resolve();

function draw() {
  drawing = drawing.then(async () => {
    // `strict` keeps the text of a diagram from becoming markup or running anything (Mermaid's default, set anyway).
    // Mermaid 12 lays diagrams out with ELK by default, which the site leaves out (PO decision on #484): dagre instead.
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      themeVariables: themeVariables(),
      layout: 'dagre',
      // The plain look in both themes; and each diagram at its own size, so its text stays readable: a wide one
      // scrolls in its frame instead of shrinking (style.css).
      look: 'classic',
      flowchart: { useMaxWidth: false },
      sequence: { useMaxWidth: false },
      state: { layout: 'dagre', look: 'classic', useMaxWidth: false },
    });
    for (const pre of blocks) {
      pre.removeAttribute('data-processed');
      pre.textContent = pre.dataset.source ?? '';
    }
    try {
      await mermaid.run({ nodes: blocks });
    } catch (error) {
      // The text stays on the page, so the diagram can still be read; the console says why it wasn't drawn.
      console.error('A diagram could not be drawn:', error);
    }
    // A diagram wider than its frame scrolls there, and the keyboard can reach it to scroll it.
    for (const pre of blocks) {
      const frame = pre.closest('figure');
      if (frame && frame.scrollWidth > frame.clientWidth) frame.tabIndex = 0;
      else frame?.removeAttribute('tabindex');
    }
  });
}

draw();
new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
