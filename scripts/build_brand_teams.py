#!/usr/bin/env python3
"""Validate and rebuild only the fast-food or brand entries; preserve all other data.

Usage: python3 scripts/build_brand_teams.py --league FOOD|BRAND [--dry-run]
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

from brand_rosters import LEAGUES, ROSTERS
from build_teams import atomic_write_text, fmt_entry
from download_brand_logos import artwork_path, manifest_path
from download_extra_logos import inspect_artwork
from nfl_vector_artwork import validate_vector

ROOT = Path(__file__).resolve().parent.parent
TEAMS_JSON = ROOT / "src/lib/teams.json"
HEX = re.compile(r"#[0-9A-F]{6}")


def build_entry(league: str, item: dict, row: tuple) -> dict:
    abbr, name, category, primary, secondary, aliases = row
    palette = [f"#{primary}", f"#{secondary}", "#FFFFFF"]
    expected = {"id": f"{league}-{abbr}", "league": league, "conference": category, "region": name,
                "name": "", "abbr": abbr, "aliases": aliases, "palette": palette}
    if any(item.get(k) != v for k, v in expected.items()) or category not in LEAGUES[league]["conferences"]:
        raise ValueError(f"stale roster data for {abbr}; re-run download_brand_logos.py")
    artwork = item["artwork"]
    ids = [art["id"] for art in artwork]
    if not ids or ids[0] != "primary" or len(set(ids)) != len(ids):
        raise ValueError(f"{abbr}: primary artwork first, then unique alternates")
    for art in artwork:
        if art["path"] != artwork_path(league, abbr, art["id"]) or art["format"] != "svg":
            raise ValueError(f"{abbr}: invalid artwork path for {art['id']}")
        raw = (ROOT / "public" / art["path"].lstrip("/")).read_bytes()
        validate_vector(raw)
        if hashlib.sha256(raw).hexdigest() != art["sha256"] or inspect_artwork(raw, "svg") != art["colors"]:
            raise ValueError(f"stale artwork metadata for {abbr}/{art['id']}")
        source = art["sourcePalette"]
        if len(source) != 3 or any(not HEX.fullmatch(c) for c in source):
            raise ValueError(f"invalid source palette for {abbr}/{art['id']}")
    entry = {k: expected[k] for k in ("id", "league", "conference", "region", "name", "abbr", "palette")}
    main = artwork[0]
    if main["sourcePalette"] != palette:
        entry["sourcePalette"] = main["sourcePalette"]
    entry["logo"] = main["path"]
    if aliases:
        entry["aliases"] = aliases
    if main["unusedSourceSlots"]:
        entry["unusedSourceSlots"] = main["unusedSourceSlots"]
    if len(artwork) > 1:
        entry["alternateLogos"] = [
            {"id": art["id"], "label": art["label"], "logo": art["path"],
             "sourcePalette": art["sourcePalette"], "unusedSourceSlots": art["unusedSourceSlots"]}
            for art in artwork[1:]
        ]
    return entry


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--league", choices=sorted(ROSTERS), required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    league = args.league
    roster = {row[0]: row for row in ROSTERS[league]}
    items = json.loads(manifest_path(league).read_text())["assets"]
    if len(items) != len(roster) or {i["abbr"] for i in items} != set(roster):
        raise ValueError(f"{league} manifest must contain exactly {len(roster)} entries")
    entries = [build_entry(league, item, roster[item["abbr"]]) for item in items]

    text = TEAMS_JSON.read_text()
    data = json.loads(text)
    teams = data["teams"]
    # Replace the collection where it already sits so rebuild order never reshuffles the file.
    at = next((i for i, t in enumerate(teams) if t["league"] == league), len(teams))
    merged = teams[:at] + entries + [t for t in teams[at:] if t["league"] != league]
    start = text.index('"teams": [')
    end = text.index("\n  ]", start)
    text = text[:start] + '"teams": [\n' + ",\n".join(fmt_entry(t) for t in merged) + text[end:]
    config = json.dumps(LEAGUES[league], separators=(", ", ": "), ensure_ascii=False)
    if league in data["leagues"]:
        text = re.sub(r'"' + league + r'":\s*\{[^}]*\}', lambda _: f'"{league}": {config}', text, count=1)
    else:
        marker = text.index("\n  },", text.index('"leagues"'))
        text = text[:marker] + f',\n    "{league}": {config}' + text[marker:]
    json.loads(text)
    if not args.dry_run:
        atomic_write_text(TEAMS_JSON, text)
    print(f"{len(entries)} {league} entries; all other leagues and saved-game configuration preserved")


if __name__ == "__main__":
    main()
