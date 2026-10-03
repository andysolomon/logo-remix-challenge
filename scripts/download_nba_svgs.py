#!/usr/bin/env python3
"""Download all 30 official NBA SVGs and snapshot ESPN names/brand colors.

Usage: python3 scripts/download_nba_svgs.py [--force]
Follow with scripts/build_nba_teams.py. Runtime uses checked-in local assets.
"""

import argparse
import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from xml.etree import ElementTree as ET

from build_teams import atomic_write_text
from download_svgs import fetch, fetch_json
from nba_roster import ALIASES, ROSTER

ROOT = Path(__file__).resolve().parent.parent
ESPN_TEAMS = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=50"


def validate_svg(data: bytes) -> None:
    root = ET.fromstring(data)
    if root.tag != "{http://www.w3.org/2000/svg}svg" or not root.get("viewBox"):
        raise ValueError("expected an SVG with a viewBox")
    if not any(node.tag.endswith("}path") for node in root.iter()):
        raise ValueError("SVG has no artwork")


def artwork_colors(data: bytes) -> list[str]:
    """Resolve the presentation attributes and simple class rules in NBA SVGs.

    CSS declarations that no shape uses are excluded; named white and default
    black are included. This prevents inventing palette roles in one-color marks.
    """
    root = ET.fromstring(data)
    styles = {}
    for node in root.iter():
        if node.tag.endswith("}style"):
            for selector, body in re.findall(r"([^{}]+)\{([^{}]+)\}", node.text or ""):
                for cls in selector.split(","):
                    styles[cls.strip().lstrip(".")] = dict(re.findall(r"([\w-]+)\s*:\s*([^;]+)", body))
    colors = []

    def walk(node, inherited):
        paint = {**inherited, **{k: node.attrib[k] for k in ("fill", "stroke") if k in node.attrib}}
        for cls in node.get("class", "").split():
            paint.update(styles.get(cls, {}))
        paint.update(dict(re.findall(r"([\w-]+)\s*:\s*([^;]+)", node.get("style", ""))))
        if node.tag.rsplit("}", 1)[-1] in {"path", "polygon", "rect", "circle", "ellipse", "polyline", "line"}:
            for key in ("fill", "stroke"):
                color = paint.get(key, "none").strip().upper()
                color = {"WHITE": "#FFFFFF", "BLACK": "#000000"}.get(color, color)
                if re.fullmatch(r"#[0-9A-F]{3}", color):
                    color = "#" + "".join(c * 2 for c in color[1:])
                if re.fullmatch(r"#[0-9A-F]{6}", color) and color not in colors:
                    colors.append(color)
        for child in node:
            walk(child, paint)

    walk(root, {"fill": "#000000", "stroke": "none"})
    return colors


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    teams = [e["team"] for e in fetch_json(ESPN_TEAMS)["sports"][0]["leagues"][0]["teams"]]
    if len(teams) != 30 or {t["abbreviation"] for t in teams} != set(ROSTER):
        raise ValueError("ESPN roster differs from the pinned 30 NBA teams; review nba_roster.py")

    def download(t: dict) -> dict:
        abbr = t["abbreviation"]
        nba_id, conference = ROSTER[abbr]
        url = f"https://cdn.nba.com/logos/nba/{nba_id}/primary/L/logo.svg"
        path = f"/logos/svg/nba/{abbr.lower()}.svg"
        dest = ROOT / "public" / path.lstrip("/")
        artwork = dest.read_bytes() if dest.is_file() and not args.force else fetch(url)
        validate_svg(artwork)
        dest.parent.mkdir(parents=True, exist_ok=True)
        normalized = "\n".join(line.rstrip() for line in artwork.decode("utf-8").splitlines()) + "\n"
        atomic_write_text(dest, normalized)
        print(f"{abbr}: {t['displayName']}", flush=True)
        return {
            "id": f"NBA-{abbr}", "league": "NBA", "conference": conference,
            "region": t["location"], "name": t["name"], "abbr": abbr,
            "aliases": ALIASES.get(abbr, []), "nbaId": nba_id,
            "color": t["color"], "alternateColor": t["alternateColor"],
            "sourceUrl": url, "rosterSource": ESPN_TEAMS, "path": path,
            "format": "svg", "fills": artwork_colors(artwork),
        }

    with ThreadPoolExecutor(max_workers=6) as executor:
        items = list(executor.map(download, sorted(teams, key=lambda t: t["abbreviation"])))
    atomic_write_text(ROOT / "public/logos/svg/nba-manifest.json", json.dumps({"assets": items}, indent=2) + "\n")


if __name__ == "__main__":
    main()
