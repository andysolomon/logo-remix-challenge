#!/usr/bin/env python3
"""Refresh the pinned NFL alternate marks without changing team identities or palettes.

Requires Pillow for PNG validation; original AI/EPS sources need Inkscape and
Ghostscript. Existing assets are reused unless --force is
provided. All sources and all 32 teams must validate before any data is replaced.
Source dates describe the artwork, not a claim that historical logos are primary.
"""
import argparse
import hashlib
import io
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from build_teams import atomic_write_text, fmt_entry
from download_extra_logos import inspect_artwork, palette_for
from download_svgs import fetch
from nfl_vector_artwork import import_vector, validate_vector
from nfl_source_download import fetch_logowik_svg

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / 'scripts/nfl_alternate_sources.json'
MANIFEST = ROOT / 'public/logos/svg/nfl-alternates-manifest.json'
TEAMS = ROOT / 'src/lib/teams.json'


def refresh(force=False):
    text = TEAMS.read_text()
    data = json.loads(text)
    teams = {t['id']: t for t in data['teams'] if t['league'] == 'PRO'}
    sources = json.loads(SOURCES.read_text())
    if len(teams) != 32 or {s['teamId'] for s in sources} != set(teams):
        raise ValueError('alternate sources must cover the complete 32-team NFL roster')
    if len({(s['teamId'], s['id']) for s in sources}) != len(sources):
        raise ValueError('duplicate alternate ids')
    cached = {(s['teamId'], s['id']): s for s in json.loads(MANIFEST.read_text())} if MANIFEST.exists() else {}

    def download(source):
        team = teams[source['teamId']]
        suffix = source.get('format') or ('svg' if '.svg' in source['sourceUrl'].lower() else 'png')
        if suffix not in {'svg', 'png'}:
            raise ValueError(f"unsupported artwork format: {suffix}")
        path = f"/logos/svg/nfl/alternates/{team['abbr'].lower()}-{source['id']}.{suffix}"
        target = ROOT / 'public' / path.lstrip('/')
        previous = cached.get((team['id'], source['id']))
        source_keys = ('sourceUrl', 'downloadForm', 'inputFormat', 'archiveMember', 'removeElements', 'removePaths', 'cropToArtwork', 'removeWhitePage')
        reuse = not force and previous and all(previous.get(k) == source.get(k) for k in source_keys) and previous['format'] == suffix and target.exists()
        if source.get('downloadForm') not in {None, 'logowik'}:
            raise ValueError('unsupported source download form')
        raw = target.read_bytes() if reuse else (
            fetch_logowik_svg(source['sourceUrl']) if source.get('downloadForm') == 'logowik'
            else fetch(source['sourceUrl']))
        if reuse and hashlib.sha256(raw).hexdigest() != previous['sha256']:
            raise ValueError(f"{team['id']}: cached artwork checksum differs; review or refresh with --force")
        if suffix == 'png':
            from PIL import Image, ImageDraw
            image = Image.open(io.BytesIO(raw)).convert('RGBA')
            image.load()
            if source.get('removeWhitePage') and not reuse:
                corners = [(0, 0), (image.width - 1, 0), (0, image.height - 1),
                           (image.width - 1, image.height - 1)]
                if any(image.getpixel(corner) != (255, 255, 255, 255) for corner in corners):
                    raise ValueError('reviewed white page background changed')
                # Remove only white connected to the page edge; enclosed white
                # details in these reviewed mascot sources remain artwork.
                for corner in corners:
                    if image.getpixel(corner)[3]:
                        ImageDraw.floodfill(image, corner, (255, 255, 255, 0))
            if not image.getbbox() or (not reuse and image.getextrema()[3][0] == 255 and team['id'] != 'PRO-ARI'):
                raise ValueError(f"{team['id']}: empty artwork or opaque background")
            image = image.crop(image.getbbox())
            if source.get('minRasterSize') and max(image.size) < source['minRasterSize']:
                raise ValueError(f"{team['id']}: raster source is too small; upscaling is not a quality upgrade")
            padded = Image.new('RGBA', (image.width + 6, image.height + 6))
            padded.paste(image, (3, 3))
            output = io.BytesIO()
            padded.save(output, format='PNG', optimize=True)
            raw = output.getvalue()
        else:
            if not reuse:
                raw = import_vector(raw, source)
            validate_vector(raw)
        colors = inspect_artwork(raw, suffix)
        palette, unused = palette_for(colors, team['palette'][0].lstrip('#'), team['palette'][1].lstrip('#'))
        item = {**source, 'path': path, 'format': suffix, 'sourcePalette': palette,
                'unusedSourceSlots': unused, 'colors': colors, 'sha256': hashlib.sha256(raw).hexdigest()}
        print(f"{team['id']}: {source['label']} ({len(raw)} bytes)", flush=True)
        return item, raw

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(download, sources))
    for item, raw in results:
        dest = ROOT / 'public' / item['path'].lstrip('/')
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(raw)
    for team in teams.values():
        team['alternateLogos'] = [
            {'id': item['id'], 'label': item['label'], 'logo': item['path'],
             'sourcePalette': item['sourcePalette'], 'unusedSourceSlots': item['unusedSourceSlots']}
            for item, _ in results if item['teamId'] == team['id']
        ]
    atomic_write_text(MANIFEST, json.dumps([item for item, _ in results], indent=2) + '\n')
    start = text.index('"teams": [')
    end = text.index('\n  ]', start)
    text = text[:start] + '"teams": [\n' + ',\n'.join(fmt_entry(t) for t in data['teams']) + text[end:]
    json.loads(text)
    atomic_write_text(TEAMS, text)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--force', action='store_true')
    refresh(parser.parse_args().force)
