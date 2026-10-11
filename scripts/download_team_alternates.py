#!/usr/bin/env python3
"""Download the pinned NBA or college alternate marks and record their metadata.

Usage: python3 scripts/download_team_alternates.py --league NBA|COL [--force] [--cache-dir DIR]
Then run build_nba_teams.py (NBA) or build_teams.py (COL); both attach the alternates.

team_alternate_sources.json pins every alternate the way brand_artwork_sources.json pins
brand artwork: the source URL, the SHA-256 of the source file and the reviewed
brand_vector.py edits that remove a page background or crop the mark. Only real vector
outlines are accepted, so every alternate recolors like the primary. An alternate is
artwork only: the team's name, answers and donor palette never change. Checked-in assets
whose checksum matches the manifest are reused unless --force is given; --cache-dir keeps
verified source files for rate-limited refreshes. The whole league validates before any
asset or the manifest is replaced; alternates no longer pinned are removed.
"""
import argparse
import hashlib
import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from build_teams import atomic_write_text
from download_brand_logos import MAX_BYTES, artwork_palette, brand_colors, source_bytes
from brand_vector import import_brand_vector
from nfl_vector_artwork import validate_vector

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "scripts/team_alternate_sources.json"
TEAMS_JSON = ROOT / "src/lib/teams.json"
FOLDERS = {"NBA": "nba", "COL": "ncaa"}
SOURCE_KEYS = ("sourceUrl", "sourceSha256", "downloadForm", "ops")


def manifest_path(league: str) -> Path:
    return ROOT / f"public/logos/svg/{FOLDERS[league]}-alternates-manifest.json"


def artwork_path(league: str, team_id: str, variant: str) -> str:
    return f"/logos/svg/{FOLDERS[league]}/alternates/{team_id.split('-', 1)[1].lower()}-{variant}.svg"


def roster(league: str) -> dict:
    """The league's teams from teams.json; college conference marks take no alternates."""
    teams = json.loads(TEAMS_JSON.read_text())["teams"]
    return {t["id"]: t for t in teams if t["league"] == league and t["name"]}


def pinned_sources(league: str, teams: dict) -> list[dict]:
    sources = [s for s in json.loads(SOURCES.read_text()) if s["teamId"].split("-", 1)[0] == league]
    keys = [(s["teamId"], s["id"]) for s in sources]
    if len(set(keys)) != len(keys):
        raise ValueError(f"{league}: duplicate alternate ids")
    for source in sources:
        where = f"{source['teamId']}/{source['id']}"
        if source["teamId"] not in teams:
            raise ValueError(f"{where}: not a {league} team")
        if source["id"] == "primary" or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", source["id"]):
            raise ValueError(f"{where}: alternates need a stable lowercase slug other than 'primary'")
        if not source.get("label"):
            raise ValueError(f"{where}: missing label")
        if not source["sourceUrl"].startswith("https://") or not re.fullmatch(r"[0-9a-f]{64}", source.get("sourceSha256", "")):
            raise ValueError(f"{where}: pin an https source and its SHA-256")
    return sources


def refresh(league: str, force: bool = False, cache_dir: Path | None = None) -> None:
    teams = roster(league)
    sources = pinned_sources(league, teams)
    manifest = manifest_path(league)
    cached = {(a["teamId"], a["id"]): a for a in json.loads(manifest.read_text())["assets"]} if manifest.is_file() else {}

    def download(source):
        team = teams[source["teamId"]]
        path = artwork_path(league, team["id"], source["id"])
        target = ROOT / "public" / path.lstrip("/")
        previous = cached.get((source["teamId"], source["id"]))
        reuse = (not force and previous and previous["path"] == path and target.is_file()
                 and all(previous.get(k) == source.get(k) for k in SOURCE_KEYS))
        if reuse:
            raw = target.read_bytes()
            if hashlib.sha256(raw).hexdigest() != previous["sha256"]:
                raise ValueError(f"{path}: checked-in artwork differs from the manifest; review or refresh with --force")
        else:
            raw = import_brand_vector(source_bytes(source, cache_dir), source.get("ops", {}))
        validate_vector(raw)
        if len(raw) > MAX_BYTES:
            raise ValueError(f"{path}: {len(raw)} bytes; pick a lighter vector source")
        colors = brand_colors(raw)
        palette, unused = artwork_palette(colors, team["palette"][0].lstrip("#"), team["palette"][1].lstrip("#"))
        print(f"{source['teamId']}: {source['id']} ({len(raw)} bytes)", flush=True)
        return {**source, "path": path, "format": "svg", "colors": colors, "sourcePalette": palette,
                "unusedSourceSlots": unused, "sha256": hashlib.sha256(raw).hexdigest()}, raw

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(download, sources))
    # Everything validated: replace assets, then drop artwork the manifest no longer references.
    folder = ROOT / "public/logos/svg" / FOLDERS[league] / "alternates"
    keep = set()
    for item, raw in results:
        dest = ROOT / "public" / item["path"].lstrip("/")
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not dest.is_file() or dest.read_bytes() != raw:
            dest.write_bytes(raw)
        keep.add(dest)
    for stale in folder.glob("*.*") if folder.is_dir() else []:
        if stale.suffix in (".svg", ".png") and stale not in keep:
            stale.unlink()
    atomic_write_text(manifest, json.dumps({"assets": [item for item, _ in results]}, indent=2, ensure_ascii=False) + "\n")


def team_alternates(league: str, team_ids) -> dict[str, list[dict]]:
    """The teams.json ``alternateLogos`` of every team, checked against the manifest and artwork.

    Roster builders call this so a rebuild keeps the alternates; a manifest that names an
    unknown team or disagrees with its files stops the build instead of dropping artwork.
    """
    manifest = manifest_path(league)
    if not manifest.is_file():
        return {}
    alternates: dict[str, list[dict]] = {}
    for item in json.loads(manifest.read_text())["assets"]:
        where = f"{item['teamId']}/{item['id']}"
        if item["teamId"] not in team_ids:
            raise ValueError(f"{where}: alternate for a team that is not in the {league} roster")
        if item["path"] != artwork_path(league, item["teamId"], item["id"]) or item["format"] != "svg":
            raise ValueError(f"{where}: invalid artwork path")
        raw = (ROOT / "public" / item["path"].lstrip("/")).read_bytes()
        validate_vector(raw)
        if hashlib.sha256(raw).hexdigest() != item["sha256"] or brand_colors(raw) != item["colors"]:
            raise ValueError(f"{where}: stale artwork metadata; re-run download_team_alternates.py")
        alternates.setdefault(item["teamId"], []).append(
            {"id": item["id"], "label": item["label"], "logo": item["path"],
             "sourcePalette": item["sourcePalette"], "unusedSourceSlots": item["unusedSourceSlots"]})
    return alternates


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--league", choices=sorted(FOLDERS), required=True)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--cache-dir", type=Path, help="optional cache of verified source files")
    args = parser.parse_args()
    refresh(args.league, args.force, args.cache_dir)
