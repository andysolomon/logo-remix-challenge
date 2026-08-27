#!/usr/bin/env python3
"""Download SVG logos from Wikipedia for every team in Logo Remix Challenge.

Assets fetched:
  * 32 NFL teams                          -> public/logos/svg/nfl/<abbr>.svg
  * 6 college conference logos            -> public/logos/svg/conferences/<slug>.svg
    (ACC, Big 12, Big Ten, Pac-12, SEC, Ivy)
  * every football member of the 7       -> public/logos/svg/ncaa/<abbr>.svg
    "conferences" in CONFERENCES (the 6
    above plus HBCU: SWAC + MEAC + D-I
    HBCUs in other leagues) for the season
    (a .png is kept instead when Wikipedia
    has no SVG for that team, e.g. Arkansas)

How it works
  1. Conference rosters come from ESPN's standings API (``?group=<id>``),
     which is the only ESPN endpoint that honors the conference filter.
     Team ids, abbreviations, names and brand colors come from ESPN too.
  2. Each team's Wikipedia article (the athletics page, e.g. "Georgia
     Bulldogs", falling back to "<name> football" and finally a search)
     is fetched as wikitext and the infobox ``logo =`` field is parsed
     for a ``*.svg`` file name.
  3. The file's URL is resolved through the MediaWiki ``imageinfo`` API and
     downloaded. Wikimedia requires a descriptive User-Agent; see USER_AGENT.
  4. A manifest (``public/logos/svg/manifest.json``) records, per asset:
     id, league, conference, region, name, abbr, ESPN colors, the Wikipedia
     file it came from, the local path, and the distinct fill colors found
     in the SVG. That manifest is the input for mapping fills -> palette
     slots in ``src/lib/teams.json``.

Stdlib only. Safe to re-run: existing valid SVGs are skipped unless
``--force`` is given. Exits non-zero if any asset could not be resolved.

Usage:
    python3 scripts/download_svgs.py [--out public/logos/svg] [--season 2026] [--force]
    python3 scripts/download_svgs.py --only nfl,conferences   # subset

Note: most of these logos are trademarked and hosted on Wikipedia under
fair-use tags. Use them in the same spirit as the existing ESPN PNGs.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
USER_AGENT = "logo-remix-challenge/1.0 (https://github.com/andrewsolomon/arc-logo-remix; asset downloader)"

ESPN_NFL_TEAMS = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams?limit=50"
ESPN_CFB_STANDINGS = "https://site.api.espn.com/apis/v2/sports/football/college-football/standings?group={group}&season={season}"
ESPN_CFB_TEAM = "https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/{id}"
WIKI_API = "https://en.wikipedia.org/w/api.php"

ESPN_CFB_ALL_TEAMS = "https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams?limit=1000"

# slug -> conference definition:
#   groups  ESPN college-football group ids whose standings make up the roster
#   label   conference label used in teams.json
#   article Wikipedia article whose infobox logo is the conference logo
#           (None: no conference logo asset, e.g. HBCU is a grouping, not a league)
#   extra   additional ESPN displayNames to include beyond the groups' standings
CONFERENCES: dict[str, dict] = {
    "acc": {"groups": [1], "label": "ACC", "article": "Atlantic Coast Conference"},
    "big-12": {"groups": [4], "label": "Big 12", "article": "Big 12 Conference"},
    "big-ten": {"groups": [5], "label": "Big Ten", "article": "Big Ten Conference"},
    "pac-12": {"groups": [9], "label": "Pac-12", "article": "Pac-12 Conference"},
    "sec": {"groups": [8], "label": "SEC", "article": "Southeastern Conference"},
    "ivy": {"groups": [22], "label": "Ivy", "article": "Ivy League"},
    # Historically Black Colleges and Universities playing NCAA Division I
    # football: the SWAC (31) and MEAC (24) plus the D-I HBCUs that compete
    # in other conferences. ESPN does not carry Division II (CIAA/SIAC).
    "hbcu": {
        "groups": [31, 24],
        "label": "HBCU",
        "article": None,
        "extra": ["Tennessee State Tigers", "Hampton Pirates", "North Carolina A&T Aggies"],
    },
}

# ESPN abbreviation -> abbreviation used in src/lib/teams.json (and the file stem).
ABBR_OVERRIDES: dict[str, str] = {"WSH": "WAS"}

# Wikipedia article title overrides where "<displayName>" is not the athletics page.
WIKI_TITLE_OVERRIDES: dict[str, str] = {
    "Hawai'i Rainbow Warriors": "Hawaii Rainbow Warriors football",
}

# Explicit Wikipedia file picks, keyed by ESPN displayName, for teams whose
# infobox logo is a PNG or a wordmark while a proper SVG exists elsewhere.
WIKI_FILE_OVERRIDES: dict[str, str] = {
    "BYU Cougars": "BYU Cougars logo.svg",
    "Georgia Tech Yellow Jackets": "Georgia Tech Yellow Jackets logo.svg",
    "Purdue Boilermakers": "Purdue Boilermakers logo.svg",
    "Mississippi State Bulldogs": "Mississippi State University Bulldogs Logo Official.svg",
    # The "ATM" block mark; the athletics infobox only carries a PNG.
    "Texas A&M Aggies": "Texas A&M University logo.svg",
}

INFOBOX_LOGO_RE = re.compile(
    r"\|\s*(?:logo|image|logo_image|image_name)\s*=\s*(?:\[\[)?(?:File:|Image:)?\s*([^\|\]\n]*?\.(?:svg|png))",
    re.IGNORECASE,
)
HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
FILL_RE = re.compile(r"(?:fill|stroke)\s*[:=]\s*[\"']?\s*(#[0-9a-fA-F]{3,8}|rgb\([^)]*\)|[a-zA-Z]+)")
SVG_MAGIC_RE = re.compile(rb"<svg[\s>]", re.IGNORECASE)
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


# ---------------------------------------------------------------- HTTP helpers
def fetch(url: str, retries: int = 3) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    last: Exception | None = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            last = exc
            if exc.code == 429 or exc.code >= 500:
                time.sleep(1.5 * (attempt + 1))
                continue
            break
        except OSError as exc:
            last = exc
            time.sleep(1.0 * (attempt + 1))
    # curl handles some TLS/proxy quirks urllib does not
    try:
        return subprocess.run(
            ["curl", "-fsSL", "-A", USER_AGENT, "--max-time", "30", url],
            check=True,
            capture_output=True,
        ).stdout
    except Exception as exc:  # pragma: no cover - last resort
        raise last or exc


def fetch_json(url: str):
    return json.loads(fetch(url))


def wiki_api(**params) -> dict:
    params.setdefault("format", "json")
    params.setdefault("formatversion", "2")
    return fetch_json(f"{WIKI_API}?{urllib.parse.urlencode(params)}")


def is_svg(data: bytes) -> bool:
    return bool(SVG_MAGIC_RE.search(data[:4096]))


def is_valid_image(data: bytes, dest: Path) -> bool:
    return data.startswith(PNG_MAGIC) if dest.suffix == ".png" else is_svg(data)


def safe_slug(abbr: str) -> str:
    """Filesystem/URL-safe lowercase file stem (e.g. "TA&M" -> "tam")."""
    return re.sub(r"[^a-z0-9-]", "", abbr.lower())


def display_path(path: Path) -> str:
    resolved = path.resolve()
    try:
        return str(resolved.relative_to(ROOT))
    except ValueError:
        return str(resolved)


# ---------------------------------------------------------------- ESPN rosters
def nfl_teams() -> list[dict]:
    data = fetch_json(ESPN_NFL_TEAMS)
    out = []
    for entry in data["sports"][0]["leagues"][0]["teams"]:
        t = entry["team"]
        abbr = ABBR_OVERRIDES.get(t["abbreviation"].upper(), t["abbreviation"].upper())
        out.append(
            {
                "id": f"PRO-{abbr}",
                "league": "PRO",
                "conference": "",  # filled below from existing teams.json when present
                "region": t["location"],
                "name": t["name"],
                "abbr": abbr,
                "displayName": t["displayName"],
                "espnId": t["id"],
                "color": t.get("color"),
                "alternateColor": t.get("alternateColor"),
                "file": f"nfl/{safe_slug(abbr)}.svg",
            }
        )
    return out


_all_cfb_teams: dict[str, dict] | None = None


def cfb_team_by_name(display_name: str) -> dict | None:
    """Look a team up in ESPN's full college-football team list by displayName."""
    global _all_cfb_teams
    if _all_cfb_teams is None:
        data = fetch_json(ESPN_CFB_ALL_TEAMS)
        _all_cfb_teams = {e["team"]["displayName"]: e["team"] for e in data["sports"][0]["leagues"][0]["teams"]}
    return _all_cfb_teams.get(display_name)


