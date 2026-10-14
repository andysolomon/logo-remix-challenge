#!/usr/bin/env python3
"""Clip rasters that keep their own colors: relief maps to a place's outline, and space photos to the planet.

A relief map comes as a JPEG or PNG, as an SVG wrapping one opaque bitmap that fills its sheet
(extracted directly), or as an SVG drawn from vectors or from a translucent hillshade over vector
colors (Wikipedia's state series). The last kind is rendered with a headless Chromium found on
PATH or named by CHROME_BIN; checked-in terrain needs no browser.

Wikipedia's location-map data names a relief image per country or state and the
equirectangular bounds it covers (top, bottom, left, right in degrees). The outline is
a silhouette cut from a map sheet and reprojected to plain degrees (map_projection's
"geographic" output), so laying it over the raster is linear. The result is a PNG with
transparency: the raster inside the outline, cropped to it, scaled down and quantized to
a 255-color palette so the file stays small. clip_space does the same for a NASA photo on
black: the black that touches the edges becomes transparent (a flood fill, so a planet's
dark features and the gap inside Saturn's rings are told apart from the sky). Needs Pillow.
"""
import base64
import io
import math
import os
import re
import shutil
import subprocess
import tempfile
from xml.etree import ElementTree as ET

from PIL import Image, ImageChops, ImageDraw

MAX_EDGE = 512
SUPERSAMPLE = 3
MARGIN = 0.03
COLORS = 255
RENDER_WIDTH = 2000
BROWSERS = ('chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome', '/opt/pw-browsers/chromium')
SPACE_THRESHOLD = 28
SPACE_WORKING_EDGE = 1024
NUMBER = re.compile(r'[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?')


def _placement(node, box, ancestors):
    """Where an SVG <image> lands on its sheet: x, y, width, height after its own and its groups' transforms
    (translate, scale and axis-aligned matrix only)."""
    x, y = float(node.get('x', 0)), float(node.get('y', 0))
    w, h = float(node.get('width', box[2])), float(node.get('height', box[3]))
    chain = ' '.join(n.get('transform', '') for n in [node, *ancestors])
    for name, args in re.findall(r'(\w+)\s*\(([^)]*)\)', chain):
        a = [float(v) for v in NUMBER.findall(args)]
        if name == 'translate':
            x, y = x + a[0], y + (a[1] if len(a) > 1 else 0)
        elif name == 'scale':
            sx, sy = a[0], a[1] if len(a) > 1 else a[0]
            x, y, w, h = x * sx, y * sy, w * sx, h * sy
        elif name == 'matrix' and abs(a[1]) < 1e-9 and abs(a[2]) < 1e-9:
            x, y, w, h = a[0] * x + a[4], a[3] * y + a[5], a[0] * w, a[3] * h
        else:
            raise ValueError(f'unsupported bitmap transform {name}')
    return x, y, w, h


def find_browser():
    for name in (os.environ.get('CHROME_BIN'), *BROWSERS):
        if name and (shutil.which(name) or (os.path.isfile(name) and os.access(name, os.X_OK))):
            return shutil.which(name) or name
    return None


def render_svg(raw, box, width=RENDER_WIDTH):
    """Rasterize a whole SVG sheet with headless Chromium at the given width (sheet aspect ratio)."""
    browser = find_browser()
    if not browser:
        raise ValueError('rendering this relief map needs Chromium (install it or set CHROME_BIN)')
    height = max(1, round(width * box[3] / box[2]))
    with tempfile.TemporaryDirectory() as folder:
        sheet = os.path.join(folder, 'sheet.svg')
        page = os.path.join(folder, 'page.html')
        shot = os.path.join(folder, 'shot.png')
        with open(sheet, 'wb') as out:
            out.write(raw)
        with open(page, 'w') as out:
            out.write(f'<!doctype html><html><body style="margin:0;background:#fff"><img src="sheet.svg" style="display:block;width:{width}px;height:{height}px"></body></html>')
        subprocess.run([browser, '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1',
                        f'--user-data-dir={os.path.join(folder, "profile")}', f'--window-size={width},{height}', f'--screenshot={shot}', 'file://' + page],
                       check=True, capture_output=True, timeout=120)
        image = Image.open(shot)
        image.load()
    return image.convert('RGBA')


def _sheet_box(root):
    box = [float(n) for n in re.split(r'[\s,]+', root.get('viewBox', '').strip()) if n]
    if len(box) != 4:
        box = [0.0, 0.0, float(root.get('width')), float(root.get('height'))]
    return tuple(box)


def decode_raster(raw):
    """A JPEG or PNG, or an SVG sheet: one opaque embedded bitmap is extracted, anything else is rendered.

    Returns the image, the sheet box the georeference applies to and the bitmap's placement on it,
    both in sheet units (for a plain or rendered bitmap, its own pixel box twice).
    """
    if not raw.lstrip().startswith(b'<'):
        image = Image.open(io.BytesIO(raw))
        image.load()
        image = image.convert('RGBA')
        box = (0.0, 0.0, float(image.width), float(image.height))
        return image, box, box
    root = ET.fromstring(raw)
    box = _sheet_box(root)
    images = [n for n in root.iter() if n.tag.rsplit('}', 1)[-1] == 'image']
    if len(images) == 1:
        href = next((v for k, v in images[0].attrib.items() if k.rsplit('}', 1)[-1] == 'href'), '')
        match = re.match(r'data:image/(?:png|jpeg|jpg);base64,(.*)', href, re.S)
        if match:
            parents = {child: parent for parent in root.iter() for child in parent}
            ancestors = []
            node = images[0]
            while node in parents:
                node = parents[node]
                ancestors.append(node)
            placement = _placement(images[0], box, ancestors)
            image = Image.open(io.BytesIO(base64.b64decode(match.group(1))))
            image.load()
            image = image.convert('RGBA')
            histogram = image.getchannel('A').histogram()
            opaque = sum(histogram[240:]) / (image.width * image.height)
            covers = placement[2] * placement[3] >= 0.9 * box[2] * box[3]
            if opaque > 0.98 and covers:
                return image, box, placement
    # Vector relief, a translucent hillshade over vector colors, or several layers: draw the whole sheet.
    image = render_svg(raw, box)
    pixels = (0.0, 0.0, float(image.width), float(image.height))
    return image, pixels, pixels


