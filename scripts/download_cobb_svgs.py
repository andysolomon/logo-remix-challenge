#!/usr/bin/env python3
"""Download logos for the 17 Cobb County high schools in the HIGH SCHOOL league.

No feed covers Georgia high schools the way ESPN covers the NFL and NCAA, so
``scripts/cobb_roster.py`` pins one hand-verified source URL per school --
the school's own athletics site where one is scrapeable, the Cobb County
School District site otherwise, Wikipedia's infobox logo as the fallback, and a
third-party mirror for the five schools whose real mark none of those three
carries. Cobb Horizon has no athletics program, so its entry is the school's
primary institutional mark from the district site.

Assets fetched (one per school in ``cobb_roster.SCHOOLS``):
    public/logos/svg/high-school/<abbr>.svg   (or .png when no SVG exists)

A source that serves JPEG is decoded and re-encoded as PNG on the way in, so
the league only ever stores the two formats ``Logo.tsx`` can recolor.

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
import math
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

# Every provenance class a roster entry may claim, documented in
# ``cobb_roster``. ``community`` covers third-party mirrors (VNN sportshub
# uploads reached outside the school's own site, vhv.rs, scorestream) for the
# schools whose real mark no official, district, or Wikipedia page carries.
# ``build_hs_teams`` validates the manifest against this same set, so the
# downloader and the builder can never disagree about what is allowed.
SOURCE_KINDS = frozenset({"official", "district", "wikipedia", "community"})

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
    "CAMP": [2],
    "HORZ": [2],
    "LASS": [1],
    "OSBO": [1],
    "PEBB": [2],
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


# ----------------------------------------------------------------- JPEG -> PNG
# Campbell's mark is only mirrored as JPEG. Logo.tsx recolors PNG and SVG, and
# the manifest's palette work reads PNG, so a JPEG download is decoded here and
# re-encoded as PNG rather than stored in a third format. Baseline sequential
# only -- the shape every mirror of a logo actually uses; anything else fails
# loudly instead of being half-decoded.
JPEG_MAGIC = b"\xff\xd8\xff"
JPEG_ZIGZAG = [
    0, 1, 8, 16, 9, 2, 3, 10,
    17, 24, 32, 25, 18, 11, 4, 5,
    12, 19, 26, 33, 40, 48, 41, 34,
    27, 20, 13, 6, 7, 14, 21, 28,
    35, 42, 49, 56, 57, 50, 43, 36,
    29, 22, 15, 23, 30, 37, 44, 51,
    58, 59, 52, 45, 38, 31, 39, 46,
    53, 60, 61, 54, 47, 55, 62, 63,
]
# IDCT basis: COS[x][u] folds in the 1/sqrt(2) DC scale, so applying it across
# rows and then down columns is the full 2-D transform.
COS = [
    [(0.3535533905932738 if u == 0 else 0.5) * math.cos((2 * x + 1) * u * math.pi / 16) for u in range(8)]
    for x in range(8)
]
# Saturating lookup for color conversion: index by value+256, which keeps every
# YCbCr->RGB result (-227..480) inside the table.
CLAMP = bytes(min(255, max(0, i - 256)) for i in range(768))
# Frame markers this decoder cannot honor: progressive, lossless, arithmetic and
# hierarchical coding all need machinery baseline does not.
JPEG_UNSUPPORTED_SOF = frozenset({0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF})


class JpegBits:
    """Entropy-coded bit reader: unstuffs 0xFF00 and stops at the next marker."""

    def __init__(self, data: bytes, pos: int) -> None:
        self.data, self.pos, self.bits, self.nbits, self.marker = data, pos, 0, 0, None

    def bit(self) -> int:
        if not self.nbits:
            if self.marker is not None:
                # Past the end of the scan: pad with zero bits, as the spec's
                # final incomplete byte requires, instead of reading the marker.
                self.bits = 0
            else:
                if self.pos >= len(self.data):
                    raise ValueError("truncated JPEG entropy data")
                b = self.data[self.pos]
                if b == 0xFF:
                    nxt = self.data[self.pos + 1] if self.pos + 1 < len(self.data) else 0xD9
                    if nxt == 0x00:
                        self.pos += 2
                    else:
                        self.marker, b = nxt, 0
                else:
                    self.pos += 1
                self.bits = b
            self.nbits = 8
        self.nbits -= 1
        return (self.bits >> self.nbits) & 1

    def receive(self, n: int) -> int:
        v = 0
        for _ in range(n):
            v = (v << 1) | self.bit()
        return v

    def extend(self, v: int, n: int) -> int:
        """Sign-extend an n-bit magnitude per JPEG's EXTEND procedure."""
        return v - (1 << n) + 1 if n and v < (1 << (n - 1)) else v

    def huffman(self, table: dict[tuple[int, int], int]) -> int:
        code = 0
        for length in range(1, 17):
            code = (code << 1) | self.bit()
            if (length, code) in table:
                return table[(length, code)]
        raise ValueError("invalid Huffman code")


