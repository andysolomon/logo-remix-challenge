#!/usr/bin/env python3
"""Refresh the pinned NFL alternate marks without changing team identities or palettes.

Requires Pillow for PNG validation. Existing assets are reused unless --force is
provided. All sources and all 32 teams must validate before any data is replaced.
Source dates describe the artwork, not a claim that historical logos are primary.
"""
import argparse
import hashlib
import io
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from xml.etree import ElementTree as ET

from build_teams import atomic_write_text, fmt_entry
from download_extra_logos import inspect_artwork, palette_for
from download_svgs import fetch

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
        suffix = 'svg' if '.svg' in source['sourceUrl'].lower() else 'png'
        path = f"/logos/svg/nfl/alternates/{team['abbr'].lower()}-{source['id']}.{suffix}"
        target = ROOT / 'public' / path.lstrip('/')
        previous = cached.get((team['id'], source['id']))
        reuse = not force and previous and previous['sourceUrl'] == source['sourceUrl'] and target.exists()
        raw = target.read_bytes() if reuse else fetch(source['sourceUrl'])
        if reuse and hashlib.sha256(raw).hexdigest() != previous['sha256']:
            raise ValueError(f"{team['id']}: cached artwork checksum differs; review or refresh with --force")
        if suffix == 'png':
            from PIL import Image
            image = Image.open(io.BytesIO(raw)).convert('RGBA')
            image.load()
            if not image.getbbox() or (not reuse and image.getextrema()[3][0] == 255 and team['id'] != 'PRO-ARI'):
                raise ValueError(f"{team['id']}: empty artwork or opaque background")
            image = image.crop(image.getbbox())
            image.thumbnail((768, 768))
            padded = Image.new('RGBA', (image.width + 6, image.height + 6))
            padded.paste(image, (3, 3))
            output = io.BytesIO()
            padded.save(output, format='PNG', optimize=True)
            raw = output.getvalue()
        else:
            root = ET.fromstring(raw)
            if not root.get('viewBox'):
                root.set('viewBox', f"0 0 {root.get('width')} {root.get('height')}")
                raw = ET.tostring(root, encoding='utf-8', xml_declaration=True)
            raw = ('\n'.join(line.rstrip() for line in raw.decode().splitlines()) + '\n').encode()
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
