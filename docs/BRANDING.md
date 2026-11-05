# Branding

How Apollo Download Manager looks: the mark, the app icon, the colours and the type. The product name is decided in [ADR-0018](decisions/0018-product-name-apollo.md). The source artwork is in [`assets/brand/`](../assets/brand/README.md).

The identity comes from #347. These are the PO's decisions there, all on 2026-11-05:

- The mark is a letter A that shows speed.
- The colours match the app's current theme.
- The A is split along its leg (the "P2" design).
- The app icon is the A alone, without a tile.
- The A is coloured in two flat tones.

## The mark

A capital **A**, leaning **10° forward**, with a thin **streak** cut from its left leg. The streak runs parallel to the leg, like a motion line inside the letter.

It is built on a 128-unit grid:

- **Cap height:** 12 units.
- **Baseline:** 112 units.
- **Crossbar band:** from 72 to 92 units.
- **Streak width:** 4 units in the full mark and 7 in the small one.
- **Stroke weight:** the same throughout.

The mark has two drawings:

| Drawing | Use | Difference |
|---|---|---|
| Full (`apollo-icon.svg`) | 48 px and larger | The proportions above |
| Small (`apollo-icon-small.svg`) | 16 to 32 px | Thicker legs, a smaller counter and a wider streak, so the split still shows at 16 px |

## The app icon

**The A alone, with no tile or border,** like the VS Code and Edge icons in the Windows Start menu. The surrounding desktop, taskbar or browser shows through.

**Two flat tones, with no gradient or shine:**

| Part | Colour |
|---|---|
| The back half (the left leg and the streak) | `#1659B3` |
| The front half (the right leg) | `#2F80E4` |

Microsoft's guideline is that at least half of an icon has 3:1 contrast on both light and dark backgrounds. Here, both halves pass on light backgrounds, and the front half carries the contrast on dark ones. The figures are computed with the WCAG formula, not measured on screen:

| Half | Light background | Dark taskbar (`#202020`) |
|---|---|---|
| Back (`#1659B3`) | 6.7:1 on white | 2.4:1 |
| Front (`#2F80E4`) | 3.9:1 on white | 4.1:1 |

The source rules are in the Windows app icon guidelines, the GNOME app icon guidelines and the Chrome Web Store image guidelines:

- one idea, with no text in the icon;
- simple shapes with one stroke weight;
- no outer shadow or border, because the desktop adds its own;
- a separate drawing for small sizes.

## Colours

The identity uses the app's existing theme tokens in [`src/index.css`](../src/index.css), so the window and the icon match.

| Role | Light | Dark |
|---|---|---|
| Accent (buttons, links, the mark in one colour) | `#1B68CB` | `#5092F0` |
| Ink (text, the mark on light) | `#0F172A` | `#E6EBF2` |
| Icon, back half | `#1659B3` | `#2F80E4` in the dark lockup |
| Icon, front half | `#2F80E4` | `#5092F0` in the dark lockup |

On dark backgrounds the lockup moves both halves one step lighter (`apollo-lockup-dark.svg`), so the mark keeps its weight.

## The full logo

**The mark stands in for the A of "Apollo",** followed by "pollo", with "DOWNLOAD MANAGER" spaced out underneath (PO decision on #347, design "L4"). The files are `apollo-lockup-light.svg` and `apollo-lockup-dark.svg`.

## Type

- **The wordmark is set in Outfit,** a geometric sans-serif from Google Fonts:
  - **"pollo":** weight 700, tracking −3 at 142 units. Its cap height matches the mark.
  - **"DOWNLOAD MANAGER":** weight 600, letter-spaced 9, in the muted text colour.
  - **Licence:** Outfit is under the SIL Open Font License (by Smartsheet Inc and Rodrigo Fuenzalida; the `METADATA.pb` file in Google's fonts repository, `ofl/outfit`).
  - **The font isn't shipped.** The lockups use it as live text, so it is neither in the app nor a dependency.
- **The window stays in Inter** (`--font-sans`).

## Using the mark

- **Clear space:** keep at least the width of the streak's leg (about a quarter of the mark's height) empty around the mark.
- **On a photo or colour:** use the one-colour mark (`apollo-mark.svg`) in ink or white.
- **Don't:**
  - put the icon back on a tile;
  - add shadows, outlines or gradients;
  - change the lean;
  - recolour one half only;
  - stretch the mark;
  - set the wordmark in another font;
  - put an ordinary letter A in front of the mark: the mark is the A.

## Generating the icons

The desktop icons in `src-tauri/icons/` are generated from the SVG sources, never edited by hand. The steps are in [`assets/brand/README.md`](../assets/brand/README.md#regenerating-the-icons).

## Still to do (#347)

- **The product name in the app, the installer and the docs,** and the upgrade from 0.1.x. These are the next PR.
- **The browser extension's icons.** They come with the extension redesign (#356).
- **The `.ico` file's 16, 24 and 32 px sizes.** They still come from the full drawing (see the assets README).
- **The wordmark as outlines** for use outside the app. Until then, the lockups render in a fallback font wherever Outfit isn't installed.
- **Showing the full logo inside the app** (for example on the first-run screen) would need Outfit bundled with the app, which is a new dependency for the PO to approve.
