"""Compose a state's pinned flag and silhouette into a standalone vector alternate.

Striped flags cover the shape; uniform-field flags fit over their own field color.
Reviewed placements keep emblems recognizable without stretching the flag.
State geometry stays exactly as imported, including islands and separate parts.
The reviewed flagViewBox removes the primary asset's transparent display padding.
"""
from copy import deepcopy
import hashlib
import json
import math
from pathlib import Path
import re
from xml.etree import ElementTree as ET

from brand_rosters import FLAG
from nfl_vector_artwork import SVG, validate_vector

ROOT = Path(__file__).resolve().parent.parent
XLINK = 'http://www.w3.org/1999/xlink'
ET.register_namespace('', SVG)
ET.register_namespace('xlink', XLINK)
STATES = {row[0] for row in FLAG if row[2] == 'US States'}


def number(value):
    return format(float(value), '.9g')


def bounds(value):
    box = [float(v) for v in re.split(r'[\s,]+', value.strip())]
    if len(box) != 4 or not all(math.isfinite(v) for v in box) or min(box[2:]) <= 0:
        raise ValueError('expected a finite, positive viewBox')
    return box


def prefix_ids(root, prefix):
    """Isolate the flag's gradients, clips, uses and CSS ID selectors."""
    ids = {n.get('id'): prefix + n.get('id') for n in root.iter() if n.get('id')}
    # One compiled alternation avoids re-scanning every large path once per ID.
    pattern = re.compile(r'#(' + '|'.join(re.escape(key) for key in sorted(ids, key=len, reverse=True)) + r')(?![\w.-])') if ids else None
    def rewrite(value):
        return pattern.sub(lambda match: '#' + ids[match[1]], value) if pattern else value
    for node in root.iter():
        for key, value in list(node.attrib.items()):
            node.set(key, ids[value] if key == 'id' else rewrite(value))
        if node.tag == f'{{{SVG}}}style' and node.text:
            node.text = rewrite(node.text)


def clip_paths(root):
    """clipPath accepts geometry directly; flatten groups while retaining transforms."""
    result = []
    def walk(node, transforms=(), rule='nonzero'):
        tag = node.tag.rsplit('}', 1)[-1]
        if tag not in ('svg', 'g', 'path'):
            raise ValueError(f'unreviewed silhouette element: {tag}')
        if node.get('transform'):
            transforms = (*transforms, node.get('transform'))
        rule = node.get('fill-rule', rule)
        if tag == 'path':
            attrs = {'d': node.attrib['d'], 'clip-rule': rule}
            if transforms:
                attrs['transform'] = ' '.join(transforms)
            result.append(ET.Element(f'{{{SVG}}}path', attrs))
        for child in node:
            walk(child, transforms, rule)
    walk(root)
    if not result:
        raise ValueError('silhouette contains no paths')
    return result


def render(source):
    abbr = source['teamId'].removeprefix('FLAG-')
    if source['teamId'] != f'FLAG-{abbr}' or abbr not in STATES or source['id'] != 'flag-map':
        raise ValueError('state flag compositions require a US state and the flag-map variant')
    expected = [f'/logos/svg/flags/{abbr.lower()}.svg', f'/logos/svg/flags/alternates/{abbr.lower()}-silhouette.svg']
    inputs = source['inputs']
    if [item['path'] for item in inputs] != expected:
        raise ValueError('state flag inputs must be its own primary flag and silhouette')
    roots = []
    for item in inputs:
        raw = (ROOT / 'public' / item['path'].lstrip('/')).read_bytes()
        if hashlib.sha256(raw).hexdigest() != item['sha256']:
            raise ValueError(f"{item['path']}: input changed; review and repin the composition")
        roots.append(validate_vector(raw))
    flag, shape = roots
    box = bounds(shape.attrib['viewBox'])
    flag_box = bounds(source['flagViewBox'])
    original_box = bounds(flag.attrib['viewBox'])
    if any(flag_box[i] < original_box[i] - .01 or flag_box[i] + flag_box[i+2] > original_box[i] + original_box[i+2] + .01 for i in (0, 1)):
        raise ValueError('reviewed flag crop must stay inside its source viewBox')
    root = ET.Element(f'{{{SVG}}}svg', {
        'viewBox': ' '.join(map(number, box)), 'width': number(box[2]), 'height': number(box[3]),
        # Clip geometry does not paint a color or invent an extra remix palette role.
        'fill': 'none',
    })
    defs = ET.SubElement(root, f'{{{SVG}}}defs')
    clip_id = f'state-outline-{abbr.lower()}'
    clip = ET.SubElement(defs, f'{{{SVG}}}clipPath', {'id': clip_id, 'clipPathUnits': 'userSpaceOnUse'})
    clip.extend(clip_paths(shape))
    group = ET.SubElement(root, f'{{{SVG}}}g', {'clip-path': f'url(#{clip_id})'})
    background = source.get('backgroundFill')
    if background:
        if not re.fullmatch(r'#[0-9A-F]{6}', background):
            raise ValueError('background must be a reviewed flag field color')
        ET.SubElement(group, f'{{{SVG}}}rect', {**dict(zip(('x', 'y', 'width', 'height'), map(number, box))), 'fill': background})
    fit = source.get('flagFit', 'xMidYMid slice')
    if fit not in ('xMidYMid slice', 'xMinYMid slice', 'xMidYMid meet'):
        raise ValueError('unsupported flag fitting mode')
    if fit.endswith('meet') and not background:
        raise ValueError('fitted flags need a continuous background field')
    frame = source.get('flagFrame', [0, 0, 1, 1])
    if len(frame) != 4 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in frame) or min(frame) < 0 or min(frame[2:]) <= 0 or frame[0] + frame[2] > 1 or frame[1] + frame[3] > 1:
        raise ValueError('flag frame must stay within the state viewport')
    flag_rect = [box[0] + frame[0]*box[2], box[1] + frame[1]*box[3], frame[2]*box[2], frame[3]*box[3]]
    flag = deepcopy(flag)
    prefix_ids(flag, f'flag-{abbr.lower()}-')
    flag.attrib.update(dict(zip(('x', 'y', 'width', 'height'), map(number, flag_rect))))
    flag.set('viewBox', ' '.join(map(number, flag_box)))
    flag.set('preserveAspectRatio', fit)
    flag.set('overflow', 'hidden')
    # Nested SVGs inherit outer fill; preserve the original document's default black.
    if 'fill' not in flag.attrib:
        flag.set('fill', '#000000')
    group.append(flag)
    raw = ET.tostring(root, encoding='utf-8', xml_declaration=True) + b'\n'
    validate_vector(raw)
    return raw


if __name__ == '__main__':
    # Regenerate only the source pins after reviewed crop/input changes. Existing
    # downloader and roster-builder commands publish the validated assets.
    path = ROOT / 'scripts/brand_artwork_sources.json'
    sources = json.loads(path.read_text())
    for source in sources:
        if source.get('generator') == 'state_flag_artwork':
            source['sourceSha256'] = hashlib.sha256(render(source)).hexdigest()
    path.write_text(json.dumps(sources, indent=2, ensure_ascii=False) + '\n')
