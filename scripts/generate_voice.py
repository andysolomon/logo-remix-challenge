#!/usr/bin/env python3
"""Bake Chatterbox announcer clips into public/voice/.

The game is a client-only SPA, so TTS cannot run in the browser. This script
generates the three closed-vocabulary prompts once and the app plays the wavs.

Requires chatterbox-tts (https://github.com/resemble-ai/chatterbox). Run with
that environment's Python, for example:

    ~/Documents/Github/chatterbox/.venv/bin/python scripts/generate_voice.py
"""

from __future__ import annotations

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

# Keys match GuessTarget in src/lib/teams.ts (team / colors / both).
CLIPS = (
    ("guess-logo.wav", "Guess the Logo!"),
    ("guess-colors.wav", "Guess the Colors!"),
    ("guess-both.wav", "Guess the Logo and the Colors!"),
)


def main() -> None:
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    if torch.cuda.is_available():
        device = "cuda"
    print(f"device={device}")

    orig_load = torch.load

    def patched_load(*args, **kwargs):
        kwargs.setdefault("map_location", torch.device(device))
        return orig_load(*args, **kwargs)

    torch.load = patched_load

    print("Loading Chatterbox-Turbo...")
    model = ChatterboxTurboTTS.from_pretrained(device=device)
    OUT.mkdir(parents=True, exist_ok=True)

    for name, text in CLIPS:
        print(f"Generating {name}: {text}")
        wav = model.generate(text, temperature=0.7)
        path = OUT / name
        ta.save(str(path), wav, model.sr)
        dur = wav.shape[-1] / model.sr
        print(f"  wrote {path} ({dur:.2f}s)")


if __name__ == "__main__":
    main()
