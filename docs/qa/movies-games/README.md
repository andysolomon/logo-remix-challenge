# Movies and video games

Adds two logo-only collections for players aged 10 to 16: **MOVIES** (44 movies: Animated, Adventure & Fantasy, Sci-Fi & Action, Halloween) and **VIDEO GAMES** (47 games: Nintendo, Adventure, Battle & Shooters, Arcade & Puzzle, Sports & Racing, Indie). The catalog grows to **1418 entries and 742 alternates**.

## What changed

- `scripts/brand_rosters.py`: new `MOVIE` and `GAME` rosters, registered as `MOVIES` / `VIDEO GAMES` with the `movies` and `games` asset slugs. CHARACTERS' 11 movie franchises, Scooby-Doo and its 30 video games (Umbrella Corporation included) moved over with their abbreviations; the TV shows left in CHARACTERS keep a `TV` category, so CHARACTERS holds 73 entries.
- Moved artwork kept its pinned source, checksum and reviewed edits; only the `teamId` and asset folder changed. 32 new movies and 17 new games were pinned in `scripts/brand_artwork_sources.json` from Logopedia, Wikimedia Commons, Iconify, worldvectorlogo, iconape and the icons_plus repository (Destiny and Terraria icons, pinned at tag v5.0.0).
- `src/lib/teams.ts`: `MOVIE` and `GAME` join the `League` union, `entryNoun` says "movie" / "game", hints read "MOVIES - Halloween" / "VIDEO GAMES - Nintendo", `Movies` and `Video Games` Random Deck pools follow Characters, and `MOVED_TEAMS` sends every moved `CHAR-*` id to its new home so saved decks keep working.
- `src/lib/teams.json`: both blocks sit after CHAR and before the educational collections, so every roster builder reproduces the file byte-for-byte.
- `package.json`: `logos:movies`, `teams:movies`, `logos:games`, `teams:games`.
- Short forms that already answer another entry stay with it: the abbreviations are `SMASHBROS`, `GRANTURISMO`, `WIZARDOFOZ` and `MISSIONIMP`, and "Smash", "GT", "Oz" and "MI" are not aliases.

## Not included

- No usable SVG was found for Percy Jackson, Wicked, Clash of Clans, Stardew Valley, Cuphead, Rayman, Hogwarts Legacy, Monster House, Corpse Bride, ParaNorman, Halloweentown, The Witches, It's the Great Pumpkin, Charlie Brown or The Lego Movie. Madden's only clean SVG is white-only lettering.
- Hocus Pocus, How to Train Your Dragon, Frankenweenie, Spyro, Frogger and Jumanji have candidate files on Wikimedia Commons, but Commons answered every download with HTTP 429 during this work, so they are not reviewed or pinned.

## Validation

- `npm run build`: passes (Vite's standard >500 KB bundle advisory).
- `bun test`, file by file: every file passes (one optional Potrace test skipped). New `tests/movies-games.test.ts` covers the move, saved-round migration, answers and hints; `tests/brands.test.ts` and `tests/collections.test.ts` cover pins, checksums, palette roles and byte-for-byte rebuilds for both collections.
- Playwright Chromium against `vite preview`, 1024×768: MOVIES › Halloween lists 12 movies, VIDEO GAMES › Nintendo lists 11 games; Goosebumps remixed in Baltimore Ravens colors recolors the splat purple and the G gold. 390×844: MOVIES › Halloween lists 12 movies. No page errors.

Screenshots:

- [MOVIES › Halloween on iPad](movies-halloween-ipad.png)
- [VIDEO GAMES › Nintendo on iPad](games-nintendo-ipad.png)
- [Goosebumps in Ravens colors](goosebumps-in-ravens-ipad.png)
- [MOVIES › Halloween on phone](movies-halloween-phone.png)

The browser checks emulate viewports; they are not tests on physical iOS Safari.
