# Media kit

Logos, screenshots and boilerplate copy for directory listings, launch
platforms and press. Everything here is served publicly, so it can be linked
directly: `https://lensresearch.app/brand/<file>`.

## Description (50 words)

> Lens is a UX research repository with usability testing built in. Turn
> interview quotes into evidence-linked insights, run unmoderated tests by
> sharing one link — participants need no account — and move validated findings
> to the roadmap. Viewers are always free. EU-hosted or self-hosted. AI runs on
> your own key.

One-liner, where a listing only allows a sentence:

> The UX research repository that connects interviews, insights and unmoderated
> testing — EU-hosted, with unlimited free viewers.

## Logos

| File | Size | Use |
|---|---|---|
| `lens-mark-512.png` | 512×512 | App icon, avatars, directory listings |
| `lens-mark-1024.png` | 1024×1024 | Large square tiles (Product Hunt, Peerlist) |
| `lens-logo-light.png` | 1400×512 | Full lockup for **light** backgrounds — navy wordmark |
| `lens-logo-dark.png` | 1400×512 | Full lockup for **dark** backgrounds — white wordmark |
| `lens-mark.svg` | vector | Source for the mark; scale to any size |

Transparent backgrounds, cropped tight to the artwork — place them with your own
clear space, at least the height of the tile on every side.

## Screenshots

3200×2000 (1600×1000 at 2×), light theme.

| File | Shows |
|---|---|
| `screenshots/01-dashboard.png` | The workspace overview — active studies, upcoming interviews, insight count, interview sentiment |
| `screenshots/02-insights.png` | The repository itself — reusable insights with severity, impact, confidence, themes and evidence counts |
| `screenshots/03-insight-to-roadmap.png` | Insight triage — findings moving from raw through validated to opportunity, the research-to-product workflow |

**These are the demo sandbox, deliberately.** The data is fictional, so no real
participant or customer appears in a public asset. Two pieces of local-only
chrome are suppressed before capture: Next's dev indicator, and the "Demo mode"
pill — which `DemoPill` in `components/shell/topbar.tsx` renders *only* in the
sandbox, so hiding it makes the shot match what a signed-in customer sees. No UI
text is altered.

**No testing screenshot yet.** The obvious fourth shot is the test builder, but
in the sandbox it displays a `http://localhost:3000/t/…` share link and a
"results may exist" warning. Making that presentable would mean editing UI text
in a press asset, which isn't worth doing — capture it from the deployed app
instead.

## Colours

| Token | Hex | Where |
|---|---|---|
| Primary indigo | `#4756E1` | The tile. Matches `--primary` in `app/globals.css` — `hsl(234 72% 58%)` |
| Wordmark navy | `#191F55` | Wordmark on light backgrounds. `C.dark` in `components/marketing/chrome.tsx` |
| White | `#FFFFFF` | The telescope glyph, and the wordmark on dark backgrounds |

## Notes

- The mark is the lucide **telescope** outline on the primary indigo tile — the
  same mark as the favicon and Apple touch icon, generated at request time by
  [`app/icon.tsx`](../../app/icon.tsx) and
  [`app/apple-icon.tsx`](../../app/apple-icon.tsx). Those remain the canonical
  definition; these files exist because directories and press need downloadable
  PNGs at larger sizes.
- The lockup wordmark is **Inter ExtraBold (800)**, the typeface the site loads
  via `next/font`, baked into the PNGs so no font is needed to use them.
- Tile corner radius is 21.9% of its width (14/64), matching the favicon.
- There is no SVG of the full lockup: it would need Inter embedded or the text
  converted to paths. Ask if you want one and the glyphs can be outlined.
- **Don't** recolour the tile, stretch any file, or put the light lockup on a
  dark background.

## Regenerating

Logos were rendered from SVG with headless Chrome at the exact sizes above
(transparent background via `--default-background-color=00000000`). Screenshots
were captured over the DevTools Protocol against a local dev server, because
entering the demo sandbox requires setting a `sessionStorage` marker between page
load and capture. If the mark changes, update `app/icon.tsx` first — it's
canonical — then re-render these to match.
