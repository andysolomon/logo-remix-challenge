#!/usr/bin/env python3
"""Rebuild only the NBA roster from nba-manifest.json; preserve other leagues."""

import argparse
import json
import re
from pathlib import Path

from build_teams import atomic_write_text, build_palette, dist_sq, fmt_entry
from download_nba_svgs import artwork_colors, validate_svg
from nba_roster import ROSTER

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "public/logos/svg/nba-manifest.json"
TEAMS_JSON = ROOT / "src/lib/teams.json"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    items = json.loads(MANIFEST.read_text())["assets"]
    if len(items) != 30 or {i["abbr"] for i in items} != set(ROSTER):
        raise ValueError("NBA manifest must contain exactly the 30 pinned teams")
    entries = []
    for item in items:
        abbr = item["abbr"]
        nba_id, conference = ROSTER[abbr]
        path = f"/logos/svg/nba/{abbr.lower()}.svg"
        expected = {"id": f"NBA-{abbr}", "league": "NBA", "nbaId": nba_id,
                    "conference": conference, "path": path, "format": "svg"}
        if any(item.get(k) != v for k, v in expected.items()):
            raise ValueError(f"invalid NBA metadata for {abbr}")
        artwork = (ROOT / "public" / path.lstrip("/")).read_bytes()
        validate_svg(artwork)
        fills = artwork_colors(artwork)
        if item["fills"] != fills:
            raise ValueError(f"stale artwork colors for {abbr}; rerun logos:nba")
        for key in ("color", "alternateColor"):
            if not re.fullmatch(r"[0-9a-fA-F]{6}", item[key]):
                raise ValueError(f"invalid {key} for {abbr}")
        palette, _ = build_palette(item)
        # Black/white-only artwork (Nets) has no secondary ink to remap.
        if palette[1] == palette[2]:
            palette[1] = "#808080"
        source = list(palette)
        # Some primary marks omit a brand color or use a different shade.
        # Preserve the donor palette while mapping the actual artwork's roles.
        overrides = {"PHX": {0: "#000000"}, "MIN": {1: "#009A44"},
                     "ORL": {1: "#061922"}, "HOU": {1: "#FFD520"}}
        for slot, color in overrides.get(abbr, {}).items():
            source[slot] = color
        unused = [slot for slot, color in enumerate(source)
                  if not any(dist_sq(color, fill) <= 90 * 90 for fill in fills)]
        entry = {k: item[k] for k in ("id", "league", "conference", "region", "name", "abbr")}
        entry.update(palette=palette, logo=path)
        if source != palette:
            entry["sourcePalette"] = source
        if item.get("aliases"):
            entry["aliases"] = item["aliases"]
        if unused:
            entry["unusedSourceSlots"] = unused
        entries.append(entry)
    text = TEAMS_JSON.read_text()
    data = json.loads(text)
    existing = data["teams"]
    nfl = [t for t in existing if t["league"] == "PRO"]
    others = [t for t in existing if t["league"] not in ("PRO", "NBA")]
    start = text.index('"teams": [')
    end = text.index("\n  ]", start)
    text = text[:start] + '"teams": [\n' + ",\n".join(fmt_entry(t) for t in nfl + entries + others) + text[end:]
    config = '"NBA": { "label": "NBA", "conferences": ["Eastern", "Western"] }'
    if "NBA" in data["leagues"]:
        text = re.sub(r'"NBA":\s*\{[^}]*\}', lambda _: config, text, count=1)
    else:
        text = text.replace('    "COL":', f'    {config},\n    "COL":', 1)
    json.loads(text)
    if not args.dry_run:
        atomic_write_text(TEAMS_JSON, text)
    print("30 NBA teams; existing NFL, college and high-school entries preserved")


if __name__ == "__main__":
    main()
