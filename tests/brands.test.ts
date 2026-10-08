import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')
const python = (code: string) => execFileSync('python3', ['-c', code], { cwd: root })

describe('brand artwork pipeline', () => {
  test('reviewed edits strip a wordmark and crop, and reject stale or unsafe sources', () => {
    python(`
import sys
sys.path.insert(0, 'scripts')
from xml.etree import ElementTree as ET
from brand_vector import import_brand_vector
def svg(body, attrs=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:i="urn:editor" viewBox="0 0 100 100" {attrs}>{body}</svg>'.encode()
source = svg('<metadata>editor</metadata><path fill="#E2203D" d="M0 0h40v40z"/><path fill="#000" d="M50 50h40v10z"/>', 'i:junk="1"')
raw = import_brand_vector(source, {'removeNodes': ['2'], 'viewBox': '-1 -1 42 42'})
root = ET.fromstring(raw)
assert root.get('viewBox') == '-1 -1 42 42' and root.get('width') == '42'
assert len(root) == 1 and root[0].get('fill') == '#E2203D', 'wordmark or editor data kept'
assert not any(k.startswith('{urn:editor}') for k in root.attrib), 'editor attributes kept'
assert ET.fromstring(import_brand_vector(svg('<path d="M0 0h9v9z"/>'), {'fill': '#00754A'})).get('fill') == '#00754A'
for raw, ops in [(source, {'removeNodes': ['9']}), (source, {'removeNodes': ['1', '1']}),
                 (source, {'fill': 'red'}), (source, {'viewBox': '0 0 0 10'}), (source, {'recolor': {}}),
                 (svg('<text>Brand</text>'), {}), (svg('<image href="logo.png"/>'), {}),
                 (svg('<path d="M0 0h9v9z"/><text>Brand</text>'), {'removeNodes': ['0']})]:
    try: import_brand_vector(raw, ops)
    except (ValueError, IndexError): pass
    else: raise AssertionError(f'unsafe artwork or edit accepted: {ops}')
`)
  })
})
