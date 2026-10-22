# LANDMARKS collection verification

- Roster: 36 landmarks in four regions (Americas 10, Europe 10, Asia & Pacific 10, Africa & Middle East 6), all original SVG geometry drawn in `scripts/build_landmarks.py` in the science-figure style. No artwork carries lettering.
- Every figure paints all three palette slots, so no landmark sits on a backdrop tile; the catalog-wide backdrop and dark-plate tests cover the new entries. Output checksums are pinned in `public/logos/svg/landmarks-manifest.json`.
- Rebuilds are idempotent: `npm run teams:landmarks` and `npm run teams:education` leave `teams.json` byte-for-byte unchanged in either order (the landmark entries sit between WNBA and ELEMENTS, where both builders expect them).
- A contact sheet of all 36 figures was rendered in headless Chromium and reviewed; Chichén Itzá, the Brandenburg quadriga, the Sphinx and the Capitol dome were redrawn after that review.
- Full suite: 186 passed, 1 skipped (the optional Potrace test), 3 failed. The three failures are the same Python-subprocess timeouts that fail on `main` in this container before the change (30 s and 5 s limits in `team-alternates.test.ts` and `highschool.test.ts`); none of them touches the landmark files. Rerun with `bun test --timeout 180000`, the two high-school tests pass; the alternates test keeps its own 30 s limit and still times out here, exactly as on `main`. `npm run build` passes with Vite's standard >500 KB bundle advisory.
- Playwright Chromium, 1024×1366 with touch: opened LANDMARKS in the logo picker (36 tiles; Asia & Pacific shows 10), picked the Eiffel Tower and remixed it in Los Angeles Lakers colors. The figure recolors fully, with no tile or frame.
- Playwright Chromium, 390×844 with touch, dark mode: LANDMARKS tab reachable at the end of the collection row, no page-wide horizontal overflow, no page errors and no failed requests.

Screenshots:

- [LANDMARKS picker on iPad](landmarks-picker-ipad.png)
- [Eiffel Tower in Lakers colors on iPad](eiffel-in-lakers-ipad.png)
- [LANDMARKS picker on phone, dark mode](landmarks-picker-phone-dark.png)

The browser checks emulate viewport and touch behavior; they are not tests on physical iOS Safari.
