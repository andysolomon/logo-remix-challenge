#!/usr/bin/env python3
"""Download logos for the HBCUs that ESPN's college-football feed does not carry.

``scripts/download_svgs.py`` builds the HBCU chip from ESPN's SWAC/MEAC
football standings, which reaches only the 21 Division I football programs.
Two MEAC members field no football team and the entire Division II SIAC is
absent from that feed, so this script fills in those 16 schools straight from
Wikipedia. See ``scripts/hbcu_roster.py`` for the roster and its scope.

Assets fetched (one per school in ``hbcu_roster.EXTRA``):
    public/logos/svg/ncaa/<abbr>.svg   (or .png when Wikipedia has no SVG)

ESPN carries no brand colors for Division II, so the palette comes from the
school's official colors in ``hbcu_roster.BRAND_COLORS``, each snapped to the
color the artwork actually uses; schools with no stated colors fall back to the
two most-used non-white colors in the file. Either way the hexes are read out
of the artwork, so the runtime recolor in Logo.tsx matches exactly and no
separate ``sourcePalette`` is needed.

Results are written to ``public/logos/svg/hbcu-manifest.json`` for
``scripts/build_hbcu_teams.py`` to merge into ``src/lib/teams.json``.

Stdlib only (PNGs are decoded with a small zlib-based reader). Safe to re-run:
existing valid assets are skipped unless ``--force`` is given.

Usage:
    python3 scripts/download_hbcu_svgs.py [--force] [--only ABBR,ABBR]
"""

from __future__ import annotations

import argparse
import json
import re
import struct
import sys
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from download_svgs import (  # noqa: E402  (path shim above)
    ROOT,
    display_path,
    fetch,
    file_url,
    is_valid_image,
    logo_from_wikitext,
    safe_slug,
    svg_fills,
    wikitext,
)
from hbcu_roster import BRAND_COLORS, EXTRA, WIKI_FILE_OVERRIDES  # noqa: E402

OUT = ROOT / "public" / "logos" / "svg"
MANIFEST = OUT / "hbcu-manifest.json"

WHITE, BLACK = "#FFFFFF", "#000000"
# A color this close to white is the light slot, not a brand color.
NEAR_WHITE_SQ = 60 * 60
# Two colors this close are the same brand color (matches build_teams.py).
SAME_COLOR_SQ = 40 * 40
# Raster colors below this share of opaque pixels are anti-aliasing rather than
# a fill, so they are not offered as a palette slot -- but they stay in the list
# a brand color may snap to, which is how a thin accent inside a busy seal is
# still found. Low enough to keep the line art in a detailed seal: the purple in
# Miles College's covers well under 1% of it.
MIN_PIXEL_SHARE = 0.005
# A brand color this far from every color in the artwork has no match to snap to.
SNAP_TOLERANCE_SQ = 90 * 90

NAMED = {
    "white": "#ffffff", "black": "#000000", "red": "#ff0000", "blue": "#0000ff",
    "green": "#008000", "yellow": "#ffff00", "gold": "#ffd700", "orange": "#ffa500",
    "purple": "#800080", "navy": "#000080", "silver": "#c0c0c0", "gray": "#808080",
    "grey": "#808080", "maroon": "#800000", "teal": "#008080", "olive": "#808000",
}
RGB_FUNC_RE = re.compile(r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)")


def rgb(h: str) -> tuple[int, int, int]:
    return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)


def dist_sq(a: str, b: str) -> int:
    return sum((x - y) ** 2 for x, y in zip(rgb(a), rgb(b)))


def to_hex(token: str) -> str | None:
    """Normalize an SVG color token to ``#RRGGBB``; None when unparsable."""
    v = token.strip().lower()
    if v.startswith("#"):
        if len(v) in (4, 5):
            return ("#" + "".join(c * 2 for c in v[1:4])).upper()
        if len(v) in (7, 9):
            return v[:7].upper()
        return None
    m = RGB_FUNC_RE.match(v)
    if m:
        return "#" + "".join(f"{min(255, int(n)):02X}" for n in m.groups())
    named = NAMED.get(v)
    return named.upper() if named else None


