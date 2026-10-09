#!/usr/bin/env python3
"""Download the pinned, name-free fast-food or brand artwork and record its metadata.

Usage: python3 scripts/download_brand_logos.py --league FOOD|BRAND [--force] [--cache-dir DIR]
Then run build_brand_teams.py with the same --league argument.

brand_artwork_sources.json pins every variant: its source URL, the SHA-256 of the
source file and the reviewed brand_vector.py edits that strip a wordmark or page
background and crop the symbol. Checked-in assets whose checksum matches the
manifest are reused unless --force is given; --cache-dir keeps verified source files
(named by checksum) so an interrupted or rate-limited refresh can resume. The whole
collection validates before any asset or the manifest is replaced; assets no longer
referenced are removed.
"""
import argparse
import hashlib
import json
import re
from xml.etree import ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from brand_rosters import ROSTERS, SLUGS
from brand_vector import fetch_source, import_brand_vector
from build_teams import MATCH_TOLERANCE_SQ, atomic_write_text, dist_sq, nearest
from download_hbcu_svgs import to_hex
from download_nba_svgs import artwork_colors
from nfl_vector_artwork import validate_vector

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "scripts/brand_artwork_sources.json"
SOURCE_KEYS = ("sourceUrl", "sourceSha256", "downloadForm", "ops")
MAX_BYTES = 400_000
WHITE = "#FFFFFF"
DISTINCT = 40 * 40


def brand_colors(raw: bytes) -> list[str]:
    """Shape fills plus gradient stops: many app tiles are pure gradients, and the game recolors stops too."""
    colors = artwork_colors(raw)
    for node in ET.fromstring(raw).iter():
        if node.tag.rsplit("}", 1)[-1] == "stop":
            style = dict(re.findall(r"([\w-]+)\s*:\s*([^;]+)", node.get("style", "")))
            color = to_hex(style.get("stop-color", node.get("stop-color", "#000000")).strip())
            if color and color.upper() not in colors:
                colors.append(color.upper())
    if not colors:
        raise ValueError("logo has no readable artwork colors")
    return colors


def artwork_palette(colors: list[str], primary: str, secondary: str) -> tuple[list[str], list[int]]:
    """Map artwork fills onto the [primary, secondary, light] roles; roles the art lacks are unused.

    Symbol-only marks often lack a brand color, so the roles fall back to the art's own
    non-white fills, and never repeat one color in two roles.
    """
    ink = [c for c in colors if dist_sq(c, WHITE) > DISTINCT]
    first = nearest("#" + primary, ink) or (ink[0] if ink else "#000000")
    rest = [c for c in ink if dist_sq(c, first) > DISTINCT]
    second = nearest("#" + secondary, rest) or (rest[0] if rest else next(
        c for c in ("#" + secondary, "#000000", "#808080") if min(dist_sq(c, first), dist_sq(c, WHITE)) > MATCH_TOLERANCE_SQ))
    palette = [first, second, WHITE]
    # Gradient tiles: center a role between its nearby shades when every shade stays within
    # matching range, so both ends of a two-stop gradient follow the remix.
    for slot in (0, 1):
        group = [c for c in ink if dist_sq(c, palette[slot]) <= 4 * MATCH_TOLERANCE_SQ
                 and min(range(3), key=lambda s: dist_sq(c, palette[s])) == slot]
        if len(group) > 1:
            center = "#" + "".join(f"{round(sum(int(c[i:i + 2], 16) for c in group) / len(group)):02X}" for i in (1, 3, 5))
            if all(dist_sq(c, center) <= MATCH_TOLERANCE_SQ for c in group):
                palette[slot] = center
    unused = [slot for slot, color in enumerate(palette) if not any(dist_sq(color, c) <= MATCH_TOLERANCE_SQ for c in colors)]
    return palette, unused


def artwork_path(league: str, abbr: str, variant: str) -> str:
    name = abbr.lower() if variant == "primary" else f"alternates/{abbr.lower()}-{variant}"
    return f"/logos/svg/{SLUGS[league]}/{name}.svg"