def conference_roster(slug: str, season: int) -> list[dict]:
    conf = CONFERENCES[slug]
    label = conf["label"]

    def walk(node) -> list[dict]:
        if "standings" in node:
            return [e["team"] for e in node["standings"]["entries"]]
        return [t for child in node.get("children", []) for t in walk(child)]

    teams: list[dict] = []
    for group in conf["groups"]:
        teams.extend(walk(fetch_json(ESPN_CFB_STANDINGS.format(group=group, season=season))))
    for name in conf.get("extra", []):
        t = cfb_team_by_name(name)
        if t:
            teams.append(t)
        else:
            print(f"warning: {label}: extra team {name!r} not found in ESPN team list", file=sys.stderr)

    out = []
    for t in teams:
        abbr = t["abbreviation"].upper()
        out.append(
            {
                "id": f"COL-{abbr}",
                "league": "COL",
                "conference": label,
                "region": t.get("location", ""),
                "name": t.get("name", ""),
                "abbr": abbr,
                "displayName": t["displayName"],
                "espnId": t["id"],
                "color": None,
                "alternateColor": None,
                "file": f"ncaa/{safe_slug(abbr)}.svg",
            }
        )
    return out


def enrich_cfb_colors(team: dict) -> None:
    try:
        t = fetch_json(ESPN_CFB_TEAM.format(id=team["espnId"]))["team"]
        team["color"] = t.get("color")
        team["alternateColor"] = t.get("alternateColor")
        team["region"] = team["region"] or t.get("location", "")
        team["name"] = team["name"] or t.get("name", "")
    except Exception as exc:
        print(f"warning: colors for {team['displayName']}: {exc}", file=sys.stderr)


