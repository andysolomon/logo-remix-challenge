# Logo Remix Challenge

iPad-first logo guessing game. A creator picks the **logo of one team or fast-food chain** and the **colors of another**; players name the logo and/or color sources while the remix misdirects them.

Real logos for all 32 NFL teams, all 30 NBA teams, all 30 MLB teams, 30 fast-food chains, 120 college teams, 6 college conference marks, and the 17 Cobb County high schools (the HIGH SCHOOL league) live as local SVG or PNG assets under `public/logos/svg/`. SVG fills are rewritten in-browser; PNGs use a canvas-based pixel recolor.

NBA teams are available as both logo and color donors. Filter them by Eastern or Western conference, or select NBA in Random Deck to create NBA-only or mixed-league rounds. Common answers such as Sixers, Cavs, GSW, NYK and SAS work in search, autocomplete and grading.

MLB teams have American/National League filters and use official MLB SVGs. Team colors remain available even when a cap mark uses only one of them. Fast-food chains are grouped into Burgers, Chicken, Sandwiches, Pizza, Mexican & Asian, and Coffee & Treats. Both collections work in the logo picker, color picker, Random Deck, hints, autocomplete and saved rounds. Try a Braves logo in McDonald's colors, or the Golden Arches in Yankees colors. Collection buttons form a single horizontally scrollable row on phones and smaller tablets; larger layouts retain two rows of three.

Every NFL team has alternate artwork. Pick an NFL original, then use **Shuffle Logo** in the remix preview to cycle its primary, alternate and available throwback marks. **Shuffle Colors** changes the color assignment independently. The preview shows the artwork label and position; the chosen logo is retained when saving, editing, playing and revealing a round. Team names, accepted answers and donor colors stay the same. Teams outside the NFL continue to use their primary marks. Random Deck uses primary logos until you edit a round and choose an alternate.

Each round asks for either the **logo's team** or the **team whose colors it wears** — set per round on its deck card, with a deck-wide default for rounds left alone. An optional voice announcer plays Chatterbox clips (`public/voice/`) for the round prompt, the verdict, and the final score.

Client-only SPA — no backend, no auth. Deck, timer, game mode, guess mode, voice, and high score persist in `localStorage`.

## Stack

- Vite + React 18 + TypeScript
- Plain CSS with design tokens from `design_handoff_logo_remix/DESIGN_SYSTEM.md` (`src/styles.css`)
- Google Fonts: Chakra Petch (600/700), Space Grotesk (400–700)
- Local SVG logos recolored in-browser by fill substitution, with a canvas fallback for PNGs (`src/components/Logo.tsx`, `public/logos/svg/`)
- Voice announcer: baked Chatterbox Turbo wavs in `public/voice/` — round prompts, correct / not quite / time's up, and score fragments (regenerate with `scripts/generate_voice.py`)

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

`download_nfl_alternates.py` refreshes the curated sources in `scripts/nfl_alternate_sources.json` and records provenance, checksums, artwork palettes and unused slots in `nfl-alternates-manifest.json`. All 32 teams offer vector alternates: 35 SVGs contain editable outlines, with no embedded bitmap or live font dependency. Where the previous design had no usable vector source, the catalog uses a labeled vector alternate or throwback. Cleveland's 2023 Dawg now uses SVG paths from Logowik. Brownie remains the only PNG fallback, with a 540-pixel artwork edge; it is not a vector.

Sources include the Rams' official brand-assets bundle, an archived NFL EPS collection, 1000 Logos, Logos Download, Wikimedia, Seeklogo and Logowik. Logowik refresh follows its public guest download form with session cookies and stops if that workflow no longer provides an SVG. SVG import rejects bitmap wrappers, live text, missing viewBoxes and external image references. Reviewed page backgrounds are removed without removing enclosed white artwork details, and each PNG fallback has a minimum source size; refresh never upscales or shrinks the source. Pillow is required for PNG inspection. Importing original AI/EPS files or cropping downloaded SVG pages also requires Inkscape; EPS conversion uses Ghostscript. Verified checked-in assets are reused without those conversion tools unless a source changes or `--force` is supplied.

Gameplay needs no external image service. The complete NFL catalog validates before any artwork or team data is replaced. Re-run with `bun run logos:nfl-alternates`, or add `--force` to refresh source images (the official Rams source downloads a large ZIP). Stable variant ids are stored in the optional round `l` field and retained across artwork upgrades. Older decks and missing variant ids use the primary artwork.

Logo assets are acquired from official NBA/MLB CDNs, ESPN-linked Wikipedia files, direct Wikipedia files, official athletics sites, brand media libraries, and Cobb County School District pages, then checked into `public/logos/svg/` with manifests describing their sources and artwork colors.

`download_nba_svgs.py` downloads the 30 primary SVG marks from the official NBA CDN, snapshots names and brand colors from ESPN, and records actual artwork colors in `nba-manifest.json`. `nba_roster.py` pins NBA IDs and conference alignment from NBA.com. `build_nba_teams.py` validates the complete roster and replaces only NBA entries; the college and high-school builders preserve NBA entries. All logos stay local at runtime.

`download_extra_logos.py --league MLB` validates the current roster against MLB's official Stats API and downloads MLB's team SVGs. `--league FOOD` resolves the 30 chains' Wikipedia infobox logos, with KFC's 2026 primary mark coming directly from its official media library. The separate `mlb-manifest.json` and `fast-food-manifest.json` record sources, artwork colors, palettes, and unused color slots. `build_extra_teams.py --league MLB|FOOD` validates and replaces only the requested collection. Every roster builder preserves the other collections. The downloader validates the whole collection before replacing checked-in files; an optional `--cache-dir /tmp/logo-remix-assets` resumes interrupted downloads.

