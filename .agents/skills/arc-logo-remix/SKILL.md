---
name: arc-logo-remix
description: >-
  Logo Remix Challenge (arc-logo-remix) iPad sports-logo guessing game. Use when
  working on Voice Announcer, baked Chatterbox clips in public/voice, speak() /
  stopSpeak(), guess prompts, or replacing browser speechSynthesis in that app.
compatibility: Sibling app at ~/Documents/Github/arc-logo-remix (Vite + React SPA). Audio bake requires the Chatterbox venv from this repo.
metadata:
  author: andrewsolomon
  version: "1.0"
  app: "~/Documents/Github/arc-logo-remix"
---

# Logo Remix Challenge — Voice Announcer

The game is a **client-only Vite + React SPA** (iPad-first, Vercel). Chatterbox cannot run in the browser. The announcer has a **closed vocabulary of three lines**, so clips are baked once and played as static wavs.

App root: `~/Documents/Github/arc-logo-remix`.

For generating wavs, follow the `creating-audio` skill, then copy into the app (or run the app’s `scripts/generate_voice.py` with the Chatterbox venv).

## Architecture (do not regress)

| Piece | Where |
|---|---|
| Clip map `GuessTarget` → wav | `src/lib/teams.ts` (`VOICE_CLIPS`) |
| `speak(target)` / `stopSpeak()` | `src/lib/teams.ts` — one shared `HTMLAudioElement` |
| Round start | `PlayMode.beginRound` → `speak(roundTarget(deck[i], guessTarget))` |
| Preview | Deck rail + Settings: On → `speak(guessTarget)` |
| Stop on quit | `PlayMode.quit` → `stopSpeak()` |
| Assets | `public/voice/guess-logo.wav`, `guess-colors.wav`, `guess-both.wav` |
| Regen | `scripts/generate_voice.py` (Turbo, temperature 0.7) |

Prompts that must match the baked text:

| `GuessTarget` | Spoken line | File |
|---|---|---|
| `team` | Guess the Logo! | `/voice/guess-logo.wav` |
| `colors` | Guess the Colors! | `/voice/guess-colors.wav` |
| `both` | Guess the Logo and the Colors! | `/voice/guess-both.wav` |

On-screen round copy is different (`WHOSE LOGO IS THIS?` etc.). Do not bake those strings unless product asks to change the VO.

## Rules

- **Do not** restore `window.speechSynthesis`. It is the old, bad announcer.
- **Do not** add a Python/GPU TTS API to this app. It would break the client-only Vercel deploy and add latency on iPad.
- Keep **one** `Audio` element and reuse it. iPad Safari unlocks that element on the first user-gesture `play()` (On, or START). Later rounds fire from a timer after reveal; a new `Audio()` each time will often be blocked.
- `speak()` takes a `GuessTarget`, not a string. `guessPrompt()` is display copy only.
- Voice toggle stays in `localStorage` key `lrx-voice`.
- `voiceSupported()` is `typeof Audio !== 'undefined'` (always true in the browser). Keep the On button enabled.

## Regen clips

From the **Logo Remix** repo, using the **Chatterbox** venv:

```bash
export PYTORCH_ENABLE_MPS_FALLBACK=1
~/Documents/Github/chatterbox/.venv/bin/python scripts/generate_voice.py
```

To clone a sports-PA voice, extend `generate_voice.py` with `audio_prompt_path=` pointing at a **>5s** reference wav, then re-run. Listen with `afplay` before committing.

If you change `guessPrompt()` text, regenerate the matching wavs or they will drift.

## Verify

1. `afplay public/voice/guess-logo.wav` (and colors / both).
2. `bun run dev` → Deck → **🔊 On** (user gesture) — should fetch `/voice/guess-*.wav` and play.
3. START GAME → START — round start plays the clip for that round’s target.
4. Quit mid-clip — audio stops (`stopSpeak`).
5. Type-check: `bun run build`.

Do not treat a screenshot as verification. Confirm the network request and that the file is not silence.

## Additional resources

- [references/work-log.md](references/work-log.md) — everything done 2026-08-27
- [references/files.md](references/files.md) — touch list and call sites
