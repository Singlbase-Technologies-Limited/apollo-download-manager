// The website's theme switch (#379): light for everyone, dark only when a visitor chooses it. The choice stays in this
// browser and is sent nowhere. This runs in the page's head, so a dark page never flashes light first.
(() => {
  const read = () => {
    try {
      return localStorage.getItem('theme');
    } catch {
      return null;
    }
  };
  const write = (theme) => {
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // A browser that keeps nothing: the choice lasts for this page.
    }
  };
  const root = document.documentElement;
  if (read() === 'dark') root.dataset.theme = 'dark';

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('[data-theme-toggle]');
    if (!button) return;
    const show = () => button.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
    // The home page's dark screenshot (#423): fetched when the switch is pointed at or focused, or at once on a dark
    // page, and shown only once it has loaded (style.css), so the light one stays until then. A visitor who never
    // switches never downloads it.
    const darkShot = document.querySelector('.stage img.dark-only');
    const fetchDark = () => {
      if (!darkShot) return;
      if (darkShot.complete && darkShot.naturalWidth > 0) darkShot.classList.add('ready');
      else darkShot.loading = 'eager';
    };
    darkShot?.addEventListener('load', () => darkShot.classList.add('ready'));
    button.addEventListener('pointerenter', fetchDark);
    button.addEventListener('focus', fetchDark);
    if (root.dataset.theme === 'dark') fetchDark();
    button.addEventListener('click', () => {
      fetchDark();
      const dark = root.dataset.theme !== 'dark';
      if (dark) root.dataset.theme = 'dark';
      else delete root.dataset.theme;
      write(dark ? 'dark' : 'light');
      show();
    });
    show();
    button.hidden = false;
  });
})();
