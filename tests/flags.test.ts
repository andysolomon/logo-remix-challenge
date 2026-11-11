import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ALL_POOL_IDS, LEAGUES, TEAMS, colorPoolTeams, deckFromStorage, entryNoun, filterTeams, findTeam, fullName,
  isCorrectGuess, logoPoolTeams, normalizeRound, poolTeams, randomDeck, roundHints, suggestTeams, teamHint, withLogoVariant,
} from '../src/lib/teams'

const root = join(import.meta.dir, '..')
const flags = filterTeams('FLAG', 'All', '')
const REGIONS = ['Americas', 'Europe', 'Asia & Pacific', 'Africa & Middle East', 'US States', 'Cities']
/** The 17 flags that opened as BRANDS' Place type. */
const MOVED = ['TX', 'CANADA', 'JAPAN', 'CHICAGO', 'MEXICO', 'USA', 'UK', 'BRAZIL', 'KOREA', 'JAMAICA', 'PR', 'CALI', 'AUS', 'INDIA', 'TURKEY', 'GREECE', 'ARG']
/** Places whose outline is too small on the map sheets for a readable silhouette; they keep the flag only. */
const NO_SILHOUETTE = ['FLAG-BAHAMAS', 'FLAG-BARBADOS', 'FLAG-PR', 'FLAG-SG', 'FLAG-TT']

