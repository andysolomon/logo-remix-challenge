# Logo Remix Challenge — Design System

High-fidelity spec. Every value below is final; implement verbatim as CSS custom properties.

## 1. Typography

| Role | Font | Usage |
|---|---|---|
| Display / Game | `'Chakra Petch', sans-serif` 700 (600 available) | Wordmark, section names, timers, scores, prompts, reveals, big buttons. Usually UPPERCASE with letter-spacing 1–5px |
| UI | `'Space Grotesk', system-ui, sans-serif` 400/500/600/700 | Everything else: labels, tiles, inputs, chips, body |

Type scale (px): micro-label 11 (ls 3, uppercase, 600) · chip/tile 12–14 (600) · body 15–16 (500) · input 20 · panel heading 13 (ls 2) · canvas team name 22–24 · setup count 34 · play meta 18 (ls 2) · prompt 26 (ls 4) · timer 54 · reveal title 44 (ls 5) · reveal name 38 · intro title 62 (ls 5) · final score 90.

## 2. Color tokens

### Light (Create / Deck)
```css
--bg:        #F7F5F1;  /* app background, warm white */
--surface:   #FFFFFF;  /* cards, panels, header */
--line:      #E5E1D8;  /* borders, dividers */
--ink:       #17150F;  /* primary text, selected-state fill */
--muted:     #6E6A61;  /* secondary text */
--faint:     #9B958A;  /* placeholders, micro-labels */
--chip-bg:   #F0EDE6;  /* segmented/chips resting */
--chip-fg:   #57534A;
--input-bg:  #FBFAF7;
--disabled:  #D8D3C8;  /* disabled button fill, dashed strokes */
--tile-sel:  #FBF3E4;  /* selected tile background tint */
```

### Accent & status
```css
--accent:       #D8442B;  /* primary actions; hover = brightness(0.92–0.94) */
--link:         #B9331D;  /* a; hover #8F2716 */
--success:      #3BA55C;  /* light surfaces (ADDED ✓) */
--success-dark: #4CBF6B;  /* on dark (correct) */
--danger-dark:  #FF6B4A;  /* on dark (wrong, urgent timer) */
--gold:         #F2B72E;  /* timeout, NEW HIGH SCORE */
```

### Dark (Play)
```css
--dark-bg:      #12100D;
--dark-surface: #1C1915;  /* recap rows */
--dark-input:   #221E18;  /* border #3A352C */
--dark-ink:     #F5F2EC;
--dark-muted:   #B7B0A3;  /* round/score header */
--dark-faint:   #8F887B;  /* tertiary */
```

Team colors come only from `teams.json` palettes — the app chrome never uses them.

## 3. Spacing, radii, borders, shadows

- Spacing scale: 4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 / 24.
- Radii: chips & swatches = pill; buttons/inputs 8–14; tiles 14; cards/panels 16; START GAME 16.
- Borders: panels/cards `1px --line`; inputs `1.5px --line`; tiles `2.5px` (`--line` → `--ink` selected); outlined buttons `2px --ink` (light) / `2px --dark-ink` (dark).
- Shadows: none on cards (flat, border-separated). Logos carry `filter: drop-shadow(0 2px 6px rgba(0,0,0,0.18))`.

## 4. Touch targets

Chips 38–40px · segmented 38–52px · search 46–48px · icon buttons 44×44 · Shuffle/Add Round 54–56px · guess input & Submit 60px · START GAME / START 64px. Grid gaps ≥10px so children don't mis-tap.

## 5. Logo generator (procedural SVG — the core asset)

Every logo = one SVG, `viewBox="0 0 100 100"`, scales to its container, `drop-shadow(0 2px 6px rgba(0,0,0,0.18))`.