# ---------------------------------------------------------------- Wikipedia
def wikitext(title: str) -> tuple[str, str] | None:
    """Return (resolved_title, wikitext) or None if the page does not exist."""
    data = wiki_api(action="query", prop="revisions", rvprop="content", rvslots="main", redirects=1, titles=title)
    page = data["query"]["pages"][0]
    if page.get("missing"):
        return None
    return page["title"], page["revisions"][0]["slots"]["main"]["content"]


def logo_from_wikitext(text: str) -> str | None:
    """Infobox logo file name (SVG preferred, PNG as a fallback), or None."""
    # Only look at the leading infobox so we do not pick up gallery images.
    head = HTML_COMMENT_RE.sub("", text[:6000])
    names = [m.group(1).strip() for m in INFOBOX_LOGO_RE.finditer(head)]
    names = [n for n in names if n and not n.lower().startswith("flag of")]
    for n in names:
        if n.lower().endswith(".svg"):
            return n
    return names[0] if names else None


def find_logo_file(candidates: list[str]) -> tuple[str, str] | None:
    """Try each article title; return (article, File name) for the first with a logo.

    An SVG from any candidate article wins over a PNG from an earlier one.
    """
    tried: list[str] = []
    png: tuple[str, str] | None = None
    for title in candidates:
        if title in tried:
            continue
        tried.append(title)
        try:
            page = wikitext(title)
        except Exception as exc:
            print(f"warning: wikitext {title!r}: {exc}", file=sys.stderr)
            continue
        if not page:
            continue
        resolved, text = page
        logo = logo_from_wikitext(text)
        if logo and logo.lower().endswith(".svg"):
            return resolved, logo
        if logo and png is None:
            png = (resolved, logo)
    if png:
        return png
    # Last resort: search.
    try:
        hits = wiki_api(action="query", list="search", srsearch=f"{candidates[0]} logo", srlimit=3)["query"]["search"]
        for h in hits:
            page = wikitext(h["title"])
            if page:
                logo = logo_from_wikitext(page[1])
                if logo:
                    return page[0], logo
    except Exception as exc:
        print(f"warning: search {candidates[0]!r}: {exc}", file=sys.stderr)
    return None


