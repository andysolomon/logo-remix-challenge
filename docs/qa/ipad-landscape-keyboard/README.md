# iPad landscape: the logo while typing

On an iPad in landscape, the on-screen keyboard leaves a strip about 300–520 px tall and over 1000 px wide. The keyboard-up layout (`html.kb-open`) stacked the round, logo, prompt, suggestions and answer field in one column, so the logo got whatever height was left (112–182 px on an iPad mini or iPad Air) while most of the width sat empty. In a "both" round on an iPad mini the COLORS field was pushed below the strip.

## What changed

- `src/styles.css`: `.play` is a size container (`container: play / size`). When it is at least twice as wide as tall with the keyboard up, the logo takes the left column at the strip's full height and the jersey line, prompt, hints, suggestions and answer form stack in the right column. The timer column is the gutter between them. The logo cap goes from 430 to 520 px.
- The container query follows the visible strip (`.app` is sized from `--vvh`), so it works whether or not the browser also shrinks the layout viewport.
- Portrait with the keyboard up, and every layout without the keyboard, are unchanged (same measurements before and after).
- `tests/gameplay.test.ts` checks the new rules.

## Measurements

Playwright Chromium, touch emulation, against `vite preview`. The game starts, the guess field is focused, then the viewport is shrunk to the height left above the keyboard (Safari toolbar and keyboard subtracted). Logo edge in CSS px:

| Device (landscape, visible strip) | Logo, before | Logo, after | "Both" round overflow, before → after |
|---|---|---|---|
| iPad mini 1133 × 300 | 132 (team) / 112 (both) | 232 | 26 px → 0 |
| iPad 10.2" 1080 × 340 | 172 / 126 | 272 | 0 → 0 |
| iPad Air 11" 1180 × 350 | 182 / 136 | 282 | 0 → 0 |
| iPad Pro 13" 1376 × 520 | 352 / 306 | 452 | 0 → 0 |
| Hardware keyboard bar 1180 × 690 | 430 | 430 (stays stacked) | 0 → 0 |
| Phone landscape 844 × 150 | 112 (both) | 136 | 176 px → 54 px |

Screenshots:

- [Before: "both" round, iPad mini](before-both-ipad-mini.png)
- [After: "both" round, iPad mini](after-both-ipad-mini.png)
- [After: logo round with suggestions, iPad Air](after-team-ipad-air.png)
- [After: jersey round, iPad mini](after-jersey-ipad-mini.png)
- [After: logo round, iPad Pro 13"](after-team-ipad-pro-13.png)

## Validation

- `npm run build`: passes.
- `bun test tests/gameplay.test.ts`: passes. On the full suite, `tests/highschool.test.ts` passes with `--timeout 120000`. `tests/team-alternates.test.ts` › "roster rebuilds reproduce the alternates" hits its 30 s timeout here on unmodified `main` too.

These are emulated viewports, not tests on a physical iPad. Real Safari keyboard heights vary with the predictive bar, Stage Manager and the floating keyboard. The floating keyboard does not shrink the viewport, so the full-size layout stays up.
