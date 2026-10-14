import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ALL_POOL_IDS, LEAGUES, TEAMS, colorPoolTeams, deckFromStorage, entryNoun, filterTeams, findTeam, fullName,
  isCorrectGuess, logoPoolTeams, logoVariants, normalizeRound, poolTeams, randomDeck, roundHints, suggestTeams, teamHint, withLogoVariant,
} from '../src/lib/teams'

const root = join(import.meta.dir, '..')
const flags = filterTeams('FLAG', 'All', '')
const REGIONS = ['Americas', 'Europe', 'Asia & Pacific', 'Africa & Middle East', 'US States', 'Cities', 'Solar System']
/** The 17 flags that opened as BRANDS' Place type. */
const MOVED = ['TX', 'CANADA', 'JAPAN', 'CHICAGO', 'MEXICO', 'USA', 'UK', 'BRAZIL', 'KOREA', 'JAMAICA', 'PR', 'CALI', 'AUS', 'INDIA', 'TURKEY', 'GREECE', 'ARG']
/** State flags that spell the state's name on a seal or scroll: the outline leads and the flag is a name-showing alternate. */
const NAME_ON_FLAG = ['AR', 'FL', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'ME', 'MO', 'MT', 'NE', 'NV', 'NH', 'NC', 'ND', 'OK', 'OR', 'SD', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY']
const PLANETS = ['MERCURY', 'VENUS', 'EARTH', 'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE']
/** Natural Earth's public-domain outlines, pinned at a release so every refresh cuts the same shapes. */
const NATURAL_EARTH = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/'

describe('the FLAGS collection', () => {
  test('131 places are grouped by region, and BRANDS no longer has a Place type', () => {
    expect(LEAGUES.FLAG).toEqual({ label: 'FLAGS', conferences: REGIONS })
    expect(flags).toHaveLength(131)
    expect(REGIONS.map((r) => filterTeams('FLAG', r, '').length)).toEqual([17, 19, 15, 14, 50, 8, 8])
    expect(new Set(flags.map((t) => fullName(t))).size).toBe(131)
    expect(filterTeams('FLAG', 'US States', '').map((t) => t.abbr).sort()).toHaveLength(50)
    expect(filterTeams('FLAG', 'Solar System', '').map((t) => t.abbr).sort()).toEqual([...PLANETS].sort())
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
    expect(isCorrectGuess('Red Planet', findTeam('FLAG-MARS')!)).toBe(true)
    expect(isCorrectGuess('Empire State', findTeam('FLAG-NY')!)).toBe(true)
  })

  test('hints name the region, flags are logo-only, and random decks draw them', () => {
    expect(teamHint(findTeam('FLAG-ITALY')!)).toBe('FLAGS - Europe')
    expect(roundHints({ o: 'FLAG-TX', c: 'PRO-KC', v: 0 })).toEqual(['Logo: FLAGS - US States', 'Colors: NFL - AFC'])
    expect(roundHints({ o: 'FLAG-TOKYO', v: 0 })).toEqual(['Logo: FLAGS - Cities'])
    expect(roundHints({ o: 'FLAG-SATURN', c: 'NBA-LAL', v: 0 })).toEqual(['Logo: FLAGS - Solar System', 'Colors: NBA'])
    expect(ALL_POOL_IDS).toContain('Flags')
    expect(poolTeams(['Flags'])).toHaveLength(131)
    // Name-showing flags are alternates behind an outline, so every place can be a random-deck logo.
    expect(logoPoolTeams(['Flags'])).toHaveLength(131)
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

  test('every country and state carries a one-color outline in its flag color and a flag-filled outline; cities and planets do not', () => {
    const places = flags.filter((t) => !['Cities', 'Solar System'].includes(t.conference))
    expect(places).toHaveLength(115)
    for (const team of flags) {
      const named = NAME_ON_FLAG.includes(team.abbr)
      // A flag that spells the state's name leads with the outline instead, and the flag is a name-showing alternate.
      const silhouette = named ? logoVariants(team)[0] : team.alternateLogos?.find((v) => v.id === 'silhouette')
      const flagMap = team.alternateLogos?.find((v) => v.id === 'flag-map')
      if (['Cities', 'Solar System'].includes(team.conference)) {
        expect(team.alternateLogos?.find((v) => v.id === 'silhouette')).toBeUndefined()
        expect(flagMap).toBeUndefined()
        continue
      }
      if (named) {
        expect(team.showsName).toBeUndefined()
        expect(team.logo).toBe(`/logos/svg/flags/${team.abbr.toLowerCase()}.svg`)
        expect(logoVariants(team)[0].label).toBe('Primary')
        const flag = team.alternateLogos!.find((v) => v.id === 'flag')!
        expect(flag).toMatchObject({ label: 'State flag', showsName: true, logo: `/logos/svg/flags/alternates/${team.abbr.toLowerCase()}-flag.svg` })
        expect(flagMap!.showsName).toBe(true)
        expect(withLogoVariant(team, 'flag').showsName).toBe(true)
      } else {
        expect(team.alternateLogos!.every((v) => !v.showsName)).toBe(true)
        expect(silhouette).toMatchObject({ label: 'Silhouette', logo: `/logos/svg/flags/alternates/${team.abbr.toLowerCase()}-silhouette.svg` })
      }
      expect(silhouette!.unusedSourceSlots).toEqual([1, 2])
      expect((silhouette!.sourcePalette ?? team.palette)[0]).toBe(team.palette[0])
      const svg = readFileSync(join(root, 'public', silhouette!.logo), 'utf8')
      expect(svg).toMatch(new RegExp(`<svg[^>]* fill="${team.palette[0]}"`))
      expect(svg).not.toMatch(/<(text|image|style)\b/)
      expect(svg.length).toBeLessThanOrEqual(400_000)
      // The flag drawn through the outline: a clip path around a nested copy of the flag, so it recolors like the flag.
      expect(flagMap).toMatchObject({ logo: `/logos/svg/flags/alternates/${team.abbr.toLowerCase()}-flag-map.svg` })
      const map = readFileSync(join(root, 'public', flagMap!.logo), 'utf8')
      if (team.id !== 'FLAG-TX') {
        expect(flagMap!.label).toBe('Flag-filled outline')
        expect(map).toContain('<clipPath id="flag-map-outline">')
        expect(map).toContain('clip-path="url(#flag-map-outline)"')
        expect(map).toContain('preserveAspectRatio="xMidYMid slice"')
      }
      expect(map).not.toMatch(/<(text|image)\b/)
    }
    for (const team of flags) for (const variant of logoVariants(team)) expect(existsSync(join(root, 'public', variant.logo))).toBe(true)
  })

  test('planets lead with a NASA photo that keeps its colors and carry the astronomical symbol as a vector alternate', () => {
    for (const abbr of PLANETS) {
      const planet = findTeam(`FLAG-${abbr}`)!
      expect(planet).toMatchObject({ conference: 'Solar System', logo: `/logos/svg/flags/${abbr.toLowerCase()}.png`, keepsColors: true, unusedSourceSlots: [1, 2] })
      expect(planet.sourcePalette).toBeUndefined()
      expect(planet.alternateLogos).toHaveLength(1)
      expect(planet.alternateLogos![0]).toMatchObject({ id: 'symbol', label: 'Astronomical symbol', logo: `/logos/svg/flags/alternates/${abbr.toLowerCase()}-symbol.svg` })
      expect(withLogoVariant(planet, 'symbol').keepsColors).toBeUndefined()
      const png = readFileSync(join(root, 'public', planet.logo))
      expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      expect(png.length).toBeLessThanOrEqual(400_000)
    }
    // Photos are still random-deck logos: a remix paints the tile and frame around them.
    expect(logoPoolTeams(['Flags']).filter((t) => t.keepsColors)).toHaveLength(8)
  })

  test('terrain alternates are clipped relief rasters that keep their own colors', () => {
    const terrains = flags.filter((t) => t.alternateLogos?.some((v) => v.id === 'terrain'))
    expect(terrains.length).toBeGreaterThanOrEqual(40)
    expect(terrains.every((t) => !['Cities', 'Solar System'].includes(t.conference))).toBe(true)
    for (const team of terrains) {
      const terrain = team.alternateLogos!.find((v) => v.id === 'terrain')!
      expect(terrain).toMatchObject({ label: 'Terrain', logo: `/logos/svg/flags/alternates/${team.abbr.toLowerCase()}-terrain.png`, keepsColors: true, unusedSourceSlots: [1, 2] })
      expect(terrain.sourcePalette).toEqual(team.palette)
      const png = readFileSync(join(root, 'public', terrain.logo))
      expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      expect(png.length).toBeLessThanOrEqual(400_000)
      const resolved = withLogoVariant(team, 'terrain')
      expect(resolved.keepsColors).toBe(true)
      expect(fullName(resolved)).toBe(fullName(team))
      expect(withLogoVariant(team).keepsColors).toBeUndefined()
      expect(withLogoVariant(team, 'silhouette').keepsColors).toBeUndefined()
    }
    // Only the planet photos keep their colors as primaries; every other primary logo recolors into a remix.
    expect(TEAMS.filter((t) => t.keepsColors).map((t) => t.abbr).sort()).toEqual([...PLANETS].sort())
  })

  test('outlines are pinned Natural Earth features, flags Commons files, and terrain Wikipedia relief maps with bounds', () => {
    execFileSync('python3', ['-c', `
import json, sys
from pathlib import Path
sys.path.insert(0, 'scripts')
from download_brand_logos import pinned_sources
from brand_rosters import FLAG, BRAND, LEAGUES
from outline_geojson import OPS, outline_svg, simplify
from terrain_raster import outline_polygons
assert not any(row[2] == 'Place' for row in BRAND) and 'Place' not in LEAGUES['BRAND']['conferences']
assert [row[0] for row in FLAG].count('TX') == 1 and len(FLAG) == 131
NE = '${NATURAL_EARTH}'
checksums = {}
def outline(pinned):
    assert pinned['sourceUrl'].startswith(NE) and pinned['ops']['feature'] and pinned['ops']['viewBox'], pinned
    assert checksums.setdefault(pinned['sourceUrl'], pinned['sourceSha256']) == pinned['sourceSha256'], 'one checksum per Natural Earth file'
    return pinned['ops']
for s in pinned_sources('FLAG'):
    name = s['sourceUrl'].rsplit('/', 1)[1]
    if s['id'] == 'silhouette':
        ops = outline(s)
        assert ops['projection'] == 'mercator' and ops['fill'].startswith('#') and 0 < ops['simplify'] <= 0.06, s['teamId']
    elif s['id'] == 'flag-map' and 'mask' in s:
        assert outline(s['mask'])['projection'] == 'mercator' and 'viewBox' not in s.get('ops', {}), s['teamId']
    elif s['id'] == 'terrain':
        assert s['sourceUrl'].startswith('https://commons.wikimedia.org/wiki/Special:FilePath/'), s['sourceUrl']
        assert outline(s['mask'])['projection'] == 'geographic', s['teamId']
        b = s['bounds']; assert b['top'] > b['bottom'] and b['right'] > b['left'], s['teamId']
    elif s['id'] in ('primary', 'flag') and 'feature' not in s.get('ops', {}) and 'background' not in s:
        assert name.startswith('Flag_of_') and s['sourceUrl'].startswith('https://commons.wikimedia.org/wiki/Special:FilePath/'), s['teamId']
    elif s['id'] == 'primary' and 'background' in s:
        assert s['background'] == 'black' and s['teamId'].split('-')[1] in ${JSON.stringify(PLANETS)}, s['teamId']
# A tiny GeoJSON exercises feature selection, the window, both projections, holes and simplification.
ring = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
hole = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]
far = [[100, 0], [101, 0], [101, 1], [100, 1], [100, 0]]
geo = json.dumps({'type': 'FeatureCollection', 'features': [
    {'type': 'Feature', 'properties': {'A3': 'XXX'}, 'geometry': {'type': 'MultiPolygon', 'coordinates': [[ring, hole], [far]]}},
    {'type': 'Feature', 'properties': {'A3': 'YYY'}, 'geometry': {'type': 'Polygon', 'coordinates': [ring]}}]}).encode()
svg = outline_svg(geo, {'feature': {'A3': 'XXX'}, 'within': [-1, -1, 20, 20], 'projection': 'geographic', 'simplify': 0.01})
rings = outline_polygons(svg)
assert len(rings) == 2 and rings[0][0] == (0.0, 0.0) and (6.0, 6.0) in rings[1], rings
assert b'fill-rule="evenodd"' in svg
merc = outline_svg(geo, {'feature': {'A3': 'XXX'}, 'projection': 'mercator'})
assert len(outline_polygons(merc)) == 3 and 10 < outline_polygons(merc)[0][2][1] < 10.1, 'Mercator stretches latitude; the far island stays without a window'
for bad in ({'feature': {'A3': 'ZZZ'}, 'projection': 'mercator'}, {'feature': {'A3': 'XXX'}, 'projection': 'robinson'}, {'feature': {'A3': 'XXX'}, 'projection': 'mercator', 'within': [50, 50, 60, 60]}, {'feature': {'A3': 'XXX'}, 'projection': 'mercator', 'crop': 1}):
    try:
        outline_svg(geo, bad)
    except ValueError:
        pass
    else:
        raise AssertionError(f'accepted {bad}')
assert simplify([(0, 0), (1, 0.001), (2, 0), (3, 1), (4, 0)], 0.01) == [(0, 0), (2, 0), (3, 1), (4, 0)]
manifest = json.loads(Path('public/logos/svg/flags-manifest.json').read_text())['assets']
assert len(manifest) == 131 and all(a['league'] == 'FLAG' for a in manifest)
for a in manifest:
    for art in a['artwork']:
        if art['id'] == 'silhouette':
            assert len(art['colors']) == 1 and art['unusedSourceSlots'] == [1, 2], a['id']
        if art['id'] == 'terrain' or (art['id'] == 'primary' and a['conference'] == 'Solar System'):
            assert art['format'] == 'png' and art['keepsColors'] and art['path'].endswith('.png'), a['id']
        else:
            assert art['format'] == 'svg' and not art.get('keepsColors'), a['id']
`], { cwd: root })
  }, 30000)
})
