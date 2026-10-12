# Logo Remix Challenge

iPad-first logo guessing game. A creator picks the **logo of one team, brand or app** and the **colors of an NFL, NBA or college team**; players name the logo and/or color sources while the remix misdirects them. For now only those three collections donate colors; every other collection is logo-only, and a saved round whose colors came from anywhere else is dropped when the deck loads.

A remix is optional: pick only a logo and **+ ADD ORIGINAL** puts it in the deck in its own colors (in portrait, step 2 offers **Skip · keep the original colors**). Any collection works this way, soccer clubs and brands included. An original-colors round always asks for the logo, shows only the logo hint, and reveals as "in its original colors". Editing it and picking a color source turns it into a remix; clearing the colors turns a remix back into an original.

Real logos for all 32 NFL teams, all 30 NBA teams, all 30 MLB teams, 29 popular soccer clubs, all 30 MLS clubs, 30 fast-food chains, 29 brands, 30 iOS apps, 30 TV channels, 30 car brands, 30 luxury houses, 30 clothing brands, 120 college teams, 6 college conference marks, and 36 Georgia high schools (the HIGH SCHOOL league, filtered by county) live as local SVG or PNG assets under `public/logos/svg/`. SVG fills are rewritten in-browser; PNGs use a canvas-based pixel recolor.

NBA teams are available as both logo and color donors. Filter them by Eastern or Western conference, or select NBA in Random Deck to create NBA-only or mixed-league rounds. Common answers such as Sixers, Cavs, GSW, NYK and SAS work in search, autocomplete and grading.

MLB teams have American/National League filters and use official MLB SVGs. Fast-food chains are grouped into Burgers, Chicken, Sandwiches, Pizza, Mexican & Asian, and Coffee & Treats. Both collections are logo-only: they work in the logo picker, Random Deck, hints, autocomplete and saved rounds, but never donate colors. Try a Braves logo in Chiefs colors, or the Golden Arches in Lakers colors. Collection buttons form a single horizontally scrollable row on phones and smaller tablets; larger layouts show rows of four.

**SOCCER** holds 29 of the most popular football clubs, filtered by domestic league: Premier League (Arsenal, Man City, Man United, Liverpool, Chelsea, Spurs, Newcastle, Aston Villa), La Liga (Real Madrid, Barcelona, Atlético Madrid, Sevilla), Bundesliga (Bayern, Dortmund, Leverkusen, Leipzig), Serie A (Juventus, AC Milan, Inter, Napoli, Roma), Ligue 1 (PSG, Marseille) and Rest of World (Ajax, Benfica, Porto, Celtic, Galatasaray, Flamengo). Hints name the club's league ("Logo: Serie A"), or SOCCER for Rest of World. Nicknames and short forms such as Man Utd, Spurs, Barca, Juve and PSG are accepted, and guesses ignore accents, so "Atletico" matches Atlético.