# ------------------------------------------------------------------ PNG reader
def png_colors(data: bytes) -> list[tuple[str, int]]:
    """Opaque (hex, count) pairs, most common first, for an 8-bit RGB/RGBA PNG."""
    pos, width, height, depth, ctype, interlace = 8, 0, 0, 0, 0, 0
    idat = bytearray()
    palette: bytes = b""
    while pos + 8 <= len(data):
        length, kind = struct.unpack(">I4s", data[pos : pos + 8])
        body = data[pos + 8 : pos + 8 + length]
        pos += 12 + length
        if kind == b"IHDR":
            width, height, depth, ctype, _, _, interlace = struct.unpack(">IIBBBBB", body)
        elif kind == b"PLTE":
            palette = body
        elif kind == b"IDAT":
            idat += body
        elif kind == b"IEND":
            break
    if depth != 8 or interlace != 0 or ctype not in (2, 3, 6) or not idat:
        raise ValueError(f"unsupported PNG (depth={depth} color={ctype} interlace={interlace})")
    channels = {2: 3, 3: 1, 6: 4}[ctype]
    raw = zlib.decompress(bytes(idat))
    stride = width * channels
    prev = bytearray(stride)
    counts: dict[tuple[int, int, int], int] = {}
    off = 0
    for _ in range(height):
        filt = raw[off]
        line = bytearray(raw[off + 1 : off + 1 + stride])
        off += 1 + stride
        for i in range(stride):
            a = line[i - channels] if i >= channels else 0
            b = prev[i]
            c = prev[i - channels] if i >= channels else 0
            if filt == 1:
                line[i] = (line[i] + a) & 0xFF
            elif filt == 2:
                line[i] = (line[i] + b) & 0xFF
            elif filt == 3:
                line[i] = (line[i] + ((a + b) >> 1)) & 0xFF
            elif filt == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pred = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pred) & 0xFF
        for x in range(0, stride, channels):
            if ctype == 6:
                if line[x + 3] < 200:
                    continue
                px = (line[x], line[x + 1], line[x + 2])
            elif ctype == 3:
                idx = line[x] * 3
                px = (palette[idx], palette[idx + 1], palette[idx + 2])
            else:
                px = (line[x], line[x + 1], line[x + 2])
            counts[px] = counts.get(px, 0) + 1
        prev = line
    ordered = sorted(counts.items(), key=lambda kv: -kv[1])
    return [("#%02X%02X%02X" % px, n) for px, n in ordered]


# ------------------------------------------------------------------- palettes
def _nearest(brand: str, artwork: list[str]) -> str | None:
    best, best_d = None, SNAP_TOLERANCE_SQ
    for c in artwork:
        d = dist_sq(brand, c)
        if d < best_d:
            best, best_d = c, d
    return best


def snap(brand: str, colors: list[str], usable: list[str]) -> str | None:
    """The artwork color closest to ``brand``, or None when nothing is close.

    Flat fills are searched first so a brand color lands on the shape it belongs
    to rather than on one of the anti-aliased shades ringing it -- those sit
    between two fills and can measure closer to the official hex than either.
    Only when no fill is within tolerance does the whole artwork come into play.
    """
    return _nearest(brand, usable) or _nearest(brand, colors)


def pick_palette(colors: list[str], usable: list[str], brand: tuple[str, str] | None) -> list[str]:
    """[primary, secondary, light] for one school.

    ``colors`` is every color in the artwork, most prominent first; ``usable``
    is the subset large enough to read as a fill. Official colors are snapped
    onto ``colors`` so even a thin accent can hold a slot; anything the school
    does not state is filled from ``usable`` in order of prominence.
    """
    slots: list[str | None] = [None, None]
    for i, want in enumerate(brand or ("", "")):
        if want:
            slots[i] = snap(want, colors, usable)
    rest = [c for c in usable if dist_sq(c, WHITE) > NEAR_WHITE_SQ]
    for i in range(2):
        if slots[i] is not None:
            continue
        taken = [s for s in slots if s]
        slots[i] = next((c for c in rest if all(dist_sq(c, t) > SAME_COLOR_SQ for t in taken)), None)
    primary = slots[0] or BLACK
    secondary = slots[1]
    if secondary is None or dist_sq(secondary, primary) <= SAME_COLOR_SQ:
        secondary = BLACK if dist_sq(primary, BLACK) > SAME_COLOR_SQ else "#B3B3B3"
    return [primary, secondary, WHITE]


def artwork_colors(path: Path) -> tuple[list[str], list[str]]:
    """(every color in the artwork, the subset big enough to read as a fill)."""
    data = path.read_bytes()
    if path.suffix == ".svg":
        out: list[str] = []
        for token in svg_fills(data):
            hex_ = to_hex(token)
            if hex_ and hex_ not in out:
                out.append(hex_)
        # Shapes with no fill of their own render black, so black is in play
        # whenever the file declares no color at all.
        if not out:
            # An SVG that declares no color at all is almost always a <rect>
            # filled with an embedded base64 raster: it renders, but there is
            # nothing for Logo.tsx's SVG recolor to rewrite. Caller reports it.
            raise ValueError("SVG declares no fills (embedded raster?)")
        return out, out
    pairs = png_colors(data)
    total = sum(n for _, n in pairs) or 1
    every = [h for h, _ in pairs]
    usable = [h for h, n in pairs if n / total >= MIN_PIXEL_SHARE]
    return every, usable or every[:3]


