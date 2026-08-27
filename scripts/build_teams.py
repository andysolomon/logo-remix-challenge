#!/usr/bin/env python3
"""Merge college teams from public/logos/svg/manifest.json into src/lib/teams.json.

Run after ``scripts/download_svgs.py``. Idempotent: every ``COL-*`` *team*
entry is regenerated from the manifest; the hand-tuned conference logo
entries (``COL-ACC`` etc.) and all NFL entries are left untouched. New
conference logos in the manifest (e.g. Ivy) are added if missing, and the
``leagues.COL.conferences`` chip list is updated to the manifest's order.

Palette per team is ``[primary, secondary, light]``:
  * primary   ESPN ``color``, snapped to the nearest fill in the SVG
  * secondary ESPN ``alternateColor`` unless it is white or ~primary, in
              which case the most-used SVG fill that is neither; falls back
              to black (which is also what fill-less SVG shapes render as)
  * light     white
Primary and secondary are snapped to the SVG's actual fills, so the runtime
recolor in Logo.tsx matches exactly without a separate ``sourcePalette``.

Usage:
    python3 scripts/build_teams.py [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "public" / "logos" / "svg" / "manifest.json"
TEAMS_JSON = ROOT / "src" / "lib" / "teams.json"
CONFERENCE_ORDER = ["ACC", "Big 12", "Big Ten", "Pac-12", "SEC", "Ivy", "HBCU"]
# Conference ids already used by teams.json for the original five.
CONFERENCE_IDS = {"ACC": "COL-ACC", "Big 12": "COL-B12", "Big Ten": "COL-B1G", "Pac-12": "COL-P12", "SEC": "COL-SEC", "Ivy": "COL-IVY"}

MATCH_TOLERANCE_SQ = 90 * 90
# Tighter distance for deciding two *brand* colors are the same color.
SAME_COLOR_SQ = 40 * 40
WHITE, BLACK = "#FFFFFF", "#000000"
SHAPE_NO_FILL_RE = re.compile(r"<(?:path|polygon|rect|circle|ellipse|polyline)\b(?![^>]*\bfill\b)[^>]*>", re.I)
ROOT_FILL_RE = re.compile(r"<svg\b[^>]*\bfill\s*=", re.I)


def rgb(h: str) -> tuple[int, int, int]:
    return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)


def dist_sq(a: str, b: str) -> int:
    return sum((x - y) ** 2 for x, y in zip(rgb(a), rgb(b)))


def near(a: str, b: str) -> bool:
    return dist_sq(a, b) <= MATCH_TOLERANCE_SQ


def same(a: str, b: str) -> bool:
    return dist_sq(a, b) <= SAME_COLOR_SQ


def nearest(hex_: str, fills: list[str]) -> str | None:
    best, best_d = None, MATCH_TOLERANCE_SQ
    for f in fills:
        d = dist_sq(hex_, f)
        if d <= best_d:
            best, best_d = f, d
    return best


def espn_hex(v: str | None, default: str) -> str:
    return f"#{v.upper()}" if v and re.fullmatch(r"[0-9a-fA-F]{6}", v) else default


def svg_fills(item: dict) -> list[str]:
    """Manifest fills (most-used first) plus black when fill-less shapes exist."""
    fills = [f.upper() for f in item.get("fills", []) if f.startswith("#")]
    path = ROOT / "public" / item["path"].lstrip("/")
    if item.get("format") == "svg" and path.is_file():
        text = path.read_text(errors="replace")
        if SHAPE_NO_FILL_RE.search(text) and not ROOT_FILL_RE.search(text) and BLACK not in fills:
            fills.append(BLACK)
    return fills


def build_palette(item: dict) -> tuple[list[str], list[str] | None]:
    fills = svg_fills(item)
    primary = espn_hex(item.get("color"), BLACK)
    alt = espn_hex(item.get("alternateColor"), WHITE)

    if same(alt, WHITE) or same(alt, primary):
        # Pick the dominant SVG fill that is neither the primary nor white.
        candidates = [f for f in fills if not same(f, primary) and not same(f, WHITE)]
        alt = candidates[0] if candidates else BLACK

    # Snap primary/secondary to the actual artwork so swatches and recolors
    # agree; no two slots may claim the same fill, and white is left alone
    # (the runtime tolerance already absorbs off-white fills).
    primary = nearest(primary, fills) or primary
    alt = nearest(alt, [f for f in fills if f != primary and not same(f, WHITE)]) or alt
    if same(alt, primary) or same(alt, WHITE):
        alt = BLACK if not same(primary, BLACK) else WHITE
    return [primary, alt, WHITE], None


def team_entry(item: dict) -> dict:
    palette, source = build_palette(item)
    entry = {
        "id": "COL-" + re.sub(r"[^A-Z0-9]", "", item["abbr"].upper()),
        "league": "COL",
        "conference": item["conference"],
        "region": item["region"],
        "name": item["name"],
        "abbr": item["abbr"],
        "palette": palette,
    }
    if source:
        entry["sourcePalette"] = source
    entry["logo"] = item["path"]
    return entry


def conference_entry(item: dict) -> dict:
    fills = svg_fills(item)
    primary = fills[0] if fills and not near(fills[0], WHITE) else (fills[1] if len(fills) > 1 else BLACK)
    others = [f for f in fills if not near(f, primary) and not near(f, WHITE)]
    return {
        "id": CONFERENCE_IDS.get(item["conference"], item["id"]),
        "league": "COL",
        "conference": item["conference"],
        "region": item["conference"],
        "name": "",
        "abbr": item["abbr"],
        "palette": [primary, others[0] if others else BLACK, WHITE],
        "logo": item["path"],
    }


def fmt_entry(e: dict) -> str:
    """One team per line, matching the existing hand-written style."""
    return "    " + json.dumps(e, ensure_ascii=False, separators=(", ", ": "))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="print the resulting team count and changes only")
    args = parser.parse_args()

    manifest = json.loads(MANIFEST.read_text())
    data = json.loads(TEAMS_JSON.read_text())
    existing = data["teams"]

    college_items = [i for i in manifest["items"] if i["league"] == "COL"]
    conf_items = {i["conference"]: i for i in college_items if not i.get("espnId")}
    team_items = [i for i in college_items if i.get("espnId")]
    missing = [i["abbr"] for i in team_items if not (ROOT / "public" / i["path"].lstrip("/")).is_file()]
    if missing:
        print(f"error: logo files missing for {', '.join(missing)}; run scripts/download_svgs.py", file=sys.stderr)
        return 1

    conferences = [c for c in CONFERENCE_ORDER if any(i["conference"] == c for i in college_items)]
    conf_order = {c: n for n, c in enumerate(conferences)}

    nfl = [t for t in existing if t["league"] == "PRO"]
    kept_confs = {t["conference"]: t for t in existing if t["league"] == "COL" and t["name"] == ""}
    for conf, item in conf_items.items():
        kept_confs.setdefault(conf, conference_entry(item))

    teams = sorted((team_entry(i) for i in team_items), key=lambda t: (conf_order[t["conference"]], t["region"], t["name"]))
    ids = [t["id"] for t in teams]
    dupes = sorted({x for x in ids if ids.count(x) > 1})
    if dupes:
        print(f"error: duplicate team ids {dupes}", file=sys.stderr)
        return 1

    college = [kept_confs[c] for c in conferences if c in kept_confs] + teams
    data["leagues"]["COL"]["conferences"] = conferences

    before = {t["id"] for t in existing}
    added = [t["id"] for t in college if t["id"] not in before]
    print(f"{len(nfl)} NFL + {len(college)} college entries ({len(teams)} teams, {len(college) - len(teams)} conference logos); "
          f"{len(added)} new, conferences: {', '.join(conferences)}")
    if args.dry_run:
        return 0

    # Rewrite the "teams" array by hand to keep one-entry-per-line formatting.
    text = TEAMS_JSON.read_text()
    start = text.index('"teams": [')
    end = text.index("\n  ]", start)
    body = ",\n".join(fmt_entry(t) for t in nfl + college)
    head = text[:start] + '"teams": [\n'
    text = head + body + text[end:]
    # Conference chip list.
    text = re.sub(
        r'("COL": \{ "label": "COLLEGE", "conferences": )\[[^\]]*\]',
        lambda m: m.group(1) + json.dumps(conferences),
        text,
    )
    TEAMS_JSON.write_text(text)
    json.loads(TEAMS_JSON.read_text())  # sanity: still valid JSON
    print(f"wrote {TEAMS_JSON.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
