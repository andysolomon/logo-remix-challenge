#!/usr/bin/env python3
"""Bake Chatterbox announcer clips into public/voice/.

The game is a client-only SPA, so TTS cannot run in the browser. This script
generates a closed vocabulary: round prompts, verdicts, and score fragments.

Requires chatterbox-tts (https://github.com/resemble-ai/chatterbox). Run with
that environment's Python, for example:

    ~/Documents/Github/chatterbox/.venv/bin/python scripts/generate_voice.py
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

try:
    import torch
    import torchaudio as ta
    from chatterbox.tts_turbo import ChatterboxTurboTTS
except ImportError as e:
    sys.exit(
        f"chatterbox-tts is not importable ({e}).\n"
        "Run this script with the Chatterbox venv's Python, e.g.\n"
        "  ~/Documents/Github/chatterbox/.venv/bin/python scripts/generate_voice.py"
    )

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "voice"

# GuessTarget keys in src/lib/teams.ts (team / colors / both).
GUESS = (
    ("guess-logo.wav", "Guess the Logo!"),
    ("guess-logo-2.wav", "Whose logo is this?"),
    ("guess-logo-3.wav", "Name the team behind the logo!"),
    ("guess-logo-4.wav", "Which team is it?"),
    ("guess-colors.wav", "Guess the Colors!"),
    ("guess-colors-2.wav", "Whose colors are these?"),
    ("guess-colors-3.wav", "Which team wears these colors?"),
    ("guess-colors-4.wav", "Who wears these colors?"),
    ("guess-both.wav", "Guess the Logo and the Colors!"),
    ("guess-both-2.wav", "Name both teams!"),
    ("guess-both-3.wav", "Identify the logo team and the color team!"),
    ("guess-both-4.wav", "Who owns the logo and who wears its colors?"),
)

# Reveal kinds in PlayMode (correct / wrong / timeout) plus a score fallback.
VERDICT = (
    ("correct.wav", "Correct!"),
    ("correct-2.wav", "You got it!"),
    ("correct-3.wav", "That’s right!"),
    ("correct-4.wav", "Nice work!"),
    ("wrong.wav", "Not quite!"),
    ("wrong-2.wav", "Good try!"),
    ("wrong-3.wav", "Not this time!"),
    ("wrong-4.wav", "That’s not it!"),
    ("timeout.wav", "Time's up!"),
    ("timeout-2.wav", "Out of time!"),
    ("timeout-3.wav", "The clock ran out!"),
    ("timeout-4.wav", "Time expired!"),
    ("game-over.wav", "That's the game! Check the board for your score."),
)

# Spoken cardinals 0–20. Files are you-scored-{n}.wav and out-of-{n}.wav.
WORDS = (
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
    "twenty",
)


def all_clips() -> list[tuple[str, str]]:
    clips = list(GUESS) + list(VERDICT)
    for n, word in enumerate(WORDS):
        clips.append((f"you-scored-{n}.wav", f"You scored {word}"))
        if n >= 1:
            clips.append((f"out-of-{n}.wav", f"out of {word}."))
    return clips


def trim_silence(wav: torch.Tensor, sr: int, thresh: float = 0.015, pad_ms: int = 40) -> torch.Tensor:
    amp = wav.abs().amax(dim=0)
    loud = (amp > thresh).nonzero(as_tuple=True)[0]
    if loud.numel() == 0:
        return wav
    pad = int(sr * pad_ms / 1000)
    start = max(0, int(loud[0]) - pad)
    end = min(wav.shape[-1], int(loud[-1]) + pad)
    return wav[..., start:end]


def main() -> None:
    parser = argparse.ArgumentParser(description="Bake Logo Remix announcer wavs")
    parser.add_argument("--force", action="store_true", help="Regenerate files that already exist")
    args = parser.parse_args()

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    if torch.cuda.is_available():
        device = "cuda"
    print(f"device={device}")

    orig_load = torch.load

    def patched_load(*args, **kwargs):
        kwargs.setdefault("map_location", torch.device(device))
        return orig_load(*args, **kwargs)

    torch.load = patched_load

    clips = all_clips()
    OUT.mkdir(parents=True, exist_ok=True)
    pending = [(name, text) for name, text in clips if args.force or not (OUT / name).exists()]
    skipped = len(clips) - len(pending)
    if skipped:
        print(f"skipping {skipped} existing file(s); pass --force to regenerate")
    if not pending:
        print("nothing to generate")
        return

    print("Loading Chatterbox-Turbo...")
    model = ChatterboxTurboTTS.from_pretrained(device=device)

    for name, text in pending:
        print(f"Generating {name}: {text}")
        wav = trim_silence(model.generate(text, temperature=0.7), model.sr)
        path = OUT / name
        ta.save(str(path), wav, model.sr)
        dur = wav.shape[-1] / model.sr
        peak = float(wav.abs().max())
        print(f"  wrote {path} ({dur:.2f}s peak={peak:.3f})")
        if peak < 0.05:
            print("  warning: peak is very low; clip may be silence", file=sys.stderr)


if __name__ == "__main__":
    main()
