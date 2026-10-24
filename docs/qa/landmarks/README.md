# LANDMARKS collection verification

- Roster: 40 landmarks in four regions (Americas 8, Europe 14, Asia & Pacific 15, Africa & Middle East 3). Every mark is real artwork of the structure from Openclipart (CC0), chosen from contact sheets of search candidates and reviewed at full size; schematic drawings were not accepted. 26 landmarks searched for had no faithful vector on Openclipart and were left out (among them the Empire State Building, Chichén Itzá, CN Tower, Machu Picchu, Sagrada Família, London Eye, Petra and Table Mountain).
- Pipeline: the same pinned-source pipeline as the brand collections (`scripts/brand_rosters.py`, `scripts/brand_artwork_sources.json`, `download_brand_logos.py --league LANDMARK`, `build_brand_teams.py --league LANDMARK`). Four sources carry reviewed edits (two sky backgrounds, one caption, one border crop); the rest import unchanged. All 40 pass the vector validator and the 400 KB limit.
- Remix behaviour: 22 one-color silhouettes sit on a tile with a frame, as the flag silhouettes do; the multi-color illustrations recolor slot by slot. The catalog-wide backdrop and dark-plate tests cover the entries.
- Rebuilds are idempotent: `npm run logos:landmarks` reuses the verified checked-in files offline and leaves the manifest unchanged, and `npm run teams:landmarks` and `npm run teams:education` leave `teams.json` byte-for-byte unchanged in either order.
- Full suite: 186 passed, 1 skipped (the optional Potrace test), 3 failed. The three failures are the same Python-subprocess timeouts that fail on `main` in this container before the change (30 s and 5 s limits in `team-alternates.test.ts` and `highschool.test.ts`); none of them touches the landmark files. `npm run build` passes with Vite's standard >500 KB bundle advisory.
- Playwright Chromium, 1024×1366 with touch: opened LANDMARKS in the logo picker (40 tiles; Asia & Pacific shows 15), picked the Eiffel Tower and remixed it in Los Angeles Lakers colors.
- Playwright Chromium, 390×844 with touch, dark mode: LANDMARKS tab reachable at the end of the collection row, no page-wide horizontal overflow, no page errors and no failed requests.

Screenshots:

- [LANDMARKS picker on iPad](landmarks-picker-ipad.png)
- [Eiffel Tower in Lakers colors on iPad](eiffel-in-lakers-ipad.png)
- [LANDMARKS picker on phone, dark mode](landmarks-picker-phone-dark.png)

The browser checks emulate viewport and touch behavior; they are not tests on physical iOS Safari.