The fast-food PNG inspection path requires Pillow (`python3 -m pip install Pillow`). The application itself has no new runtime dependencies.

`download_svgs.py` takes its rosters and brand colors from ESPN — 32 NFL teams, 6 conference logos (ACC, Big 12, Big Ten, Pac-12, SEC, Ivy), and every football member of those conferences for the configured season, plus the 21 Division I football HBCUs (SWAC, the MEAC schools that field football, and Hampton, North Carolina A&T and Tennessee State). It writes `manifest.json`.

`download_hbcu_svgs.py` covers the HBCUs that ESPN's football feed cannot reach: Coppin State and Maryland Eastern Shore, the two MEAC members with no football team, and all 14 HBCUs of the Division II SIAC. ESPN carries no brand colors for Division II, so palettes come from the official colors in `scripts/hbcu_roster.py` snapped onto the artwork's own fills. It writes `hbcu-manifest.json`. Between them the HBCU chip is the complete SWAC, MEAC and SIAC membership — 37 schools. (Spring Hill College is a SIAC member but not an HBCU, so it is deliberately absent.)

`download_cobb_svgs.py` fetches the HIGH SCHOOL league: the 17 Cobb County high schools. No feed covers Georgia high schools, so `scripts/cobb_roster.py` pins one hand-verified source URL per school — the school's own athletics site where one is scrapeable, the Cobb County School District site otherwise, and Wikipedia as the fallback (Cobb Horizon fields no teams, so its primary institutional mark stands in). Palettes come from the official colors snapped onto the artwork's own fills, and each asset lands in `public/logos/svg/high-school/` with its source recorded in `hs-manifest.json`.

`build_teams.py` merges the NFL/college manifests into `src/lib/teams.json`, rewriting the whole `COL-*` block (high-school entries are carried through untouched); `build_hs_teams.py` does the same for the `HS-*` block from `hs-manifest.json`. Run each after its downloader. To fetch or refresh (stdlib Python 3, idempotent):

```sh
bun run logos:svg                              # or: python3 scripts/download_svgs.py
python3 scripts/download_svgs.py --force       # re-download everything
python3 scripts/download_svgs.py --only nfl    # subset: nfl, conferences, ncaa
bun run logos:hbcu                             # or: python3 scripts/download_hbcu_svgs.py
bun run logos:hs                               # or: python3 scripts/download_cobb_svgs.py
bun run logos:nba                              # fetch official NBA SVGs and refresh the manifest
bun run logos:mlb                              # fetch official MLB SVGs and refresh the manifest
bun run logos:food                             # fetch the 30 fast-food logos and refresh the manifest
bun run teams                                  # regenerate college entries in src/lib/teams.json from both manifests
bun run teams:hs                               # regenerate high-school entries from hs-manifest.json
bun run teams:nba                              # regenerate NBA entries from nba-manifest.json
bun run teams:mlb                              # regenerate MLB entries from mlb-manifest.json
bun run teams:food                             # regenerate fast-food entries from fast-food-manifest.json
```

The legacy ESPN PNGs (32 NFL teams + 5 conferences) can still be fetched into `public/logos/`:

```sh
bun run logos                                  # or: python3 scripts/download_logos.py
python3 scripts/download_logos.py --force      # re-download everything
```

Trademarks belong to the NFL, NBA, MLB, their teams, the restaurant brands, the conferences and the schools; assets are used here for a private party game.

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
  lib/teams.json           32 NFL + 30 NBA + 30 MLB + 30 food + 126 college + 17 high-school entries
  lib/useOrientation.ts    portrait = innerHeight > innerWidth
  components/
    Logo.tsx               local PNG rendering + canvas palette-swap recoloring
    Header.tsx             wordmark, Create / Deck tabs, PLAY
    TeamBrowser.tsx        league toggle, search, conference chips, tile grid
    RemixCanvas.tsx        hero remix logo, Shuffle Logo, Shuffle Colors, + ADD ROUND
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
  download_cobb_svgs.py    fetch the 17 Cobb County high-school logos
  download_nba_svgs.py     fetch the 30 official NBA SVGs and snapshot ESPN metadata
  nba_roster.py            pinned NBA IDs, conferences and answer aliases
  build_nba_teams.py       validate and rebuild only NBA entries
  download_extra_logos.py  fetch official MLB and fast-food SVG/PNG marks
  extra_rosters.py         pinned MLB IDs/conferences, chain roster and aliases
  build_extra_teams.py     validate and rebuild only MLB or fast-food entries
  cobb_roster.py           Cobb roster, official colors, and per-school source URLs
  build_teams.py           merge the NFL/college manifests into src/lib/teams.json
  build_hs_teams.py        merge hs-manifest.json into src/lib/teams.json
  generate_voice.py        bake Chatterbox announcer clips into public/voice/
public/logos/
  nfl/                     32 team PNGs (ESPN CDN naming, e.g. wsh.png)
  conferences/             acc, big-12, big-ten, pac-12, sec PNGs
  svg/high-school/         17 checked-in Cobb high-school SVG/PNG marks
  svg/nba/                 30 checked-in official NBA SVG marks
  svg/mlb/                 30 checked-in official MLB SVG marks
  svg/fast-food/           30 checked-in chain SVG/PNG marks
```

The design prototype and spec live in `design_handoff_logo_remix/` (reference only).
