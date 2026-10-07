"""Import real vector artwork; never trace or wrap a raster image as SVG."""
import io
import math
import re
import subprocess
import tempfile
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

SVG = 'http://www.w3.org/2000/svg'
ET.register_namespace('', SVG)
SHAPES = {'path', 'polygon', 'polyline', 'rect', 'circle', 'ellipse', 'line'}


def validate_vector(raw):
    root = ET.fromstring(raw)
    if root.tag != f'{{{SVG}}}svg':
        raise ValueError('expected an SVG document')
    try:
        box = [float(n) for n in re.split(r'[\s,]+', root.get('viewBox', '').strip())]
        valid = len(box) == 4 and all(math.isfinite(n) for n in box) and min(box[2:]) > 0
    except ValueError:
        valid = False
    if not valid:
        raise ValueError('vector artwork needs a finite, positive viewBox')
    tags = {node.tag.rsplit('}', 1)[-1] for node in root.iter()}
    if tags & {'image', 'foreignObject', 'script', 'text'}:
        raise ValueError('artwork must contain vector outlines, not bitmaps, scripts or live fonts')
    if not tags & SHAPES:
        raise ValueError('vector artwork has no shapes')
    for node in root.iter():
        for key, value in node.attrib.items():
            if key.rsplit('}', 1)[-1] == 'href' and not value.startswith('#'):
                raise ValueError('vector artwork references an external resource')
    return root


def import_vector(raw, source):
    """Convert an original AI/EPS asset, or normalize a downloaded SVG."""
    format = source.get('inputFormat', 'svg')
    if source.get('archiveMember'):
        with ZipFile(io.BytesIO(raw)) as archive:
            raw = archive.read(source['archiveMember'])
    if format in {'ai', 'eps'}:
        with tempfile.TemporaryDirectory() as folder:
            original = Path(folder) / f'original.{format}'
            original.write_bytes(raw)
            if format == 'eps':
                pdf = Path(folder) / 'original.pdf'
                subprocess.run(['gs', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dEPSCrop',
                                '-sDEVICE=pdfwrite', f'-sOutputFile={pdf}', str(original)],
                               check=True, capture_output=True)
                original = pdf
            output = Path(folder) / 'vector.svg'
            subprocess.run(['inkscape', str(original), '--export-type=svg', '--export-plain-svg',
                            '--export-text-to-path', '--export-area-drawing', f'--export-filename={output}'],
                           check=True, capture_output=True)
            raw = output.read_bytes()
    elif format != 'svg':
        raise ValueError(f'unsupported vector source format: {format}')
    root = ET.fromstring(raw)
    if not root.get('viewBox'):
        dimensions = [root.get(key, '') for key in ('width', 'height')]
        if all(re.fullmatch(r'\d+(?:\.\d+)?(?:px)?', n) for n in dimensions):
            root.set('viewBox', '0 0 ' + ' '.join(n.removesuffix('px') for n in dimensions))
    # Source elements are reviewed against the original before removal.
    # This removes a page background, never an inferred white artwork color.
    removals = source.get('removePaths', [])
    removed = []
    for parent in root.iter():
        for child in list(parent):
            if child.get('id') in source.get('removeElements', []) or (
                    child.tag == f'{{{SVG}}}path' and child.get('d') in removals):
                removed.append(child.get('d'))
                parent.remove(child)
    if any(removed.count(path) != 1 for path in removals):
        raise ValueError('reviewed page background changed; inspect the source again')
    raw = ET.tostring(root, encoding='utf-8', xml_declaration=True) + b'\n'
    validate_vector(raw)
    if source.get('cropToArtwork'):
        with tempfile.TemporaryDirectory() as folder:
            original = Path(folder) / 'original.svg'
            output = Path(folder) / 'cropped.svg'
            original.write_bytes(raw)
            subprocess.run(['inkscape', str(original),
                            f'--actions=page-fit-to-selection;export-filename:{output};export-plain-svg;export-do'],
                           check=True, capture_output=True)
            root = validate_vector(output.read_bytes())
            raw = ET.tostring(root, encoding='utf-8', xml_declaration=True) + b'\n'
    return raw
