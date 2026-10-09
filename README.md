# Logo Remix Challenge

iPad-first logo guessing game. A creator picks the **logo of one team, brand or app** and the **colors of another**; players name the logo and/or color sources while the remix misdirects them.

Real logos for all 32 NFL teams, all 30 NBA teams, all 30 MLB teams, 30 fast-food chains, 29 brands, 30 iOS apps, 30 TV channels, 30 car brands, 120 college teams, 6 college conference marks, and the 17 Cobb County high schools (the HIGH SCHOOL league) live as local SVG or PNG assets under `public/logos/svg/`. SVG fills are rewritten in-browser; PNGs use a canvas-based pixel recolor.

NBA teams are available as both logo and color donors. Filter them by Eastern or Western conference, or select NBA in Random Deck to create NBA-only or mixed-league rounds. Common answers such as Sixers, Cavs, GSW, NYK and SAS work in search, autocomplete and grading.

MLB teams have American/National League filters and use official MLB SVGs. Team colors remain available even when a cap mark uses only one of them. Fast-food chains are grouped into Burgers, Chicken, Sandwiches, Pizza, Mexican & Asian, and Coffee & Treats. Both collections work in the logo picker, color picker, Random Deck, hints, autocomplete and saved rounds. Try a Braves logo in McDonald's colors, or the Golden Arches in Yankees colors. Collection buttons form a single horizontally scrollable row on phones and smaller tablets; larger layouts show rows of four.

**BRANDS** groups 29 brands by brand type — Product, Service, Corporate, Personal, Store (retailers selling their own label) and Place (flags and civic symbols) — five of each, with four in Personal. **APPS** holds 30 iOS app icons: Apple's built-in apps (Maps, Weather, Messages…) plus Social, Games, Music & Video and Everyday apps such as Duolingo. **TV** holds 30 channels grouped into Broadcast, Cable, Music & Pop (MTV, VH1, BET…), Kids and Discovery & Lifestyle. **CARS** holds 30 carmakers grouped into American, Japanese & Korean, German, Italian and British. Hints name the type ("Logo: Place brand", "Colors: Games app", "Logo: German car", "Colors: Kids channel").

Brand logos must not give the answer away. Every fast-food, brand, app, channel and car mark is a name-free symbol, mascot, badge or icon: wordmarks are stripped from official artwork or replaced by the brand's symbol-only file. Some brands publish nothing but a wordmark — six chains (Bojangles, Culver's, Dunkin', Five Guys, Papa Johns and Raising Cane's), eleven channels (ABC, FOX, HBO, ESPN, CNN, TNT, VH1, CMT, E!, HGTV and The Weather Channel) and two carmakers (Ford and Fiat); they keep it, and Random Deck uses them only as color donors. Hardee's and Carl's Jr. share the same Happy Star, so either name is accepted for both.

Every NFL team has alternate artwork. Pick an NFL original, then use **Shuffle Logo** in the remix preview to cycle its primary, alternate and available throwback marks. **Shuffle Colors** changes the color assignment independently. The preview shows the artwork label and position; the chosen logo is retained when saving, editing, playing and revealing a round. Team names, accepted answers and donor colors stay the same. Most fast-food chains, brands, apps, channels and carmakers also have alternates, such as Burger King's 1999 bun, the 1977 rainbow Apple, the Texas flag map, older app icons, MTV's 1981 block M, Nickelodeon's 1985 splat, BMW's 1917 roundel or Ferrari's rearing horse. Other collections use their primary marks. Random Deck uses primary logos until you edit a round and choose an alternate.

One-color logos, such as the Yankees' NY, the Golden Arches or Alabama's script A, would otherwise remix into a single solid color — often a lone black silhouette that says nothing about the color team. Their remixes sit on a rounded backdrop tile painted in a second color from the color team's palette, so every remix shows at least two of that team's colors. **Shuffle Colors** swaps which color fills the logo and which fills the backdrop; every assignment keeps the logo readable on its backdrop, and the backdrop is never white. Logos that already show two or more remixable colors are unchanged, and logos in their own colors (team browser, reveal) never get a backdrop. A logo counts as one-color when its `unusedSourceSlots` lists two of its three palette slots.

Each round asks for either the **logo's team** or the **team whose colors it wears** — set per round on its deck card, with a deck-wide default for rounds left alone. An optional voice announcer plays Chatterbox clips (`public/voice/`) for the round prompt, the verdict, and the final score.

