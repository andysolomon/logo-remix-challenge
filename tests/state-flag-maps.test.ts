import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  filterTeams, withLogoVariant, nextLogoVariant, logoVariants, normalizeRound, deckFromStorage,
} from '../src/lib/teams'

const root = join(import.meta.dir, '..')
const states = filterTeams('FLAG', 'US States', '')

describe('state flags inside state boundaries', () => {
  test('all 50 states have an accessible flag-map alternate alongside the original and silhouette', () => {
    expect(states).toHaveLength(50)
    for (const team of states) {
      const map = withLogoVariant(team, 'flag-map')
      expect(map.logo).toBe(`/logos/svg/flags/alternates/${team.abbr.toLowerCase()}-flag-map.svg`)
      expect(map.logo).not.toBe(team.logo)
      expect(withLogoVariant(team, 'silhouette').logo).not.toBe(map.logo)
      expect(readFileSync(join(root, 'public', map.logo), 'utf8')).toContain('<svg')
      let current: string | undefined
      const seen = new Set<string>()
      for (let n = 0; n < logoVariants(team).length; n++) {
        seen.add(withLogoVariant(team, current).logo)
        current = nextLogoVariant(team, current)
      }
      expect(current).toBeUndefined()
      expect(seen.has(map.logo)).toBe(true)
      for (const donor of [undefined, 'PRO-BUF']) {
        const round = normalizeRound({ o: team.id, c: donor, l: 'flag-map', v: 0 })
        expect(deckFromStorage(JSON.stringify([round]))).toEqual([round])
        expect(round.l).toBe('flag-map')
      }
    }
  })

  test('compositions reproduce offline, keep exact multi-part geography, and reject changed inputs', () => {
    execFileSync('python3', ['-c', `
import hashlib,json,re,sys
from pathlib import Path
from xml.etree import ElementTree as ET
sys.path.insert(0,'scripts')
import state_flag_artwork as g
from download_brand_logos import source_bytes
from brand_vector import import_brand_vector
sources=[s for s in json.loads(Path('scripts/brand_artwork_sources.json').read_text()) if s.get('generator')=='state_flag_artwork']
assert len(sources)==49, 'Texas keeps its existing flag map'
for s in sources:
    raw=source_bytes(s,None)
    output=Path('public/logos/svg/flags/alternates')/(s['teamId'][5:].lower()+'-flag-map.svg')
    assert import_brand_vector(raw,{})==output.read_bytes(),s['teamId']
    root=ET.fromstring(raw)
    clip=root.find('.//{*}clipPath')
    shape=ET.parse(Path('public')/s['inputs'][1]['path'].lstrip('/')).getroot()
    assert [p.get('d') for p in clip] == [p.get('d') for p in shape.iter() if p.tag.endswith('}path')],s['teamId']
    assert root.get('viewBox')==shape.get('viewBox'),s['teamId']
    ids=[n.get('id') for n in root.iter() if n.get('id')]
    assert len(ids)==len(set(ids)),s['teamId']
    for n in root.iter():
        for key,value in n.attrib.items():
            for target in re.findall(r'url\\(#([^)]+)\\)',value):assert target in ids,(s['teamId'],target)
            if key.rsplit('}',1)[-1]=='href':assert value.startswith('#') and value[1:] in ids,(s['teamId'],value)
    assert not any(n.tag.rsplit('}',1)[-1] in ('image','text','script','foreignObject') for n in root.iter())
    assert root.find('./{*}g/{*}svg').get('preserveAspectRatio')!='none',s['teamId']
    bad={**s,'inputs':[{**s['inputs'][0],'sha256':'0'*64},s['inputs'][1]]}
    try:g.render(bad)
    except ValueError:pass
    else:raise AssertionError('changed flag accepted')
    bad={**s,'inputs':[{**s['inputs'][0],'path':'/../unrelated.svg'},s['inputs'][1]]}
    try:g.render(bad)
    except ValueError:pass
    else:raise AssertionError('unrelated input accepted')
`], { cwd: root, maxBuffer: 1024 * 1024 })
  }, 30000)
})
