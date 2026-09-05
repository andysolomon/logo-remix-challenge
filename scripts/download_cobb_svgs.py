#!/usr/bin/env python3
"""Download logos for the 17 Cobb County high schools in the HIGH SCHOOL league.

No feed covers Georgia high schools the way ESPN covers the NFL and NCAA, so
``scripts/cobb_roster.py`` pins one hand-verified source URL per school --
the school's own athletics site where one is scrapeable, the Cobb County
School District site otherwise, and Wikipedia's infobox logo as the fallback.
Cobb Horizon has no athletics program, so its entry is the school's primary
institutional mark from the district site.

Assets fetched (one per school in ``cobb_roster.SCHOOLS``):
    public/logos/svg/high-school/<abbr>.svg   (or .png when no SVG exists)

Palettes come from the official colors in ``cobb_roster.BRAND_COLORS``, each
snapped to the color the artwork actually uses. The manifest records both the
three-slot game palette and source-slot coverage; genuinely two-color marks
explicitly identify their unused slot instead of inventing artwork colors.

Results are written to ``public/logos/svg/hs-manifest.json`` for
``scripts/build_hs_teams.py`` to merge into ``src/lib/teams.json``.

Stdlib only. Safe to re-run: existing valid assets are skipped unless
``--force`` is given, selected runs merge into the complete local roster, and
failed downloads cannot replace a valid asset or truncate the manifest.

Usage:
    python3 scripts/download_cobb_svgs.py [--force] [--only ABBR,ABBR]
"""

from __future__ import annotations

import argparse
import json
import os
import struct
import sys
import tempfile
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from download_svgs import (  # noqa: E402  (path shim above)
    ROOT,
    display_path,
    fetch,
    is_valid_image,
    safe_slug,
)
import download_hbcu_svgs  # noqa: E402
from download_hbcu_svgs import MIN_PIXEL_SHARE, pick_palette, snap  # noqa: E402
from cobb_roster import BRAND_COLORS, SCHOOLS  # noqa: E402

OUT = ROOT / "public" / "logos" / "svg"
DEST_DIR = OUT / "high-school"
MANIFEST = OUT / "hs-manifest.json"
CONFERENCE = "Cobb County"

# Adam7 interlace passes: (x_start, y_start, x_step, y_step).
ADAM7 = [(0, 0, 8, 8), (4, 0, 8, 8), (0, 4, 4, 8), (2, 0, 4, 4), (0, 2, 2, 4), (1, 0, 2, 2), (0, 1, 1, 2)]
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
PNG_DEPTHS = {0: {1, 2, 4, 8, 16}, 2: {8, 16}, 3: {1, 2, 4, 8}, 4: {8, 16}, 6: {8, 16}}
PNG_CHANNELS = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}
# Every critical (uppercase-initial) chunk a decoder must understand. A file
# carrying any other critical chunk cannot be rendered faithfully, so reject it
# rather than silently dropping part of the image.
PNG_CRITICAL = {b"IHDR", b"PLTE", b"IDAT", b"IEND"}

# These marks genuinely contain only two source colors. Their three-slot game
# palettes stay intact, but the absent artwork slot is explicit instead of
# pretending the fallback color is present in the file.
UNUSED_SOURCE_SLOTS = {
    "CAMP": [1],
    "HORZ": [2],
    "LASS": [1],
    "OSBO": [1],
    "WALT": [1],
}
# Kennesaw Mountain has green, silver, and black artwork; white remains its
# useful light game color while black is the actual third recolor source.
SOURCE_PALETTE_OVERRIDES = {"KMHS": {2: "#000000"}}