# ------------------------------------------------------------- logo resolution
def resolve_logo(abbr: str, titles: list[str]) -> tuple[str, str] | None:
    """(article, File name) for a school, honoring roster order.

    Unlike ``download_svgs.find_logo_file`` the first article that carries a
    logo wins even when a later one offers an SVG: the roster lists the
    athletics article first, and a team's PNG wordmark beats the university
    seal that the institution article would hand back. ``Logo.tsx`` recolors
    rasters on a canvas, so a PNG is a usable asset, just a lossier one.

    There is deliberately no full-text-search fallback. Searching for a school
    with no logo on Wikipedia returns a confidently wrong mark -- a trial run
    handed Paul Quinn the Hull City A.F.C. crest and Fisk the Red Sox socks --
    so an unresolved school fails loudly and is fixed in WIKI_FILE_OVERRIDES.
    """
    override = WIKI_FILE_OVERRIDES.get(abbr)
    if override:
        return titles[0], override
    for title in titles:
        try:
            page = wikitext(title)
        except Exception as exc:
            print(f"warning: wikitext {title!r}: {exc}", file=sys.stderr)
            continue
        if not page:
            continue
        logo = logo_from_wikitext(page[1])
        if logo:
            return page[0], logo
    return None


# ------------------------------------------------------------------------ main
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--force", action="store_true", help="re-download even when a valid asset exists")
    ap.add_argument("--only", default="", help="comma list of abbrs to limit the run to")
    args = ap.parse_args()
    only = {s.strip().upper() for s in args.only.split(",") if s.strip()}

    (OUT / "ncaa").mkdir(parents=True, exist_ok=True)
    items: list[dict] = []
    failures: list[str] = []

    for abbr, region, nickname, titles in EXTRA:
        if only and abbr not in only:
            continue
        stem = safe_slug(abbr)
        svg_dest = OUT / "ncaa" / f"{stem}.svg"
        item = {
            "id": f"COL-{abbr}",
            "league": "COL",
            "conference": "HBCU",
            "region": region,
            "name": nickname,
            "abbr": abbr,
            "displayName": f"{region} {nickname}".strip(),
        }

        existing = next((p for p in (svg_dest, svg_dest.with_suffix(".png")) if p.is_file() and is_valid_image(p.read_bytes(), p)), None)
        if existing and not args.force:
            print(f"{'skipped':10s} {display_path(existing)}")
        else:
            found = resolve_logo(abbr, titles)
            if not found:
                failures.append(f"{abbr}: no logo found on Wikipedia for {titles[0]!r}")
                print(f"FAIL {abbr}: no logo found ({titles[0]})", file=sys.stderr)
                continue
            article, filename = found
            dest = svg_dest if filename.lower().endswith(".svg") else svg_dest.with_suffix(".png")
            try:
                url = file_url(filename)
                if not url:
                    raise ValueError(f"no imageinfo for File:{filename}")
                data = fetch(url)
                if not is_valid_image(data, dest):
                    raise ValueError(f"{url} is not a valid {dest.suffix[1:].upper()}")
                dest.write_bytes(data)
            except Exception as exc:
                failures.append(f"{abbr}: {exc}")
                print(f"FAIL {abbr}: {exc}", file=sys.stderr)
                continue
            item["wikiArticle"] = article
            item["wikiFile"] = filename
            existing = dest
            print(f"{'saved':10s} {display_path(dest)}  <- {filename}")

        item["path"] = "/logos/svg/" + existing.relative_to(OUT).as_posix()
        item["format"] = existing.suffix[1:]
        try:
            colors, usable = artwork_colors(existing)
        except Exception as exc:
            failures.append(f"{abbr}: {existing.name}: {exc}; pick another file in hbcu_roster.WIKI_FILE_OVERRIDES")
            print(f"FAIL {abbr}: {existing.name}: {exc}", file=sys.stderr)
            continue
        brand = BRAND_COLORS.get(abbr)
        item["colors"] = usable[:8]
        item["brand"] = list(brand) if brand else []
        item["palette"] = pick_palette(colors, usable, brand)
        for want in brand or ():
            if want and snap(want, colors, usable) is None:
                print(f"warning: {abbr}: official {want} matches nothing in the artwork", file=sys.stderr)
        items.append(item)

    MANIFEST.write_text(json.dumps({"assets": items}, indent=2) + "\n")
    print(f"\n{len(items)} assets -> {display_path(MANIFEST)}")
    if failures:
        print(f"\n{len(failures)} failure(s):", file=sys.stderr)
        for f in failures:
            print(f"  {f}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
