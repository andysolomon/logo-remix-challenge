import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ALL_POOL_IDS, TEAMS, LEAGUES, COLOR_POOLS, filterTeams, findTeam, fullName, isCorrectGuess, suggestTeams,
  randomDeck, deckFromStorage, colorPoolTeams, poolTeams, roundHints, entryNoun, teamHint, remixLayout, logoVariants,
} from '../src/lib/teams'

const root = join(import.meta.dir, '..')
const landmarks = filterTeams('LANDMARK', 'All', '')
const regions = { Americas: 18, Europe: 18, 'Asia & Pacific': 18, 'Africa & Middle East': 12 }

describe('world landmarks collection', () => {
  test('66 landmarks grouped by region, with unique IDs, names and artwork', () => {
    expect(landmarks).toHaveLength(66)
    expect(LEAGUES.LANDMARK).toEqual({ label: 'LANDMARKS', conferences: Object.keys(regions) })
    for (const [region, count] of Object.entries(regions)) expect(filterTeams('LANDMARK', region, '')).toHaveLength(count)
    expect(new Set(TEAMS.map((t) => t.id)).size).toBe(TEAMS.length)
    expect(new Set(landmarks.map((t) => fullName(t))).size).toBe(66)
    expect(new Set(landmarks.map((t) => t.logo)).size).toBe(66)
    for (const t of landmarks) {
      expect(t.logo).toMatch(/^\/logos\/svg\/landmarks\/[a-z]+\.svg$/)
      expect(t.palette).toEqual(['#183153', '#009688', '#FFFFFF'])
      expect(t.alternateLogos).toBeUndefined()
      expect(t.showsName).toBeUndefined()
    }
    expect(fullName(findTeam('LANDMARK-LIBERTY')!)).toBe('Statue of Liberty')
    expect(findTeam('LANDMARK-GOLDENGATE')!.conference).toBe('Americas')
    expect(findTeam('LANDMARK-EIFFEL')!.conference).toBe('Europe')
    expect(findTeam('LANDMARK-TAJ')!.conference).toBe('Asia & Pacific')
    expect(findTeam('LANDMARK-PYRAMIDS')!.conference).toBe('Africa & Middle East')
    expect(findTeam('LANDMARK-RUSHMORE')!.conference).toBe('Americas')
    expect(findTeam('LANDMARK-STBASIL')!.conference).toBe('Europe')
    expect(findTeam('LANDMARK-ULURU')!.conference).toBe('Asia & Pacific')
    expect(findTeam('LANDMARK-PALM')!.conference).toBe('Africa & Middle East')
  })

  test('hints name the region and search uses the landmark noun', () => {
    expect(entryNoun('LANDMARK')).toBe('landmark')
    expect(teamHint(findTeam('LANDMARK-EIFFEL')!)).toBe('LANDMARKS - Europe')
    expect(teamHint(findTeam('LANDMARK-OPERA')!)).toBe('LANDMARKS - Asia & Pacific')
    expect(roundHints({ o: 'LANDMARK-LIBERTY', c: 'PRO-KC', v: 0 })).toEqual(['Logo: LANDMARKS - Americas', 'Colors: NFL - AFC'])
    expect(roundHints({ o: 'LANDMARK-SPHINX', v: 0 })).toEqual(['Logo: LANDMARKS - Africa & Middle East'])
  })

  test('names, common names and accent-free spellings work in grading, search and autocomplete', () => {
    for (const [id, answers] of [
      ['LANDMARK-LIBERTY', ['Statue of Liberty', 'Lady Liberty']], ['LANDMARK-GOLDENGATE', ['Golden Gate Bridge', 'Golden Gate']],
      ['LANDMARK-REDEEMER', ['Christ the Redeemer', 'Cristo Redentor']], ['LANDMARK-CHICHEN', ['Chichén Itzá', 'Chichen Itza', 'El Castillo']],
      ['LANDMARK-COLOSSEUM', ['Colosseum', 'Coliseum']], ['LANDMARK-PISA', ['Leaning Tower of Pisa', 'Tower of Pisa']],
      ['LANDMARK-PARTHENON', ['Parthenon', 'Acropolis']], ['LANDMARK-GREATWALL', ['Great Wall of China', 'Great Wall']],
      ['LANDMARK-FUJI', ['Mount Fuji', 'Mt. Fuji', 'Fujisan']], ['LANDMARK-HARBOUR', ['Sydney Harbour Bridge', 'Sydney Harbor Bridge']],
      ['LANDMARK-MOAI', ['Moai', 'Easter Island']], ['LANDMARK-SPHINX', ['Great Sphinx of Giza', 'Sphinx']],
      ['LANDMARK-PETRA', ['Petra', 'Al-Khazneh']], ['LANDMARK-KILIMANJARO', ['Mount Kilimanjaro', 'Kilimanjaro']],
      ['LANDMARK-RUSHMORE', ['Mount Rushmore', 'Mt. Rushmore']], ['LANDMARK-SUGARLOAF', ['Sugarloaf Mountain', 'Pão de Açúcar', 'Pao de Acucar']],
      ['LANDMARK-SAGRADA', ['Sagrada Família', 'Sagrada Familia']], ['LANDMARK-STBASIL', ["Saint Basil's Cathedral", "St. Basil's Cathedral"]],
      ['LANDMARK-LONDONEYE', ['London Eye', 'Millennium Wheel']], ['LANDMARK-ULURU', ['Uluru', 'Ayers Rock']],
      ['LANDMARK-EVEREST', ['Mount Everest', 'Everest', 'Sagarmatha']], ['LANDMARK-WHITEHOUSE', ['White House', 'The White House']],
      ['LANDMARK-PALM', ['Palm Jumeirah', 'The Palm']], ['LANDMARK-KARNAK', ['Karnak Temple', 'Karnak']],
    ] as [string, string[]][]) {
      const t = findTeam(id)!
      for (const answer of answers) {
        expect(isCorrectGuess(answer, t)).toBe(true)
        expect(filterTeams('LANDMARK', 'All', answer)).toContain(t)
        expect(suggestTeams(answer, TEAMS.length)).toContain(t)
      }
      expect(isCorrectGuess('unrelated answer', t)).toBe(false)
    }
    // A country or city is never the answer, and one landmark never answers another.
    expect(isCorrectGuess('France', findTeam('LANDMARK-EIFFEL')!)).toBe(false)
    expect(isCorrectGuess('Paris', findTeam('LANDMARK-EIFFEL')!)).toBe(false)
    expect(isCorrectGuess('Tokyo Tower', findTeam('LANDMARK-EIFFEL')!)).toBe(false)
    expect(isCorrectGuess('', findTeam('LANDMARK-EIFFEL')!)).toBe(false)
  })

  test('landmarks are a logo-only random-deck pool that persists through storage', () => {
    expect(ALL_POOL_IDS).toContain('LANDMARKS')
    expect(COLOR_POOLS.some((p) => p.league === 'LANDMARK')).toBe(false)
    expect(poolTeams(['LANDMARKS'])).toEqual(landmarks)
    expect(colorPoolTeams(['LANDMARKS'])).toEqual([])
    expect(randomDeck({ rounds: 10, logoPools: ['LANDMARKS'], colorPools: ['LANDMARKS'], guess: 'both', hints: true })).toEqual([])
    for (const colors of [['NFL'], ['NBA'], ['SEC']]) {
      const deck = randomDeck({ rounds: 20, logoPools: ['LANDMARKS'], colorPools: colors, guess: 'both', hints: true })
      expect(deck).toHaveLength(20)
      expect(new Set(deck.map((r) => r.o)).size).toBe(20)
      for (const round of deck) expect(findTeam(round.o)!.league).toBe('LANDMARK')
      expect(deckFromStorage(JSON.stringify(deck))).toEqual(deck)
    }
  })

  test('every figure paints all three palette slots, so no landmark sits on a backdrop tile', () => {
    for (const t of landmarks) {
      expect(logoVariants(t)).toHaveLength(1)
      expect(t.unusedSourceSlots).toBeUndefined()
      expect(remixLayout(t)).toEqual({ artwork: [0, 1, 2] })
      const raw = readFileSync(join(root, 'public', t.logo), 'utf8')
      for (const color of t.palette) expect([t.id, raw.includes(color)]).toEqual([t.id, true])
    }
  })

  test('landmark SVGs are self-contained vectors and reproduce byte-for-byte offline', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'public/logos/svg/landmarks-manifest.json'), 'utf8'))
    expect(manifest.generator).toBe('scripts/build_landmarks.py')
    expect(manifest.assets).toHaveLength(66)
    expect(manifest.assets.map((a: { path: string }) => a.path)).toEqual(landmarks.map((t) => t.logo))
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
import build_landmarks as b
from nfl_vector_artwork import validate_vector
root=Path.cwd()
before=(root/'src/lib/teams.json').read_bytes()
with tempfile.TemporaryDirectory() as folder:
    b.ROOT=Path(folder)
    b.TEAMS_JSON=b.ROOT/'teams.json';b.TEAMS_JSON.write_bytes(before)
    with contextlib.redirect_stdout(io.StringIO()):b.build()
    assert b.TEAMS_JSON.read_bytes()==before
    files=[p for p in (b.ROOT/'public').rglob('*') if p.is_file()]
    assert len(files)==67, len(files)
    for p in files:
        assert p.read_bytes()==(root/p.relative_to(b.ROOT)).read_bytes(), p
        if p.suffix=='.svg':validate_vector(p.read_bytes())
`], { cwd: root })
  })
})