**MLS** holds all 30 Major League Soccer clubs, filtered by Eastern and Western Conference, with official MLS crests (NYCFC's 2024 crest comes from Logopedia because MLS serves it only as a bitmap). Inter Miami moved here from SOCCER, and saved rounds that used it follow it. Hints read "Logo: MLS". Short forms such as NYCFC, Red Bulls, RBNY, Galaxy, Sounders, TFC and Revs are accepted. Clubs keep their full names, so a bare city counts only for a club named for the city alone (Austin, Charlotte, Nashville, Toronto…); "New York" and "Los Angeles" answer neither of their two clubs. Like MLB and SOCCER, MLS is logo-only.

**BRANDS** groups 29 brands by brand type — Product, Service, Corporate, Personal, Store (retailers selling their own label) and Place (flags and civic symbols) — five of each, with four in Personal. **APPS** holds 30 iOS app icons: Apple's built-in apps (Maps, Weather, Messages…) plus Social, Games, Music & Video and Everyday apps such as Duolingo. **TV** holds 30 channels grouped into Broadcast, Cable, Music & Pop (MTV, VH1, BET…), Kids and Discovery & Lifestyle. **CARS** holds 30 carmakers grouped into American, Japanese & Korean, German, Italian and British. **LUXURY** holds 30 houses grouped into Fashion House (Gucci, Chanel, Dior, Versace, Prada, Fendi, Yves Saint Laurent, Givenchy, Burberry, Dolce & Gabbana), Leather Goods (Louis Vuitton, Hermès, Coach, Michael Kors, Tory Burch, Kate Spade), Watchmaker (Rolex, Richard Mille, Patek Philippe, Audemars Piguet, Omega, Breitling, TAG Heuer, Hublot) and Jeweler (Cartier, Tiffany & Co., Bulgari, Van Cleef & Arpels, Swarovski, Pandora). **CLOTHING** holds 30 brands grouped into Sportswear (Adidas, Puma, Under Armour, Reebok, New Balance, Champion, Fila), Streetwear (Supreme, BAPE, Off-White, Stüssy, Converse, Vans), Outdoor (The North Face, Patagonia, Columbia, Timberland, Carhartt, Arc'teryx), Preppy (Polo Ralph Lauren, Lacoste, Tommy Hilfiger, Abercrombie & Fitch, Hollister, Vineyard Vines) and Everyday (Levi's, Calvin Klein, Wrangler, Fruit of the Loom, Gap). Nike, Jordan, American Eagle and Lululemon stay in BRANDS rather than appearing twice. Hints name the type ("Logo: Place brand", "Colors: Games app", "Logo: German car", "Colors: Kids channel", "Logo: Luxury watchmaker", "Logo: Outdoor brand"). Like the other brand collections, LUXURY and CLOTHING are logo-only..

Brand logos must not give the answer away. Every fast-food, brand, app, channel, car, luxury and clothing mark is a name-free symbol, monogram, mascot, badge or icon: wordmarks are stripped from official artwork or replaced by the brand's symbol-only file. Some brands publish nothing but a wordmark — six chains (Bojangles, Culver's, Dunkin', Five Guys, Papa Johns and Raising Cane's), eleven channels (ABC, FOX, HBO, ESPN, CNN, TNT, VH1, CMT, E!, HGTV and The Weather Channel), two carmakers (Ford and Fiat), eight luxury houses (Dior, Prada, Michael Kors, Richard Mille, TAG Heuer, Tiffany & Co., Bulgari and Van Cleef & Arpels) and three clothing brands (Supreme, Vans and Gap); they keep it; Random Deck never shows them as logos, and since brands donate no colors they sit random decks out. Hardee's and Carl's Jr. share the same Happy Star, so either name is accepted for both.

