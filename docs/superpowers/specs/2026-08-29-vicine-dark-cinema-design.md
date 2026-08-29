# VICINE "Dark Cinema" Visual System Overhaul

Date: 2026-08-29
Status: Approved direction, ready to implement
Scope: Full visual system pass across shared components, theme tokens, typography, and visible copy of the VICINE streaming app.

## Design Read

"Reading this as: a streaming content product (movies/anime/series discovery + player) for mainstream consumers, in a dark, cinematic, poster-forward language, leaning toward a tuned Tailwind/shadcn + display-typography system with a single emerald accent and motion that serves browsing (snap rows, hover reveals) rather than marketing theatrics."

Dials:

- `DESIGN_VARIANCE: 6` (asymmetric poster grids, split hero)
- `MOTION_INTENSITY: 5` (hover reveals + one scroll-driven hero treatment, reduced-motion safe)
- `VISUAL_DENSITY: 6` (content-dense poster walls, minimal chrome)

## Problems Being Fixed

1. **Two competing card systems.** `media-card.tsx` (theme tokens) is the live one. `content-card.tsx` (hardcoded zinc/emerald), `hero.tsx`, custom `badge.tsx`, and component `skeleton.tsx` are dead code using a conflicting, inconsistent palette.
2. **Multiple accents.** `design-tokens.ts` badge fragments use blue/purple/emerald (three accents). The live `ui/badge` + `ui/card` already use the single emerald `--primary`. Unify everything to emerald.
3. **Banned Inter default** body font; only display uses Space Grotesk.
4. **Em/en-dashes everywhere** in visible copy (metadata, OG, page descriptions, quality labels, footer, pagination, hero fallback).
5. **Middle-dot (`•`) overuse** in category strips and file-size labels.
6. **`reveal-section` claims animation but animates nothing.**
7. **Dark base is a blue-grey**; a warmer cinematic near-black reads better.

## Design

### 1. Foundation (globals.css tokens)

- Deepen dark base from `oklch(0.13 0.005 270)` (blue-grey) to a warmer cinematic near-black (`oklch(0.15 0.01 255)`), stepping elevated surfaces subtly. Keep light theme clean/neutral.
- **Single accent lock**: emerald (`--primary` / `--ring`) stays the only accent. Remove all multi-color badge fragments from `design-tokens.ts`.
- Keep the one radius scale and the shadcn/oklch token structure.

### 2. Typography (layout.tsx)

- Body: Inter -> **Geist** Sans via `next/font/google` (self-hosted). Keep **Space Grotesk** for `--font-display`. Keep Geist Mono for `--font-mono`.
- Update `@theme inline` font vars accordingly.

### 3. Dead code cleanup

Delete unused components that use a conflicting palette:

- `components/hero.tsx`
- `components/content-card.tsx`
- `components/badge.tsx` (custom, not ui/badge)
- `components/section-header.tsx`
- `components/skeleton.tsx` (component, not ui/skeleton)

(Verify each has no remaining live import before deleting.)

### 4. Browsing surfaces (home, movies, anime, series, search)

- `media-card.tsx` / `media-grid.tsx`: cinematic poster wall. Refined hover (subtle scale + play affordance), single-system badges, replace `bg-white/90` overlay badges with tone-aware badge over a scrim.
- `home-hero.tsx`: keep the strong poster split, clean the `•` separator, ensure CTA contrast, use display font.
- `site-header.tsx` / `footer.tsx`: unify to Geist + emerald, tidy mobile chrome, remove `•` fragments.
- `reveal-section.tsx`: give it a real `whileInView` reveal, reduced-motion safe, or drop it.
- `design-tokens.ts`: refactor to single-accent token system for programmatic (motion) use.

### 5. Watch page chrome

- `season-episodes.tsx` + `watch-inner.tsx`: replace em-dash labels (`S1 E2 — 480p`) -> comma or middot form (`S1 E2, 480p` / `S1 E2 · 480p`), unify quality chips to emerald.

### 6. Copy hygiene (em/en-dash + middot)

Fix all visible/branded strings:

- `app/layout.tsx` metadata + OG + twitter
- `app/movies/anime/series/page.tsx` descriptions
- `components/footer.tsx` (`480p – 4K`)
- `components/pagination.tsx` (`Page X of Y`)
- `home-hero.tsx` / `hero.tsx` fallback copy
- `watch-inner.tsx` / `season-episodes.tsx` labels

Rules: replace `—`/`–` with hyphen, colon, comma, or period. Rationalize `•` (max one per line).

### 7. Non-goals

- No change to video player functionality or the watch page's composition/information architecture.
- No change to URL structure, primary nav labels, or route slugs.
- No change to theme toggle behavior (auto light/dark retained).

## Verification

- `bun run typecheck` (tsc --noEmit)
- `bun run lint` (eslint)
- `bun run build` (next build)
