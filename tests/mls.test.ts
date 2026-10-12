import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  ALL_POOL_IDS, LEAGUES, TEAMS, colorPoolTeams, deckFromStorage, entryNoun, filterTeams, findTeam, fullName,
  isCorrectGuess, normalizeRound, poolTeams, randomDeck, roundHints, suggestTeams,
} from '../src/lib/teams'

const root = join(import.meta.dir, '..')
const python = (code: string) => execFileSync('python3', ['-c', code], { cwd: root })
const clubs = filterTeams('MLS', 'All', '')

describe('MLS collection', () => {
  test('all 30 clubs are split evenly between the two conferences', () => {
    expect(LEAGUES.MLS).toEqual({ label: 'MLS', conferences: ['Eastern', 'Western'] })
    expect(clubs).toHaveLength(30)
    expect(filterTeams('MLS', 'Eastern', '')).toHaveLength(15)
    expect(filterTeams('MLS', 'Western', '')).toHaveLength(15)
    expect(new Set(clubs.map(fullName)).size).toBe(30)
    expect(new Set(TEAMS.map((t) => t.id)).size).toBe(TEAMS.length)
    for (const name of ['Inter Miami', 'LA Galaxy', 'LAFC', 'Red Bull New York', 'New York City FC', 'San Diego FC', 'CF Montréal', 'Seattle Sounders']) {
      expect(clubs.map(fullName)).toContain(name)
    }
    expect(filterTeams('MLS', 'Western', '').map((t) => t.id)).toContain('MLS-SD')
    expect(filterTeams('MLS', 'Eastern', 'Galaxy')).toHaveLength(0)
    expect(entryNoun('MLS')).toBe('club')
  })

  test('full names, short codes and nicknames are accepted; a shared city alone names neither club', () => {
    for (const club of clubs) {
      for (const answer of [fullName(club), club.abbr, ...(club.aliases ?? [])]) {
        expect(isCorrectGuess(answer, club)).toBe(true)
        expect(suggestTeams(answer, TEAMS.length)).toContain(club)
      }
      expect(isCorrectGuess('unrelated answer', club)).toBe(false)
    }
    expect(isCorrectGuess('Galaxy', findTeam('MLS-LA')!)).toBe(true)
    expect(isCorrectGuess('New York Red Bulls', findTeam('MLS-RBNY')!)).toBe(true)
    expect(isCorrectGuess('NYCFC', findTeam('MLS-NYC')!)).toBe(true)
    expect(isCorrectGuess('CF Montreal', findTeam('MLS-MTL')!)).toBe(true)
    expect(isCorrectGuess('DC United', findTeam('MLS-DC')!)).toBe(true)
    expect(isCorrectGuess('Sounders', findTeam('MLS-SEA')!)).toBe(true)
    expect(isCorrectGuess('Austin', findTeam('MLS-ATX')!)).toBe(true)
    for (const id of ['MLS-RBNY', 'MLS-NYC']) expect(isCorrectGuess('New York', findTeam(id)!)).toBe(false)
    for (const id of ['MLS-LA', 'MLS-LAFC']) expect(isCorrectGuess('Los Angeles', findTeam(id)!)).toBe(false)
    expect(isCorrectGuess('United', findTeam('MLS-ATL')!)).toBe(false)
    expect(suggestTeams('inter mia')[0].id).toBe('MLS-MIA')
  })

  test('hints name MLS, clubs are logo-only, and random decks mix them with other collections', () => {
    expect(roundHints({ o: 'MLS-ATL', c: 'PRO-KC', v: 0 })).toEqual(['Logo: MLS', 'Colors: NFL'])
    expect(ALL_POOL_IDS).toContain('MLS')
    expect(poolTeams(['MLS'])).toEqual(clubs)
    expect(colorPoolTeams(['MLS'])).toEqual([])
    expect(randomDeck({ rounds: 20, logoPools: ['NFL'], colorPools: ['MLS'], guess: 'both', hints: true })).toEqual([])
    const deck = randomDeck({ rounds: 20, logoPools: ['MLS'], colorPools: ['NBA'], guess: 'both', hints: true })
    expect(deck).toHaveLength(20)
    expect(new Set(deck.map((r) => r.o)).size).toBe(20)
    for (const round of deck) {
      expect(findTeam(round.o)!.league).toBe('MLS')
      expect(findTeam(round.c)!.league).toBe('NBA')
    }
    expect(deckFromStorage(JSON.stringify(deck))).toEqual(deck)
  })

  test('Inter Miami moved from SOCCER to MLS, and saved rounds follow it', () => {
    expect(findTeam('SOCCER-MIA')).toBeUndefined()
    expect(filterTeams('SOCCER', 'All', 'Miami')).toEqual([])
    const kept = { o: 'PRO-BUF', c: 'NBA-LAL', v: 0, g: 'both' as const }
    const saved = JSON.stringify([{ o: 'SOCCER-MIA', c: 'PRO-KC', v: 2, g: 'team' }, kept])
    expect(deckFromStorage(saved)).toEqual([
      normalizeRound({ o: 'MLS-MIA', c: 'PRO-KC', v: 2, g: 'team' }),
      normalizeRound(kept),
    ])
  })

  test('every crest is local vector artwork that matches its manifest and the pinned ESPN roster', () => {
    for (const club of clubs) {
      expect(club.logo).toMatch(/^\/logos\/svg\/mls\/[a-z]+\.svg$/)
      expect(existsSync(join(root, 'public', club.logo))).toBe(true)
      expect(new Set(club.palette).size).toBe(3)
    }
    python(`
import json, sys
from pathlib import Path
from xml.etree import ElementTree as ET
sys.path.insert(0, 'scripts')
from download_extra_logos import inspect_artwork, palette_for, strip_background
from nfl_vector_artwork import validate_vector
from extra_rosters import MLS
teams = {t['id']: t for t in json.loads(Path('src/lib/teams.json').read_text())['teams']}
items = json.loads(Path('public/logos/svg/mls-manifest.json').read_text())['assets']
assert sorted(i['abbr'] for i in items) == sorted(MLS)
assert len({row[7] for row in MLS.values()}) == 30
for item in items:
    data = (Path('public') / item['path'].lstrip('/')).read_bytes()
    validate_vector(data)
    colors = inspect_artwork(data, item['format'])
    assert item['format'] == 'svg' and colors == item['colors'], item['id']
    assert (item['palette'], item['unusedSourceSlots']) == palette_for(colors, *MLS[item['abbr']][2:4]), item['id']
    assert strip_background(ET.fromstring(data)) == 0, item['id']
    team = teams[item['id']]
    assert team['logo'] == item['path'] and team['region'] == MLS[item['abbr']][1] and team['name'] == ''
    assert team['conference'] == MLS[item['abbr']][0]
    assert team.get('sourcePalette', team['palette']) == item['palette']
`)
  }, 20000)
})