def outline_polygons(outline_svg):
    """Rings of (longitude, latitude) from a geographic outline (absolute M/L segments)."""
    polygons = []
    for node in ET.fromstring(outline_svg).iter():
        if node.tag.rsplit('}', 1)[-1] != 'path':
            continue
        for ring in re.findall(r'M[^MZ]*', node.get('d', '')):
            numbers = [float(n) for n in NUMBER.findall(ring)]
            points = [(numbers[i], -numbers[i + 1]) for i in range(0, len(numbers) - 1, 2)]
            if len(points) >= 3:
                polygons.append(points)
    if not polygons:
        raise ValueError('the outline has no rings')
    return polygons


def clip_relief(raw, bounds, outline_svg, max_edge=MAX_EDGE):
    image, sheet, placed = decode_raster(raw)
    width, height = image.size
    top, bottom, left, right = (float(bounds[k]) for k in ('top', 'bottom', 'left', 'right'))
    if top <= bottom or right <= left:
        raise ValueError('relief bounds must run top to bottom and left to right')

    def to_pixel(lon, lat):
        # Degrees to sheet units (the bounds describe the whole sheet), then to the bitmap's own pixels.
        sx = sheet[0] + (lon - left) / (right - left) * sheet[2]
        sy = sheet[1] + (top - lat) / (top - bottom) * sheet[3]
        return (sx - placed[0]) / placed[2] * width, (sy - placed[1]) / placed[3] * height

    polygons = [[to_pixel(lon, lat) for lon, lat in ring] for ring in outline_polygons(outline_svg)]
    xs = [x for ring in polygons for x, _ in ring]
    ys = [y for ring in polygons for _, y in ring]
    if min(xs) < -0.02 * width or min(ys) < -0.02 * height or max(xs) > 1.02 * width or max(ys) > 1.02 * height:
        raise ValueError('the outline falls outside the relief bitmap; check the bounds')
    margin = MARGIN * max(max(xs) - min(xs), max(ys) - min(ys))
    box = (max(0, math.floor(min(xs) - margin)), max(0, math.floor(min(ys) - margin)),
           min(width, math.ceil(max(xs) + margin)), min(height, math.ceil(max(ys) + margin)))
    crop = image.crop(box)
    mask = Image.new('L', (crop.width * SUPERSAMPLE, crop.height * SUPERSAMPLE), 0)
    draw = ImageDraw.Draw(mask)
    for ring in polygons:
        draw.polygon([((x - box[0]) * SUPERSAMPLE, (y - box[1]) * SUPERSAMPLE) for x, y in ring], fill=255)
    mask = mask.resize(crop.size, Image.LANCZOS)
    crop.putalpha(ImageChops.multiply(crop.getchannel('A'), mask))
    return finish(crop, max_edge)


def finish(image, max_edge=MAX_EDGE):
    """Scale an RGBA image down to the edge limit and quantize it to a small palette PNG."""
    scale = min(1.0, max_edge / max(image.size))
    if scale < 1.0:
        image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.LANCZOS)
    quantized = image.quantize(colors=COLORS, method=Image.Quantize.FASTOCTREE)
    out = io.BytesIO()
    quantized.save(out, 'PNG', optimize=True)
    return out.getvalue()


def clip_space(raw, max_edge=MAX_EDGE, threshold=SPACE_THRESHOLD):
    """A photo on black sky: the sky that reaches the edges turns transparent, then the subject is cropped out."""
    image, _, _ = decode_raster(raw)
    scale = min(1.0, SPACE_WORKING_EDGE / max(image.size))
    if scale < 1.0:
        image = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    bright = image.convert('RGB').point(lambda v: 255 if v > threshold else 0).convert('L')
    # A pixel is sky when all channels sit under the threshold; flood the sky in from every edge.
    sky = Image.eval(bright, lambda v: 0 if v else 255)
    width, height = sky.size
    subject = sky.copy()
    for x in range(0, width, max(1, width // 16)):
        for y in (0, height - 1):
            if subject.getpixel((x, y)) == 255:
                ImageDraw.floodfill(subject, (x, y), 128)
    for y in range(0, height, max(1, height // 16)):
        for x in (0, width - 1):
            if subject.getpixel((x, y)) == 255:
                ImageDraw.floodfill(subject, (x, y), 128)
    alpha = subject.point(lambda v: 0 if v == 128 else 255)
    box = alpha.getbbox()
    if box is None:
        raise ValueError('the photo is all sky')
    margin = math.ceil(MARGIN * max(box[2] - box[0], box[3] - box[1]))
    box = (max(0, box[0] - margin), max(0, box[1] - margin), min(width, box[2] + margin), min(height, box[3] + margin))
    image.putalpha(ImageChops.multiply(image.getchannel('A'), alpha))
    return finish(image.crop(box), max_edge)
