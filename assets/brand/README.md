# Apollo brand assets

The source artwork for Apollo Download Manager's mark, app icon and wordmark (#347). How to use them, the colours and the rules are in [docs/BRANDING.md](../../docs/BRANDING.md).

| File | Use |
|---|---|
| `apollo-icon.svg` | The app icon, at 48 px and larger: the A alone, in two tones |
| `apollo-icon-small.svg` | The app icon drawn heavier for 16 to 32 px, so the split still shows |
| `apollo-mark.svg` | The A in one colour (ink), for single-colour uses |
| `apollo-lockup-light.svg`, `apollo-lockup-dark.svg` | The mark and wordmark, for light and dark backgrounds |

The app draws the small icon inline (`src/components/BrandIcon.tsx`) in the sidebar and on the first-run screen.

## Regenerating the icons

The desktop icons in `src-tauri/icons/` are generated from these files, never edited by hand. Write the output to a temporary folder, then copy only the files `src-tauri/icons/` already has:

```sh
pnpm tauri icon assets/brand/apollo-icon.svg -o <tmp>/full
pnpm tauri icon assets/brand/apollo-icon-small.svg -o <tmp>/small -p 32
```

- **`32x32.png`** comes from the small icon, and every other file from the full icon.
- **`icon.ico`** is Tauri's, so all its sizes come from the full icon. Building it with the 16, 24 and 32 px sizes from the small icon needs another tool, which is left for later (#347).

## Before a public release

The lockups set the wordmark as live text in Inter, so they look different where Inter isn't installed. Convert the text to outlines before using a lockup outside the app.
