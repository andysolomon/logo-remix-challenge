# Build Prompt: Logo Remix Challenge — React app on Vercel

You are implementing a production React app from a finished high-fidelity design prototype. The design is FINAL. Your job is pixel-exact recreation, not reinterpretation.

## The ask

Build **Logo Remix Challenge**, an iPad-first sports-logo guessing game, as a React app deployable to Vercel.

- **Stack**: Vite + React 18 + TypeScript. Client-only SPA — no backend, no auth, no database. State persists in `localStorage`. Deploy to Vercel with zero-config (framework preset: Vite).
- **Styling**: CSS custom properties from `DESIGN_SYSTEM.md` + plain CSS (CSS modules fine). Do NOT introduce Tailwind, MUI, or any component library — the design system in this folder is the only source of truth. Every hex, radius, font size, and duration is specified; use them verbatim.
- **Fonts**: Google Fonts — `Chakra Petch` (600, 700) and `Space Grotesk` (400, 500, 600, 700).
- **Reference file**: `Logo Remix Challenge.dc.html` in this folder is the working prototype (an HTML design reference, NOT production code — do not copy it in; recreate it). Open it in a browser to compare. The build must be visually indistinguishable from it.

## Game concept

A creator picks the **logo of one team** and the **colors of another team**; the app renders the logo recolored in the other team's palette. During play, the recolored logo is shown full-screen and players type the **original team** (the colors are the misdirection). All teams are fictional (2 leagues × 16 teams, in `teams.json`). Logos are procedurally generated SVGs — spec in `DESIGN_SYSTEM.md` § Logo generator. There are no image assets.

## App structure — 3 modes, 1 shared root

Top-level state `mode: 'create' | 'deck' | 'play'`. Header chrome (64px bar) shows in create/deck, is **completely hidden** during play.

**Header**: white bar, bottom border `--line`. Left: wordmark "LOGO REMIX" (Chakra Petch 700 20px, "REMIX" in `--accent`). Center: segmented control (Create / "Deck · N") in a `#F0EDE6` pill, active segment `#17150F` bg + white text. Right: "PLAY ▶" accent button (46px tall, radius 12).

### Mode 1 — Create (landscape, ≥ aspect 1:1)

Three-column grid `28fr 44fr 28fr`, gap 14, padding 14/16/16.

- **Left panel — ORIGINAL browser** (white card, radius 16, border `--line`, padding 12): header row with letterspaced label "ORIGINAL" + PRO/COLLEGE segmented toggle; 46px search input; filter chips (All + 2 conferences, league-dependent); scrollable 2-column grid of team tiles. Tile: logo 70px, team name 13px/600 centered, 2.5px border (`--line`, selected: `#17150F` + bg `#FBF3E4` + 22px dark check badge top-right), radius 14.
- **Center panel — Remix canvas**: label "ORIGINAL" (11px, letterspacing 3, `--faint`) → team name (Chakra Petch 700 22px) → the remix logo at `min(36vh, 340px)`, pop-in animation → "COLORS" label → color team name + 3×16px palette dots → button row: "Shuffle Colors" (outlined, 54px) + "+ ADD ROUND" (accent, 54px, Chakra Petch). Empty state: 290px dashed circle, "Pick an original team on the left to start a remix". If original picked but no colors: show original logo in its own colors, colors line reads "Now pick a color team →".
- **Right panel — COLORS browser**: mirrors left, tiles additionally show 3×12px palette swatch dots under the name.

Behavior: selecting both teams updates the remix **instantly** (no Generate button). **Shuffle Colors** cycles through 6 color-assignment permutations. **+ ADD ROUND** appends `{originalTeamId, colorTeamId, permutation}` to the deck, flashes "ADDED ✓" (green bg) for 1s, increments the header deck count. When editing an existing round the button reads "SAVE ROUND". Disabled look (`#D8D3C8`) until both teams picked.

### Mode 1 — Create (portrait, height > width)

Do NOT squeeze the 3 columns. Recompose as steps: segmented step control ("1 · Original", "2 · Colors", "3 · Remix", 48px tall) above a single full-width panel. Step 1/2 = full-width browser, tile grid `repeat(auto-fill, minmax(150px, 1fr))`, logos 84px/76px. Step 3 = remix canvas, logo `min(52vw, 400px)`. Picking a team **auto-advances** to the next step; the step control moves backward freely without losing state. Orientation change (resize listener) must preserve all selections.

### Mode 2 — Deck + Setup

Landscape: cards area (flex 1, scrollable) + fixed 300px right rail. Portrait: rail becomes a full-width row below the cards, its two cards side by side (`flex: 1 1 0`).