def manifest_path(league: str) -> Path:
    return ROOT / f"public/logos/svg/{SLUGS[league]}-manifest.json"


def pinned_sources(league: str) -> list[dict]:
    """Every roster member needs one primary; variant ids must be unique, stable slugs."""
    ids = {f"{league}-{row[0]}" for row in ROSTERS[league]}
    sources = [s for s in json.loads(SOURCES.read_text()) if s["teamId"].split("-", 1)[0] == league]
    if {s["teamId"] for s in sources} != ids:
        raise ValueError(f"{league} artwork sources must cover exactly the {len(ids)}-entry roster")
    for team in ids:
        variants = [s["id"] for s in sources if s["teamId"] == team]
        if variants.count("primary") != 1 or len(set(variants)) != len(variants):
            raise ValueError(f"{team}: needs one primary and unique alternate ids")
    for source in sources:
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", source["id"]) or not source.get("label"):
            raise ValueError(f"{source['teamId']}: invalid variant id or missing label")
        if not source["sourceUrl"].startswith("https://") or not re.fullmatch(r"[0-9a-f]{64}", source.get("sourceSha256", "")):
            raise ValueError(f"{source['teamId']}/{source['id']}: pin an https source and its SHA-256")
    return sources


def source_bytes(source: dict, cache_dir: Path | None) -> bytes:
    hit = cache_dir / f"{source['sourceSha256']}.src" if cache_dir else None
    if hit and hit.is_file() and hashlib.sha256(hit.read_bytes()).hexdigest() == source["sourceSha256"]:
        return hit.read_bytes()
    raw = fetch_source(source)
    if hit:
        hit.parent.mkdir(parents=True, exist_ok=True)
        hit.write_bytes(raw)
    return raw


def refresh(league: str, force: bool = False, cache_dir: Path | None = None) -> None:
    roster = {row[0]: row for row in ROSTERS[league]}
    sources = pinned_sources(league)
    manifest = manifest_path(league)
    cached = {}
    if manifest.is_file():
        for team in json.loads(manifest.read_text())["assets"]:
            for art in team.get("artwork", []):
                cached[(team["id"], art["id"])] = art

    def download(source):
        abbr = source["teamId"].split("-", 1)[1]
        _, _, _, primary, secondary, _ = roster[abbr]
        path = artwork_path(league, abbr, source["id"])
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
        palette, unused = artwork_palette(colors, primary, secondary)
        print(f"{source['teamId']}: {source['id']} ({len(raw)} bytes)", flush=True)
        return {**source, "path": path, "format": "svg", "colors": colors, "sourcePalette": palette,
                "unusedSourceSlots": unused, "sha256": hashlib.sha256(raw).hexdigest()}, raw

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(download, sources))
    assets = []
    for abbr, name, category, primary, secondary, aliases in sorted(roster.values()):
        team_id = f"{league}-{abbr}"
        artwork = [item for item, _ in results if item["teamId"] == team_id]
        artwork.sort(key=lambda item: item["id"] != "primary")
        assets.append({"id": team_id, "league": league, "conference": category, "region": name, "name": "",
                       "abbr": abbr, "aliases": aliases, "palette": [f"#{primary}", f"#{secondary}", "#FFFFFF"],
                       "artwork": [{k: v for k, v in item.items() if k != "teamId"} for item in artwork]})
    # Everything validated: replace assets, then drop artwork the manifest no longer references.
    folder = ROOT / "public/logos/svg" / SLUGS[league]
    keep = set()
    for item, raw in results:
        dest = ROOT / "public" / item["path"].lstrip("/")
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not dest.is_file() or dest.read_bytes() != raw:
            dest.write_bytes(raw)
        keep.add(dest)
    for stale in [*folder.glob("*.*"), *folder.glob("alternates/*.*")]:
        if stale.suffix in (".svg", ".png") and stale not in keep:
            stale.unlink()
    atomic_write_text(manifest, json.dumps({"assets": assets}, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--league", choices=sorted(ROSTERS), required=True)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--cache-dir", type=Path, help="optional cache of verified source files")
    args = parser.parse_args()
    refresh(args.league, args.force, args.cache_dir)
