import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ALL_POOL_IDS, TEAMS, LEAGUES, COLOR_POOLS, filterTeams, findTeam, fullName, isCorrectGuess, suggestTeams,
  randomDeck, deckFromStorage, colorPoolTeams, poolTeams, roundHints, entryNoun, teamHint, remixLayout, logoVariants,
} from '../src/lib/teams'

const root = join(import.meta.dir, '..')
const landmarks = filterTeams('LANDMARK', 'All', '')
const regions = { Americas: 8, Europe: 14, 'Asia & Pacific': 15, 'Africa & Middle East': 3 }

describe('world landmarks collection', () => {
  test('40 landmarks grouped by region, with unique IDs, names and local vector artwork', () => {
    expect(landmarks).toHaveLength(40)
    expect(LEAGUES.LANDMARK).toEqual({ label: 'LANDMARKS', conferences: Object.keys(regions) })
    for (const [region, count] of Object.entries(regions)) expect(filterTeams('LANDMARK', region, '')).toHaveLength(count)
    expect(new Set(TEAMS.map((t) => t.id)).size).toBe(TEAMS.length)
    expect(new Set(landmarks.map((t) => fullName(t))).size).toBe(40)
    expect(new Set(landmarks.map((t) => t.logo)).size).toBe(40)
    for (const t of landmarks) {
      expect(t.logo).toBe(`/logos/svg/landmarks/${t.abbr.toLowerCase()}.svg`)
      expect(existsSync(join(root, 'public', t.logo))).toBe(true)
      expect(logoVariants(t)).toHaveLength(1)
      expect(t.showsName).toBeUndefined()
    }
    expect(fullName(findTeam('LANDMARK-LIBERTY')!)).toBe('Statue of Liberty')
    expect(findTeam('LANDMARK-GOLDENGATE')!.conference).toBe('Americas')
    expect(findTeam('LANDMARK-EIFFEL')!.conference).toBe('Europe')
    expect(findTeam('LANDMARK-TAJ')!.conference).toBe('Asia & Pacific')
    expect(findTeam('LANDMARK-SKYTREE')!.conference).toBe('Asia & Pacific')
    expect(findTeam('LANDMARK-PYRAMIDS')!.conference).toBe('Africa & Middle East')
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
      ['LANDMARK-REDEEMER', ['Christ the Redeemer', 'Cristo Redentor']], ['LANDMARK-ARCH', ['Gateway Arch', 'St. Louis Arch']],
      ['LANDMARK-COLOSSEUM', ['Colosseum', 'Coliseum']], ['LANDMARK-PISA', ['Leaning Tower of Pisa', 'Tower of Pisa']],
      ['LANDMARK-PARTHENON', ['Parthenon', 'Acropolis']], ['LANDMARK-GREATWALL', ['Great Wall of China', 'Great Wall']],
      ['LANDMARK-FUJI', ['Mount Fuji', 'Mt. Fuji', 'Fujisan']], ['LANDMARK-HARBOUR', ['Sydney Harbour Bridge', 'Sydney Harbor Bridge']],
      ['LANDMARK-MOAI', ['Moai', 'Easter Island']], ['LANDMARK-SPHINX', ['Great Sphinx of Giza', 'Sphinx']],
      ['LANDMARK-RUSHMORE', ['Mount Rushmore', 'Mt. Rushmore']], ['LANDMARK-STBASIL', ["Saint Basil's Cathedral", "St. Basil's Cathedral"]],
      ['LANDMARK-SKYTREE', ['Tokyo Skytree', 'Skytree']], ['LANDMARK-EVEREST', ['Mount Everest', 'Everest', 'Sagarmatha']],
      ['LANDMARK-WHITEHOUSE', ['White House', 'The White House']], ['LANDMARK-MONTSTMICHEL', ['Mont-Saint-Michel', 'Mont Saint-Michel']],
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
    expect(isCorrectGuess('Tokyo Skytree', findTeam('LANDMARK-EIFFEL')!)).toBe(false)
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

  test('one-color silhouettes remix onto a tile and frame; multi-color illustrations paint their own slots', () => {
    const silhouettes = landmarks.filter((t) => t.unusedSourceSlots?.length === 2)
    expect(silhouettes.length).toBeGreaterThanOrEqual(20)
    for (const t of landmarks) {
      const layout = remixLayout(t)
      const used = t.unusedSourceSlots ?? []
      expect(layout.frame !== undefined).toBe(used.length === 2)
      expect(layout.backdrop !== undefined).toBe(used.length >= 1)
    }
    for (const id of ['LANDMARK-LIBERTY', 'LANDMARK-EIFFEL', 'LANDMARK-BURJ', 'LANDMARK-BRANDENBURG']) expect(findTeam(id)!.unusedSourceSlots).toEqual([1, 2])
    for (const id of ['LANDMARK-BIGBEN', 'LANDMARK-ATOMIUM', 'LANDMARK-ARC']) expect(findTeam(id)!.unusedSourceSlots).toBeUndefined()
  })

  test('every landmark is a pinned Openclipart (CC0) vector, imported through the brand pipeline', () => {
    const sources = JSON.parse(readFileSync(join(root, 'scripts/brand_artwork_sources.json'), 'utf8')) as { teamId: string; id: string; sourceUrl: string; sourcePage: string }[]
    const pinned = sources.filter((s) => s.teamId.startsWith('LANDMARK-'))
    expect(pinned).toHaveLength(40)
    expect(new Set(pinned.map((s) => s.teamId))).toEqual(new Set(landmarks.map((t) => t.id)))
    for (const s of pinned) {
      expect(s.id).toBe('primary')
      expect(s.sourceUrl).toMatch(/^https:\/\/openclipart\.org\/download\/\d+\//)
      expect(s.sourcePage).toMatch(/^https:\/\/openclipart\.org\/detail\/\d+\/[a-z0-9-]+$/)
    }
    const manifest = JSON.parse(readFileSync(join(root, 'public/logos/svg/landmarks-manifest.json'), 'utf8'))
    expect(manifest.assets).toHaveLength(40)
    for (const asset of manifest.assets) {
      const raw = readFileSync(join(root, 'public', asset.artwork[0].path), 'utf8')
      expect(raw).not.toMatch(/<(text|image|script|foreignObject)\b/)
      expect(raw.length).toBeLessThanOrEqual(400_000)
    }
    // The downloader reuses verified checked-in files, so the dry run below needs no network.
    execFileSync('python3', ['-c', `
import sys, io, contextlib, json
sys.path.insert(0, 'scripts')
from pathlib import Path
import download_brand_logos as d
before = Path('public/logos/svg/landmarks-manifest.json').read_bytes()
files = {p: p.read_bytes() for p in Path('public/logos/svg/landmarks').glob('*.svg')}
with contextlib.redirect_stdout(io.StringIO()): d.refresh('LANDMARK')
assert Path('public/logos/svg/landmarks-manifest.json').read_bytes() == before
assert {p: p.read_bytes() for p in Path('public/logos/svg/landmarks').glob('*.svg')} == files
`], { cwd: root })
  }, 60000)
})
