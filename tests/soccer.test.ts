import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  ALL_POOL_IDS, LEAGUES, TEAMS, deckFromStorage, entryNoun, filterTeams, findTeam, fullName,
  isCorrectGuess, poolTeams, randomDeck, roundHints, suggestTeams,
} from '../src/lib/teams'

const root = join(import.meta.dir, '..')
const python = (code: string) => execFileSync('python3', ['-c', code], { cwd: root })
const clubs = filterTeams('SOCCER', 'All', '')

describe('soccer clubs collection', () => {
  test('30 popular clubs are grouped by domestic league', () => {
    expect(LEAGUES.SOCCER).toEqual({
      label: 'SOCCER',
      conferences: ['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1', 'Rest of World'],
    })
    expect(clubs).toHaveLength(30)
    expect(LEAGUES.SOCCER.conferences.map((c) => filterTeams('SOCCER', c, '').length)).toEqual([8, 4, 4, 5, 2, 7])
    expect(new Set(clubs.map((t) => fullName(t))).size).toBe(30)
    expect(new Set(TEAMS.map((t) => t.id)).size).toBe(TEAMS.length)
    for (const name of ['Juventus', 'Manchester City', 'Manchester United', 'Paris Saint-Germain', 'Real Madrid', 'Arsenal', 'Barcelona', 'Bayern Munich']) {
      expect(clubs.map(fullName)).toContain(name)
    }
    expect(filterTeams('SOCCER', 'Serie A', '').map((t) => t.id).sort()).toEqual(['SOCCER-INT', 'SOCCER-JUV', 'SOCCER-MIL', 'SOCCER-NAP', 'SOCCER-ROM'])
    expect(filterTeams('SOCCER', 'La Liga', 'Arsenal')).toHaveLength(0)
    expect(entryNoun('SOCCER')).toBe('club')
  })

  test('full names, short codes, nicknames and unaccented spellings are accepted and suggested', () => {
    for (const club of clubs) {
      for (const answer of [fullName(club), club.abbr, ...(club.aliases ?? [])]) {
        expect(isCorrectGuess(answer, club)).toBe(true)
        expect(suggestTeams(answer, TEAMS.length)).toContain(club)
      }
      expect(isCorrectGuess('unrelated answer', club)).toBe(false)
    }
    expect(isCorrectGuess('Man Utd', findTeam('SOCCER-MUN')!)).toBe(true)
    expect(isCorrectGuess('man city', findTeam('SOCCER-MCI')!)).toBe(true)
    expect(isCorrectGuess('PSG', findTeam('SOCCER-PSG')!)).toBe(true)
    expect(isCorrectGuess('Juve', findTeam('SOCCER-JUV')!)).toBe(true)
    expect(isCorrectGuess('Atletico Madrid', findTeam('SOCCER-ATM')!)).toBe(true)
    expect(isCorrectGuess('Barça', findTeam('SOCCER-BAR')!)).toBe(true)
    expect(isCorrectGuess('Bayern München', findTeam('SOCCER-BAY')!)).toBe(true)
    // The city alone names neither Manchester club, and Inter means the Milan club.
    expect(isCorrectGuess('Manchester', findTeam('SOCCER-MUN')!)).toBe(false)
    expect(isCorrectGuess('Manchester', findTeam('SOCCER-MCI')!)).toBe(false)
    expect(isCorrectGuess('Inter', findTeam('SOCCER-INT')!)).toBe(true)
    expect(isCorrectGuess('Inter', findTeam('SOCCER-MIA')!)).toBe(false)
    expect(suggestTeams('real ma')[0].id).toBe('SOCCER-RMA')
  })

  test('hints name the domestic league, and random decks mix clubs with other collections', () => {
    expect(roundHints({ o: 'SOCCER-ARS', c: 'SOCCER-JUV', v: 0 })).toEqual(['Logo: Premier League', 'Colors: Serie A'])
    expect(roundHints({ o: 'SOCCER-GAL', c: 'PRO-KC', v: 0 })).toEqual(['Logo: SOCCER', 'Colors: NFL'])
    expect(ALL_POOL_IDS).toContain('Soccer')
    expect(poolTeams(['Soccer'])).toEqual(clubs)
    for (const [logos, colors] of [[['Soccer'], ['Soccer']], [['Soccer'], ['NFL']], [['Fast Food'], ['Soccer']]]) {
      const deck = randomDeck({ rounds: 20, logoPools: logos, colorPools: colors, guess: 'both', hints: true })
      expect(deck).toHaveLength(20)
      expect(new Set(deck.map((r) => r.o)).size).toBe(20)
      expect(new Set(deck.map((r) => `${r.o}|${r.c}`)).size).toBe(20)
      for (const round of deck) {
        expect(round.o).not.toBe(round.c)
        expect(poolTeams(logos)).toContain(findTeam(round.o)!)
        expect(poolTeams(colors)).toContain(findTeam(round.c)!)
      }
      expect(deckFromStorage(JSON.stringify(deck))).toEqual(deck)
    }
  })

  test('every crest is local, matches its manifest, and carries no backdrop or embedded bitmap', () => {
    for (const club of clubs) {
      expect(club.logo).toMatch(/^\/logos\/svg\/soccer\/[a-z0-9]+\.(svg|png)$/)
      expect(existsSync(join(root, 'public', club.logo))).toBe(true)
      expect(new Set(club.palette).size).toBe(3)
    }
    python(`
import json, sys
from pathlib import Path
from xml.etree import ElementTree as ET
sys.path.insert(0, 'scripts')
from download_extra_logos import inspect_artwork, palette_for, strip_background
from build_teams import dist_sq
from extra_rosters import SOCCER
teams = {t['id']: t for t in json.loads(Path('src/lib/teams.json').read_text())['teams']}
items = json.loads(Path('public/logos/svg/soccer-manifest.json').read_text())['assets']
assert sorted(i['abbr'] for i in items) == sorted(SOCCER)
for item in items:
    data = (Path('public') / item['path'].lstrip('/')).read_bytes()
    colors = inspect_artwork(data, item['format'])
    assert colors == item['colors'], item['id']
    assert (item['palette'], item['unusedSourceSlots']) == palette_for(colors, *SOCCER[item['abbr']][2:4]), item['id']
    if item['format'] == 'svg':
        assert b'<image' not in data, item['id']
        assert strip_background(ET.fromstring(data)) == 0, item['id']
    team = teams[item['id']]
    assert team['logo'] == item['path'] and team['region'] == SOCCER[item['abbr']][1] and team['name'] == ''
    assert team.get('sourcePalette', team['palette']) == item['palette']
    for slot, color in enumerate(item['palette']):
        occurs = any(dist_sq(color, fill) <= 90 * 90 for fill in colors)
        assert occurs == (slot not in item['unusedSourceSlots']), (item['id'], slot)
`)
  }, 20000)

  test('backdrop stripping removes only white or invisible absolute shapes on the canvas edge', () => {
    python(`
import sys
from xml.etree import ElementTree as ET
sys.path.insert(0, 'scripts')
from download_extra_logos import strip_background
svg = ET.fromstring('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<path id="page" fill="#ffffff" d="M 0.00 0.00 L 200.00 0.00 L 200.00 200.00 L 0.00 200.00 Z"/>
<path id="ghost" style="fill:#123456;fill-opacity:0.04" d="M 20 0 L 40 0 L 30 10 Z"/>
<path id="edge-color" fill="#ff0000" d="M 0 0 L 50 50 L 0 50 Z"/>
<path id="inner-white" fill="#ffffff" d="M 50 50 L 150 50 L 100 150 Z"/>
<path id="relative-white" fill="#fff" d="m 0 0 l 10 10 l -10 0 z"/>
<rect id="bg" width="100%" height="100%" fill="white"/>
</svg>''')
assert strip_background(svg) == 3
assert [n.get('id') for n in svg] == ['edge-color', 'inner-white', 'relative-white']
`)
  })
})
