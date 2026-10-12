#!/usr/bin/env python3
"""Trace a flat one-color raster mark into SVG outlines, for the rare mark with no public vector.

The game's rule is real vector artwork: importers reject bitmaps and never trace on their
own. A pinned alternate may carry a reviewed ``trace`` edit instead, when the owner asked
for a mark that is only published as a bitmap (Kennesaw Mountain's KM monogram exists
only as JPG and PNG exports). The edit names everything that shapes the result:

  fill       the ink color the outlines are filled with (uppercase #RRGGBB)
  threshold  luminance from 0 to 1 below which a pixel counts as ink
  turdsize   speckles of at most this many pixels are dropped (potrace's default is 2)

potrace (the pure-Python ``potracer`` package, a dev-time tool like Pillow) turns the
thresholded bitmap into Bezier outlines. The result is an ordinary SVG with the source
image's pixel grid as its viewBox, so the usual brand_vector.py edits crop it and
validate_vector() checks it like any downloaded file. Checked-in artwork is reused, so a
refresh only needs potracer when the source or its trace edit changes, or with --force.
"""
import io
import re

TRACE_KEYS = {"fill", "threshold", "turdsize"}


def _point(p) -> str:
    return f"{p.x:.2f}".rstrip("0").rstrip(".") + " " + f"{p.y:.2f}".rstrip("0").rstrip(".")


def trace_raster(raw: bytes, spec: dict) -> bytes:
    unknown = set(spec) - TRACE_KEYS
    if unknown or not {"fill", "threshold"} <= set(spec):
        raise ValueError(f"trace needs fill and threshold, and supports only {sorted(TRACE_KEYS)}")
    if not re.fullmatch(r"#[0-9A-F]{6}", spec["fill"]):
        raise ValueError("trace fill must be an uppercase #RRGGBB color")
    if not 0 < spec["threshold"] < 1:
        raise ValueError("trace threshold must lie between 0 and 1")
    turdsize = spec.get("turdsize", 2)
    if type(turdsize) is not int or turdsize < 0:
        raise ValueError("trace turdsize must be a non-negative integer")
    # Imported here: only a refresh that actually re-traces needs these dev-time packages.
    import potrace
    from PIL import Image

    image = Image.open(io.BytesIO(raw))
    if image.mode in ("RGBA", "LA", "P"):
        # Transparent pixels are background, not ink.
        backdrop = Image.new("RGBA", image.size, "white")
        image = Image.alpha_composite(backdrop, image.convert("RGBA"))
    gray = image.convert("L")
    curves = potrace.Bitmap(gray, blacklevel=spec["threshold"]).trace(turdsize=turdsize)
    if not curves:
        raise ValueError("trace found no ink; check the threshold")
    d = []
    for curve in curves:
        d.append("M" + _point(curve.start_point))
        for segment in curve:
            if segment.is_corner:
                d.append("L" + _point(segment.c) + "L" + _point(segment.end_point))
            else:
                d.append("C" + _point(segment.c1) + " " + _point(segment.c2) + " " + _point(segment.end_point))
        d.append("Z")
    # Even-odd keeps counters (the holes in letters) open whatever their winding.
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {gray.width} {gray.height}">'
            f'<path fill="{spec["fill"]}" fill-rule="evenodd" d="{"".join(d)}"/></svg>\n').encode()
