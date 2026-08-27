#!/usr/bin/env python3
"""Download the 37 logo assets used by Logo Remix Challenge from ESPN.

Fetches the 32 NFL team logos via the ESPN site API (falling back to the
CDN URL pattern) into ``public/logos/nfl/`` and the 5 college conference
logos (ACC, Big 12, Big Ten, Pac-12, SEC) from the ESPN CDN into
``public/logos/conferences/``.

Stdlib only, safe to re-run: existing valid PNGs are skipped before any
network access unless ``--force`` is given. Exits non-zero if any of the
exact expected assets is missing or invalid.

Usage:
    python3 scripts/download_logos.py [--out public/logos] [--force]
"""

import argparse
import json
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

NFL_API = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams"
NFL_CDN = "https://a.espncdn.com/i/teamlogos/nfl/500/{abbr}.png"
CONF_CDN = "https://a.espncdn.com/i/teamlogos/ncaa_conf/500/{group}.png"

# slug -> ESPN college-football conference (group) id
CONFERENCES = {
    "acc": 1,
    "big-12": 4,
    "big-ten": 5,
    "pac-12": 9,
    "sec": 8,
}

# Well-known ESPN NFL abbreviations, mirroring the API ordering. The
# expected asset set is exactly these 32 plus the 5 conferences above.
NFL_ABBRS = (
    "ari atl bal buf car chi cin cle dal den det gb hou ind jax kc lv lac lar "
    "mia min ne no nyg nyj phi pit sf sea tb ten wsh"
).split()

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
ROOT = Path(__file__).resolve().parent.parent
USER_AGENT = "logo-remix-challenge/1.0 (asset downloader)"


def fetch(url: str) -> bytes:
    """GET ``url`` via urllib; fall back to curl on any network failure."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read()
    except OSError:  # HTTPError, URLError, timeouts: curl handles ESPN's quirks
        return subprocess.run(
            ["curl", "-fsSL", "--max-time", "30", url], check=True, capture_output=True
        ).stdout


def fetch_json(url: str):
    return json.loads(fetch(url))


def is_png(data: bytes) -> bool:
    return data.startswith(PNG_MAGIC)


def display_path(path: Path) -> str:
    """Repo-relative path when possible, else the absolute path.

    ``--out`` may point outside the repository, where ``relative_to(ROOT)``
    would raise ValueError.
    """
    resolved = path.resolve()
    try:
        return str(resolved.relative_to(ROOT))
    except ValueError:
        return str(resolved)


def save_png(data: bytes, dest: Path) -> None:
    if not is_png(data):
        raise ValueError(f"response for {dest.name} is not a PNG")
    dest.write_bytes(data)


def nfl_team_logos() -> dict[str, str]:
    """Map of lowercase NFL abbreviation -> logo URL from the ESPN API."""
    data = fetch_json(NFL_API)
    logos: dict[str, str] = {}
    for entry in data["sports"][0]["leagues"][0]["teams"]:
        team = entry["team"]
        abbr = team["abbreviation"].lower()
        hrefs = [logo["href"] for logo in team.get("logos", []) if logo.get("href")]
        logos[abbr] = hrefs[0] if hrefs else NFL_CDN.format(abbr=abbr)
    return logos


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--out",
        type=Path,
        default=ROOT / "public" / "logos",
        help="output root containing nfl/ and conferences/ (default: public/logos)",
    )
    parser.add_argument("--force", action="store_true", help="re-download even if a valid PNG exists")
    args = parser.parse_args()

    nfl_dir = args.out / "nfl"
    conf_dir = args.out / "conferences"
    nfl_dir.mkdir(parents=True, exist_ok=True)
    conf_dir.mkdir(parents=True, exist_ok=True)

    # The exact expected targets: the 32 NFL abbreviations + 5 conferences.
    targets: dict[str, tuple[str, Path]] = {
        abbr: (NFL_CDN.format(abbr=abbr), nfl_dir / f"{abbr}.png") for abbr in NFL_ABBRS
    }
    for slug, group in CONFERENCES.items():
        targets[f"conf:{slug}"] = (CONF_CDN.format(group=group), conf_dir / f"{slug}.png")

    # Skip valid existing files before any network access.
    counts = {"downloaded": 0, "skipped": 0}
    pending: dict[str, tuple[str, Path]] = {}
    for key, (url, dest) in sorted(targets.items()):
        if not args.force and dest.is_file() and is_png(dest.read_bytes()):
            counts["skipped"] += 1
            print(f"{'skipped':10s} {display_path(dest)}")
        else:
            pending[key] = (url, dest)

    # Prefer API logo URLs, but only when an NFL asset actually needs a
    # fetch; an unreachable or incomplete API keeps the hardcoded CDN list.
    if any(not key.startswith("conf:") for key in pending):
        try:
            api_logos = nfl_team_logos()
            missing = [abbr for abbr in NFL_ABBRS if abbr not in api_logos]
            if missing:
                print(
                    f"warning: NFL API incomplete (no {', '.join(missing)}); using hardcoded CDN list",
                    file=sys.stderr,
                )
            else:
                for abbr in NFL_ABBRS:
                    if abbr in pending:
                        pending[abbr] = (api_logos[abbr], pending[abbr][1])
        except Exception as exc:
            print(f"warning: NFL API failed ({exc}); using hardcoded CDN list", file=sys.stderr)

    failures: list[str] = []
    for key, (url, dest) in sorted(pending.items()):
        cdn = NFL_CDN.format(abbr=key) if not key.startswith("conf:") else None
        candidates = [url] + ([cdn] if cdn and cdn != url else [])
        error = None
        for candidate in candidates:
            try:
                save_png(fetch(candidate), dest)
                error = None
                break
            except Exception as exc:  # network/timeout/HTTP error or non-PNG body
                error = exc
                if candidate != candidates[-1]:
                    print(f"warning: {key}: {exc}; trying CDN fallback", file=sys.stderr)
        if error is not None:
            failures.append(f"{dest.relative_to(args.out)}: {error}")
            print(f"FAIL {dest}: {error}", file=sys.stderr)
            continue
        counts["downloaded"] += 1
        print(f"{'downloaded':10s} {display_path(dest)}")

    # Validate the exact expected paths; stray extra PNGs cannot mask a
    # missing target because nothing is glob-counted.
    expected = sorted(dest for _, dest in targets.values())
    invalid = [p for p in expected if not (p.is_file() and is_png(p.read_bytes()))]
    print(f"\n{len(expected) - len(invalid)}/{len(expected)} valid PNGs under {display_path(args.out)} "
          f"({counts['downloaded']} downloaded, {counts['skipped']} skipped)")
    for path in invalid:
        print(f"error: missing or invalid expected asset {path.relative_to(args.out)}", file=sys.stderr)
    if failures or invalid:
        print(f"error: {len(failures)} failure(s), {len(invalid)} missing/invalid of {len(expected)} expected",
              file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
