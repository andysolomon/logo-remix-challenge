#!/usr/bin/env python3
"""Merge the Cobb County high schools into src/lib/teams.json.

Reads ``public/logos/svg/hs-manifest.json`` (written by
``scripts/download_cobb_svgs.py``) and rewrites only the ``HS-*`` slice of the
``teams`` array plus the ``leagues.HS`` chip config. The NFL and college
entries -- and the text ``scripts/build_teams.py`` owns -- are left untouched,
so the two builders can run in either order.

Before writing, the complete manifest is checked against the pinned roster,
each palette's used source slots are checked against fully decoded artwork,
and every logo file is structurally validated.

Usage:
    python3 scripts/build_hs_teams.py [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from cobb_roster import SCHOOLS  # noqa: E402
from download_cobb_svgs import (  # noqa: E402
    CONFERENCE,
    SOURCE_KINDS,
    SOURCE_PALETTE_OVERRIDES,
    UNUSED_SOURCE_SLOTS,
    artwork_colors,
    is_valid_cobb_image,
)
from download_svgs import safe_slug  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "public" / "logos" / "svg" / "hs-manifest.json"
TEAMS_JSON = ROOT / "src" / "lib" / "teams.json"
LEAGUE_LABEL = "HIGH SCHOOL"
HEX_RE = re.compile(r"^#[0-9A-F]{6}$")
REQUIRED_FIELDS = {
    "id": str,
    "league": str,
    "conference": str,
    "region": str,
    "name": str,
    "abbr": str,
    "displayName": str,
    "sourceUrl": str,
    "sourceKind": str,
    "sourcePage": str,
    "path": str,
    "format": str,
    "colors": list,
    "brand": list,
    "palette": list,
    "sourcePalette": list,
    "unusedSourceSlots": list,
}


def atomic_write_text(path: Path, text: str) -> None:
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=path.suffix, dir=path.parent)
    tmp = Path(tmp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise


def validate_manifest() -> list[dict]:
    """Return roster-ordered rows, rejecting every incomplete or stale input."""
    try:
        payload = json.loads(MANIFEST.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot read {MANIFEST.name}: {exc}") from exc
    if not isinstance(payload, dict) or set(payload) != {"assets"} or not isinstance(payload["assets"], list):
        raise ValueError("manifest must be an object containing only an assets array")
    items = payload["assets"]
    roster = {school[0]: school for school in SCHOOLS}
    if len(items) != len(roster):
        raise ValueError(f"manifest has {len(items)} assets; expected {len(roster)}")

    seen_ids: set[str] = set()
    seen_abbrs: set[str] = set()
    seen_paths: set[str] = set()
    by_abbr: dict[str, dict] = {}
    for n, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValueError(f"asset {n} is not an object")
        for field, kind in REQUIRED_FIELDS.items():
            if field not in item or not isinstance(item[field], kind):
                raise ValueError(f"asset {n} has invalid or missing {field}")
        abbr = item["abbr"]
        if abbr not in roster:
            raise ValueError(f"unexpected school {abbr!r}")
        school = roster[abbr]
        expected_values = {
            "id": f"HS-{abbr}",
            "league": "HS",
            "conference": CONFERENCE,
            "region": school[1],
            "name": school[2],
            "displayName": f"{school[1]} {school[2]}".strip(),
            "sourceUrl": school[3],
            "sourceKind": school[4],
            "sourcePage": school[5],
        }
        for field, expected in expected_values.items():
            if item[field] != expected:
                raise ValueError(f"{abbr}: {field} does not match the roster")
        suffix = ".svg" if school[3].lower().split("?")[0].endswith(".svg") else ".png"
        expected_path = f"/logos/svg/high-school/{safe_slug(abbr)}{suffix}"
        if item["path"] != expected_path or item["format"] != suffix[1:]:
            raise ValueError(f"{abbr}: unexpected asset path or format")
        if item["sourceKind"] not in SOURCE_KINDS:
            raise ValueError(f"{abbr}: invalid sourceKind")
        if not item["sourceUrl"].startswith("https://") or not item["sourcePage"].startswith("https://"):
            raise ValueError(f"{abbr}: source URLs must use https")
        if item["id"] in seen_ids or abbr in seen_abbrs or item["path"] in seen_paths:
            raise ValueError(f"{abbr}: duplicate id, abbreviation, or path")
        seen_ids.add(item["id"])
        seen_abbrs.add(abbr)
        seen_paths.add(item["path"])

        palette = item["palette"]
        source_palette = item["sourcePalette"]
        unused = item["unusedSourceSlots"]
        if (len(palette) != 3 or any(not isinstance(v, str) or not HEX_RE.fullmatch(v) for v in palette)
                or len(set(palette)) != 3):
            raise ValueError(f"{abbr}: palette must contain three unique uppercase hex colors")
        if len(source_palette) != 3 or any(not isinstance(v, str) or not HEX_RE.fullmatch(v) for v in source_palette):
            raise ValueError(f"{abbr}: sourcePalette must contain three uppercase hex colors")
        if (not item["colors"] or len(item["colors"]) > 8
                or any(not isinstance(v, str) or not HEX_RE.fullmatch(v) for v in item["colors"])):
            raise ValueError(f"{abbr}: colors must contain 1-8 uppercase artwork hex colors")
        if len(item["brand"]) != 2 or any(not isinstance(v, str) or not HEX_RE.fullmatch(v) for v in item["brand"]):
            raise ValueError(f"{abbr}: brand must contain two uppercase hex colors")
        if unused != UNUSED_SOURCE_SLOTS.get(abbr, []):
            raise ValueError(f"{abbr}: unusedSourceSlots does not match known artwork coverage")
        if any(type(slot) is not int or slot not in range(3) for slot in unused) or len(set(unused)) != len(unused):
            raise ValueError(f"{abbr}: invalid unusedSourceSlots")
        expected_source = list(palette)
        for slot, color in SOURCE_PALETTE_OVERRIDES.get(abbr, {}).items():
            expected_source[slot] = color
        if source_palette != expected_source:
            raise ValueError(f"{abbr}: sourcePalette does not match its game palette/override")

        asset = ROOT / "public" / item["path"].lstrip("/")
        try:
            raw = asset.read_bytes()
        except OSError as exc:
            raise ValueError(f"{abbr}: logo file missing: {exc}") from exc
        if not is_valid_cobb_image(raw, asset):
            raise ValueError(f"{abbr}: logo file is malformed")
        try:
            artwork, _ = artwork_colors(asset)
        except (OSError, ValueError) as exc:
            raise ValueError(f"{abbr}: cannot inspect artwork colors: {exc}") from exc
        for slot, source in enumerate(source_palette):
            if slot in unused:
                continue
            if source not in artwork:
                raise ValueError(f"{abbr}: used source slot {slot} ({source}) is absent from artwork")
        by_abbr[abbr] = item

    if set(by_abbr) != set(roster):
        missing = sorted(set(roster) - set(by_abbr))
        raise ValueError(f"manifest roster mismatch; missing {', '.join(missing)}")
    return [by_abbr[school[0]] for school in SCHOOLS]


def hs_entry(item: dict) -> dict:
    entry = {
        "id": item["id"],
        "league": "HS",
        "conference": item["conference"],
        "region": item["region"],
        "name": item["name"],
        "abbr": item["abbr"],
        "palette": item["palette"],
        "logo": item["path"],
    }
    if item["sourcePalette"] != item["palette"]:
        entry["sourcePalette"] = item["sourcePalette"]
    if item["unusedSourceSlots"]:
        entry["unusedSourceSlots"] = item["unusedSourceSlots"]
    return entry


def fmt_entry(e: dict) -> str:
    """One team per line, matching the existing hand-written style."""
    return "    " + json.dumps(e, ensure_ascii=False, separators=(", ", ": "))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="print the resulting team count and changes only")
    args = parser.parse_args()

    try:
        items = validate_manifest()
    except ValueError as exc:
        print(f"error: {exc}; run scripts/download_cobb_svgs.py", file=sys.stderr)
        return 1

    teams = sorted((hs_entry(i) for i in items), key=lambda t: (t["conference"], t["region"], t["name"]))
    ids = [t["id"] for t in teams]
    dupes = sorted({x for x in ids if ids.count(x) > 1})
    if dupes:
        print(f"error: duplicate team ids {dupes}", file=sys.stderr)
        return 1
    conferences = sorted({t["conference"] for t in teams})

    data = json.loads(TEAMS_JSON.read_text())
    existing = data["teams"]
    others = [t for t in existing if t["league"] != "HS"]
    before = {t["id"] for t in existing}
    added = [t["id"] for t in teams if t["id"] not in before]
    print(f"{len(others)} NFL/college entries kept + {len(teams)} high-school teams "
          f"({len(added)} new), conferences: {', '.join(conferences)}")
    if args.dry_run:
        return 0

    text = TEAMS_JSON.read_text()
    # League chip config: replace the HS line, or insert it after COL.
    hs_line = f'"HS": {{ "label": {json.dumps(LEAGUE_LABEL)}, "conferences": {json.dumps(conferences)} }}'
    if re.search(r'"HS": \{ "label":[^}]*\}', text):
        text = re.sub(r'"HS": \{ "label":[^}]*\}', hs_line, text)
    else:
        text = re.sub(
            r'("COL": \{ "label": "COLLEGE", "conferences": \[[^\]]*\] \})\n',
            lambda m: m.group(1) + ",\n    " + hs_line + "\n",
            text,
        )
    # Rewrite the "teams" array by hand to keep one-entry-per-line formatting;
    # existing non-HS lines pass through verbatim.
    start = text.index('"teams": [')
    end = text.index("\n  ]", start)
    kept = [ln for ln in text[start + len('"teams": ['):end].split("\n") if ln.strip() and '"league": "HS"' not in ln]
    kept[-1] = kept[-1].rstrip().rstrip(",")
    body = "\n".join(kept) + ",\n" + ",\n".join(fmt_entry(t) for t in teams)
    text = text[:start] + '"teams": [\n' + body + text[end:]
    json.loads(text)  # sanity before replacing the last known-good file
    atomic_write_text(TEAMS_JSON, text)
    print(f"wrote {TEAMS_JSON.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
