import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import {
  ALL_POOL_IDS, TEAMS, LEAGUES, deckFromStorage, filterTeams, findTeam, fullName,
  isCorrectGuess, poolTeams, randomDeck, roundHints, suggestTeams,
} from '../src/lib/teams'

const root = join(import.meta.dir, '..')
const mlb = filterTeams('MLB', 'All', '')
const food = filterTeams('FOOD', 'All', '')

describe('MLB and fast food collections', () => {
  test('the MLB roster has all 30 teams, correct conferences and current full names', () => {
    expect(mlb).toHaveLength(30)
    expect(LEAGUES.MLB.conferences).toEqual(['American League', 'National League'])
    expect(filterTeams('MLB', 'American League', '')).toHaveLength(15)
    expect(filterTeams('MLB', 'National League', '')).toHaveLength(15)
    expect(fullName(findTeam('MLB-ATH')!)).toBe('Athletics')
    expect(fullName(findTeam('MLB-AZ')!)).toBe('Arizona Diamondbacks')
    expect(fullName(findTeam('MLB-NYY')!)).toBe('New York Yankees')
    expect(fullName(findTeam('MLB-MIN')!)).toBe('Minnesota Twins')
    expect(fullName(findTeam('MLB-TEX')!)).toBe('Texas Rangers')
    expect(fullName(findTeam('MLB-LAA')!)).toBe('Los Angeles Angels')
    expect(filterTeams('MLB', 'American League', 'Braves')).toHaveLength(0)
    expect(filterTeams('MLB', 'National League', 'Atlanta')[0].id).toBe('MLB-ATL')
    expect(new Set(TEAMS.map((t) => t.id)).size).toBe(TEAMS.length)
  })

  test('all 30 food chains are reachable through categories and punctuation-friendly search', () => {
    expect(food).toHaveLength(30)
    expect(new Set(food.map((t) => fullName(t))).size).toBe(30)
    expect(LEAGUES.FOOD.label).toBe('FAST FOOD')
    for (const category of LEAGUES.FOOD.conferences) {
      expect(filterTeams('FOOD', category, '').length).toBeGreaterThan(0)
    }
    expect(filterTeams('FOOD', 'All', 'chickfila')[0].id).toBe('FOOD-CFA')
    expect(filterTeams('FOOD', 'All', 'mcdonalds')[0].id).toBe('FOOD-MCD')
    expect(filterTeams('FOOD', 'Chicken', 'Burger King')).toHaveLength(0)
    expect(filterTeams('FOOD', 'Pizza', '').map((t) => t.id).sort()).toEqual(['FOOD-DOM', 'FOOD-LC', 'FOOD-PAPA', 'FOOD-PH'])
  })

  test('brand names, MLB names and their aliases work in grading and autocomplete', () => {
    for (const entry of [...mlb, ...food]) {
      for (const name of [fullName(entry), entry.abbr, ...(entry.aliases ?? [])]) {
        expect(isCorrectGuess(name, entry)).toBe(true)
        expect(suggestTeams(name, TEAMS.length)).toContain(entry)
      }
      expect(isCorrectGuess('unrelated answer', entry)).toBe(false)
    }
    expect(isCorrectGuess('Kentucky Fried Chicken', findTeam('FOOD-KFC')!)).toBe(true)
    expect(isCorrectGuess('A’s', findTeam('MLB-ATH')!)).toBe(true)
    expect(isCorrectGuess('Chickfila', findTeam('FOOD-CFA')!)).toBe(true)
  })

  test('random decks mix MLB, food and other sports, persist, and show meaningful hints', () => {
    expect(ALL_POOL_IDS).toContain('MLB')
    expect(ALL_POOL_IDS).toContain('Fast Food')
    expect(poolTeams(['MLB', 'Fast Food'])).toHaveLength(60)
    for (const [logos, colors] of [[['MLB'], ['MLB']], [['Fast Food'], ['Fast Food']], [['MLB'], ['Fast Food']], [['Fast Food'], ['NBA']]]) {
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
    expect(roundHints({ o: 'MLB-ATL', c: 'FOOD-MCD', v: 0 })).toEqual(['Logo: MLB', 'Colors: FAST FOOD'])
    expect(roundHints({ o: 'FOOD-CFA', c: 'NBA-ATL', v: 0 })).toEqual(['Logo: FAST FOOD', 'Colors: NBA'])
  })

  test('all 30 MLB logos decode and each source palette matches its manifest and artwork', () => {
    execFileSync('python3', ['-c', `
import json, sys
from pathlib import Path
sys.path.insert(0, 'scripts')
from download_extra_logos import inspect_artwork
from build_teams import dist_sq
teams = {t['id']: t for t in json.loads(Path('src/lib/teams.json').read_text())['teams']}
for slug in ('mlb',):
    items = json.loads(Path(f'public/logos/svg/{slug}-manifest.json').read_text())['assets']
    assert len(items) == 30
    for item in items:
        colors = inspect_artwork((Path('public') / item['path'].lstrip('/')).read_bytes(), item['format'])
        assert colors == item['colors'], item['id']
        team = teams[item['id']]
        assert team['logo'] == item['path']
        source = team.get('sourcePalette', team['palette'])
        assert source == item['palette']
        assert len(set(team['palette'])) == 3
        for slot, color in enumerate(source):
            occurs = any(dist_sq(color, fill) <= 90 * 90 for fill in colors)
            assert occurs == (slot not in item['unusedSourceSlots']), (item['id'], slot)
`], { cwd: root })
  }, 20000)

  test('every roster builder preserves the new collections; invalid manifests cannot alter saved teams', () => {
    execFileSync('python3', ['-c', `
import json, sys, tempfile
from pathlib import Path
sys.path.insert(0, 'scripts')
import build_extra_teams as extras, build_brand_teams as brands, build_nba_teams as nba, build_teams as college, build_hs_teams as hs
root = Path.cwd()
original = Path('src/lib/teams.json').read_text()
kept = ('MLB', 'FOOD', 'BRAND', 'APP')
wanted = [t for t in json.loads(original)['teams'] if t['league'] in kept]
with tempfile.TemporaryDirectory(dir=root) as tmp:
    target = Path(tmp) / 'teams.json'
    target.write_text(original)
    extras.TEAMS_JSON = brands.TEAMS_JSON = nba.TEAMS_JSON = college.TEAMS_JSON = hs.TEAMS_JSON = target
    for builder in (nba, college, hs):
        sys.argv = ['builder']
        builder.main()
        actual = [t for t in json.loads(target.read_text())['teams'] if t['league'] in kept]
        assert actual == wanted
    target.write_text(original)
    for league in ('FOOD', 'BRAND', 'APP'):
        sys.argv = ['builder', '--league', league]
        brands.main()
    assert target.read_text() == original, 'brand rebuild changed data, order or formatting'
    sys.argv = ['builder', '--league', 'MLB']
    extras.main()
    actual = [t for t in json.loads(target.read_text())['teams'] if t['league'] == 'MLB']
    assert actual == [t for t in wanted if t['league'] == 'MLB']
    svg = Path(tmp) / 'public/logos/svg'
    svg.mkdir(parents=True)
    (svg / 'mlb').symlink_to(root / 'public/logos/svg/mlb', target_is_directory=True)
    manifest = json.loads(Path('public/logos/svg/mlb-manifest.json').read_text())
    manifest['assets'].pop()
    (svg / 'mlb-manifest.json').write_text(json.dumps(manifest))
    extras.ROOT = Path(tmp)
    sys.argv = ['builder', '--league', 'MLB']
    before = target.read_bytes()
    try:
        extras.main()
    except ValueError:
        pass
    else:
        raise AssertionError('incomplete manifest accepted')
    assert target.read_bytes() == before
`], { cwd: root })
  }, 30000)
})
