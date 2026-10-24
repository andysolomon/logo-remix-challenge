# Restaurants, brands, alternates and characters expansion

Adds 43 restaurants, 78 brands, 115 fictional characters and franchises (the new **CHARACTERS** collection) and 115 alternate marks on existing restaurant, brand, app, TV, car, luxury and clothing entries. The catalog grows from **982 entries and 489 alternates** to **1218 entries and 645 alternates**.

## What changed

- `scripts/brand_rosters.py`: `FOOD` grows from 50 to 93 chains and `BRAND` from 60 to 138 brands (no existing row changes). A new `CHAR` roster of 115 rows is grouped into Marvel, DC, Disney & Pixar, Star Wars, Movies & TV, Video Games and Cartoons & Anime. The roster module registers the league as `CHARACTERS` with the `characters` asset slug.
- `scripts/brand_artwork_sources.json`: 1050 pinned variants (was 658). Every new variant records its https source, the source file's SHA-256, the reviewed edits (`removeNodes`, `keepNodes`, `viewBox`, `clipToViewBox`, `fill`) and its label. Sources are Logopedia (`static.wikia.nocookie.net`), Wikimedia Commons and Iconify icon sets (Simple Icons, Font Awesome brands, game-icons, emoji sets), the same hosts the existing collections use.
- `src/lib/teams.ts`: `CHAR` joins the `League` union, `entryNoun` says "character", `teamHint` reads "CHARACTERS - Marvel", and a `Characters` pool joins the Random Deck list after WNBA. Characters are logo-only like every other brand collection.
- `src/lib/teams.json`: the `CHAR` block sits between LANDMARK and the educational collections so every roster builder reproduces the file byte-for-byte.
- `package.json`: `logos:characters` and `teams:characters` scripts.
- Waffle House now leads with its WH monogram; the wordmark that used to be its only artwork is kept as a flagged `wordmark` alternate, so the chain joins random logo pools.
- `tests/backdrop.test.ts`: the artwork-coverage measure now counts a gradient `<stop>` without a `stop-color` as the SVG default, black, which is what `brand_colors` already records (the Super Mario Power Star's eyes use such a stop).

## Review process

Candidate SVGs were gathered per name from Wikidata's logo property, Logopedia's file search, Wikimedia Commons search and Iconify search, downloaded, validated (`validate_vector`: no text, images, scripts or external references, under 400 KB) and rendered on contact sheets in Chromium. Each chosen file was exploded node by node to decide which elements to keep or remove, cropped to a measured bounding box with padding, re-rendered, and checked before pinning. Labels were checked against every accepted answer so no alternate label spells its entry's name.

Every mark is a name-free symbol where one exists. Where a franchise or brand publishes only a title or wordmark (Coca-Cola, Visa, IBM, Lego, Iron Man, Toy Story, Naruto, Call of Duty…) it is kept hand-pickable and flagged `showsName`, so Random Deck never draws it as a logo: 142 flagged entries across the brand collections, up from 42.

## Validation

- `npm run build`: passes (Vite's standard >500 KB bundle advisory).
- Full suite file by file with `bun test`: 179 pass, 1 skip (the optional Potrace test), 3 fail. All three failures are timing limits on this container, not data regressions: the two high-school checks decode 36 PNGs in pure Python and take 5.3 s against a 5 s limit, and the team-alternates rebuild check takes 36 s against its 30 s limit; the same Python run directly completes and passes every assertion (`NBA`, `COL`, `MLB`, `MLS`, `HS` rebuilds reproduce `teams.json`, stale manifests are refused). Neither touches the new data.
- `bun test tests/brands.test.ts tests/collections.test.ts tests/color-donors.test.ts tests/backdrop.test.ts tests/education.test.ts`: all pass, including the manifest check that re-derives every checksum, reviewed edit and palette role for all 1050 pinned variants, the offline refresh test, and the backdrop rule for every one of the 1218 entries and their alternates.
- Rebuilds are idempotent: `npm run teams:<collection>` for every brand collection, plus the education, NBA, college, MLB, MLS and high-school builders, leave `teams.json` unchanged.
- Playwright Chromium, 1024×768: opened CHARACTERS (115 characters, DC filter), picked Batman and remixed it in Kansas City Chiefs colors; the yellow-oval bat paints two palette slots and sits on a tile. Shuffle Logo cycled to "1989 film bat · 2 of 4". RESTAURANTS lists 93 and BRANDS 138 entries. No page errors.
- Playwright Chromium, 390×844: CHARACTERS is reachable at the end of the collection row in the stepped portrait layout; 115 entries, no page errors.

Screenshots:

- [Characters picker on iPad](characters-ipad.png)
- [Batman in Chiefs colors](batman-in-chiefs-ipad.png)
- [Batman's 1989 alternate in Chiefs colors](batman-alternate-ipad.png)
- [Restaurants on iPad](restaurants-ipad.png)
- [Brands on iPad](brands-ipad.png)
- [Characters picker on phone](characters-phone.png)

The browser checks emulate viewports; they are not tests on physical iOS Safari.