Layers, given palette `[A, B, C]` (after permutation):
1. **Container shape** — fill `A`, stroke `C`, stroke-width 3:
   - shield: `path M50 5 L87 18 V50 C87 72 70 87 50 95 C30 87 13 72 13 50 V18 Z`
   - circle: `cx=50 cy=50 r=44`
   - hex: `polygon 50,4 90,26 90,74 50,96 10,74 10,26`
   - diamond: `polygon 50,5 95,50 50,95 5,50`
   - square: `rect x=9 y=9 w=82 h=82 rx=18`
   - pennant: `polygon 15,7 85,7 85,60 50,93 15,60`
2. **Deco** — fill `C`: stripe `rect x=27 y=66 w=46 h=6 rx=3` · star `polygon 50,14 55,23 50,32 45,23` · dots `3 circles r=3.4 at (38|50|62, 77)` · none
3. **Monogram** — team abbreviation, `text x=50 y=59 text-anchor=middle`, Chakra Petch 700, fill `B`, letter-spacing 1. Font-size: 40 (1 char) / 32 (2) / 24 (3).

**Color permutations** (Shuffle Colors cycles index 0→5):
`[0,1,2] [1,0,2] [2,1,0] [0,2,1] [1,2,0] [2,0,1]` applied to the color team's palette `[primary, secondary, light]`.

A team's own logo = its shape/deco/abbr with its own palette at permutation 0. A **remix** = original team's shape/deco/abbr with the color team's palette at the round's permutation.

## 6. Component inventory

- **TeamLogoTile** — button; logo + name (+ 3 swatch dots in the colors browser); rest / selected (border+tint+check badge) / pressed.
- **TeamBrowser** — panel: heading, LeagueToggle, TeamSearch, conference chips, scrollable tile grid (2-col at 28% width; `minmax(150px,1fr)` full-width portrait).
- **LeagueToggle** — PRO / COLLEGE segmented, dark-fill active.
- **PaletteSwatches** — 12–16px circles, `1px rgba(0,0,0,0.15)` border.
- **RemixCanvas** — labels + names + hero logo + swatches + action row; empty / original-only / full states.
- **AddRoundButton** — accent; disabled / "+ ADD ROUND" / "SAVE ROUND" / "ADDED ✓" (success green, 1s).
- **DeckIndicator** — "Deck · N" header segment.
- **RoundCard** — as specced in README; move buttons dim to 0.35 opacity at list boundaries.
- **TimerSegmented** — 5s/10s/15s/30s.
- **GameModeSegmented** — Type the Team / Host Mode, 52px, dark-fill active, muted hint line below.
- **HostVerdictButtons** — 68px pair: ✓ CORRECT solid `#4CBF6B` on `#12100D` text; ✕ INCORRECT `2.5px #FF6B4A` outline, transparent, radius 16; replaces GuessInput/SubmitGuess when mode = host.
- **Timer** — number + draining 6px bar; urgent color ≤5s.
- **GuessInput / SubmitGuess** — dark 60px pair; Enter submits; no autofill.
- **Reveal** — icon circle + title + true logo + name + note (+1 when correct).
- **ResultsRecap** — dark rows: mark, 40px thumb, name.

## 7. Motion

| Event | Duration / behavior |
|---|---|
| Tile select | instant state; optional 100–150ms scale tick |
| Remix update / shuffle | 300ms `pop` (scale 0.5→1.06→1, fade in) |
| Add round confirm | label swap, 1000ms revert |
| Screen enter (intro, results) | 400ms `rise` (translateY 14px→0, fade) |
| Round logo enter | 280ms `pop` |
| Reveal hold | 1700ms then auto-advance |
| Timer tick | 100ms linear updates |

`@media (prefers-reduced-motion: reduce)` disables all animations/transitions.

## 8. Layout breakpoints

Orientation-driven, not width-driven: portrait = `innerHeight > innerWidth` (listen on resize). Landscape create = 3 columns `28fr 44fr 44fr→28fr` (28/44/28); portrait create = stepped; deck rail 300px landscape / full-width row portrait. Desktop uses the same iPad layout with more breathing room (no new chrome). Phones use the portrait compositions.
