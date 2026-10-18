import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  TEAMS, LEAGUES, COLOR_POOLS, filterTeams, findTeam, isCorrectGuess, suggestTeams,
  randomDeck, deckFromStorage, normalizeRound, nextLogoVariant, withLogoVariant,
  logoVariants, entryNoun, teamHint,
} from '../src/lib/teams'

const root = join(import.meta.dir, '..')
const collections = { ELEMENT: 118, MATH: 22, SHAPE: 20, SPACE: 13, SCIENCE: 10, NHL: 32 } as const

describe('expanded learning and NHL collections', () => {
  test('complete identities and useful subcategories, with no duplicate IDs or paths', () => {
    expect(new Set(TEAMS.map(t => t.id)).size).toBe(TEAMS.length)
    for (const [league, count] of Object.entries(collections)) {
      const entries = filterTeams(league as keyof typeof collections, 'All', '')
      expect(entries).toHaveLength(count)
      expect(new Set(entries.map(t => t.logo)).size).toBe(count)
      for (const t of entries) expect(LEAGUES[t.league].conferences).toContain(t.conference)
      expect(COLOR_POOLS.some(p => p.league === league)).toBe(false)
    }
    const elements = JSON.parse(readFileSync(join(root, 'scripts/elements.json'), 'utf8'))
    expect(elements.map((e: { number: number }) => e.number)).toEqual(Array.from({ length: 118 }, (_, i) => i + 1))
    expect(elements[117]).toEqual({ number: 118, symbol: 'Og', name: 'Oganesson' })
    expect(LEAGUES.ELEMENT.conferences.map(p => filterTeams('ELEMENT', p, '').length)).toEqual([2, 8, 8, 18, 18, 32, 32])
    expect(filterTeams('SPACE', 'Planets', '').map(t => t.region)).toEqual(['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'])
    expect(findTeam('SPACE-PLUTO')!.conference).toBe('Dwarf planets')
    expect(findTeam('NHL-UTA')!.region).toBe('Utah Mammoth')
    expect(filterTeams('NHL', 'Eastern', '')).toHaveLength(16)
    expect(filterTeams('NHL', 'Western', '')).toHaveLength(16)
  })

  test('all 50 states are present exactly once, each with a distinct outline alternate', () => {
    const codes = 'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ')
    const states = filterTeams('FLAG', 'US States', '')
    expect(states.map(s => s.abbr === 'CALI' ? 'CA' : s.abbr).sort()).toEqual(codes.sort())
    for (const state of states) {
      const alt = withLogoVariant(state, 'silhouette')
      expect(alt.logo).not.toBe(state.logo)
      expect(alt.unusedSourceSlots).toEqual([1, 2])
    }
    expect(findTeam('FLAG-OR')!.alternateLogos!.some(v => v.id === 'reverse')).toBe(true)
  })

  test('names, Unicode math, common spellings and science aliases work in search and grading', () => {
    for (const [id, answers] of [
      ['ELEMENT-Al', ['Aluminium', 'Aluminum', 'Al']], ['ELEMENT-Cs', ['Caesium', 'Cesium']],
      ['MATH-PI', ['pi', 'π']], ['MATH-SQRT', ['√', 'square root', 'radical']],
      ['MATH-SUM', ['∑', 'sigma', 'summation']], ['MATH-PERCENT', ['%', 'percent']],
      ['MATH-LESS', ['<', 'less than']], ['MATH-GREATER', ['>', 'greater than']],
      ['MATH-PERP', ['⊥', 'perpendicular']], ['SCIENCE-DNA', ['DNA', 'double helix']],
      ['SHAPE-OVAL', ['ellipse', 'oval']], ['SPACE-MOON', ['Luna']],
    ] as [string, string[]][]) {
      const t = findTeam(id)!
      for (const answer of answers) {
        expect(isCorrectGuess(answer, t)).toBe(true)
        expect(filterTeams(t.league, 'All', answer)).toContain(t)
        expect(suggestTeams(answer, TEAMS.length)).toContain(t)
      }
      expect(isCorrectGuess('unrelated answer', t)).toBe(false)
    }
    expect(isCorrectGuess('>', findTeam('MATH-LESS')!)).toBe(false)
    expect(isCorrectGuess('', findTeam('MATH-PI')!)).toBe(false)
    expect(entryNoun('ELEMENT')).toBe('element')
    expect(entryNoun('SHAPE')).toBe('shape')
    expect(teamHint(findTeam('ELEMENT-O')!)).toBe('ELEMENTS - Period 2')
  })

  test('new pools generate remixes and saved alternates keep identity through a full cycle', () => {
    for (const pool of ['ELEMENTS', 'MATH', 'SHAPES', 'SPACE', 'SCIENCE', 'NHL', 'US States']) {
      const deck = randomDeck({ rounds: 10, logoPools: [pool], colorPools: ['NFL'], guess: 'both', hints: true })
      expect(deck).toHaveLength(10)
      expect(new Set(deck.map(r => r.o)).size).toBe(10)
      expect(deckFromStorage(JSON.stringify(deck))).toEqual(deck)
    }
    for (const t of TEAMS.filter(t => t.league in collections)) {
      let variant: string | undefined
      const seen = new Set<string>()
      for (let n = 0; n < logoVariants(t).length; n++) {
        seen.add(withLogoVariant(t, variant).logo)
        const r = normalizeRound({ o: t.id, c: 'PRO-BUF', v: 0, l: variant })
        expect(deckFromStorage(JSON.stringify([r]))).toEqual([r])
        variant = nextLogoVariant(t, variant)
      }
      expect(variant).toBeUndefined()
      expect(seen.size).toBe(logoVariants(t).length)
    }
  })

  test('educational SVGs are self-contained vectors and reproduce byte-for-byte offline', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'public/logos/svg/education-manifest.json'), 'utf8'))
    expect(manifest.assets).toHaveLength(315)
    for (const asset of manifest.assets) {
      const raw = readFileSync(join(root, 'public', asset.path), 'utf8')
      expect(createHash('sha256').update(raw).digest('hex')).toBe(asset.sha256)
      expect(raw).toContain('viewBox="0 0 256 256"')
      expect(raw).not.toMatch(/<(text|image|script|foreignObject)\b|\b(?:href|onload)=/)
      expect(raw.length).toBeLessThan(15000)
    }
    execFileSync('python3', ['-c', `
import contextlib, io, sys, tempfile
from pathlib import Path
sys.path.insert(0,'scripts')
import build_education as b
from nfl_vector_artwork import validate_vector
root=Path.cwd()
before=(root/'src/lib/teams.json').read_bytes()
with tempfile.TemporaryDirectory() as folder:
    b.ROOT=Path(folder)
    (b.ROOT/'scripts').mkdir()
    (b.ROOT/'scripts/elements.json').write_bytes((root/'scripts/elements.json').read_bytes())
    b.TEAMS_JSON=b.ROOT/'teams.json';b.TEAMS_JSON.write_bytes(before)
    with contextlib.redirect_stdout(io.StringIO()):b.build()
    assert b.TEAMS_JSON.read_bytes()==before
    for p in (b.ROOT/'public').rglob('*'):
        if p.is_file():
            assert p.read_bytes()==(root/p.relative_to(b.ROOT)).read_bytes(), p
            if p.suffix=='.svg':validate_vector(p.read_bytes())
`], { cwd: root })
  })
})
