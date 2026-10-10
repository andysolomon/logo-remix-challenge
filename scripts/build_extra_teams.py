#!/usr/bin/env python3
"""Validate and rebuild only MLB or soccer entries; preserve all other data.

Fast-food and brand entries are rebuilt by build_brand_teams.py.
"""
import argparse
import json
import re
from pathlib import Path

from build_teams import atomic_write_text, fmt_entry
from download_extra_logos import inspect_artwork
from extra_rosters import MLB, SOCCER, LEAGUES

ROOT = Path(__file__).resolve().parent.parent
TEAMS_JSON = ROOT / "src/lib/teams.json"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--league", choices=sorted(LEAGUES), required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    slug = args.league.lower()
    items = json.loads((ROOT / f"public/logos/svg/{slug}-manifest.json").read_text())["assets"]
    rows = SOCCER if args.league == "SOCCER" else MLB
    roster = set(rows)
    if len(items) != len(roster) or {i["abbr"] for i in items} != roster:
        raise ValueError(f"{args.league} manifest must contain exactly {len(roster)} entries")
    entries = []
    for item in items:
        abbr = item["abbr"]
        format = item["format"]
        expected_path = f"/logos/svg/{slug}/{abbr.lower()}.{format}"
        if format not in ("svg", "png") or item["path"] != expected_path or item["id"] != f"{args.league}-{abbr}" or item["league"] != args.league:
            raise ValueError(f"invalid identity/path for {abbr}")
        if item["conference"] not in LEAGUES[args.league]["conferences"]:
            raise ValueError(f"invalid grouping for {abbr}")
        if args.league == "SOCCER":
            if item["conference"] != rows[abbr][0] or item["region"] != rows[abbr][1] or item["name"] != "":
                raise ValueError(f"invalid soccer league or club name for {abbr}")
        elif item["conference"] != MLB[abbr][1]:
            raise ValueError(f"invalid MLB conference for {abbr}")
        colors = inspect_artwork((ROOT / "public" / expected_path.lstrip("/")).read_bytes(), format)
        if colors != item["colors"]:
            raise ValueError(f"stale artwork metadata for {abbr}")
        palette = item["palette"]
        if len(palette) != 3 or len(set(palette)) != 3 or any(not re.fullmatch(r"#[0-9A-F]{6}", c) for c in palette):
            raise ValueError(f"invalid palette for {abbr}")
        entry = {k: item[k] for k in ("id", "league", "conference", "region", "name", "abbr", "palette")}
        entry["logo"] = expected_path
        # Cap marks and crests can omit primary or secondary team colors entirely.
        # Keep the complete donor palette and map the actual artwork separately.
        brand = ["#" + rows[abbr][2], "#" + rows[abbr][3], "#FFFFFF"]
        if brand != palette:
            entry["sourcePalette"] = palette
            entry["palette"] = brand
        if item["aliases"]:
            entry["aliases"] = item["aliases"]
        if item["unusedSourceSlots"]:
            entry["unusedSourceSlots"] = item["unusedSourceSlots"]
        entries.append(entry)
    text = TEAMS_JSON.read_text()
    data = json.loads(text)
    teams = data["teams"]
    # Rebuild in place so other collections keep their order; a new league goes last.
    at = next((i for i, t in enumerate(teams) if t["league"] == args.league), len(teams))
    merged = teams[:at] + entries + [t for t in teams[at:] if t["league"] != args.league]
    start = text.index('"teams": [')
    end = text.index("\n  ]", start)
    text = text[:start] + '"teams": [\n' + ",\n".join(fmt_entry(t) for t in merged) + text[end:]
    config = json.dumps(LEAGUES[args.league], separators=(", ", ": "), ensure_ascii=False)
    if args.league in data["leagues"]:
        text = re.sub(r'"' + args.league + r'":\s*\{[^}]*\}', lambda _: f'"{args.league}": {config}', text, count=1)
    else:
        text = text.replace('    "COL":', f'    "{args.league}": {config},\n    "COL":', 1)
    json.loads(text)
    if not args.dry_run:
        atomic_write_text(TEAMS_JSON, text)
    print(f"{len(entries)} {args.league} entries; all other leagues and saved-game configuration preserved")


if __name__ == "__main__":
    main()