def file_url(filename: str) -> str | None:
    data = wiki_api(action="query", prop="imageinfo", iiprop="url", titles=f"File:{filename}")
    page = data["query"]["pages"][0]
    info = page.get("imageinfo")
    return info[0]["url"] if info else None


# ---------------------------------------------------------------- SVG inspection
def svg_fills(data: bytes) -> list[str]:
    text = data.decode("utf-8", errors="replace")
    seen: dict[str, int] = {}
    for m in FILL_RE.finditer(text):
        v = m.group(1).lower()
        if v in ("none", "transparent", "currentcolor", "inherit"):
            continue
        if re.fullmatch(r"#[0-9a-f]{3}", v):
            v = "#" + "".join(ch * 2 for ch in v[1:])
        seen[v] = seen.get(v, 0) + 1
    return [k for k, _ in sorted(seen.items(), key=lambda kv: -kv[1])]


# ---------------------------------------------------------------- main
def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, default=ROOT / "public" / "logos" / "svg")
    parser.add_argument("--season", type=int, default=2026, help="college season used for conference rosters")
    parser.add_argument("--force", action="store_true", help="re-download even if a valid SVG exists")
    parser.add_argument("--only", default="nfl,conferences,ncaa", help="comma list of: nfl, conferences, ncaa")
    parser.add_argument("--delay", type=float, default=0.5, help="seconds between Wikipedia requests")
    args = parser.parse_args()
    only = {s.strip() for s in args.only.split(",") if s.strip()}

    # Existing NFL conference labels (AFC/NFC) from teams.json, if present.
    nfl_conf: dict[str, str] = {}
    teams_json = ROOT / "src" / "lib" / "teams.json"
    if teams_json.is_file():
        for t in json.loads(teams_json.read_text())["teams"]:
            if t["league"] == "PRO":
                nfl_conf[t["abbr"].upper()] = t["conference"]

    # ---- build the asset list
    assets: list[dict] = []
    if "nfl" in only:
        print("fetching NFL roster from ESPN")
        for t in nfl_teams():
            t["conference"] = nfl_conf.get(t["abbr"], "")
            t["wiki"] = [WIKI_TITLE_OVERRIDES.get(t["displayName"], t["displayName"])]
            assets.append(t)
    if "conferences" in only:
        for slug, conf in CONFERENCES.items():
            label, article = conf["label"], conf["article"]
            if not article:
                print(f"note: {label} has no conference logo (grouping, not a league); skipping conferences/{slug}.svg")
                continue
            assets.append(
                {
                    "id": f"COL-{slug.upper().replace('-', '')}",
                    "league": "COL",
                    "conference": label,
                    "region": label,
                    "name": "",
                    "abbr": label.upper().replace(" ", ""),
                    "displayName": article,
                    "espnId": None,
                    "color": None,
                    "alternateColor": None,
                    "file": f"conferences/{slug}.svg",
                    "wiki": [article],
                }
            )
    if "ncaa" in only:
        seen_abbr: set[str] = set()
        for slug in CONFERENCES:
            print(f"fetching {CONFERENCES[slug]['label']} roster ({args.season}) from ESPN")
            for t in conference_roster(slug, args.season):
                if t["abbr"] in seen_abbr:
                    continue
                seen_abbr.add(t["abbr"])
                dn = t["displayName"]
                t["wiki"] = [WIKI_TITLE_OVERRIDES.get(dn, dn), f"{dn} football", f"{t['region']} {t['name']}".strip()]
                assets.append(t)

    # ---- resolve + download
    args.out.mkdir(parents=True, exist_ok=True)
    counts = {"downloaded": 0, "skipped": 0}
    failures: list[str] = []
    manifest_items: list[dict] = []

    for a in assets:
        dest = args.out / a["file"]
        dest.parent.mkdir(parents=True, exist_ok=True)
        item = {k: v for k, v in a.items() if k != "wiki"}
        item["path"] = "/logos/svg/" + a["file"]

        existing = next((p for p in (dest, dest.with_suffix(".png")) if p.is_file() and is_valid_image(p.read_bytes(), p)), None)
        if not args.force and existing:
            counts["skipped"] += 1
            print(f"{'skipped':10s} {display_path(existing)}")
            item["path"] = "/logos/svg/" + existing.relative_to(args.out).as_posix()
            item["format"] = existing.suffix[1:]
            if existing.suffix == ".svg":
                item["fills"] = svg_fills(existing.read_bytes())
            manifest_items.append(item)
            continue

        override = WIKI_FILE_OVERRIDES.get(a["displayName"])
        found = (a["wiki"][0], override) if override else find_logo_file(a["wiki"])
        time.sleep(args.delay)
        if not found:
            failures.append(f"{a['file']}: no SVG logo found on Wikipedia for {a['wiki'][0]!r}")
            print(f"FAIL {a['file']}: no SVG logo found ({a['wiki'][0]})", file=sys.stderr)
            manifest_items.append(item)
            continue
        article, filename = found
        if filename.lower().endswith(".png"):
            # No SVG available on Wikipedia; keep the raster so the team is not missing.
            dest = dest.with_suffix(".png")
            item["path"] = "/logos/svg/" + a["file"][:-4] + ".png"
            print(f"warning: {a['file']}: only a PNG logo exists on Wikipedia ({filename})", file=sys.stderr)
        item["format"] = dest.suffix[1:]
        try:
            url = file_url(filename)
            if not url:
                raise ValueError(f"no imageinfo for File:{filename}")
            data = fetch(url)
            if not is_valid_image(data, dest):
                raise ValueError(f"{url} is not a valid {dest.suffix[1:].upper()}")
            dest.write_bytes(data)
        except Exception as exc:
            failures.append(f"{a['file']}: {exc}")
            print(f"FAIL {a['file']}: {exc}", file=sys.stderr)
            manifest_items.append(item)
            continue
        time.sleep(args.delay)
        counts["downloaded"] += 1
        item["wikiArticle"] = article
        item["wikiFile"] = filename
        if dest.suffix == ".svg":
            item["fills"] = svg_fills(data)
        manifest_items.append(item)
        print(f"{'downloaded':10s} {display_path(dest)}  <- {filename}")

    # ---- college brand colors (one ESPN call per team; only for new items)
    if "ncaa" in only:
        print("fetching college team colors from ESPN")
        for item in manifest_items:
            if item["league"] == "COL" and item.get("espnId") and not item.get("color"):
                enrich_cfb_colors(item)

    manifest = {
        "season": args.season,
        "source": "Wikipedia (SVG) + ESPN (rosters, colors)",
        "items": manifest_items,
    }
    (args.out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    ok = len(assets) - len(failures)
    print(f"\n{ok}/{len(assets)} SVGs under {display_path(args.out)} "
          f"({counts['downloaded']} downloaded, {counts['skipped']} skipped); manifest.json written")
    for f in failures:
        print(f"error: {f}", file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
