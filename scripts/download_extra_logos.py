#!/usr/bin/env python3
"""Download MLB or fast-food logos locally and record source/palette metadata.

Usage: python3 scripts/download_extra_logos.py --league MLB|FOOD [--force]
Then run build_extra_teams.py with the same --league argument.
"""
import argparse
import io
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote
from xml.etree import ElementTree as ET

from build_teams import atomic_write_text, dist_sq, nearest
from download_nba_svgs import artwork_colors
from download_svgs import fetch, fetch_json, wikitext, logo_from_wikitext, file_url
from extra_rosters import MLB, FOOD, FOOD_SOURCE_OVERRIDES

ET.register_namespace("", "http://www.w3.org/2000/svg")
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")

ROOT = Path(__file__).resolve().parent.parent
MLB_API = "https://statsapi.mlb.com/api/v1/teams?sportId=1&activeStatus=Yes&season=2026"


def inspect_artwork(data: bytes, format: str) -> list[str]:
    if format == "svg":
        root = ET.fromstring(data)
        if root.tag != "{http://www.w3.org/2000/svg}svg":
            raise ValueError("not an SVG")
        if not any(n.tag.rsplit("}", 1)[-1] in {"path", "polygon", "rect", "circle", "ellipse", "use"} for n in root.iter()):
            raise ValueError("empty SVG")
        colors = artwork_colors(data)
    else:
        from PIL import Image
        image = Image.open(io.BytesIO(data)).convert("RGBA")
        image.load()
        counts = {}
        for r, g, b, a in image.get_flattened_data():
            if a >= 240:
                color = f"#{r:02X}{g:02X}{b:02X}"
                counts[color] = counts.get(color, 0) + 1
        colors = sorted(counts, key=counts.get, reverse=True)[:100]
    if not colors:
        raise ValueError("logo has no readable artwork colors")
    return colors


def palette_for(colors: list[str], primary: str, secondary: str) -> tuple[list[str], list[int]]:
    primary = nearest("#" + primary, colors) or colors[0]
    secondary_brand = "#" + secondary
    other = [c for c in colors if dist_sq(c, primary) > 40 * 40 and dist_sq(c, "#FFFFFF") > 40 * 40]
    secondary = nearest(secondary_brand, other) or (other[0] if other else secondary_brand)
    if secondary == primary or secondary == "#FFFFFF":
        secondary = "#000000" if primary != "#000000" else "#808080"
    palette = [primary, secondary, "#FFFFFF"]
    unused = [slot for slot, color in enumerate(palette) if not any(dist_sq(color, c) <= 90 * 90 for c in colors)]
    return palette, unused


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--league", choices=["MLB", "FOOD"], required=True)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--cache-dir", type=Path, help="optional staging cache for resuming interrupted downloads")
    args = parser.parse_args()
    slug = "mlb" if args.league == "MLB" else "fast-food"
    manifest = ROOT / f"public/logos/svg/{slug}-manifest.json"
    cached = {item["abbr"]: item for item in json.loads(manifest.read_text())["assets"]} if manifest.is_file() else {}
    if args.league == "MLB":
        teams = fetch_json(MLB_API)["teams"]
        if len(teams) != 30 or {t["id"] for t in teams} != {row[0] for row in MLB.values()}:
            raise ValueError("MLB roster differs from the pinned 30 teams; review extra_rosters.py")
        by_id = {t["id"]: t for t in teams}
        rows = []
        for abbr, (mlb_id, conference, primary, secondary, aliases) in MLB.items():
            team = by_id[mlb_id]
            if team["league"]["name"] != conference:
                raise ValueError(f"conference changed for {abbr}")
            name = team["teamName"]
            region = team["name"].removesuffix(" " + name) if abbr != "ATH" else ""
            if abbr == "AZ":
                region, name = "Arizona", "Diamondbacks"
            rows.append((abbr, region, name, conference, primary, secondary, aliases, f"https://www.mlbstatic.com/team-logos/{mlb_id}.svg", MLB_API))
    else:
        rows = [(abbr, name, "", category, primary, secondary, aliases, article, "https://en.wikipedia.org/wiki/" + quote(article.replace(" ", "_")))
                for abbr, name, article, category, primary, secondary, aliases in FOOD]

    def download(row):
        abbr, region, name, conference, primary, secondary, aliases, source, page = row
        old = cached.get(abbr)
        if old and not args.force and (ROOT / "public" / old["path"].lstrip("/")).is_file():
            return {**old, "region": region, "name": name, "conference": conference, "aliases": aliases}, None
        stage = args.cache_dir / slug / abbr if args.cache_dir else None
        if stage and not args.force and stage.with_suffix(".json").is_file() and stage.with_suffix(".asset").is_file():
            old = json.loads(stage.with_suffix(".json").read_text())
            return {**old, "region": region, "name": name, "conference": conference, "aliases": aliases}, stage.with_suffix(".asset").read_bytes()
        if args.league == "FOOD" and abbr in FOOD_SOURCE_OVERRIDES:
            source, format, page = FOOD_SOURCE_OVERRIDES[abbr]
        elif args.league == "FOOD":
            article = wikitext(source)
            filename = logo_from_wikitext(article[1]) if article else None
            if not filename:
                raise ValueError(f"no infobox logo for {source}")
            source = file_url(filename)
            if not source:
                raise ValueError(f"no image URL for {filename}")
            format = "svg" if filename.lower().endswith(".svg") else "png"
        else:
            format = "svg"
        data = fetch(source)
        if format == "svg":
            # Legacy Wikipedia SVGs sometimes declare only width/height.
            root = ET.fromstring(data)
            if not root.get("viewBox"):
                width, height = root.get("width", ""), root.get("height", "")
                if width.isdigit() and height.isdigit():
                    root.set("viewBox", f"0 0 {width} {height}")
                    data = ET.tostring(root, encoding="utf-8", xml_declaration=True)
            data = ("\n".join(line.rstrip() for line in data.decode("utf-8").splitlines()) + "\n").encode()
        colors = inspect_artwork(data, format)
        palette, unused = palette_for(colors, primary, secondary)
        path = f"/logos/svg/{slug}/{abbr.lower()}.{format}"
        item = {"id": f"{args.league}-{abbr}", "league": args.league, "conference": conference,
                "region": region, "name": name, "abbr": abbr, "aliases": aliases,
                "path": path, "format": format, "sourceUrl": source, "sourcePage": page,
                "colors": colors, "palette": palette, "unusedSourceSlots": unused}
        if stage:
            stage.parent.mkdir(parents=True, exist_ok=True)
            stage.with_suffix(".asset").write_bytes(data)
            stage.with_suffix(".json").write_text(json.dumps(item))
        print(f"{args.league}-{abbr}: {region} {name} ({format})", flush=True)
        return item, data

    failures = []
    def attempt(row):
        try:
            return download(row)
        except Exception as exc:
            failures.append(f"{row[0]}: {exc}")
            print(f"error: {failures[-1]}", flush=True)
            return None
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(attempt, sorted(rows)))
    if failures:
        raise ValueError("incomplete roster: " + "; ".join(failures))
    # Fetch/validate the complete roster before replacing any checked-in files.
    for item, data in results:
        if data is not None:
            dest = ROOT / "public" / item["path"].lstrip("/")
            dest.parent.mkdir(parents=True, exist_ok=True)
            if item["format"] == "svg":
                atomic_write_text(dest, data.decode())
            else:
                dest.write_bytes(data)
    atomic_write_text(manifest, json.dumps({"assets": [i for i, _ in results]}, indent=2) + "\n")


if __name__ == "__main__":
    main()
