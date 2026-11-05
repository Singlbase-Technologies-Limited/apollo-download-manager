import { describe, expect, it } from 'vitest';

// #348 G: one set of form controls. A checkbox or a list box is drawn by the shared components in src/components,
// never by a bare <input type="checkbox"> or <select> elsewhere, so they all look and behave alike.
const sources = import.meta.glob<string>(['../**/*.tsx', '!../**/*.test.tsx', '!../components/**'], { query: '?raw', import: 'default', eager: true });

describe('form controls', () => {
  it('has no bare checkbox or select outside the shared components', () => {
    const bare = Object.entries(sources)
      .filter(([, text]) => /type=["']checkbox["']|<select[\s>]/.test(text))
      .map(([path]) => path);
    expect(bare).toEqual([]);
  });

  it('reads the sources it checks', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20);
  });
});
