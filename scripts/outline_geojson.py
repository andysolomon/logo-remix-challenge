#!/usr/bin/env python3
"""Cut one place's outline from a Natural Earth GeoJSON file as vector artwork.

Natural Earth (public domain) publishes georeferenced country and state outlines. A
reviewed edit picks one feature by its properties ("feature": {"ADM0_A3": "ITA"}),
optionally keeps only the polygons whose center lies inside a window ("within":
[west, south, east, north], to leave out overseas territories and far-flung islands),
projects the rings ("projection": "mercator" for an upright silhouette, "geographic"
for plain degrees that lay over a relief raster), and simplifies them ("simplify",
a Douglas-Peucker tolerance in projected units). The result is a plain SVG whose
fill and viewBox crop are then applied like any other brand artwork.
"""
import json
import math
from xml.etree import ElementTree as ET

from nfl_vector_artwork import SVG

MAX_LAT = 85.0
OPS = {'feature', 'within', 'projection', 'simplify'}
_features = {}


def mercator(lon, lat):
    """One unit per degree of longitude, y growing southward."""
    lat = max(-MAX_LAT, min(MAX_LAT, lat))
    return lon, -math.degrees(math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))


def geographic(lon, lat):
    """Plain degrees, y growing southward like every other SVG coordinate here."""
    return lon, -lat


PROJECTIONS = {'mercator': mercator, 'geographic': geographic}


def simplify(points, tolerance):
    """Douglas-Peucker: drop vertices that stray less than the tolerance from the line between their neighbors."""
    if tolerance <= 0 or len(points) < 3:
        return list(points)
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        (ax, ay), (bx, by) = points[first], points[last]
        length = math.hypot(bx - ax, by - ay)
        far, far_at = 0.0, -1
        for i in range(first + 1, last):
            px, py = points[i]
            distance = abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length if length else math.hypot(px - ax, py - ay)
            if distance > far:
                far, far_at = distance, i
        if far > tolerance:
            keep[far_at] = True
            stack.extend([(first, far_at), (far_at, last)])
    return [p for p, k in zip(points, keep) if k]


def select_feature(raw, wanted):
    """The one feature whose properties carry every wanted key and value."""
    key = (id(raw), json.dumps(wanted, sort_keys=True))
    if key not in _features:
        if not isinstance(wanted, dict) or not wanted:
            raise ValueError('feature selection needs a property dictionary')
        matches = [f for f in json.loads(raw)['features'] if all(f.get('properties', {}).get(k) == v for k, v in wanted.items())]
        if len(matches) != 1:
            raise ValueError(f'{len(matches)} features match {wanted}; the selection must name exactly one')
        _features[key] = matches[0]['geometry']
    return _features[key]


def polygons(geometry, within=None):
    """Polygon rings in degrees: outer rings first in each polygon, holes after; windowed by polygon center."""
    if geometry['type'] == 'Polygon':
        shapes = [geometry['coordinates']]
    elif geometry['type'] == 'MultiPolygon':
        shapes = geometry['coordinates']
    else:
        raise ValueError(f"outline must be a polygon, not {geometry['type']}")
    if within is not None:
        if len(within) != 4 or within[0] >= within[2] or within[1] >= within[3]:
            raise ValueError('within needs [west, south, east, north]')
        west, south, east, north = within
        kept = []
        for shape in shapes:
            xs = [x for x, _ in shape[0]]
            ys = [y for _, y in shape[0]]
            cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
            if west <= cx <= east and south <= cy <= north:
                kept.append(shape)
        shapes = kept
    if not shapes:
        raise ValueError('no polygon of the feature lies inside the window')
    return shapes


def outline_svg(raw, ops):
    """Plain SVG of the selected, windowed, projected and simplified outline (fill-rule evenodd keeps holes)."""
    unknown = set(ops) - OPS
    if unknown:
        raise ValueError(f'unsupported outline edits: {sorted(unknown)}')
    project = PROJECTIONS.get(ops.get('projection'))
    if project is None:
        raise ValueError(f"outline projection must be one of {sorted(PROJECTIONS)}")
    tolerance = float(ops.get('simplify', 0))
    xs, ys, parts = [], [], []
    for shape in polygons(select_feature(raw, ops.get('feature')), ops.get('within')):
        for ring in shape:
            points = simplify([project(lon, lat) for lon, lat in ring], tolerance)
            if len(points) < 4:
                continue
            xs.extend(x for x, _ in points)
            ys.extend(y for _, y in points)
            parts.append('M' + ' L'.join(f'{x:.2f} {y:.2f}' for x, y in points[:-1]) + ' Z')
    if not parts:
        raise ValueError('the outline simplified away; lower the tolerance')
    root = ET.Element(f'{{{SVG}}}svg', {'viewBox': f'{min(xs):.2f} {min(ys):.2f} {max(xs) - min(xs):.2f} {max(ys) - min(ys):.2f}'})
    ET.SubElement(root, f'{{{SVG}}}path', {'d': ' '.join(parts), 'fill-rule': 'evenodd'})
    return ET.tostring(root, encoding='utf-8', xml_declaration=True) + b'\n'


def projected_bounds(raw, ops):
    """Bounding box of the outline in projected units, for reviewing a crop."""
    root = ET.fromstring(outline_svg(raw, ops))
    x, y, w, h = (float(n) for n in root.get('viewBox').split())
    return x, y, x + w, y + h
