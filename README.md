# Logo Remix Challenge

iPad-first sports-logo guessing game. A creator picks the **logo of one team** and the **colors of another**; players must name the original team while the colors misdirect them.

Real logos for all 32 NFL teams, the ACC, Big 12, Big Ten, Pac-12, SEC and Ivy League conference marks, and 120 college teams (those conferences plus an HBCU grouping) live as local SVGs under `public/logos/svg/` and are recolored at render time by rewriting fills: colors matching the original team's three palette colors are swapped to the other team's palette while all other artwork is preserved. PNG logos (used only where Wikipedia has no SVG) fall back to a canvas-based pixel recolor.

Each round asks for either the **logo's team** or the **team whose colors it wears** — set per round on its deck card, with a deck-wide default for rounds left alone. An optional voice announcer plays a Chatterbox clip (`public/voice/`) as each round opens.

Client-only SPA — no backend, no auth. Deck, timer, game mode, guess mode, voice, and high score persist in `localStorage`.

## Stack

- Vite + React 18 + TypeScript
- Plain CSS with design tokens from `design_handoff_logo_remix/DESIGN_SYSTEM.md` (`src/styles.css`)
- Google Fonts: Chakra Petch (600/700), Space Grotesk (400–700)
- Local SVG logos recolored in-browser by fill substitution, with a canvas fallback for PNGs (`src/components/Logo.tsx`, `public/logos/svg/`)
- Voice announcer: three baked Chatterbox Turbo wavs in `public/voice/` (regenerate with `scripts/generate_voice.py`)

## Run

```sh
bun install
bun run dev      # http://localhost:5173
bun run build    # type-check + production build to dist/
bun run preview
```

Announcer clips live in `public/voice/`. To regenerate them you need a Chatterbox install:

```sh
~/Documents/Github/chatterbox/.venv/bin/python scripts/generate_voice.py
```

Agent Skill for this app (Voice Announcer, clip map, regen): `.agents/skills/arc-logo-remix/`. The bake workflow lives with Chatterbox as `creating-audio`.

## Logos

Logo SVGs are downloaded from Wikipedia and checked into `public/logos/svg/`, alongside a manifest describing each asset and its fill colors. Two scripts feed it, because one roster source does not cover everything:

`download_svgs.py` takes its rosters and brand colors from ESPN — 32 NFL teams, 6 conference logos (ACC, Big 12, Big Ten, Pac-12, SEC, Ivy), and every football member of those conferences for the configured season, plus the 21 Division I football HBCUs (SWAC, the MEAC schools that field football, and Hampton, North Carolina A&T and Tennessee State). It writes `manifest.json`.

`download_hbcu_svgs.py` covers the HBCUs that ESPN's football feed cannot reach: Coppin State and Maryland Eastern Shore, the two MEAC members with no football team, and all 14 HBCUs of the Division II SIAC. ESPN carries no brand colors for Division II, so palettes come from the official colors in `scripts/hbcu_roster.py` snapped onto the artwork's own fills. It writes `hbcu-manifest.json`. Between them the HBCU chip is the complete SWAC, MEAC and SIAC membership — 37 schools. (Spring Hill College is a SIAC member but not an HBCU, so it is deliberately absent.)

`build_teams.py` merges both manifests into `src/lib/teams.json`. It rewrites the whole `COL-*` block, so run it after either downloader. To fetch or refresh (stdlib Python 3, idempotent):

```sh
bun run logos:svg                              # or: python3 scripts/download_svgs.py
python3 scripts/download_svgs.py --force       # re-download everything
python3 scripts/download_svgs.py --only nfl    # subset: nfl, conferences, ncaa
bun run logos:hbcu                             # or: python3 scripts/download_hbcu_svgs.py
bun run teams                                  # regenerate college entries in src/lib/teams.json from both manifests
```

The legacy ESPN PNGs (32 NFL teams + 5 conferences) can still be fetched into `public/logos/`:

```sh
bun run logos                                  # or: python3 scripts/download_logos.py
python3 scripts/download_logos.py --force      # re-download everything
```

Trademarks belong to the NFL, the conferences and the schools; assets are used here for a private party game.

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
    DeckMode.tsx           deck cards (per-round guess mode) + settings rail
    SettingsModal.tsx      timer, defaults, voice announcer
public/voice/              Chatterbox clips for Guess the Logo / Colors / both
scripts/
  download_logos.py        fetch the 37 logo PNGs from ESPN into public/logos/
  download_svgs.py         fetch NFL, conference and ESPN-rostered college SVGs
  download_hbcu_svgs.py    fetch the SIAC + non-football MEAC logos from Wikipedia
  hbcu_roster.py           HBCU roster, official colors, and logo-file overrides
  build_teams.py           merge both manifests into src/lib/teams.json
  generate_voice.py        bake Chatterbox announcer clips into public/voice/
public/logos/
  nfl/                     32 team PNGs (ESPN CDN naming, e.g. wsh.png)
  conferences/             acc, big-12, big-ten, pac-12, sec PNGs
```

The design prototype and spec live in `design_handoff_logo_remix/` (reference only).
