import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { hexToRgb, recolorSvg } from '../src/components/Logo'
import { findTeam, withLogoVariant, normalizeRound, deckFromStorage } from '../src/lib/teams'

const root = join(import.meta.dir, '..')

describe('detailed vector studies', () => {
  test('original sources reproduce the imported artwork offline and reject a stale source pin', () => {
    execFileSync('python3', ['-c', `
import hashlib, json, sys
from pathlib import Path
sys.path.insert(0, 'scripts')
from download_brand_logos import source_bytes, pinned_sources, manifest_path
from brand_vector import import_brand_vector
for league, count in [('LANDMARK', 16), ('CHAR', 6), ('GAME', 4)]:
    sources=[s for s in pinned_sources(league) if s.get('generator')]
    assert len(sources)==count
    assets={(t['id'],a['id']):a for t in json.loads(manifest_path(league).read_text())['assets'] for a in t['artwork']}
    for source in sources:
        raw=source_bytes(source, None)
        assert hashlib.sha256(raw).hexdigest()==source['sourceSha256']
        art=assets[(source['teamId'],source['id'])]
        assert import_brand_vector(raw,{})==(Path('public')/art['path'].lstrip('/')).read_bytes()
        try:source_bytes({**source,'sourceSha256':'0'*64},None)
        except ValueError:pass
        else:raise AssertionError('stale generated source accepted')
`], { cwd: root })
  })

  test('all new gradient references resolve locally, and the math palette describes visible colors', () => {
    execFileSync('python3', ['-c', `
import json,re
from pathlib import Path
from xml.etree import ElementTree as ET
paths=[a['path'] for a in json.loads(Path('public/logos/svg/education-manifest.json').read_text())['assets']]
for league in ('characters','games','landmarks'):
    paths += [a['path'] for t in json.loads(Path(f'public/logos/svg/{league}-manifest.json').read_text())['assets'] for a in t['artwork'] if a.get('generator')]
for path in paths:
    raw=(Path('public')/path.lstrip('/')).read_text();root=ET.fromstring(raw)
    ids=[n.get('id') for n in root.iter() if n.get('id')]
    assert len(ids)==len(set(ids)),path
    assert set(re.findall(r'url\\(#([^)]+)\\)',raw)) <= set(ids),path
    assert not re.search(r'<(?:image|filter|text|script)\\b|https?://(?!www.w3.org/)',raw),path
`], { cwd: root })
    expect(findTeam('MATH-PI')!.unusedSourceSlots).toEqual([2])
  })

  test('remixing changes gradient colors without flattening shading or losing a saved alternate', () => {
    for (const [id, variant] of [['SPACE-EARTH', undefined], ['SHAPE-SPHERE', undefined], ['SCIENCE-FLASK', undefined], ['LANDMARK-TAJ', undefined], ['CHAR-SPIDEY', 'webbed-mask']] as const) {
      const team = withLogoVariant(findTeam(id)!, variant)
      const raw = readFileSync(join(root, 'public', team.logo), 'utf8')
      const targets = ['#FF00AA', '#00AAFF', '#F0FF00']
      const remixed = recolorSvg(raw, (team.sourcePalette ?? team.palette).map(hexToRgb), targets.map(hexToRgb))
      expect(remixed).not.toBe(raw)
      expect(remixed.match(/(?:linear|radial)Gradient/g)?.length).toBe(raw.match(/(?:linear|radial)Gradient/g)?.length)
      expect(remixed.match(/stop-opacity="[^"]+"/g)).toEqual(raw.match(/stop-opacity="[^"]+"/g))
      expect(remixed.match(/ d="[^"]+"/g)).toEqual(raw.match(/ d="[^"]+"/g))
      const round = normalizeRound({ o: id, c: 'PRO-BUF', v: 0, l: variant })
      expect(deckFromStorage(JSON.stringify([round]))).toEqual([round])
      expect(round.l).toBe(variant)
    }
  })
})