describe('the FLAGS collection', () => {
  test('123 flags are grouped by region, and BRANDS no longer has a Place type', () => {
    expect(LEAGUES.FLAG).toEqual({ label: 'FLAGS', conferences: REGIONS })
    expect(flags).toHaveLength(123)
    expect(REGIONS.map((r) => filterTeams('FLAG', r, '').length)).toEqual([17, 19, 15, 14, 50, 8])
    expect(new Set(flags.map((t) => fullName(t))).size).toBe(123)
    expect(LEAGUES.BRAND.conferences).not.toContain('Place')
    expect(TEAMS.filter((t) => t.league === 'BRAND' && t.conference === 'Place')).toEqual([])
    for (const abbr of MOVED) {
      expect(findTeam(`BRAND-${abbr}`)).toBeUndefined()
      expect(findTeam(`FLAG-${abbr}`)!.league).toBe('FLAG')
    }
    expect(filterTeams('FLAG', 'US States', 'georgia').map((t) => t.id)).toEqual(['FLAG-GA'])
    expect(filterTeams('FLAG', 'Europe', 'georgia')).toEqual([])
    expect(filterTeams('FLAG', 'Cities', '').map((t) => t.id)).toEqual(['FLAG-AMS', 'FLAG-CHICAGO', 'FLAG-DC', 'FLAG-DENVER', 'FLAG-PDX', 'FLAG-PHX', 'FLAG-STL', 'FLAG-TOKYO'])
    expect(entryNoun('FLAG')).toBe('flag')
  })

  test('names, codes and nicknames grade and autocomplete', () => {
    for (const team of flags) {
      for (const answer of [fullName(team), team.abbr, ...(team.aliases ?? [])]) {
        expect(isCorrectGuess(answer, team)).toBe(true)
        if (answer.replace(/[^a-z0-9]/gi, '').length >= 2) expect(suggestTeams(answer, TEAMS.length)).toContain(team)
      }
      expect(isCorrectGuess('unrelated answer', team)).toBe(false)
    }
    expect(isCorrectGuess('Deutschland', findTeam('FLAG-GERMANY')!)).toBe(true)
    expect(isCorrectGuess('Espana', findTeam('FLAG-SPAIN')!)).toBe(true)
    expect(isCorrectGuess('Washington DC', findTeam('FLAG-DC')!)).toBe(true)
    expect(isCorrectGuess('Peach State', findTeam('FLAG-GA')!)).toBe(true)
    expect(isCorrectGuess('Chicago', findTeam('FLAG-CHILE')!)).toBe(false)
  })

  test('hints name the region, flags are logo-only, and random decks draw them', () => {
    expect(teamHint(findTeam('FLAG-ITALY')!)).toBe('FLAGS - Europe')
    expect(roundHints({ o: 'FLAG-TX', c: 'PRO-KC', v: 0 })).toEqual(['Logo: FLAGS - US States', 'Colors: NFL - AFC'])
    expect(roundHints({ o: 'FLAG-TOKYO', v: 0 })).toEqual(['Logo: FLAGS - Cities'])
    expect(ALL_POOL_IDS).toContain('Flags')
    expect(poolTeams(['Flags'])).toHaveLength(123)
    expect(logoPoolTeams(['Flags'])).toHaveLength(123)
    expect(colorPoolTeams(['Flags'])).toEqual([])
    expect(randomDeck({ rounds: 20, logoPools: ['NFL'], colorPools: ['Flags'], guess: 'both', hints: true })).toEqual([])
    const deck = randomDeck({ rounds: 20, logoPools: ['Flags'], colorPools: ['NBA'], guess: 'both', hints: true })
    expect(deck).toHaveLength(20)
    expect(new Set(deck.map((r) => r.o)).size).toBe(20)
    for (const round of deck) {
      expect(findTeam(round.o)!.league).toBe('FLAG')
      expect(findTeam(round.c)!.league).toBe('NBA')
    }
    expect(deckFromStorage(JSON.stringify(deck))).toEqual(deck)
  })

  test('saved rounds follow the flags that moved out of BRANDS, alternates included', () => {
    const kept = { o: 'PRO-BUF', c: 'NBA-LAL', v: 0, g: 'both' as const }
    const saved = JSON.stringify([
      { o: 'BRAND-TX', c: 'PRO-KC', v: 2, g: 'team', l: 'flag-map' },
      { o: 'BRAND-JAPAN', v: 0 },
      { o: 'BRAND-CANADA', c: 'COL-ALA', v: 1, l: 'maple-leaf' },
      kept,
    ])
    expect(deckFromStorage(saved)).toEqual([
      normalizeRound({ o: 'FLAG-TX', c: 'PRO-KC', v: 2, g: 'team', l: 'flag-map' }),
      normalizeRound({ o: 'FLAG-JAPAN', v: 0 }),
      normalizeRound({ o: 'FLAG-CANADA', c: 'COL-ALA', v: 1, l: 'maple-leaf' }),
      normalizeRound(kept),
    ])
    expect('c' in deckFromStorage(saved)[1]).toBe(false)
    expect(withLogoVariant(findTeam('FLAG-TX')!, 'flag-map').logo).toBe('/logos/svg/flags/alternates/tx-flag-map.svg')
    expect(withLogoVariant(findTeam('FLAG-CANADA')!, 'maple-leaf').logo).toBe('/logos/svg/flags/alternates/canada-maple-leaf.svg')
  })

  test('every country and state carries a one-color silhouette in its flag color; cities and tiny islands keep the flag only', () => {
    for (const team of flags) {
      const silhouette = team.alternateLogos?.find((v) => v.id === 'silhouette')
      if (team.conference === 'Cities' || NO_SILHOUETTE.includes(team.id)) {
        expect(silhouette).toBeUndefined()
        continue
      }
      expect(silhouette).toMatchObject({ label: 'Silhouette', logo: `/logos/svg/flags/alternates/${team.abbr.toLowerCase()}-silhouette.svg`, unusedSourceSlots: [1, 2] })
      expect(silhouette!.sourcePalette![0]).toBe(team.palette[0])
      const svg = readFileSync(join(root, 'public', silhouette!.logo), 'utf8')
      expect(svg).toMatch(new RegExp(`<svg[^>]* fill="${team.palette[0]}"`))
      expect(svg).not.toMatch(/<(text|image|style)\b/)
      expect(svg.length).toBeLessThan(150_000)
      const resolved = withLogoVariant(team, 'silhouette')
      expect(resolved.unusedSourceSlots).toEqual([1, 2])
      expect(fullName(resolved)).toBe(fullName(team))
    }
    for (const team of flags) for (const variant of team.alternateLogos ?? []) expect(existsSync(join(root, 'public', variant.logo))).toBe(true)
    expect(flags.filter((t) => t.alternateLogos?.some((v) => v.id === 'silhouette'))).toHaveLength(123 - 8 - NO_SILHOUETTE.length)
  })

  test('silhouettes are pinned cuts from the two Wikimedia map sheets, and the flags from Commons flag files', () => {
    execFileSync('python3', ['-c', `
import json, sys
from pathlib import Path
sys.path.insert(0, 'scripts')
from download_brand_logos import pinned_sources
from brand_rosters import FLAG, BRAND, LEAGUES
assert not any(row[2] == 'Place' for row in BRAND) and 'Place' not in LEAGUES['BRAND']['conferences']
assert [row[0] for row in FLAG].count('TX') == 1 and len(FLAG) == 123
sheets = {'BlankMap-World.svg', 'Blank_US_Map_(states_only).svg'}
checksums = {}
for s in pinned_sources('FLAG'):
    if s.get('generator') == 'state_flag_artwork':
        assert s['id'] == 'flag-map' and len(s['inputs']) == 2
        assert all(i['sourceUrl'].startswith('https://commons.wikimedia.org/wiki/Special:FilePath/') for i in s['inputs'])
        continue
    name = s['sourceUrl'].rsplit('/', 1)[1]
    assert s['sourceUrl'].startswith('https://commons.wikimedia.org/wiki/Special:FilePath/'), s['sourceUrl']
    if s['id'] == 'silhouette':
        assert name in sheets and s['ops']['keepNodes'] and s['ops']['fill'].startswith('#') and s['ops']['viewBox'], s['teamId']
        assert checksums.setdefault(name, s['sourceSha256']) == s['sourceSha256'], 'one checksum per sheet'
    elif s['id'] == 'primary':
        assert name.startswith('Flag_of_'), s['teamId']
manifest = json.loads(Path('public/logos/svg/flags-manifest.json').read_text())['assets']
assert len(manifest) == 123 and all(a['league'] == 'FLAG' for a in manifest)
for a in manifest:
    for art in a['artwork']:
        if art['id'] == 'silhouette':
            assert len(art['colors']) == 1 and art['unusedSourceSlots'] == [1, 2], a['id']
`], { cwd: root })
  }, 20000)
})
