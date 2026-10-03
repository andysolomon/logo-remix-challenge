import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ALL_POOL_IDS, LEAGUES, TEAMS, deckFromStorage, filterTeams, findTeam,
  fullName, isCorrectGuess, poolTeams, randomDeck, roundHints, suggestTeams,
} from '../src/lib/teams'

const root = join(import.meta.dir, '..')
const nba = TEAMS.filter((t) => t.league === 'NBA')

describe('NBA teams', () => {
  test('all 30 teams have unique IDs and the correct conference split', () => {
    expect(LEAGUES.NBA).toEqual({ label: 'NBA', conferences: ['Eastern', 'Western'] })
    expect(nba).toHaveLength(30)
    expect(new Set(TEAMS.map((t) => t.id)).size).toBe(TEAMS.length)
    expect(filterTeams('NBA', 'Eastern', '')).toHaveLength(15)
    expect(filterTeams('NBA', 'Western', '')).toHaveLength(15)
    expect(filterTeams('NBA', 'Eastern', 'Lakers')).toHaveLength(0)
    expect(filterTeams('NBA', 'Western', 'Lakers').map((t) => t.id)).toEqual(['NBA-LAL'])
    expect(filterTeams('NBA', 'All', 'Sixers').map((t) => t.id)).toEqual(['NBA-PHI'])
    expect(filterTeams('PRO', 'All', 'Atlanta').map((t) => t.id)).toEqual(['PRO-ATL'])
  })

  test('full names, nicknames, abbreviations and aliases are accepted and suggested', () => {
    for (const team of nba) {
      for (const answer of [fullName(team), team.name, team.abbr, ...(team.aliases ?? [])]) {
        expect(isCorrectGuess(answer, team)).toBe(true)
      }
      expect(isCorrectGuess('wrong team', team)).toBe(false)
    }
    for (const [query, id] of [['Sixers', 'NBA-PHI'], ['Cavs', 'NBA-CLE'], ['GSW', 'NBA-GS'], ['Los Angeles Clippers', 'NBA-LAC']]) {
      expect(suggestTeams(query).some((t) => t.id === id)).toBe(true)
    }
  })

  test('NBA-only and mixed-league random decks are valid and survive persistence', () => {
    expect(ALL_POOL_IDS).toContain('NBA')
    expect(poolTeams(['NBA'])).toHaveLength(30)
    expect(poolTeams(['NFL', 'NBA'])).toHaveLength(62)
    for (const [logos, colors] of [[['NBA'], ['NBA']], [['NBA'], ['NFL']], [['SEC'], ['NBA']]]) {
      const deck = randomDeck({ rounds: 20, logoPools: logos, colorPools: colors, guess: 'both', hints: true })
      expect(deck).toHaveLength(20)
      expect(new Set(deck.map((r) => r.o)).size).toBe(Math.min(20, poolTeams(logos).length))
      expect(new Set(deck.map((r) => `${r.o}|${r.c}`)).size).toBe(20)
      for (const round of deck) {
        expect(round.o).not.toBe(round.c)
        expect(poolTeams(logos)).toContain(findTeam(round.o)!)
        expect(poolTeams(colors)).toContain(findTeam(round.c)!)
        expect(round.g).toBe('both')
      }
      expect(deckFromStorage(JSON.stringify(deck))).toEqual(deck)
    }
    expect(roundHints({ o: 'NBA-ATL', c: 'PRO-ATL', v: 0 })).toEqual(['Logo: NBA', 'Colors: NFL'])
  })

  test('all local SVGs are valid, manifest colors match artwork and used palette slots occur', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'public/logos/svg/nba-manifest.json'), 'utf8'))
    expect(manifest.assets).toHaveLength(30)
    execFileSync('python3', ['-c', `
import json, sys
from pathlib import Path
sys.path.insert(0, 'scripts')
from download_nba_svgs import validate_svg, artwork_colors
from build_teams import dist_sq
teams = {t['id']: t for t in json.loads(Path('src/lib/teams.json').read_text())['teams'] if t['league'] == 'NBA'}
for item in json.loads(Path('public/logos/svg/nba-manifest.json').read_text())['assets']:
    artwork = (Path('public') / item['path'].lstrip('/')).read_bytes()
    validate_svg(artwork)
    fills = artwork_colors(artwork)
    assert fills == item['fills'], item['id']
    team = teams[item['id']]
    assert item['path'] == team['logo']
    source = team.get('sourcePalette', team['palette'])
    for slot, color in enumerate(source):
        occurs = any(dist_sq(color, fill) <= 90 * 90 for fill in fills)
        assert occurs == (slot not in team.get('unusedSourceSlots', [])), (team['id'], slot)
`], { cwd: root })
  })

  test('all roster builders preserve NBA data; incomplete NBA input cannot replace saved teams', () => {
    execFileSync('python3', ['-c', `
import json, sys, tempfile
from pathlib import Path
sys.path.insert(0, 'scripts')
import build_nba_teams as nba, build_teams as college, build_hs_teams as hs
sys.argv = ['builder']
original = Path('src/lib/teams.json').read_text()
original_data = json.loads(original)
with tempfile.TemporaryDirectory(dir=Path.cwd()) as tmp:
    target = Path(tmp) / 'teams.json'
    nba.TEAMS_JSON = college.TEAMS_JSON = hs.TEAMS_JSON = target
    target.write_text(original)
    nba.main()
    assert target.read_text() == original
    wanted = [t for t in original_data['teams'] if t['league'] == 'NBA']
    for builder in (college, hs):
        assert builder.main() == 0
        result = json.loads(target.read_text())
        assert [t for t in result['teams'] if t['league'] == 'NBA'] == wanted
        assert result['leagues']['NBA'] == original_data['leagues']['NBA']
    incomplete = Path(tmp) / 'manifest.json'
    items = json.loads(nba.MANIFEST.read_text())
    items['assets'].pop()
    incomplete.write_text(json.dumps(items))
    nba.MANIFEST = incomplete
    before = target.read_bytes()
    try:
        nba.main()
    except ValueError:
        pass
    else:
        raise AssertionError('incomplete manifest accepted')
    assert target.read_bytes() == before
`], { cwd: root })
  }, 20000)
})