def _huffman_table(counts: bytes, symbols: bytes) -> dict[tuple[int, int], int]:
    """(bit length, code) -> symbol, built in canonical JPEG code order."""
    table: dict[tuple[int, int], int] = {}
    code = index = 0
    for length in range(1, 17):
        for _ in range(counts[length - 1]):
            table[(length, code)] = symbols[index]
            code += 1
            index += 1
        code <<= 1
    return table


def _idct_block(coef: list[float], plane: bytearray, stride: int, ox: int, oy: int) -> None:
    """Inverse DCT one 8x8 block of dequantized coefficients into ``plane``."""
    tmp = [0.0] * 64
    for y in range(8):
        row = coef[y * 8 : y * 8 + 8]
        if not any(row[1:]):
            flat = row[0] * COS[0][0]
            for x in range(8):
                tmp[y * 8 + x] = flat
            continue
        for x in range(8):
            c = COS[x]
            tmp[y * 8 + x] = (
                row[0] * c[0] + row[1] * c[1] + row[2] * c[2] + row[3] * c[3]
                + row[4] * c[4] + row[5] * c[5] + row[6] * c[6] + row[7] * c[7]
            )
    for x in range(8):
        col = tmp[x::8]
        for y in range(8):
            c = COS[y]
            s = (
                col[0] * c[0] + col[1] * c[1] + col[2] * c[2] + col[3] * c[3]
                + col[4] * c[4] + col[5] * c[5] + col[6] * c[6] + col[7] * c[7]
            )
            v = int(s + 128.5)  # undo the encoder's level shift, then round
            plane[(oy + y) * stride + ox + x] = 0 if v < 0 else (255 if v > 255 else v)


def _decode_scan(data: bytes, pos: int, frame: dict, scan: list, quant: dict, restart: int) -> int:
    """Decode one interleaved baseline scan; returns the offset just past it."""
    comps = frame["comps"]
    if len(scan) != len(comps):
        raise ValueError("unsupported non-interleaved JPEG scan")
    max_h = max(c["h"] for c in comps)
    max_v = max(c["v"] for c in comps)
    mcus_x = (frame["w"] + 8 * max_h - 1) // (8 * max_h)
    mcus_y = (frame["h"] + 8 * max_v - 1) // (8 * max_v)
    for c in comps:
        if c["tq"] not in quant:
            raise ValueError(f"JPEG component {c['id']} names a missing quantization table")
        c["stride"] = mcus_x * c["h"] * 8
        c["plane"] = bytearray(c["stride"] * mcus_y * c["v"] * 8)
        c["pred"] = 0
    bits = JpegBits(data, pos)
    for mcu in range(mcus_x * mcus_y):
        if restart and mcu and mcu % restart == 0:
            p = bits.pos
            while p + 1 < len(data) and not (data[p] == 0xFF and 0xD0 <= data[p + 1] <= 0xD7):
                p += 1
            if p + 1 >= len(data):
                raise ValueError("JPEG restart interval with no restart marker")
            bits = JpegBits(data, p + 2)
            for comp, _, _ in scan:
                comp["pred"] = 0
        mx, my = mcu % mcus_x, mcu // mcus_x
        for comp, dc_table, ac_table in scan:
            q = quant[comp["tq"]]
            for by in range(comp["v"]):
                for bx in range(comp["h"]):
                    coef = [0.0] * 64
                    t = bits.huffman(dc_table)
                    comp["pred"] += bits.extend(bits.receive(t), t) if t else 0
                    coef[0] = comp["pred"] * q[0]
                    k = 1
                    while k < 64:
                        rs = bits.huffman(ac_table)
                        run, size = rs >> 4, rs & 15
                        if not size:
                            if run != 15:  # end of block
                                break
                            k += 16  # ZRL: sixteen zero coefficients
                            continue
                        k += run
                        if k > 63:
                            raise ValueError("JPEG AC coefficient index out of range")
                        coef[JPEG_ZIGZAG[k]] = bits.extend(bits.receive(size), size) * q[k]
                        k += 1
                    _idct_block(coef, comp["plane"], comp["stride"],
                                (mx * comp["h"] + bx) * 8, (my * comp["v"] + by) * 8)
    p = bits.pos
    while p + 1 < len(data) and not (data[p] == 0xFF and data[p + 1] != 0x00 and not 0xD0 <= data[p + 1] <= 0xD7):
        p += 1
    return p


