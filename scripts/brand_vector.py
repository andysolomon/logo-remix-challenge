#!/usr/bin/env python3
"""Normalize pinned brand SVGs with reviewed, reproducible edits; never rasterize.

Edits come from scripts/brand_artwork_sources.json and run in this order:
  removeNodes  element-child index paths ("0/3/1") resolved against the original
               source tree, e.g. a wordmark or page background next to the symbol
  fill         root fill for one-color icons whose shapes rely on default black
  viewBox      reviewed crop around the remaining artwork

Usage (review helpers):
  python3 scripts/brand_vector.py fetch URL OUT [logowik]
  python3 scripts/brand_vector.py tree SOURCE.svg [DEPTH]
  python3 scripts/brand_vector.py import SOURCE.svg OPS.json OUT.svg
"""
import hashlib
import json
import re
import sys
from xml.etree import ElementTree as ET

from download_svgs import fetch
from nfl_source_download import fetch_logowik_svg
from nfl_vector_artwork import SVG, validate_vector

XLINK = 'http://www.w3.org/1999/xlink'
XML = 'http://www.w3.org/XML/1998/namespace'
ET.register_namespace('', SVG)
ET.register_namespace('xlink', XLINK)
EDITOR_ONLY = {'metadata', 'title', 'desc', 'namedview'}
OPS = {'removeNodes', 'fill', 'viewBox'}


def node_at(root, path):
    node = root
    for index in path.split('/'):
        children = list(node)
        if not index.isdigit() or int(index) >= len(children):
            raise ValueError(f'reviewed element {path} is missing; inspect the source again')
        node = children[int(index)]
    return node


def strip_editor_data(root):
    """Drop editor metadata and foreign-namespace attributes; rendering is unchanged."""
    for parent in list(root.iter()):
        for child in list(parent):
            namespace, _, tag = child.tag.rpartition('}')
            if tag in EDITOR_ONLY or (namespace and namespace != '{' + SVG):
                parent.remove(child)
    for node in root.iter():
        for key in list(node.attrib):
            namespace = key[1:].split('}')[0] if key.startswith('{') else ''
            if namespace not in ('', XLINK, XML):
                del node.attrib[key]


def number(value):
    return f'{float(value):.3f}'.rstrip('0').rstrip('.')


def import_brand_vector(raw, ops):
    unknown = set(ops) - OPS
    if unknown:
        raise ValueError(f'unsupported artwork edits: {sorted(unknown)}')
    root = ET.fromstring(raw)
    if not root.get('viewBox'):
        dimensions = [root.get(key, '') for key in ('width', 'height')]
        if all(re.fullmatch(r'\d+(?:\.\d+)?(?:px)?', n) for n in dimensions):
            root.set('viewBox', '0 0 ' + ' '.join(n.removesuffix('px') for n in dimensions))
    parents = {child: parent for parent in root.iter() for child in parent}
    # Resolve every reviewed path first so earlier removals cannot shift later indexes.
    targets = [node_at(root, path) for path in ops.get('removeNodes', [])]
    if len(set(map(id, targets))) != len(targets):
        raise ValueError('duplicate reviewed element removal')
    for node in targets:
        parents[node].remove(node)
    strip_editor_data(root)
    if 'fill' in ops:
        if not re.fullmatch(r'#[0-9A-F]{6}', ops['fill']):
            raise ValueError('fill must be an uppercase #RRGGBB color')
        root.set('fill', ops['fill'])
    if 'viewBox' in ops:
        box = [float(n) for n in ops['viewBox'].split()]
        if len(box) != 4 or min(box[2:]) <= 0:
            raise ValueError('crop needs a positive viewBox')
        root.set('viewBox', ' '.join(number(n) for n in box))
    box = [float(n) for n in re.split(r'[\s,]+', root.get('viewBox', '').strip()) if n]
    if len(box) == 4:
        # Pixel dimensions only describe the aspect ratio; CSS sizes the logo.
        root.set('width', number(box[2]))
        root.set('height', number(box[3]))
    raw = ET.tostring(root, encoding='utf-8', xml_declaration=True) + b'\n'
    validate_vector(raw)
    return raw


def fetch_source(source):
    """Download pinned bytes exactly as the refresh does, and verify their checksum."""
    raw = fetch_logowik_svg(source['sourceUrl']) if source.get('downloadForm') == 'logowik' else fetch(source['sourceUrl'])
    if source.get('sourceSha256') and hashlib.sha256(raw).hexdigest() != source['sourceSha256']:
        raise ValueError(f"{source['sourceUrl']}: source changed since review; inspect it again")
    return raw


def tree(raw, depth=3):
    def walk(node, path, level):
        for index, child in enumerate(node):
            child_path = f'{path}/{index}' if path else str(index)
            tag = child.tag.rsplit('}', 1)[-1]
            details = ' '.join(f'{k}={child.get(k)!r}' for k in ('id', 'class', 'fill', 'transform') if child.get(k))
            size = f' d[{len(child.get("d", ""))}]' if child.get('d') else ''
            print(f'{"  " * level}{child_path} <{tag}> {details}{size} children={len(child)}')
            if level + 1 < depth:
                walk(child, child_path, level + 1)
    walk(ET.fromstring(raw), '', 0)


if __name__ == '__main__':
    command = sys.argv[1] if len(sys.argv) > 1 else ''
    if command == 'fetch':
        form = sys.argv[4] if len(sys.argv) > 4 else None
        raw = fetch_source({'sourceUrl': sys.argv[2], 'downloadForm': form})
        open(sys.argv[3], 'wb').write(raw)
        print(hashlib.sha256(raw).hexdigest())
    elif command == 'tree':
        tree(open(sys.argv[2], 'rb').read(), int(sys.argv[3]) if len(sys.argv) > 3 else 3)
    elif command == 'import':
        ops = json.loads(open(sys.argv[3]).read()) if sys.argv[3] != '-' else {}
        open(sys.argv[4], 'wb').write(import_brand_vector(open(sys.argv[2], 'rb').read(), ops))
    else:
        sys.exit(__doc__)