**Designer mode** is tucked away under Settings → Advanced. Switch it on and a **Designer** tab joins Create and Deck: pick any logo (and any of its alternates), start from another team's palette or type exact hex codes for each of the artwork's color slots, and download the result as an **SVG** (vector, any size) or a square **PNG** at 512, 1024 or 2048 px with a transparent, white, black or custom background. One-color logos keep their backdrop tile in the export, bitmap artwork exports as PNG only, and the tab disappears again when the mode is switched off.

Client-only SPA — no backend, no auth. Deck, timer, game mode, guess mode, voice, high score, and the Designer mode switch persist in `localStorage`.

## Stack

- Vite + React 18 + TypeScript
- Plain CSS with design tokens from `design_handoff_logo_remix/DESIGN_SYSTEM.md` (`src/styles.css`); a dark theme (Settings → Appearance: System / Light / Dark) swaps the same tokens
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

`download_extra_logos.py --league MLB` validates the current roster against MLB's official Stats API and downloads MLB's team SVGs into `mlb-manifest.json`; `build_extra_teams.py --league MLB` validates and replaces only MLB entries. An optional `--cache-dir /tmp/logo-remix-assets` resumes interrupted downloads.

Fast food, brands, apps, TV channels and cars share one pipeline. `brand_rosters.py` holds their names, categories, donor colors and aliases (fast-food colors keep the values snapped from the chains' original logos). `brand_artwork_sources.json` pins every primary and alternate: the source URL (Wikimedia, official sites, Logowik, Logopedia, 1000 Logos, Iconify, vectorlogo.zone and similar), the source file's SHA-256, and the reviewed `brand_vector.py` edits — element removals that strip a wordmark, ™ or page background, kept elements that cut one icon out of a sheet, a fill for one-color icons, and a crop. `download_brand_logos.py --league FOOD|BRAND|APP|TV|CAR` replays those edits, rejects bitmaps, live text, scripts and external references, converts percentage `rgb()` colors so they can be recolored, and maps the artwork's fills and gradient stops onto the palette roles (a role sits between the two ends of a gradient when both stay within matching range, so gradient app tiles recolor as a whole). It writes `fast-food-manifest.json`, `brands-manifest.json`, `apps-manifest.json`, `tv-manifest.json` or `cars-manifest.json`. Verified checked-in assets are reused offline; a changed source fails its checksum, and nothing is replaced until the whole collection validates. `--cache-dir` keeps verified source files for rate-limited refreshes. `build_brand_teams.py --league FOOD|BRAND|APP|TV|CAR` validates the manifest against the roster and rewrites only that collection in place. Every roster builder preserves the other collections. The application itself has no new runtime dependencies.

`download_svgs.py` takes its rosters and brand colors from ESPN — 32 NFL teams, 6 conference logos (ACC, Big 12, Big Ten, Pac-12, SEC, Ivy), and every football member of those conferences for the configured season, plus the 21 Division I football HBCUs (SWAC, the MEAC schools that field football, and Hampton, North Carolina A&T and Tennessee State). It writes `manifest.json`.

`download_hbcu_svgs.py` covers the HBCUs that ESPN's football feed cannot reach: Coppin State and Maryland Eastern Shore, the two MEAC members with no football team, and all 14 HBCUs of the Division II SIAC. ESPN carries no brand colors for Division II, so palettes come from the official colors in `scripts/hbcu_roster.py` snapped onto the artwork's own fills. It writes `hbcu-manifest.json`. Between them the HBCU chip is the complete SWAC, MEAC and SIAC membership — 37 schools. (Spring Hill College is a SIAC member but not an HBCU, so it is deliberately absent.)

`download_cobb_svgs.py` fetches the HIGH SCHOOL league: the 17 Cobb County high schools. No feed covers Georgia high schools, so `scripts/cobb_roster.py` pins one hand-verified source URL per school — the school's own athletics site where one is scrapeable, the Cobb County School District site otherwise, and Wikipedia as the fallback (Cobb Horizon fields no teams, so its primary institutional mark stands in). Palettes come from the official colors snapped onto the artwork's own fills, and each asset lands in `public/logos/svg/high-school/` with its source recorded in `hs-manifest.json`.

`build_teams.py` merges the NFL/college manifests into `src/lib/teams.json`, rewriting the whole `COL-*` block (high-school entries are carried through untouched). It records each college logo's `unusedSourceSlots` from the artwork itself, as the other roster builders do; SVGs that wrap an embedded bitmap are left unrecorded. `build_hs_teams.py` does the same for the `HS-*` block from `hs-manifest.json`. Run each after its downloader. To fetch or refresh (stdlib Python 3, idempotent):

```sh
bun run logos:svg                              # or: python3 scripts/download_svgs.py
python3 scripts/download_svgs.py --force       # re-download everything
python3 scripts/download_svgs.py --only nfl    # subset: nfl, conferences, ncaa
bun run logos:hbcu                             # or: python3 scripts/download_hbcu_svgs.py
bun run logos:hs                               # or: python3 scripts/download_cobb_svgs.py
bun run logos:nba                              # fetch official NBA SVGs and refresh the manifest
bun run logos:mlb                              # fetch official MLB SVGs and refresh the manifest
bun run logos:food                             # refresh the pinned fast-food artwork and manifest
bun run logos:brands                           # refresh the pinned brand artwork and manifest
bun run logos:apps                             # refresh the pinned iOS app artwork and manifest
bun run logos:tv                               # refresh the pinned TV channel artwork and manifest
bun run logos:cars                             # refresh the pinned car brand artwork and manifest
bun run teams                                  # regenerate college entries in src/lib/teams.json from both manifests
bun run teams:hs                               # regenerate high-school entries from hs-manifest.json
bun run teams:nba                              # regenerate NBA entries from nba-manifest.json
bun run teams:mlb                              # regenerate MLB entries from mlb-manifest.json
bun run teams:food                             # regenerate fast-food entries from fast-food-manifest.json
bun run teams:brands                           # regenerate brand entries from brands-manifest.json
bun run teams:apps                             # regenerate app entries from apps-manifest.json
bun run teams:tv                               # regenerate TV channel entries from tv-manifest.json
bun run teams:cars                             # regenerate car brand entries from cars-manifest.json
```

The legacy ESPN PNGs (32 NFL teams + 5 conferences) can still be fetched into `public/logos/`:

```sh
bun run logos                                  # or: python3 scripts/download_logos.py
python3 scripts/download_logos.py --force      # re-download everything
```

Trademarks belong to the NFL, NBA, MLB, their teams, the restaurant and other brands, the app makers, the TV networks, the carmakers, the conferences and the schools; assets are used here for a private party game.

## Deploy

Zero-config on Vercel (framework preset: Vite). `vercel.json` adds an SPA rewrite.

```sh
vercel
```

## Structure

```
src/
  App.tsx                  mode router (create / deck / designer / play) + persisted state
  styles.css               tokens, keyframes, all component styles
  lib/teams.ts             dataset, answer matching, filtering, localStorage
  lib/designer.ts          Designer mode: slot roles, palette seeding, SVG sizing/composition (pure)
  lib/exportLogo.ts        Designer exports: recolored SVG files, canvas-rendered PNGs, downloads
  lib/teams.json           32 NFL + 30 NBA + 30 MLB + 30 food + 29 brand + 30 app + 30 TV + 30 car + 126 college + 17 high-school entries
  lib/useOrientation.ts    portrait = innerHeight > innerWidth
  components/
    Logo.tsx               local PNG rendering + canvas palette-swap recoloring
    Header.tsx             wordmark, Create / Deck (/ Designer) tabs, PLAY
    TeamBrowser.tsx        league toggle, search, conference chips, tile grid
    RemixCanvas.tsx        hero remix logo, Shuffle Logo, Shuffle Colors, + ADD ROUND
    CreateMode.tsx         landscape 3-column / portrait stepped composition
    DesignerMode.tsx       opt-in logo designer: per-slot colors, SVG / PNG export
    DeckMode.tsx           round cards, game setup rail, high score
    PlayMode.tsx           intro → question (type / host) → reveal → results
    DeckMode.tsx           deck cards (per-round guess mode) + settings rail
    SettingsModal.tsx      timer, defaults, voice announcer, appearance, Advanced → Designer mode
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
  download_extra_logos.py  fetch official MLB SVG marks
  extra_rosters.py         pinned MLB IDs, conferences and aliases
  build_extra_teams.py     validate and rebuild only MLB entries
  brand_rosters.py         fast-food, brand, app, TV and car rosters, categories, colors and aliases
  brand_artwork_sources.json  pinned name-free artwork: sources, checksums, reviewed edits
  brand_vector.py          replay reviewed SVG edits (strip wordmark, fill, crop); review helpers
  download_brand_logos.py  refresh fast-food, brand, app, TV or car artwork and its manifest
  build_brand_teams.py     validate and rebuild only fast-food, brand, app, TV or car entries
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
  svg/fast-food/           30 checked-in chain SVGs (+ alternates/)
  svg/brands/              30 checked-in brand SVGs (+ alternates/)
  svg/apps/                30 checked-in iOS app SVGs (+ alternates/)
```

The design prototype and spec live in `design_handoff_logo_remix/` (reference only).
