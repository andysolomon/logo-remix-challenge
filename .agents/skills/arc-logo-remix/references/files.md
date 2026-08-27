# Logo Remix voice — files and call sites

App: `~/Documents/Github/arc-logo-remix`

## Assets

```
public/voice/guess-logo.wav
public/voice/guess-colors.wav
public/voice/guess-both.wav
public/voice/correct.wav
public/voice/wrong.wav
public/voice/timeout.wav
public/voice/game-over.wav
public/voice/you-scored-0.wav … you-scored-20.wav
public/voice/out-of-1.wav … out-of-20.wav
```

## Core API (`src/lib/teams.ts`)

```ts
export type VoiceClipId = GuessTarget | 'correct' | 'wrong' | 'timeout'

export function speak(id: VoiceClipId): void
export function speakScore(score: number, total: number): void
export function stopSpeak(): void
export const voiceSupported = () => typeof Audio !== 'undefined'
export const guessPrompt = (t: GuessTarget) => /* display strings; keep in sync with baked wav text */
export const roundTarget = (r: Round, fallback: GuessTarget): GuessTarget
```

`speakScore` fetches `/voice/you-scored-{n}.wav` and `/voice/out-of-{m}.wav` when both are in 0–20 (total ≥ 1), joins them into one blob, and plays that. Otherwise `/voice/game-over.wav`.

Persistence: `loadVoice` / `saveVoice` via `LS.voice` (`lrx-voice`).

## Call sites

| File | What |
|---|---|
| `src/components/PlayMode.tsx` | `speak(roundTarget(...))` in `beginRound`; `speak(kind)` in `reveal`; `speakScore(score, deck.length)` in `finish`; `stopSpeak()` in `quit` and `restart` |
| `src/components/DeckMode.tsx` | On: `onVoice(true); speak(guessTarget)` |
| `src/components/SettingsModal.tsx` | same |
| `src/App.tsx` | `voice` state only; does not call `speak` |

On-screen question prompt in `PlayMode` is **not** `guessPrompt()`; it is `WHOSE LOGO IS THIS?` / `WHICH TEAM'S COLORS?` / `WHOSE LOGO · WHOSE COLORS?`. Reveal titles match the verdict wavs: CORRECT / NOT QUITE / TIME'S UP.

## Regen

`scripts/generate_voice.py` — run with Chatterbox `.venv` Python. Writes missing wavs (pass `--force` to redo all). Turbo, `temperature=0.7`, builtin speaker, silence-trimmed.
