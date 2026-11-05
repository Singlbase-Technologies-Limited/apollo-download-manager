# Apollo brand assets

The source artwork for Apollo Download Manager's mark, app icon and wordmark (#347). How to use them, the colours and the rules are in [docs/BRANDING.md](../../docs/BRANDING.md).

| File | Use |
|---|---|
| `apollo-icon.svg` | The app icon at 64 px and larger: the A alone, in two tones |
| `apollo-icon-small.svg` | The A drawn heavier, for small sizes that can't be drawn on a pixel grid, such as inside the app |
| `apollo-icon-16.svg` to `apollo-icon-48.svg` | The app icon at exactly 16, 20, 24, 32, 40 and 48 px, each drawn on its own pixel grid so its flat edges are crisp. 16 and 20 px have one tone and no streak, 24 px two tones and no streak, 32 px and up the streak too |
| `apollo-mark.svg` | The A in one colour (ink), for single-colour uses |
| `apollo-lockup-light.svg`, `apollo-lockup-dark.svg` | The full logo, where the mark stands in for the A of "Apollo", for light and dark backgrounds. The wordmark is Outfit converted to outlines, so it needs no font |
| `apollo-social-preview.svg`, `apollo-social-preview.png` | The repository's social preview on GitHub, 1280 × 640: the light full logo centred on the app's light background |

The app draws the logo inline (`src/components/BrandLogo.tsx`, in the sidebar and on the first-run screen) and the small icon when the sidebar is narrow (`src/components/BrandIcon.tsx`). Both use the heavier small A.

## The social preview

GitHub shows it when the repository is linked. Render the PNG from the SVG with Edge, from the repository root (any Chromium browser works the same way):

```sh
# Wrap the SVG in a page with no margin, then take a 1280 x 640 screenshot of it.
printf '<!doctype html><body style="margin:0">%s</body>' "$(cat assets/brand/apollo-social-preview.svg)" > <tmp>/social.html
msedge --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=1280,640 --screenshot=assets/brand/apollo-social-preview.png <tmp>/social.html
```

An admin uploads the PNG in the repository's Settings, General, Social preview; GitHub has no API for it.

## Regenerating the icons

The desktop icons in `src-tauri/icons/` are generated from these files, never edited by hand. Write the output to a temporary folder:

```sh
pnpm tauri icon assets/brand/apollo-icon.svg -o <tmp>/full
for n in 16 20 24 32 40 48; do pnpm tauri icon assets/brand/apollo-icon-$n.svg -o <tmp>/px$n -p $n; done
node scripts/make-ico.mjs src-tauri/icons/icon.ico <tmp>/px16/16x16.png <tmp>/px20/20x20.png <tmp>/px24/24x24.png <tmp>/px32/32x32.png <tmp>/px40/40x40.png <tmp>/px48/48x48.png <tmp>/full/64x64.png <tmp>/full/256x256.png
```

Then copy into `src-tauri/icons/` only the files it already has:

- **`32x32.png`** comes from `<tmp>/px32`, and every other PNG and `icon.icns` from `<tmp>/full`.
- **`icon.ico`** is written by `scripts/make-ico.mjs`, which packs the PNGs as they are (`scripts/ico-lib.mjs`). Each small size therefore comes from its own pixel-grid drawing; Tauri's own `.ico` would scale the full drawing down.