def atomic_write_bytes(path: Path, data: bytes) -> None:
    """Write bytes beside ``path`` and atomically replace it after fsync."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=path.suffix, dir=path.parent)
    tmp = Path(tmp_name)
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise


def atomic_write_json(path: Path, value: object) -> None:
    atomic_write_bytes(path, (json.dumps(value, indent=2) + "\n").encode())


def _passes(width: int, height: int, channels: int, depth: int, interlace: int) -> list[tuple[int, int, int]]:
    """(pixel width, row count, byte stride) for each non-empty reduced image."""
    out: list[tuple[int, int, int]] = []
    for x0, y0, dx, dy in ([(0, 0, 1, 1)] if interlace == 0 else ADAM7):
        w = (width - x0 + dx - 1) // dx
        h = (height - y0 + dy - 1) // dy
        if w > 0 and h > 0:
            out.append((w, h, (w * channels * depth + 7) // 8))
    return out


def _unfilter(raw: bytes, width: int, height: int, channels: int, depth: int) -> list[bytearray]:
    """Reverse PNG scanline filtering for one (sub)image; returns raw byte rows."""
    bpp = max(1, channels * depth // 8)
    stride = (width * channels * depth + 7) // 8
    rows: list[bytearray] = []
    prev = bytearray(stride)
    off = 0
    for _ in range(height):
        if off + 1 + stride > len(raw):
            raise ValueError("truncated PNG scanline")
        filt = raw[off]
        if filt > 4:
            raise ValueError(f"invalid PNG filter byte {filt}")
        line = bytearray(raw[off + 1 : off + 1 + stride])
        off += 1 + stride
        for i in range(stride):
            a = line[i - bpp] if i >= bpp else 0
            b = prev[i]
            c = prev[i - bpp] if i >= bpp else 0
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
        rows.append(line)
        prev = line
    return rows


def _samples(row: bytearray, width: int, channels: int, depth: int) -> list[tuple[int, ...]]:
    """Per-pixel channel tuples from one unfiltered row, any bit depth."""
    if depth == 8:
        return [tuple(row[x : x + channels]) for x in range(0, width * channels, channels)]
    if depth == 16:
        return [tuple(row[(x + c) * 2] for c in range(channels)) for x in range(0, width * channels, channels)]
    # depth 1/2/4: only ever one channel (gray or palette index) per the spec
    out: list[tuple[int, ...]] = []
    per_byte = 8 // depth
    mask = (1 << depth) - 1
    for i in range(width):
        byte = row[i // per_byte]
        shift = 8 - depth * (i % per_byte + 1)
        out.append(((byte >> shift) & mask,))
    return out


def _check_decoded(raw: bytes, width: int, height: int, depth: int, ctype: int, interlace: int, palette: bytes) -> None:
    """Check the rules that only hold once scanlines are actually reconstructed.

    Two things cannot be seen in the compressed stream: the unused low bits that
    pad a sub-byte scanline out to a whole byte must be zero, and every index in
    an indexed image must name an entry that PLTE actually has. Both are skipped
    when the color type and bit depth make them impossible, which keeps the cost
    on the byte-per-pixel images that are the only ones able to break them.
    """
    sub_byte = depth < 8
    if not sub_byte and ctype != 3:
        return
    channels = PNG_CHANNELS[ctype]
    entries = len(palette) // 3
    off = 0
    for w, h, stride in _passes(width, height, channels, depth, interlace):
        rows = _unfilter(raw[off : off + h * (1 + stride)], w, h, channels, depth)
        off += h * (1 + stride)
        used = w * channels * depth % 8
        pad = (1 << (8 - used)) - 1 if used else 0
        for row in rows:
            if pad and row[-1] & pad:
                raise ValueError("non-zero padding bits in sub-byte scanline")
            if ctype == 3:
                for (index,) in _samples(row, w, channels, depth):
                    if index >= entries:
                        raise ValueError(f"palette index {index} exceeds the {entries}-entry PLTE")


def validate_png(data: bytes) -> tuple[int, int, int, int, int, bytes, bytes, bytes]:
    """Validate PNG structure and decoded scanlines; return decode metadata.

    This deliberately does more than sniff the signature: every chunk must be
    in bounds with a valid CRC and a legal four-letter type, no unknown critical
    chunk may appear, IHDR must be legal, PLTE and tRNS must be singular and
    legal for the color type, IDAT must be a complete zlib stream of exactly the
    expected scanline size, every filter byte must be valid, sub-byte scanlines
    must be zero-padded, palette indices must be in range, and a terminal IEND
    is required.
    """
    if not data.startswith(PNG_MAGIC):
        raise ValueError("invalid PNG signature")
    pos = len(PNG_MAGIC)
    width = height = depth = ctype = interlace = -1
    idat = bytearray()
    palette = b""
    trns = b""
    seen_ihdr = seen_idat = seen_iend = seen_plte = seen_trns = False
    idat_closed = False
    while pos < len(data):
        if pos + 12 > len(data):
            raise ValueError("truncated PNG chunk header")
        length, kind = struct.unpack(">I4s", data[pos : pos + 8])
        if length > 0x7FFFFFFF:
            raise ValueError("PNG chunk length exceeds the 2^31-1 maximum")
        end = pos + 12 + length
        if end > len(data):
            raise ValueError(f"truncated {kind.decode('latin1')} chunk")
        body = data[pos + 8 : pos + 8 + length]
        expected_crc = struct.unpack(">I", data[pos + 8 + length : end])[0]
        if zlib.crc32(kind + body) & 0xFFFFFFFF != expected_crc:
            raise ValueError(f"bad {kind.decode('latin1')} CRC")
        if not all(0x41 <= b <= 0x5A or 0x61 <= b <= 0x7A for b in kind):
            raise ValueError("PNG chunk type is not four ASCII letters")
        if kind[2] & 0x20:
            raise ValueError(f"{kind.decode('latin1')} sets the reserved chunk bit")
        if not kind[0] & 0x20 and kind not in PNG_CRITICAL:
            raise ValueError(f"unknown critical chunk {kind.decode('latin1')}")
        if not seen_ihdr and kind != b"IHDR":
            raise ValueError("IHDR is not the first PNG chunk")
        if kind == b"IHDR":
            if seen_ihdr or length != 13:
                raise ValueError("invalid IHDR")
            width, height, depth, ctype, compression, filter_method, interlace = struct.unpack(
                ">IIBBBBB", body
            )
            if not width or not height or ctype not in PNG_DEPTHS or depth not in PNG_DEPTHS[ctype]:
                raise ValueError("invalid IHDR dimensions/color type/bit depth")
            if compression != 0 or filter_method != 0 or interlace not in (0, 1):
                raise ValueError("unsupported IHDR compression/filter/interlace")
            seen_ihdr = True
        elif kind == b"PLTE":
            if seen_trns:
                raise ValueError("PLTE after tRNS")
            if seen_plte or seen_idat or not length or length % 3 or length > 768:
                raise ValueError("invalid PLTE")
            if ctype in (0, 4):
                raise ValueError("PLTE is not allowed in a grayscale PNG")
            if ctype == 3 and length > 3 << depth:
                raise ValueError("PLTE has more entries than the bit depth can index")
            palette = body
            seen_plte = True
        elif kind == b"tRNS":
            if seen_trns or seen_idat:
                raise ValueError("duplicate tRNS or tRNS after IDAT")
            if ctype in (4, 6):
                raise ValueError("tRNS is not allowed alongside an alpha channel")
            if ctype == 3 and (not seen_plte or length > len(palette) // 3):
                raise ValueError("tRNS does not match the PLTE it follows")
            if (ctype == 0 and length != 2) or (ctype == 2 and length != 6):
                raise ValueError("tRNS has the wrong length for the color type")
            trns = body
            seen_trns = True
        elif kind == b"IDAT":
            if idat_closed:
                raise ValueError("non-consecutive IDAT chunks")
            seen_idat = True
            idat += body
        else:
            if seen_idat and kind != b"IEND":
                idat_closed = True
        if kind == b"IEND":
            if length or not seen_idat:
                raise ValueError("invalid IEND")
            seen_iend = True
            pos = end
            break
        pos = end
    if not seen_iend or pos != len(data):
        raise ValueError("missing IEND or trailing PNG data")
    if ctype == 3 and not palette:
        raise ValueError("indexed PNG is missing PLTE")

    decoder = zlib.decompressobj()
    try:
        raw = decoder.decompress(bytes(idat)) + decoder.flush()
    except zlib.error as exc:
        raise ValueError(f"invalid IDAT zlib stream: {exc}") from exc
    if not decoder.eof or decoder.unused_data or decoder.unconsumed_tail:
        raise ValueError("incomplete or trailing IDAT zlib stream")
    channels = PNG_CHANNELS[ctype]
    shapes = _passes(width, height, channels, depth, interlace)
    expected = sum(h * (1 + stride) for _, h, stride in shapes)
    if len(raw) != expected:
        raise ValueError(f"IDAT scanlines have {len(raw)} bytes; expected {expected}")
    off = 0
    for _, h, stride in shapes:
        for _ in range(h):
            if raw[off] > 4:
                raise ValueError(f"invalid PNG filter byte {raw[off]}")
            off += 1 + stride
    _check_decoded(raw, width, height, depth, ctype, interlace, palette)
    return width, height, depth, ctype, interlace, bytes(raw), palette, trns


def is_valid_cobb_image(data: bytes, path: Path) -> bool:
    try:
        if path.suffix.lower() == ".png":
            validate_png(data)
            return True
        return path.suffix.lower() == ".svg" and is_valid_image(data, path)
    except (ValueError, struct.error, zlib.error, IndexError):
        return False


def png_colors_any(data: bytes) -> list[tuple[str, int]]:
    """Opaque (hex, count) pairs, most common first, for any common PNG.

    A superset of the reader in ``download_hbcu_svgs``: it also handles Adam7
    interlacing, sub-byte palette/gray bit depths, 16-bit samples, grayscale
    (with or without alpha), and palette transparency via tRNS -- the shapes
    the Cobb district and VNN uploads actually come in.
    """
    width, height, depth, ctype, interlace, raw, palette, trns = validate_png(data)
    channels = PNG_CHANNELS.get(ctype)
    if not channels or depth not in (1, 2, 4, 8, 16):
        raise ValueError(f"unsupported PNG (depth={depth} color={ctype} interlace={interlace})")

    counts: dict[tuple[int, int, int], int] = {}
    gray_max = (1 << depth) - 1 if ctype in (0, 4) and depth < 8 else 255

    def count_pixel(px: tuple[int, ...]) -> None:
        if ctype == 3:
            idx = px[0] * 3
            if idx + 2 >= len(palette) or (px[0] < len(trns) and trns[px[0]] < 200):
                return
            rgb = (palette[idx], palette[idx + 1], palette[idx + 2])
        elif ctype == 0:
            g = px[0] * 255 // gray_max
            rgb = (g, g, g)
        elif ctype == 4:
            if px[1] < 200:
                return
            g = px[0] * 255 // gray_max
            rgb = (g, g, g)
        elif ctype == 6:
            if px[3] < 200:
                return
            rgb = px[:3]
        else:
            rgb = px[:3]
        counts[rgb] = counts.get(rgb, 0) + 1

    off = 0
    for w, h, stride in _passes(width, height, channels, depth, interlace):
        sub = raw[off : off + h * (1 + stride)]
        off += h * (1 + stride)
        for row in _unfilter(sub, w, h, channels, depth):
            for px in _samples(row, w, channels, depth):
                count_pixel(px)
    ordered = sorted(counts.items(), key=lambda kv: -kv[1])
    return [("#%02X%02X%02X" % px, n) for px, n in ordered]


def artwork_colors(path: Path) -> tuple[list[str], list[str]]:
    """(every color in the artwork, the subset big enough to read as a fill)."""
    if path.suffix == ".svg":
        return download_hbcu_svgs.artwork_colors(path)
    pairs = png_colors_any(path.read_bytes())
    total = sum(n for _, n in pairs) or 1
    every = [h for h, _ in pairs]
    usable = [h for h, n in pairs if n / total >= MIN_PIXEL_SHARE]
    return every, usable or every[:3]


def manifest_item(school: tuple[str, str, str, str, str, str], asset: Path) -> dict:
    """Build one manifest row from a fully validated local asset."""
    abbr, region, nickname, url, source_kind, source_page = school
    colors, usable = artwork_colors(asset)
    brand = BRAND_COLORS.get(abbr)
    palette = pick_palette(colors, usable, brand)
    source_palette = list(palette)
    for slot, color in SOURCE_PALETTE_OVERRIDES.get(abbr, {}).items():
        source_palette[slot] = color
    item = {
        "id": f"HS-{abbr}",
        "league": "HS",
        "conference": CONFERENCE,
        "region": region,
        "name": nickname,
        "abbr": abbr,
        "displayName": f"{region} {nickname}".strip(),
        "sourceUrl": url,
        "sourceKind": source_kind,
        "sourcePage": source_page,
        "path": "/logos/svg/" + (DEST_DIR / asset.name).relative_to(OUT).as_posix(),
        "format": asset.suffix[1:],
        "colors": usable[:8],
        "brand": list(brand) if brand else [],
        "palette": palette,
        "sourcePalette": source_palette,
        "unusedSourceSlots": UNUSED_SOURCE_SLOTS.get(abbr, []),
    }
    unused = set(item["unusedSourceSlots"])
    for slot, want in enumerate(brand or ()):
        if slot not in unused and want and snap(want, colors, usable) is None:
            print(f"warning: {abbr}: official {want} matches nothing in the artwork", file=sys.stderr)
    return item


def valid_local_item(school: tuple[str, str, str, str, str, str], dest: Path) -> dict | None:
    """Return a regenerated row only when the existing asset is fully valid."""
    if not dest.is_file():
        return None
    try:
        data = dest.read_bytes()
        if not is_valid_cobb_image(data, dest):
            return None
        return manifest_item(school, dest)
    except (OSError, ValueError, struct.error, zlib.error, IndexError):
        return None


def install_download(school: tuple[str, str, str, str, str, str], dest: Path, data: bytes) -> dict:
    """Validate a staged download completely before atomically replacing dest."""
    fd, tmp_name = tempfile.mkstemp(prefix=f".{dest.stem}.", suffix=dest.suffix, dir=dest.parent)
    tmp = Path(tmp_name)
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
            fh.flush()
            os.fsync(fh.fileno())
        if not is_valid_cobb_image(data, tmp):
            raise ValueError(f"download is not a valid {dest.suffix[1:].upper()}")
        item = manifest_item(school, tmp)
        # manifest_item uses the temporary basename; restore the stable path.
        item["path"] = "/logos/svg/" + dest.relative_to(OUT).as_posix()
        os.replace(tmp, dest)
        return item
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--force", action="store_true", help="re-download even when a valid asset exists")
    ap.add_argument("--only", default="", help="comma list of abbrs to limit the run to")
    args = ap.parse_args()
    only = {s.strip().upper() for s in args.only.split(",") if s.strip()}
    expected = {school[0] for school in SCHOOLS}
    unknown = sorted(only - expected)
    if unknown:
        print(f"error: unknown school abbreviation(s): {', '.join(unknown)}", file=sys.stderr)
        return 2

    DEST_DIR.mkdir(parents=True, exist_ok=True)
    # Reconstruct the complete baseline from valid local assets. This both
    # upgrades older manifest rows to the current schema and ensures --only can
    # never truncate schools it did not select.
    items_by_abbr: dict[str, dict] = {}
    destinations: dict[str, Path] = {}
    failures: list[str] = []
    for school in SCHOOLS:
        abbr, _, _, url, _, _ = school
        suffix = ".svg" if url.lower().split("?")[0].endswith(".svg") else ".png"
        dest = DEST_DIR / f"{safe_slug(abbr)}{suffix}"
        destinations[abbr] = dest
        prior = valid_local_item(school, dest)
        if prior is not None:
            items_by_abbr[abbr] = prior

    for school in SCHOOLS:
        abbr, _, _, url, _, _ = school
        if only and abbr not in only:
            continue
        dest = destinations[abbr]

        if abbr in items_by_abbr and not args.force:
            print(f"{'skipped':10s} {display_path(dest)}")
            continue
        else:
            try:
                data = fetch(url)
                item = install_download(school, dest, data)
            except Exception as exc:
                failures.append(f"{abbr}: {exc}")
                print(f"FAIL {abbr}: {exc}", file=sys.stderr)
                continue
            print(f"{'saved':10s} {display_path(dest)}  <- {url}")
            items_by_abbr[abbr] = item

    missing = sorted(expected - items_by_abbr.keys())
    if missing:
        failures.append(f"manifest incomplete; no valid asset/row for {', '.join(missing)}")
    else:
        items = [items_by_abbr[school[0]] for school in SCHOOLS]
        atomic_write_json(MANIFEST, {"assets": items})
        print(f"\n{len(items)} assets -> {display_path(MANIFEST)}")
    if failures:
        print(f"\n{len(failures)} failure(s):", file=sys.stderr)
        for f in failures:
            print(f"  {f}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
