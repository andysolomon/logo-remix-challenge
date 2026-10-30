# SWEETS collection

Adds **SWEETS**, a logo-only collection of 52 candy and sweets brands in six categories: Chocolate 15, Gummy & Chewy 7, Hard Candy 6, Gum & Mints 9, Cookies & Cakes 9 and Ice Cream 6. Hershey's, M&M's and Oreo move here from BRANDS (now 135 brands), so no brand appears twice. The catalog grows from 1369 entries and 741 alternates to **1418 entries and 748 alternates**.

## What changed

- `scripts/brand_rosters.py`: a new `SWEET` roster of 52 rows, registered as `SWEETS` with the `sweets` asset slug. The Hershey's, M&M's and Oreo rows move from `BRAND` to `SWEET` and keep their names, aliases and colors.
- `scripts/brand_artwork_sources.json`: 56 new pinned variants, plus the three moved pins re-keyed from `BRAND-*` to `SWEET-*` with their sources and edits untouched (the regenerated `hershey.svg`, `mms.svg` and `oreo.svg` are byte-identical to the old BRANDS files). Sources are Logopedia, worldvectorlogo and Wikimedia Commons, hosts the other collections already use.
- `src/lib/teams.ts`: `SWEET` joins the `League` union. `entryNoun` says "brand", `teamHint` reads "SWEETS - Chocolate", and a `Sweets` pool joins the Random Deck list after Characters. `BRAND-HERSHEY`, `BRAND-MMS` and `BRAND-OREO` are added to `MOVED_TEAMS`, so saved rounds follow the entries to SWEETS.
- `src/lib/teams.json`: the `SWEET` block sits between CHAR and the educational collections, so every roster builder reproduces the file byte for byte.
- `package.json`: `logos:sweets` and `teams:sweets` scripts.
- Tests: new `tests/sweets.test.ts` covering the roster, the move and saved-round migration, answers, symbol vs. wordmark marks, hints and random decks. `brands.test.ts`, `collections.test.ts` and `color-donors.test.ts` now include the new league and the smaller BRANDS counts.

## Artwork review

Candidates came from Logopedia file search, worldvectorlogo and Wikimedia Commons. Each was downloaded, run through `validate_vector` and rendered on contact sheets in Chromium. Composite logos were split node by node. Crops are pixel-measured bounds with 4% padding, the same padding the existing pins use. See the [artwork review sheet](artwork-review.png).

- Seven entries lead with a name-free mark:
  - the Hershey's Kiss (unchanged)
  - Lindt's crest, cut from the wordmark lockup
  - Godiva's rider on horseback, nodes 18–326 of the Chocolatier lockup
  - Toblerone's 2021 golden mountain, with the 1999 yellow mountain as an alternate
  - the Chupa Chups daisy with its lettering removed
  - the Klondike polar bear on its sunburst, with the lettering removed
  - the ice-cream heart that Good Humor shares with Wall's, Algida and Streets

  Each one keeps its full logo as a flagged `wordmark` alternate.
- The other 45 brands publish only a wordmark. They are flagged `showsName`: hand-pickable, but never drawn by Random Deck.
- Reviewed edits:
  - three worldvectorlogo files (Cadbury, Little Debbie, Keebler) had a full-canvas white page background, which is removed
  - Tic Tac's current blue logo carried one embedded raster highlight, which is removed
  - Nutella uses the colored Commons file, not worldvectorlogo's all-black version
- Left out because no clean vector was available: Starburst, Swedish Fish, Airheads, Peeps, Sour Patch Kids (raster-only), Werther's, Dippin' Dots, and Warheads (its face is fused with gradient-filled lettering).

## Validation

- `bun test tests/sweets.test.ts tests/brands.test.ts tests/color-donors.test.ts`: 19 pass, 0 fail. This includes the manifest check, which re-derives every checksum, reviewed edit and palette role for all pinned variants.
- Full suite: see the results below.
- Rebuilds are idempotent: `npm run teams:education`, `npm run teams:sweets` and `npm run teams:brands` leave `teams.json` unchanged in sequence.
- `npm run build`: passes, with Vite's standard >500 KB bundle advisory.
- Playwright Chromium, 1366×1024 with touch:
  - SWEETS lists 52 brands, and each category chip shows its count.
  - Godiva's rider remixed in Los Angeles Lakers colors.
  - The Klondike bear remixed in Kansas City Chiefs colors (the sunburst gradient follows the palette). Shuffle Logo cycles to "Wordmark · 2 of 2".
  - No page errors or failed requests.
- Playwright Chromium, 390×844 with touch, dark mode: SWEETS is reachable at the end of the collection row, the page has no horizontal overflow, and there are no page errors.

Screenshots:

- [SWEETS picker on iPad](sweets-picker-ipad.png)
- [Godiva in Lakers colors](godiva-in-lakers-ipad.png)
- [Klondike in Chiefs colors](klondike-in-chiefs-ipad.png)
- [SWEETS picker on phone, dark mode](sweets-picker-phone-dark.png)

The browser checks emulate the viewport and touch input. They are not tests on physical iOS Safari.
