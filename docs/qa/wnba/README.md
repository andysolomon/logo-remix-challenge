# WNBA collection verification

- Roster: 15 active teams checked against wnba.com's team data and ESPN's 2026 standings on 2026-10-22 (East 7, West 8, including the expansion Portland Fire and Toronto Tempo). Cleveland is inactive until 2028 and left out.
- Artwork: all 15 primaries are the WNBA's own `cdn.wnba.com` SVGs, imported without edits; source and output checksums are pinned in `scripts/brand_artwork_sources.json` and `public/logos/svg/wnba-manifest.json`. A contact sheet of all 15 was reviewed; only the Mystics and Fever marks spell their names, and both are flagged `showsName`.
- Rebuilds are idempotent: `npm run teams:wnba`, `npm run teams:nhl` and `npm run teams:education` leave `teams.json` byte-for-byte unchanged in any order.
- Full suite: 183 passed, 1 skipped (the optional Potrace test), 0 failed. `npm run build` passes with Vite's standard >500 KB bundle advisory.
- Playwright Chromium, 1024×1366 with touch: opened WNBA in the logo picker (15 teams; Western shows 8), picked Portland Fire and remixed it in Los Angeles Lakers colors. The one-color flame sits on a tile with a frame, as designed.
- Playwright Chromium, 390×844 with touch, dark mode: WNBA tab reachable at the end of the collection row, no page-wide horizontal overflow. No page errors; the only failed request is the app's pre-existing missing `favicon.ico`.

Screenshots:

- [WNBA picker on iPad](wnba-picker-ipad.png)
- [Portland Fire in Lakers colors on iPad](fire-in-lakers-ipad.png)
- [WNBA picker on phone, dark mode](wnba-picker-phone-dark.png)

The browser checks emulate viewport and touch behavior; they are not tests on physical iOS Safari.
