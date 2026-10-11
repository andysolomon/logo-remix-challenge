import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  TEAMS, contrastSafePermutation, deckFromStorage, findTeam, fullName, logoVariants, nextLogoVariant,
  normalizeRound, withLogoVariant,
} from '../src/lib/teams'

const root = join(import.meta.dir, '..')
const python = (code: string) => execFileSync('python3', ['-c', code], { cwd: root })
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const FOLDERS: Record<string, string> = { NBA: 'nba', COL: 'ncaa', HS: 'high-school' }
const withAlternates = TEAMS.filter((t) => t.league in FOLDERS && t.alternateLogos?.length)
const MIN_NBA = 18
const MIN_COL = 19
const MIN_HS = 10

describe('NBA, college and high-school alternate logos', () => {
  test('alternates are local vector artwork, distinct from the primary, and labeled without naming the team', () => {
    expect(withAlternates.filter((t) => t.league === 'NBA').length).toBeGreaterThanOrEqual(MIN_NBA)
    expect(withAlternates.filter((t) => t.league === 'COL').length).toBeGreaterThanOrEqual(MIN_COL)
    expect(withAlternates.filter((t) => t.league === 'HS').length).toBeGreaterThanOrEqual(MIN_HS)
    for (const team of withAlternates) {
      for (const variant of team.alternateLogos!) {
        expect(variant.logo.startsWith(`/logos/svg/${FOLDERS[team.league]}/alternates/`)).toBe(true)
        expect(variant.logo).toEndWith('.svg')
        expect(existsSync(join(root, 'public', variant.logo))).toBe(true)
        const answers = [fullName(team), team.region, team.name, team.abbr, ...(team.aliases ?? [])].map(norm).filter((a) => a.length > 2)
        expect(variant.label.length).toBeGreaterThan(0)
        for (const answer of answers) expect(norm(variant.label)).not.toContain(answer)
      }
      expect(new Set(logoVariants(team).map((v) => v.logo)).size).toBe(logoVariants(team).length)
    }
    // Conference marks keep a single logo.
    expect(TEAMS.filter((t) => t.league === 'COL' && !t.name && t.alternateLogos)).toEqual([])
  })

  test('manifests pin each source, checksum, reviewed edit and the palette roles found in the artwork', () => {
    python(`
import hashlib, json, sys
from pathlib import Path
sys.path.insert(0, 'scripts')
import download_team_alternates as d
from download_brand_logos import artwork_palette, brand_colors
from nfl_vector_artwork import validate_vector
teams = {t['id']: t for t in json.loads(Path('src/lib/teams.json').read_text())['teams']}
for league in ('NBA', 'COL', 'HS'):
    roster = d.roster(league)
    pinned = {(s['teamId'], s['id']): s for s in d.pinned_sources(league, roster)}
    items = json.loads(d.manifest_path(league).read_text())['assets']
    assert [(i['teamId'], i['id']) for i in items] == list(pinned), league
    for item in items:
        source = pinned[(item['teamId'], item['id'])]
        assert all(item.get(k) == v for k, v in source.items()), (item['teamId'], item['id'])
        raw = (Path('public') / item['path'].lstrip('/')).read_bytes()
        validate_vector(raw)
        assert hashlib.sha256(raw).hexdigest() == item['sha256'] and len(raw) <= 400_000
        assert brand_colors(raw) == item['colors']
        team = roster[item['teamId']]
        expected = artwork_palette(item['colors'], team['palette'][0][1:], team['palette'][1][1:])
        assert expected == (item['sourcePalette'], item['unusedSourceSlots']), (item['teamId'], item['id'])
    built = d.team_alternates(league, set(roster))
    for team_id, team in roster.items():
        assert teams[team_id].get('alternateLogos') == built.get(team_id), team_id
`)
  }, 30000)

  test('shuffle cycles every mark once and saved rounds keep the exact alternate', () => {
    const donor = findTeam('PRO-BUF')!
    for (const team of withAlternates) {
      let current: string | undefined
      const seen = new Set<string>()
      for (let i = 0; i < logoVariants(team).length; i++) {
        const resolved = withLogoVariant(team, current)
        seen.add(resolved.logo)
        expect(fullName(resolved)).toBe(fullName(team))
        expect(resolved.palette).toEqual(team.palette)
        current = nextLogoVariant(team, current)
      }
      expect(current).toBeUndefined()
      expect(seen.size).toBe(logoVariants(team).length)
      for (const variant of team.alternateLogos!) {
        const round = normalizeRound({ o: team.id, c: donor.id, v: 3, l: variant.id, g: 'both' })
        expect(round.l).toBe(variant.id)
        expect(round.v).toBe(contrastSafePermutation(withLogoVariant(team, variant.id), donor.palette, 3))
        expect(deckFromStorage(JSON.stringify([round]))).toEqual([round])
      }
    }
  })

  test('roster rebuilds reproduce the alternates; a stale manifest stops the build before writing', () => {
    python(`
import contextlib, io, json, sys, tempfile
from pathlib import Path
sys.path.insert(0, 'scripts')
import build_hs_teams as hs, build_nba_teams as nba, build_teams as college, download_team_alternates as d
original = Path('src/lib/teams.json').read_text()
with tempfile.TemporaryDirectory(dir=Path.cwd()) as tmp:
    target = Path(tmp) / 'teams.json'
    target.write_text(original)
    nba.TEAMS_JSON = college.TEAMS_JSON = hs.TEAMS_JSON = target
    sys.argv = ['builder']
    with contextlib.redirect_stdout(io.StringIO()):
        nba.main()
        assert college.main() == 0
        assert hs.main() == 0
    assert target.read_text() == original, 'rebuild changed alternates, order or formatting'
    real = d.manifest_path
    for league, builder in (('NBA', nba), ('COL', college), ('HS', hs)):
        items = json.loads(real(league).read_text())
        for bad in ('unknown team', 'stale checksum'):
            edited = json.loads(json.dumps(items))
            if bad == 'unknown team':
                edited['assets'][0]['teamId'] = league + '-NOPE'
            else:
                edited['assets'][0]['sha256'] = '0' * 64
            fake = Path(tmp) / f'{league}-{len(bad)}.json'
            fake.write_text(json.dumps(edited))
            d.manifest_path = lambda _, fake=fake: fake
            before = target.read_bytes()
            try:
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    failed = builder.main() == 1
            except ValueError:
                failed = True
            d.manifest_path = real
            assert failed, f'{league}: {bad} accepted'
            assert target.read_bytes() == before
`)
  }, 30000)

  test('refresh reuses verified assets offline and rejects changed, unknown or unsafe sources before writing', () => {
    python(`
import contextlib, io, json, shutil, sys, tempfile
from pathlib import Path
sys.path.insert(0, 'scripts')
import download_team_alternates as d
root = Path.cwd()
with tempfile.TemporaryDirectory() as folder:
    d.ROOT = Path(folder)
    d.SOURCES = d.ROOT / 'sources.json'
    d.TEAMS_JSON = root / 'src/lib/teams.json'
    shutil.copy(root / 'scripts/team_alternate_sources.json', d.SOURCES)
    (d.ROOT / 'public/logos/svg/nba').mkdir(parents=True)
    shutil.copy(root / 'public/logos/svg/nba-alternates-manifest.json', d.ROOT / 'public/logos/svg/nba-alternates-manifest.json')
    shutil.copytree(root / 'public/logos/svg/nba/alternates', d.ROOT / 'public/logos/svg/nba/alternates')
    manifest = d.ROOT / 'public/logos/svg/nba-alternates-manifest.json'
    before = manifest.read_bytes()
    assets = {p: p.read_bytes() for p in (d.ROOT / 'public/logos/svg/nba/alternates').glob('*.svg')}
    d.source_bytes = lambda *_: (_ for _ in ()).throw(AssertionError('verified asset was fetched'))
    with contextlib.redirect_stdout(io.StringIO()): d.refresh('NBA')
    assert manifest.read_bytes() == before
    sources = json.loads(d.SOURCES.read_text())
    first = next(i for i, s in enumerate(sources) if s['teamId'].startswith('NBA-'))
    bitmap = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 9"><image href="x.png"/></svg>'
    for bad in ('bitmap', 'unknown team', 'primary id'):
        edited = [dict(s) for s in sources]
        if bad == 'bitmap':
            edited[first]['sourceSha256'] = '0' * 64
            d.source_bytes = lambda *_: bitmap
        elif bad == 'unknown team':
            edited[first]['teamId'] = 'NBA-NOPE'
        else:
            edited[first]['id'] = 'primary'
        d.SOURCES.write_text(json.dumps(edited))
        try:
            with contextlib.redirect_stdout(io.StringIO()): d.refresh('NBA')
        except ValueError: pass
        else: raise AssertionError(f'{bad} source accepted')
        assert manifest.read_bytes() == before
        assert all(p.read_bytes() == raw for p, raw in assets.items()), 'failed refresh changed artwork'
`)
  }, 30000)
})
