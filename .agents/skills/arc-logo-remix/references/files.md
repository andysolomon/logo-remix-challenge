# Logo Remix voice — files and call sites

App: `~/Documents/Github/arc-logo-remix`

## Assets

```
public/voice/guess-logo.wav
public/voice/guess-colors.wav
public/voice/guess-both.wav
```

## Core API (`src/lib/teams.ts`)

```ts
const VOICE_CLIPS: Record<GuessTarget, string> = {
  team: '/voice/guess-logo.wav',
  colors: '/voice/guess-colors.wav',
  both: '/voice/guess-both.wav',
}

export function speak(target: GuessTarget): void
export function stopSpeak(): void
export const voiceSupported = () => typeof Audio !== 'undefined'
export const guessPrompt = (t: GuessTarget) => /* display strings; keep in sync with baked wav text */
export const roundTarget = (r: Round, fallback: GuessTarget): GuessTarget
```

Persistence: `loadVoice` / `saveVoice` via `LS.voice` (`lrx-voice`).

## Call sites

| File | What |
|---|---|
| `src/components/PlayMode.tsx` | `if (voice) speak(roundTarget(deck[i], guessTarget))` in `beginRound`; `stopSpeak()` in `quit` |
| `src/components/DeckMode.tsx` | On: `onVoice(true); speak(guessTarget)` |
| `src/components/SettingsModal.tsx` | same |
| `src/App.tsx` | `voice` state only; does not call `speak` |

On-screen question prompt in `PlayMode` is **not** `guessPrompt()`; it is `WHOSE LOGO IS THIS?` / `WHICH TEAM'S COLORS?` / `WHOSE LOGO · WHOSE COLORS?`.

## Regen

`scripts/generate_voice.py` — run with Chatterbox `.venv` Python. Writes the three wavs above. Turbo, `temperature=0.7`, builtin speaker.
