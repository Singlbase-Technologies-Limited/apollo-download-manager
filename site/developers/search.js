// The developer site's search (#355): the site's only script, on its developer pages only (PO decision). It reads
// search-index.json from this site when someone first types, and asks nothing of any other site. Every result is
// added as text, never as markup.

const terms = (query) => query.toLowerCase().split(/\s+/).filter(Boolean);

/**
 * The entries holding every word of `query`, best first: a word in a heading counts for more than one in the text.
 * @param {{ page: string, heading: string, path: string, anchor: string, text: string }[]} index
 * @param {string} query
 * @param {number} [limit]
 */
export function search(index, query, limit = 20) {
  const words = terms(query);
  if (words.length === 0) return [];
  const found = [];
  for (const entry of index) {
    const heading = `${entry.page} ${entry.heading}`.toLowerCase();
    const text = entry.text.toLowerCase();
    if (!words.every((w) => heading.includes(w) || text.includes(w))) continue;
    found.push({ entry, score: words.filter((w) => heading.includes(w)).length });
  }
  return found
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((f) => f.entry);
}

/** About 140 characters of `text` around the first word of `query` it holds. */
export function snippet(text, query) {
  const lower = text.toLowerCase();
  const at = Math.max(0, Math.min(...terms(query).map((w) => lower.indexOf(w)).filter((i) => i >= 0)));
  const start = Math.max(0, (Number.isFinite(at) ? at : 0) - 50);
  const end = Math.min(text.length, start + 140);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

function start(form) {
  const input = form.querySelector('input');
  const results = form.querySelector('ul');
  const status = form.querySelector('p');
  let index = null;

  const show = (query) => {
    results.replaceChildren();
    if (query.trim() === '') {
      status.textContent = '';
      return;
    }
    const found = search(index, query);
    status.textContent = found.length === 0 ? 'Nothing found.' : '';
    for (const entry of found) {
      const link = document.createElement('a');
      link.href = `${form.dataset.root}${entry.path}#${entry.anchor}`;
      link.textContent = entry.heading === entry.page ? entry.page : `${entry.page}: ${entry.heading}`;
      const item = document.createElement('li');
      item.append(link);
      if (entry.text) {
        const quote = document.createElement('p');
        quote.textContent = snippet(entry.text, query);
        item.append(quote);
      }
      results.append(item);
    }
  };

  input.addEventListener('input', () => {
    if (index) {
      show(input.value);
      return;
    }
    fetch(`${form.dataset.root}search-index.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${String(r.status)}`);
        return r.json();
      })
      .then((loaded) => {
        index = loaded;
        show(input.value);
      })
      .catch(() => {
        status.textContent = 'The search can’t load right now. Check your connection and try again.';
      });
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  form.hidden = false;
}

if (typeof document !== 'undefined') {
  const form = document.querySelector('form.search');
  if (form) start(form);
}