Every NFL team has alternate artwork. Pick an NFL original, then use **Shuffle Logo** in the remix preview to cycle its primary, alternate and available throwback marks. **Shuffle Colors** changes the color assignment independently. The preview shows the artwork label and position; the chosen logo is retained when saving, editing, playing and revealing a round. Team names, accepted answers and donor colors stay the same. Most fast-food chains, brands, apps, channels and carmakers also have alternates, such as Burger King's 1999 bun, the 1977 rainbow Apple, the Texas flag map, older app icons, MTV's 1981 block M, Nickelodeon's 1985 splat, BMW's 1917 roundel, Ferrari's rearing horse or the Adidas trefoil. 18 NBA teams carry a throwback or secondary mark (the 1995 Raptors dinosaur, the Vancouver Grizzlies, the Fiesta Spurs, the teal Pistons horse, Hugo the Hornet…). 26 MLB teams carry 43 more marks: MLB's full primary logos wherever they differ from the cap insignia used as the primary (the hanging Red Sox socks, the top-hat Yankees, the birds on the bat, Cleveland's winged G…) and throwbacks such as the 1965 Astrodome, the 1961 Twins handshake, the 1994 Brewers barley diamond, the 1977 Blue Jays, the Devil Rays manta and the Montreal Expos for the Nationals. 17 MLS clubs carry 21 earlier crests (the 1998 Fire badge, the Crew's 1996 hard hats, both MetroStars marks, the Revolution flag, the KC Wiz, the Montreal Impact, the Dallas Burn…). 19 college teams carry a mascot mark (Georgia's bulldog head, Big Al, Bucky Badger, the Oregon Duck, Sebastian the Ibis, Buzz…), and 10 Cobb County high schools a secondary mark (Allatoona's sword A, Kennesaw Mountain's mustang head and interlocking KM, Lassiter's gold helmet, Osborne's cardinal, Walton's diamond W, block letters for Pope and Sprayberry, South Cobb's SC monogram and eagle head…). Other collections use their primary marks. Random Deck uses primary logos until you edit a round and choose an alternate.

Every remix shows all three of the color team's colors. Artwork that paints all three palette slots needs nothing more. A logo that paints only two sits on a rounded backdrop tile in the color it leaves out. One-color logos, such as the Yankees' NY, the Golden Arches, the Apple or the Jumpman, would otherwise remix into a single solid color — often a lone black silhouette that says nothing about the color team — so they sit on a backdrop tile in a second color with a frame around the tile in the third. **Shuffle Colors** cycles which color fills the logo, the tile and the frame; every assignment keeps the logo readable on its tile, the tile distinct from its frame, and whichever of the two meets the canvas readable on it, so the outermost color is never white. When no assignment manages all of that, only the outermost color is darkened and the logo keeps the exact team colors. Logos in their own colors (team browser, reveal) never get a tile. A logo's `unusedSourceSlots` lists the palette slots its artwork never paints: one unused slot means a tile, two mean a tile and a frame.

Each round asks for the **logo's team**, the **team whose colors it wears**, or **both** — set per round on its deck card, with a deck-wide default for rounds left alone. Single-answer rounds are worth a point. A Both round is worth half a point per source named, so getting one of the two shows **HALF RIGHT** and scores ½; scores and high scores show halves as "7½". If time runs out on a Both round, a half that was already locked in still counts: the logo answer once Enter has graded it, or a half the host has marked correct. An optional voice announcer plays Chatterbox clips (`public/voice/`) for the round prompt, the verdict, and the final score.

**Designer mode** is tucked away under Settings → Advanced. Switch it on and a **Designer** tab joins Create and Deck: pick any logo (and any of its alternates), start from an NFL, NBA or college team's palette or type exact hex codes for each of the artwork's color slots, and download the result as an **SVG** (vector, any size) or a square **PNG** at 512, 1024 or 2048 px with a transparent, white, black or custom background. Tiled logos keep their backdrop tile (and one-color logos their frame) in the export, bitmap artwork exports as PNG only, and the tab disappears again when the mode is switched off.

**Upload Logo** in Designer mode traces any image you bring (JPG, PNG, WebP, GIF or SVG; drop it on the canvas or pick a file) into flat-color vector outlines, right in the browser; nothing is sent anywhere. The tracer (`src/lib/trace.ts`) finds the artwork's flat fills as peaks in a color histogram, so JPEG noise and anti-aliased edges don't become extra colors, removes the background around the logo while keeping white details enclosed by it, and smooths each color's outline with potrace's corner rule. **Auto** keeps up to three colors (the Designer's three slots) and drops thin anti-aliasing halos; 1, 2 or 3 forces a count, and **Remove background** can be switched off. The traced logo then recolors slot by slot, picks up a backdrop tile and frame when it has fewer than three colors, and downloads as SVG or PNG like any other logo.

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

NBA, MLB, MLS, college and high-school alternates come from `download_team_alternates.py --league NBA|MLB|MLS|COL|HS`. `team_alternate_sources.json` pins each one exactly like the brand artwork below — source URL, source SHA-256 and reviewed `brand_vector.py` edits (here mostly a removed page background, a removed ® and a crop) — and only real vector outlines are accepted, so a throwback recolors like the primary. It writes `<league>/alternates/` plus `<league>-alternates-manifest.json` (`nba`, `mlb`, `mls`, `ncaa` or `high-school`); `build_nba_teams.py`, `build_extra_teams.py --league MLB|MLS`, `build_teams.py` and `build_hs_teams.py` attach the alternates to their teams and stop rather than drop artwork when a manifest names an unknown team or disagrees with its files. Team names, answers and donor palettes never change. The MLB primary marks are MLB's own files from mlbstatic; most NBA, MLS and college marks are community vector redraws (Logopedia, worldvectorlogo, brandeps, iconape) rather than league-published files; the high-school marks are the vector opponent logos the athletics sites of Allatoona and Woodland keep in their WordPress media libraries. One mark is traced: Kennesaw Mountain's KM monogram is published only as JPG and PNG, so its pinned source is the designer's 2560-pixel export and a reviewed `trace` edit (`trace_vector.py`, fill color, threshold and speckle size, recorded in the manifest) turns it into outlines with the pure-Python `potracer` package. Refreshing that one mark needs `pip install potracer`; the checked-in SVG is reused otherwise.

`download_extra_logos.py --league MLB` validates the current roster against MLB's official Stats API and downloads MLB's team SVGs into `mlb-manifest.json`; `build_extra_teams.py --league MLB` validates and replaces only MLB entries. `--league SOCCER` does the same for the clubs pinned in `extra_rosters.py`: crests come from football-data.org's crest CDN, with Wikipedia files for Roma, PSG and Benfica and ESPN's PNG for Napoli, and white or invisible traced page backgrounds are stripped so a remix never paints a solid square (shapes inside clip paths and masks are geometry, not paint, and stay). `--league MLS` checks the 30 clubs pinned in `extra_rosters.py` against ESPN's MLS feed and downloads MLS's official crest SVGs into `mls-manifest.json`. An optional `--cache-dir /tmp/logo-remix-assets` resumes interrupted downloads.

Fast food, brands, apps, TV channels, cars, luxury houses and clothing brands share one pipeline. `brand_rosters.py` holds their names, categories, donor colors and aliases (fast-food colors keep the values snapped from the chains' original logos). `brand_artwork_sources.json` pins every primary and alternate: the source URL (Wikimedia, official sites, Logowik, Logopedia, 1000 Logos, Iconify, vectorlogo.zone, logotyp.us, brandeps and similar), the source file's SHA-256, and the reviewed `brand_vector.py` edits — element removals that strip a wordmark, ™ or page background, kept elements that cut one icon out of a sheet, a fill for one-color icons, and a crop. `download_brand_logos.py --league FOOD|BRAND|APP|TV|CAR|LUX|CLOTH` replays those edits, rejects bitmaps, live text, scripts and external references, converts percentage `rgb()` colors so they can be recolored, and maps the artwork's fills and gradient stops onto the palette roles (a role sits between the two ends of a gradient when both stay within matching range, so gradient app tiles recolor as a whole). It writes `fast-food-manifest.json`, `brands-manifest.json`, `apps-manifest.json`, `tv-manifest.json`, `cars-manifest.json`, `luxury-manifest.json` or `clothing-manifest.json`. Verified checked-in assets are reused offline; a changed source fails its checksum, and nothing is replaced until the whole collection validates. `--cache-dir` keeps verified source files for rate-limited refreshes. `build_brand_teams.py --league FOOD|BRAND|APP|TV|CAR|LUX|CLOTH` validates the manifest against the roster and rewrites only that collection in place. Every roster builder preserves the other collections. The application itself has no new runtime dependencies.

`download_svgs.py` takes its rosters and brand colors from ESPN — 32 NFL teams, 6 conference logos (ACC, Big 12, Big Ten, Pac-12, SEC, Ivy), and every football member of those conferences for the configured season, plus the 21 Division I football HBCUs (SWAC, the MEAC schools that field football, and Hampton, North Carolina A&T and Tennessee State). It writes `manifest.json`.

`download_hbcu_svgs.py` covers the HBCUs that ESPN's football feed cannot reach: Coppin State and Maryland Eastern Shore, the two MEAC members with no football team, and all 14 HBCUs of the Division II SIAC. ESPN carries no brand colors for Division II, so palettes come from the official colors in `scripts/hbcu_roster.py` snapped onto the artwork's own fills. It writes `hbcu-manifest.json`. Between them the HBCU chip is the complete SWAC, MEAC and SIAC membership — 37 schools. (Spring Hill College is a SIAC member but not an HBCU, so it is deliberately absent.)

`download_cobb_svgs.py` fetches the HIGH SCHOOL league: the 16 Cobb County high schools that field athletics teams, plus Marietta (Marietta City Schools, also in Cobb), prominent metro programs (North Paulding in Paulding County; Blessed Trinity, Creekside, Langston Hughes, Milton, North Atlanta and Westlake in Fulton; Druid Hills, Southwest DeKalb and Stephenson in DeKalb; Buford, Grayson and Parkview in Gwinnett) and the state's top contenders elsewhere (Carrollton, Gainesville, Lee County, Valdosta, Newton and Thomas County Central, each under its county). Each county is a filter chip, a random-deck pool and the round hint ("Logo: Gwinnett County"); for Lee County High that hint names the school. Nine of these marks are published only as bitmaps, so `cobb_roster.TRACED` pins each file's SHA-256 and the downloader traces it into flat-color SVG outlines with Designer mode's tracer (`scripts/trace_logo.ts`, run by bun after Pillow decodes and scales the image); re-tracing needs Pillow and bun, while the checked-in SVGs need neither. No feed covers Georgia high schools, so `scripts/cobb_roster.py` pins one hand-verified source URL per school — the school's own athletics site where one is scrapeable, the Cobb County School District site otherwise, Wikipedia as the fallback, and a community mirror when none of those carries the mark (or carries only a bitmap of it). Campbell, Harrison and North Cobb use the vector originals from Allatoona's media library. Palettes come from the official colors snapped onto the artwork's own fills, and each asset lands in `public/logos/svg/high-school/` with its source recorded in `hs-manifest.json`.

`build_teams.py` merges the NFL/college manifests into `src/lib/teams.json`, rewriting the whole `COL-*` block (high-school entries are carried through untouched). It records each college and NFL primary logo's `unusedSourceSlots` from the artwork itself, as the other roster builders do, reading the pixels of an SVG that wraps an embedded bitmap (Pillow required) so those logos get their tile too. `build_hs_teams.py` does the same for the `HS-*` block from `hs-manifest.json`. Run each after its downloader. To fetch or refresh (stdlib Python 3, idempotent):

```sh
bun run logos:svg                              # or: python3 scripts/download_svgs.py
python3 scripts/download_svgs.py --force       # re-download everything
python3 scripts/download_svgs.py --only nfl    # subset: nfl, conferences, ncaa
bun run logos:hbcu                             # or: python3 scripts/download_hbcu_svgs.py
bun run logos:hs                               # or: python3 scripts/download_cobb_svgs.py
bun run logos:nba                              # fetch official NBA SVGs and refresh the manifest
bun run logos:mlb                              # fetch official MLB SVGs and refresh the manifest
bun run logos:soccer                           # fetch soccer club crests and refresh the manifest
bun run logos:mls                              # fetch MLS club crests and refresh the manifest
bun run logos:food                             # refresh the pinned fast-food artwork and manifest
bun run logos:brands                           # refresh the pinned brand artwork and manifest
bun run logos:apps                             # refresh the pinned iOS app artwork and manifest
bun run logos:tv                               # refresh the pinned TV channel artwork and manifest
bun run logos:cars                             # refresh the pinned car brand artwork and manifest
bun run logos:luxury                           # refresh the pinned luxury artwork and manifest
bun run logos:clothing                         # refresh the pinned clothing artwork and manifest
bun run logos:nba-alternates                   # refresh the pinned NBA alternates (then bun run teams:nba)
bun run logos:mlb-alternates                   # refresh the pinned MLB alternates (then bun run teams:mlb)
bun run logos:mls-alternates                   # refresh the pinned MLS alternates (then bun run teams:mls)
bun run logos:college-alternates               # refresh the pinned college alternates (then bun run teams)
bun run logos:hs-alternates                    # refresh the pinned high-school alternates (then bun run teams:hs)
bun run teams                                  # regenerate college entries in src/lib/teams.json from both manifests
bun run teams:hs                               # regenerate high-school entries from hs-manifest.json
bun run teams:nba                              # regenerate NBA entries from nba-manifest.json
bun run teams:mlb                              # regenerate MLB entries from mlb-manifest.json
bun run teams:soccer                           # regenerate soccer entries from soccer-manifest.json
bun run teams:mls                              # regenerate MLS entries from mls-manifest.json
bun run teams:food                             # regenerate fast-food entries from fast-food-manifest.json
bun run teams:brands                           # regenerate brand entries from brands-manifest.json
bun run teams:apps                             # regenerate app entries from apps-manifest.json
bun run teams:tv                               # regenerate TV channel entries from tv-manifest.json
bun run teams:cars                             # regenerate car brand entries from cars-manifest.json
bun run teams:luxury                           # regenerate luxury entries from luxury-manifest.json
bun run teams:clothing                         # regenerate clothing entries from clothing-manifest.json
```

The legacy ESPN PNGs (32 NFL teams + 5 conferences) can still be fetched into `public/logos/`:

```sh
bun run logos                                  # or: python3 scripts/download_logos.py
python3 scripts/download_logos.py --force      # re-download everything
```

Trademarks belong to the NFL, NBA, MLB, MLS, the soccer clubs, their teams, the restaurant and other brands, the app makers, the TV networks, the carmakers, the fashion, watch and jewelry houses, the clothing brands, the conferences and the schools; assets are used here for a private party game.

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
  lib/trace.ts             Designer uploads: trace a bitmap logo into flat-color SVG outlines (pure)
  lib/traceUpload.ts       Designer uploads: decode the file in the browser, trace it, wrap it as a logo
  lib/teams.json           32 NFL + 30 NBA + 30 MLB + 29 soccer + 30 MLS + 30 food + 29 brand + 30 app + 30 TV + 30 car + 30 luxury + 30 clothing + 126 college + 36 high-school entries
  lib/useOrientation.ts    portrait = innerHeight > innerWidth
  components/
    Logo.tsx               local PNG rendering + canvas palette-swap recoloring
    Header.tsx             wordmark, Create / Deck (/ Designer) tabs, PLAY
    TeamBrowser.tsx        league toggle, search, conference chips, tile grid
    RemixCanvas.tsx        hero remix logo, Shuffle Logo, Shuffle Colors, + ADD ROUND / + ADD ORIGINAL
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
  download_cobb_svgs.py    fetch (or trace) the HIGH SCHOOL league's logos, county by county
  trace_logo.ts            trace bitmap-only high-school marks with Designer mode's tracer
  download_nba_svgs.py     fetch the 30 official NBA SVGs and snapshot ESPN metadata
  nba_roster.py            pinned NBA IDs, conferences and answer aliases
  build_nba_teams.py       validate and rebuild only NBA entries
  download_extra_logos.py  fetch official MLB SVG marks, soccer club crests and MLS club crests
  extra_rosters.py         pinned MLB IDs, soccer and MLS clubs, groupings, colors and aliases
  build_extra_teams.py     validate and rebuild only MLB, soccer or MLS entries (with MLB/MLS alternates)
  brand_rosters.py         fast-food, brand, app, TV, car, luxury and clothing rosters, categories, colors and aliases
  brand_artwork_sources.json  pinned name-free artwork: sources, checksums, reviewed edits
  brand_vector.py          replay reviewed SVG edits (strip wordmark, fill, crop); review helpers
  download_brand_logos.py  refresh fast-food, brand, app, TV or car artwork and its manifest
  build_brand_teams.py     validate and rebuild only one brand collection's entries
  download_team_alternates.py  refresh the pinned NBA, MLB, MLS, college or high-school alternates and their manifest
  trace_vector.py          trace the one requested bitmap-only alternate (KM monogram) into SVG outlines
  team_alternate_sources.json  pinned NBA, MLB, MLS, college and high-school alternates: sources, checksums, reviewed edits
  cobb_roster.py           HIGH SCHOOL roster by county, official colors, and per-school source URLs
  build_teams.py           merge the NFL/college manifests into src/lib/teams.json
  build_hs_teams.py        merge hs-manifest.json into src/lib/teams.json
  generate_voice.py        bake Chatterbox announcer clips into public/voice/
public/logos/
  nfl/                     32 team PNGs (ESPN CDN naming, e.g. wsh.png)
  conferences/             acc, big-12, big-ten, pac-12, sec PNGs
  svg/high-school/         36 checked-in high-school SVG/PNG marks
  svg/nba/                 30 checked-in official NBA SVG marks
  svg/mlb/                 30 checked-in official MLB SVG marks
  svg/soccer/              29 checked-in club crests (28 SVG, Napoli PNG)
  svg/mls/                 30 checked-in MLS club crests (+ alternates/)
  svg/fast-food/           30 checked-in chain SVGs (+ alternates/)
  svg/brands/              30 checked-in brand SVGs (+ alternates/)
  svg/apps/                30 checked-in iOS app SVGs (+ alternates/)
  svg/luxury/              30 checked-in luxury house SVGs
  svg/clothing/            30 checked-in clothing brand SVGs (+ alternates/)
  svg/nba/alternates/      18 checked-in NBA throwback SVGs
  svg/ncaa/alternates/     19 checked-in college mascot SVGs
  svg/mlb/alternates/      43 checked-in MLB primary and throwback SVGs
  svg/mls/alternates/      21 checked-in earlier MLS crest SVGs
  svg/high-school/alternates/  checked-in Cobb high-school secondary-mark SVGs
```

The design prototype and spec live in `design_handoff_logo_remix/` (reference only).