def _assemble(frame: dict, transform: int | None) -> tuple[int, int, int, bytearray]:
    """Upsample the decoded planes to full size and convert to gray or RGB."""
    comps, w, h = frame["comps"], frame["w"], frame["h"]
    if any("plane" not in c for c in comps):
        raise ValueError("JPEG frame has undecoded components")
    max_h = max(c["h"] for c in comps)
    max_v = max(c["v"] for c in comps)
    if len(comps) == 1:
        c = comps[0]
        out = bytearray(w * h)
        for y in range(h):
            row = c["stride"] * (y * c["v"] // max_v)
            plane = c["plane"]
            out[y * w : (y + 1) * w] = bytes(plane[row + x * c["h"] // max_h] for x in range(w))
        return w, h, 1, out
    if len(comps) != 3:
        raise ValueError(f"unsupported JPEG component count {len(comps)}")
    # Three components are YCbCr unless an Adobe APP14 marker says otherwise.
    ycc = transform != 0
    yc, cbc, crc = comps
    out = bytearray(w * h * 3)
    for y in range(h):
        yp, bp, rp = yc["plane"], cbc["plane"], crc["plane"]
        yo = yc["stride"] * (y * yc["v"] // max_v)
        bo = cbc["stride"] * (y * cbc["v"] // max_v)
        ro = crc["stride"] * (y * crc["v"] // max_v)
        o = y * w * 3
        for x in range(w):
            luma = yp[yo + x * yc["h"] // max_h]
            cb = bp[bo + x * cbc["h"] // max_h] - 128
            cr = rp[ro + x * crc["h"] // max_h] - 128
            if ycc:
                out[o] = CLAMP[int(luma + 1.402 * cr + 256.5)]
                out[o + 1] = CLAMP[int(luma - 0.344136 * cb - 0.714136 * cr + 256.5)]
                out[o + 2] = CLAMP[int(luma + 1.772 * cb + 256.5)]
            else:
                out[o], out[o + 1], out[o + 2] = luma, cb + 128, cr + 128
            o += 3
    return w, h, 3, out


def decode_jpeg(data: bytes) -> tuple[int, int, int, bytearray]:
    """(width, height, channels, samples) for a baseline sequential JPEG."""
    if not data.startswith(JPEG_MAGIC):
        raise ValueError("invalid JPEG signature")
    quant: dict[int, list[int]] = {}
    dc_tables: dict[int, dict] = {}
    ac_tables: dict[int, dict] = {}
    frame: dict | None = None
    restart = 0
    transform: int | None = None
    pos = 2
    while pos < len(data):
        if data[pos] != 0xFF:
            raise ValueError("lost JPEG marker sync")
        while pos < len(data) and data[pos] == 0xFF:
            pos += 1
        if pos >= len(data):
            raise ValueError("truncated JPEG marker")
        marker, pos = data[pos], pos + 1
        if marker == 0xD9:  # EOI
            break
        if marker == 0x01 or 0xD0 <= marker <= 0xD8:  # standalone markers
            continue
        if pos + 2 > len(data):
            raise ValueError("truncated JPEG segment")
        length = int.from_bytes(data[pos : pos + 2], "big")
        if length < 2 or pos + length > len(data):
            raise ValueError("truncated JPEG segment body")
        body, end = data[pos + 2 : pos + length], pos + length
        if marker == 0xDB:  # DQT
            i = 0
            while i < len(body):
                wide, target = body[i] >> 4, body[i] & 15
                i += 1
                if wide:
                    quant[target] = [int.from_bytes(body[i + 2 * k : i + 2 * k + 2], "big") for k in range(64)]
                    i += 128
                else:
                    quant[target] = list(body[i : i + 64])
                    i += 64
                if len(quant[target]) != 64:
                    raise ValueError("truncated JPEG quantization table")
        elif marker == 0xC4:  # DHT
            i = 0
            while i < len(body):
                kind, target = body[i] >> 4, body[i] & 15
                counts = body[i + 1 : i + 17]
                total = sum(counts)
                symbols = body[i + 17 : i + 17 + total]
                if len(symbols) != total:
                    raise ValueError("truncated JPEG Huffman table")
                (ac_tables if kind else dc_tables)[target] = _huffman_table(counts, symbols)
                i += 17 + total
        elif marker in (0xC0, 0xC1):  # SOF0/SOF1: baseline and extended sequential
            if body[0] != 8:
                raise ValueError(f"unsupported JPEG sample precision {body[0]}")
            h, w, count = int.from_bytes(body[1:3], "big"), int.from_bytes(body[3:5], "big"), body[5]
            if not w or not h or not count:
                raise ValueError("invalid JPEG frame header")
            comps = [
                {"id": body[6 + 3 * c], "h": body[7 + 3 * c] >> 4, "v": body[7 + 3 * c] & 15, "tq": body[8 + 3 * c]}
                for c in range(count)
            ]
            if any(not c["h"] or not c["v"] for c in comps):
                raise ValueError("invalid JPEG component sampling factors")
            frame = {"w": w, "h": h, "comps": comps}
        elif marker in JPEG_UNSUPPORTED_SOF:
            raise ValueError("unsupported JPEG (only baseline sequential is decoded)")
        elif marker == 0xDD:  # DRI
            restart = int.from_bytes(body[0:2], "big")
        elif marker == 0xEE and body[:5] == b"Adobe":  # APP14
            transform = body[11] if len(body) > 11 else None
        elif marker == 0xDA:  # SOS
            if frame is None:
                raise ValueError("JPEG scan before frame header")
            scan = []
            for s in range(body[0]):
                selector, tables = body[1 + 2 * s], body[2 + 2 * s]
                comp = next((c for c in frame["comps"] if c["id"] == selector), None)
                if comp is None or (tables >> 4) not in dc_tables or (tables & 15) not in ac_tables:
                    raise ValueError("JPEG scan names a missing component or Huffman table")
                scan.append((comp, dc_tables[tables >> 4], ac_tables[tables & 15]))
            pos = _decode_scan(data, end, frame, scan, quant, restart)
            continue
        pos = end
    if frame is None:
        raise ValueError("JPEG has no frame header")
    return _assemble(frame, transform)


def encode_png(width: int, height: int, channels: int, samples: bytes) -> bytes:
    """Non-interlaced 8-bit gray/RGB PNG with unfiltered scanlines."""
    stride = width * channels
    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filter type None
        raw += samples[y * stride : (y + 1) * stride]

    def chunk(kind: bytes, payload: bytes) -> bytes:
        crc = zlib.crc32(kind + payload) & 0xFFFFFFFF
        return len(payload).to_bytes(4, "big") + kind + payload + crc.to_bytes(4, "big")

    ihdr = width.to_bytes(4, "big") + height.to_bytes(4, "big") + bytes([8, {1: 0, 3: 2}[channels], 0, 0, 0])
    return (
        PNG_MAGIC
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def jpeg_to_png(data: bytes) -> bytes:
    return encode_png(*decode_jpeg(data))


def trim_after_iend(data: bytes) -> bytes:
    """Drop bytes past IEND, which are no part of the image the file encodes.

    Kell's mirror serves ~9 KB of stray bytes after IEND. Renderers ignore
    them, but the validator refuses trailing data rather than guess how much of
    a file is real, so the tail is cut here -- before validation, which still
    has to accept every chunk, the whole IDAT stream and the scanlines it
    decodes to. A file whose chunk list cannot be walked is left alone for the
    validator to reject.
    """
    pos = len(PNG_MAGIC)
    while pos + 12 <= len(data):
        length, kind = struct.unpack(">I4s", data[pos : pos + 8])
        if length > 0x7FFFFFFF:
            return data
        pos += 12 + length
        if kind == b"IEND":
            return data[:pos] if pos <= len(data) else data
    return data


def normalize_asset(data: bytes, dest: Path) -> bytes:
    """Re-encode a JPEG download as PNG and drop any post-IEND tail.

    Both fixes are lossless for the picture itself: the JPEG is decoded and
    re-encoded whole, and only bytes outside the PNG datastream are dropped.
    Every other asset passes through untouched.
    """
    if dest.suffix.lower() != ".png":
        return data
    if data.startswith(JPEG_MAGIC):
        return jpeg_to_png(data)
    return trim_after_iend(data) if data.startswith(PNG_MAGIC) else data


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
    data = normalize_asset(data, dest)
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
    bad_kinds = sorted(f"{s[0]} ({s[4]})" for s in SCHOOLS if s[4] not in SOURCE_KINDS)
    if bad_kinds:
        print(f"error: unknown source kind(s): {', '.join(bad_kinds)}", file=sys.stderr)
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
