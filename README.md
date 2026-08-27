# Logo Remix Challenge

iPad-first sports-logo guessing game. A creator picks the **logo of one team** and the **colors of another**; players must name the original team while the colors misdirect them.

Client-only SPA — no backend, no auth. Deck, timer, game mode, and high score persist in `localStorage`.

## Stack

- Vite + React 18 + TypeScript
- Plain CSS with design tokens from `design_handoff_logo_remix/DESIGN_SYSTEM.md` (`src/styles.css`)
- Google Fonts: Chakra Petch (600/700), Space Grotesk (400–700)
- Procedural SVG logos — no image assets (`src/components/Logo.tsx`)

## Run

```sh
bun install
bun run dev      # http://localhost:5173
bun run build    # type-check + production build to dist/
bun run preview
```

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
  lib/teams.json           32 fictional teams, permutations, seed deck
  lib/useOrientation.ts    portrait = innerHeight > innerWidth
  components/
    Logo.tsx               procedural SVG generator
    Header.tsx             wordmark, Create / Deck tabs, PLAY
    TeamBrowser.tsx        league toggle, search, conference chips, tile grid
    RemixCanvas.tsx        hero remix logo, Shuffle Colors, + ADD ROUND
    CreateMode.tsx         landscape 3-column / portrait stepped composition
    DeckMode.tsx           round cards, game setup rail, high score
    PlayMode.tsx           intro → question (type / host) → reveal → results
```

The design prototype and spec live in `design_handoff_logo_remix/` (reference only).
