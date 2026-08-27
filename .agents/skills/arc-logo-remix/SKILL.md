---
name: arc-logo-remix
description: >-
  Logo Remix Challenge (arc-logo-remix) iPad sports-logo guessing game. Use when
  working on Voice Announcer, baked Chatterbox clips in public/voice, speak() /
  speakScore() / stopSpeak(), guess prompts, verdicts, final score, or replacing
  browser speechSynthesis in that app.
compatibility: Sibling app at ~/Documents/Github/arc-logo-remix (Vite + React SPA). Audio bake requires the Chatterbox venv from this repo.
metadata:
  author: andrewsolomon
  version: "1.1"
  app: "~/Documents/Github/arc-logo-remix"
---

# Logo Remix Challenge — Voice Announcer

The game is a **client-only Vite + React SPA** (iPad-first, Vercel). Chatterbox cannot run in the browser. The announcer is a **closed vocabulary**, so clips are baked once and played as static wavs.

App root: `~/Documents/Github/arc-logo-remix`.

For generating wavs, follow the `creating-audio` skill, then copy into the app (or run the app’s `scripts/generate_voice.py` with the Chatterbox venv).

## Architecture (do not regress)

| Piece | Where |
|---|---|
| Clip map `VoiceClipId` → wav | `src/lib/teams.ts` (`VOICE_CLIPS`) |
| `speak(id)` / `speakScore(n, total)` / `stopSpeak()` | `src/lib/teams.ts` — one shared `HTMLAudioElement` |
| Round start | `PlayMode.beginRound` → `speak(roundTarget(deck[i], guessTarget))` |
| Reveal | `PlayMode.reveal` → `speak('correct' \| 'wrong' \| 'timeout')` |
| Final score | `PlayMode.finish` → `speakScore(score, deck.length)` (joins you-scored-N + out-of-M into one wav) |
| Preview | Deck rail + Settings: On → `speak(guessTarget)` |
| Stop on quit / play again | `PlayMode.quit` / `restart` → `stopSpeak()` |
| Assets | `public/voice/*.wav` |
| Regen | `scripts/generate_voice.py` (Turbo, temperature 0.7; skips existing unless `--force`) |

Round prompts:

| `GuessTarget` | Spoken line | File |
|---|---|---|
| `team` | Guess the Logo! | `/voice/guess-logo.wav` |
| `colors` | Guess the Colors! | `/voice/guess-colors.wav` |
| `both` | Guess the Logo and the Colors! | `/voice/guess-both.wav` |

Verdicts (match on-screen reveal titles):

| Id | Spoken line | File |
|---|---|---|
| `correct` | Correct! | `/voice/correct.wav` |
| `wrong` | Not quite! | `/voice/wrong.wav` |
| `timeout` | Time's up! | `/voice/timeout.wav` |

Score is one joined clip when both numbers are 0–20: `/voice/you-scored-{n}.wav` (“You scored eight”) plus `/voice/out-of-{m}.wav` (“out of ten.”), concatenated in `speakScore`. Outside that range: `/voice/game-over.wav`. Do not queue two `play()` calls — iPad and timer-fired `ended` handlers drop the second clip.

On-screen round copy is different (`WHOSE LOGO IS THIS?` etc.). Do not bake those strings unless product asks to change the VO.

## Rules

- **Do not** restore `window.speechSynthesis`. It is the old, bad announcer.
- **Do not** add a Python/GPU TTS API to this app. It would break the client-only Vercel deploy and add latency on iPad.
- Keep **one** `Audio` element and reuse it. iPad Safari unlocks that element on the first user-gesture `play()` (On, or START). Later rounds and the score line fire from timers after reveal; a new `Audio()` each time will often be blocked.
- `speak()` takes a `VoiceClipId` (`GuessTarget` or a verdict). `speakScore(score, total)` is for the end screen. `guessPrompt()` is display copy only.
- Voice toggle stays in `localStorage` key `lrx-voice`.
- `voiceSupported()` is `typeof Audio !== 'undefined'` (always true in the browser). Keep the On button enabled.

## Regen clips

From the **Logo Remix** repo, using the **Chatterbox** venv:

```bash
export PYTORCH_ENABLE_MPS_FALLBACK=1
~/Documents/Github/chatterbox/.venv/bin/python scripts/generate_voice.py
```

Existing wavs are skipped. Pass `--force` to regenerate everything (will drift the three guess clips). To clone a sports-PA voice, extend `generate_voice.py` with `audio_prompt_path=` pointing at a **>5s** reference wav, then re-run. Listen with `afplay` before committing.

If you change spoken lines, regenerate the matching wavs or they will drift.

## Verify

1. `afplay public/voice/correct.wav` (and wrong / timeout / a you-scored + out-of pair).
2. `bun run dev` → Deck → **🔊 On** (user gesture) — should fetch `/voice/guess-*.wav` and play.
3. START GAME → START — round start plays the clip for that round’s target.
4. Submit or host-tap a verdict — `correct.wav` / `wrong.wav`; let a timer expire for `timeout.wav`.
5. Finish a game — hear “You scored N” then “out of M”.
6. Quit mid-clip — audio stops (`stopSpeak`).
7. Type-check: `bun run build`.

Do not treat a screenshot as verification. Confirm the network request and that the file is not silence.

## Additional resources

- [references/work-log.md](references/work-log.md) — everything done 2026-08-27
- [references/files.md](references/files.md) — touch list and call sites