- **Round card** (white, radius 16, padding 14, centered column): "ROUND N" micro-label, remix logo 104px, team name 15px/700, "in {ColorTeam} colors" 13px muted, then a 44px control row: ◀ ▶ (move, 0.35 opacity when at boundary), "Edit" (dark outline), ⧉ duplicate, ✕ delete (red text). Grid: `repeat(auto-fill, minmax(225px, 1fr))`.
- **Setup rail card**: "GAME SETUP" label, "{N} ROUNDS" (Chakra Petch 700 34px), "TIME PER ROUND" label, 4-way segmented 5s/10s/15s/30s (52px buttons, default 15), "GAME MODE" label + 2-way segmented "Type the Team" / "Host Mode" (52px) with a one-line muted hint below ("Everyone shouts the answer — the host taps Correct or Incorrect. No typing." / "One player types the team name each round."), "START GAME" (64px accent, radius 16, disabled `#D8D3C8` when deck empty).
- **High score card**: "HIGH SCORE" label + "{N} correct" or "—".
- Empty deck state: centered "Your deck is empty" + "CREATE A ROUND" accent button.
- "Edit" loads the round back into Create (both selections + permutation restored, portrait jumps to step 3).

### Mode 3 — Play (dark, immersive)

Background flips to `--dark-bg #12100D`, text `#F5F2EC`. No header.

1. **Intro**: "LOGO REMIX / CHALLENGE" (Chakra Petch 700 62px, letterspacing 5, centered, 2 lines), "{N} ROUNDS · {T} SECONDS EACH", "Ignore the colors. Recognize the team.", 280×64 "START" accent button, "← Back to deck" text button.
2. **Question — Type the Team** (default): top row "ROUND n / N" left, "SCORE s" + 44px ✕ quit right (18px, `#B7B0A3`, letterspacing 2). Timer: big seconds number (Chakra Petch 700 54px) over a `min(560px, 80%)` × 6px progress bar draining left-to-right (100ms tick). Both turn `#FF6B4A` at ≤5s. Logo: `min(40vh, 430px)`, centered, dominant. Prompt "WHOSE LOGO IS THIS?" (Chakra Petch 700 26px, letterspacing 4). Form: 60px input (dark `#221E18`, border `#3A352C`, no autocomplete/autocorrect — never suggest the answer) + 150×60 "SUBMIT" accent button. Enter submits. Input auto-focuses each round; ensure the iPad software keyboard never covers input or Submit (the flex column layout keeps them at the bottom above the keyboard).
3. **Question — Host Mode**: identical screen except the input/Submit pair is replaced by a muted hint ("Shout it out — the host taps the verdict") over two 68px buttons filling the same `min(640px, 86%)` row: "✓ CORRECT" (solid `#4CBF6B`, dark text `#12100D`) and "✕ INCORRECT" (2.5px `#FF6B4A` outline, transparent bg, `#FF6B4A` text, radius 16, Chakra Petch 700 19px ls 2). Tapping either ends the round with that verdict; the timer and timeout still apply. No keyboard ever opens in this mode — it's the preferred shared-iPad family mode.
3. **Reveal** (auto after answer or timeout): 80px icon circle (✓ green `#4CBF6B` / ✕ red `#FF6B4A` / ! gold `#F2B72E`), title "CORRECT" / "NOT QUITE" / "TIME'S UP" (44px, letterspacing 5, in the state color), the **original logo in its true colors** at 150px, team name 38px, "wearing {Color Team} colors" muted, "+1" (green) if correct. Advances after 1700ms.
4. **Results**: "FINAL SCORE" micro-label, "s / N" (Chakra Petch 700 90px), "NEW HIGH SCORE" (gold, letterspacing 4) when beaten, recap rows (dark card `#1C1915`, radius 12: ✓/✕ mark, 40px remix thumbnail, team name), "PLAY AGAIN" (accent) + "EDIT GAME" (light outline) buttons.

## Game logic (must match exactly)

- **Answer matching**: normalize `lowercase, strip non-alphanumerics`; accept region ("Cedar Falls"), mascot ("Lumberjacks"), full name, or abbreviation. A wrong guess ends the round (reveal), it does not retry.
- **Timer**: counts down from the setup value in 0.1s steps; 0 → timeout reveal.
- **Persistence** (`localStorage`): deck `lrx-deck` (array of `{o, c, v}` team-id/permutation objects), timer `lrx-timer`, high score `lrx-hs`, game mode `lrx-mode` (`'type' | 'host'`, default `'type'`). Seed deck on first run: the 5 rounds listed in `teams.json`.
- The original (unrecolored) logo must never be visible during a question — only in the reveal.
- Quit (✕) returns to Deck, stopping all timers.

## Touch rules (non-negotiable)

Minimum 44px targets everywhere, 46–64px for primary actions. No hover-dependent affordances (hover styles are enhancement only). No long-press, double-tap, or drag requirements. Reduced motion: respect `prefers-reduced-motion` (disable animations).

## Acceptance checklist

- [ ] Side-by-side with `Logo Remix Challenge.dc.html`, screens are visually identical (colors, type, spacing, radii)
- [ ] Full loop works: pick teams → shuffle → add rounds → reorder/edit/delete → setup → play → reveal states → results → play again
- [ ] Rotation (resize) preserves create-mode selections and gameplay state
- [ ] Deck, timer choice, high score survive reload
- [ ] Lighthouse: no layout shift on keyboard open; all tap targets ≥44px
- [ ] `vercel deploy` works with zero config

## Files in this folder

- `README.md` — this prompt
- `DESIGN_SYSTEM.md` — exact tokens, component anatomy, logo-generator spec, motion
- `teams.json` — the 32-team dataset, conference structure, seed deck
- `Logo Remix Challenge.dc.html` — the design prototype (reference only)
