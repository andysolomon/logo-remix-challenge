# Logo Remix Challenge

iPad-first sports-logo guessing game. A creator picks the **logo of one team** and the **colors of another**; players must name the original team while the colors misdirect them.

Real logos for all 32 NFL teams, the ACC, Big 12, Big Ten, Pac-12, SEC and Ivy League conference marks, and 104 college teams (those conferences plus an HBCU grouping) live as local SVGs under `public/logos/svg/` and are recolored at render time by rewriting fills: colors matching the original team's three palette colors are swapped to the other team's palette while all other artwork is preserved. PNG logos (used only where Wikipedia has no SVG) fall back to a canvas-based pixel recolor.

Client-only SPA — no backend, no auth. Deck, timer, game mode, and high score persist in `localStorage`.

## Stack

- Vite + React 18 + TypeScript
- Plain CSS with design tokens from `design_handoff_logo_remix/DESIGN_SYSTEM.md` (`src/styles.css`)
- Google Fonts: Chakra Petch (600/700), Space Grotesk (400–700)
- Local SVG logos recolored in-browser by fill substitution, with a canvas fallback for PNGs (`src/components/Logo.tsx`, `public/logos/svg/`)

## Run

```sh
bun install
bun run dev      # http://localhost:5173
bun run build    # type-check + production build to dist/
bun run preview
```

## Logos

Logo SVGs are downloaded from Wikipedia (rosters and brand colors from ESPN) and checked into `public/logos/svg/` — 32 NFL teams, 6 conference logos (ACC, Big 12, Big Ten, Pac-12, SEC, Ivy), and every football member of those conferences plus an HBCU grouping (SWAC + MEAC + the D-I HBCUs in other leagues) for the configured season, plus a `manifest.json` describing each asset and its fill colors. To fetch or refresh them (stdlib Python 3, idempotent):

```sh
bun run logos:svg                              # or: python3 scripts/download_svgs.py
python3 scripts/download_svgs.py --force       # re-download everything
python3 scripts/download_svgs.py --only nfl    # subset: nfl, conferences, ncaa
bun run teams                                  # regenerate college entries in src/lib/teams.json from the manifest
```

The legacy ESPN PNGs (32 NFL teams + 5 conferences) can still be fetched into `public/logos/`:

```sh
bun run logos                                  # or: python3 scripts/download_logos.py
python3 scripts/download_logos.py --force      # re-download everything
```

Trademarks belong to the NFL and the conferences; assets are used here for a private party game.

## Deploy

Zero-config on Vercel (framework preset: Vite). `vercel.json` adds an SPA rewrite.

```sh
vercel
```

## Structure

```
src/
  App.tsx                  mode router (create / deck / play) + persisted state
  styles.css               tokens, keyframes, all component styles
  lib/teams.ts             dataset, answer matching, filtering, localStorage
  lib/teams.json           32 NFL teams + 5 conferences, permutations, seed deck
  lib/useOrientation.ts    portrait = innerHeight > innerWidth
  components/
    Logo.tsx               local PNG rendering + canvas palette-swap recoloring
    Header.tsx             wordmark, Create / Deck tabs, PLAY
    TeamBrowser.tsx        league toggle, search, conference chips, tile grid
    RemixCanvas.tsx        hero remix logo, Shuffle Colors, + ADD ROUND
    CreateMode.tsx         landscape 3-column / portrait stepped composition
    DeckMode.tsx           round cards, game setup rail, high score
    PlayMode.tsx           intro → question (type / host) → reveal → results
scripts/
  download_logos.py        fetch the 37 logo PNGs from ESPN into public/logos/
public/logos/
  nfl/                     32 team PNGs (ESPN CDN naming, e.g. wsh.png)
  conferences/             acc, big-12, big-ten, pac-12, sec PNGs
```

The design prototype and spec live in `design_handoff_logo_remix/` (reference only).
