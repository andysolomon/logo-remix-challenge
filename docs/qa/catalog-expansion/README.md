# Catalog expansion verification

- Build: `npm run build` passes (Vite reports its standard >500 KB bundle warning; output is 125.88 KB gzipped).
- Full suite: 180 passed, 1 skipped, 0 failed. The existing optional Potrace test is skipped because that Python dependency is absent. The expanded exhaustive palette tests use a 90-second timeout instead of 30 seconds; their assertions and catalog-wide coverage are unchanged.
- After final copy, illustration and NHL wordmark metadata adjustments: education, accessibility and imported-brand tests pass, 23/23.
- Playwright Chromium, 1024×1366: browsed element tiles, selected Oxygen, and remixed it with Buffalo Bills colors; verified SVG rendering.
- Playwright Chromium, 390×844 with touch: verified all 50 state tiles, all 22 math tiles, one category row, no page-wide horizontal overflow, and adding/persisting a square-root remix.
- Reloaded a controlled one-round original square-root deck in dark mode, entered `√`, and verified the Correct reveal. No browser exceptions occurred.
- Visually reviewed contact sheets for all 50 state flags, all 32 NHL logos and all non-element educational images. State and NHL source checksums are pinned; educational assets reproduce offline byte-for-byte.

Screenshots:

- [Element picker on iPad](elements-ipad.png)
- [Oxygen remix on iPad](oxygen-remix-ipad.png)
- [Math picker on phone](math-phone.png)
- [Unicode answer graded correctly on phone](math-correct-phone.png)

The browser checks emulate viewport and touch behavior; they are not tests on physical iOS Safari.
