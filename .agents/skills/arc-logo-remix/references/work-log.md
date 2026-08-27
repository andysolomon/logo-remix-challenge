# Work log — Chatterbox in Logo Remix (2026-08-27)

This is the full record of standing up Chatterbox locally and replacing Logo Remix’s native Voice Announcer.

## 1. Why native voice was replaced

Logo Remix (`~/Documents/Github/arc-logo-remix`) announced each round with `window.speechSynthesis` in `speak()` (`src/lib/teams.ts`). Rate 1.05, pitch 1.1. On iPad Safari this sounds poor and is inconsistent across devices.

The announcer only ever says three sentences, from `guessPrompt()`:

- `Guess the Logo!` (`team`)
- `Guess the Colors!` (`colors`)
- `Guess the Logo and the Colors!` (`both`)

Call sites were:

- `PlayMode.beginRound` — `speak(guessPrompt(roundTarget(...)))` at question start
- Deck + Settings On button — preview `speak(guessPrompt(guessTarget))`
- `PlayMode.quit` — `speechSynthesis.cancel()`

The app is a client-only Vite SPA on Vercel. No backend, no auth. Live Chatterbox (Python + PyTorch + 110–500M weights) cannot run there.

**Decision:** bake three WAV files with Chatterbox Turbo, ship them in `public/voice/`, play with `HTMLAudioElement`.

Rejected: GPU sidecar, Resemble hosted API, per-request TTS. All break the deploy model or add round-start latency.

## 2. Chatterbox local bring-up (this repo)

See also `creating-audio` skill references.

- Cloned/working tree: `~/Documents/Github/chatterbox`
- Created `.venv` with **Python 3.11.15** (`uv venv`), not system 3.14.6
- `uv pip install -e .` — `chatterbox-tts==0.1.7`, `torch==2.6.0`
- First smoke test: **Nano** on **MPS**
  - Device patch: `torch.load(..., map_location=mps)`
  - `PYTORCH_ENABLE_MPS_FALLBACK=1`
  - Output `test-nano.wav` (gitignored here): 6.40s, 24 kHz, peak 0.491
  - Confirmed `[chuckle]` works as a tag
- Stock CUDA examples do not run on this Mac as written

## 3. Baking the three announcer clips

Model: **Chatterbox-Turbo** (350M), builtin speaker, `temperature=0.7`, no reference wav, no laugh tags (sports-announcer request, no clip provided).

Wrote directly to the game:

| File | Duration | Size | Peak |
|---|---|---|---|
| `arc-logo-remix/public/voice/guess-logo.wav` | 1.24s | 116 KB | 0.303 |
| `arc-logo-remix/public/voice/guess-colors.wav` | 1.36s | 128 KB | 0.389 |
| `arc-logo-remix/public/voice/guess-both.wav` | 2.00s | 188 KB | 0.403 |

Listened with `afplay` on all three. 24 kHz mono. Total ~432 KB — fine for static hosting.

Regen script added at `arc-logo-remix/scripts/generate_voice.py` (same Turbo path, MPS/`torch.load` patch). npm script `"voice"` points at it but still needs the Chatterbox venv Python.

## 4. App wiring

`speak()` now takes `GuessTarget` and plays `VOICE_CLIPS[target]`.

Implementation details that matter:

- Module-level `voicePlayer: HTMLAudioElement | null` — created once, src swapped
- `stopSpeak()` pauses and seeks to 0 when `src` is set
- `play()` uses `.catch(() => {})` because autoplay rejection is async
- First-round play is on the START button click (user gesture). Later rounds are after a 1700ms reveal timeout; reused element stays unlocked on iPad
- `voiceSupported()` is `typeof Audio !== 'undefined'` so On is not disabled in browsers without `speechSynthesis`

Files touched in Logo Remix:

- `src/lib/teams.ts` — clip map, `speak`, `stopSpeak`, `voiceSupported`
- `src/components/PlayMode.tsx` — `speak(roundTarget(...))`, `stopSpeak` on quit; dropped unused `guessPrompt` import
- `src/components/DeckMode.tsx` — On preview `speak(guessTarget)`
- `src/components/SettingsModal.tsx` — same
- `scripts/generate_voice.py` — new
- `package.json` — `"voice"` script
- `README.md` — announcer is Chatterbox clips, not `speechSynthesis`
- `public/voice/*.wav` — new assets (this repo gitignores wavs; Logo Remix does not)

`bun run build` (`tsc -b && vite build`) succeeded. Vite copies `public/voice/` into `dist/voice/`.

## 5. Verification (2026-08-27)

- Dev server: `bun run dev` → http://localhost:5173/
- `GET /voice/guess-logo.wav` → 200, `Content-Type: audio/wav`, 119120 bytes
- Turning Voice **On** (DOM click on the rail button) loaded `guess-logo.wav` (`performance.getEntriesByType('resource')`)
- Switching default guess to Both and starting a round showed `WHOSE LOGO · WHOSE COLORS?` and requested `guess-both.wav`
- No console errors from the announcer path (pre-existing favicon 404)
- Headless `agent-browser` clicks on `@eN` refs were unreliable because a large clickable ancestor wraps the page; `HTMLElement.click()` on the rail button worked

Not verified on a physical iPad. The singleton Audio pattern is the standard unlock workaround; confirm on device if iOS autoplay misbehaves.

## 6. Verdicts and final score (same day)

Closed vocabulary grew past the three guess prompts. Still bake-and-serve; still one `HTMLAudioElement`.

New lines (Turbo, builtin speaker, silence-trimmed):

- Reveal: `Correct!` / `Not quite!` / `Time's up!` — match on-screen titles
- Score: `You scored {n}` + `out of {m}.` for n,m in 0–20 (m ≥ 1), joined in-browser into one blob
- Fallback: `That's the game! Check the board for your score.`

`speak()` now takes `VoiceClipId`. `speakScore(score, total)` is the end-of-game entry. `PlayMode.reveal` speaks the verdict; `finish` speaks the score; `restart` also `stopSpeak()`.

Regen skips existing files unless `--force`.

## 7. What was left undone

- Builtin Turbo voice, not a cloned sports PA (no reference wav supplied)
- Numbers above 20 use `game-over.wav`
- Physical iPad not re-tested for the joined score clip
