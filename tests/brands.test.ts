import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  ALL_POOL_IDS, LEAGUES, TEAMS, contrastSafePermutation, deckFromStorage, filterTeams, findTeam, fullName,
  isCorrectGuess, logoPoolTeams, logoVariants, nextLogoVariant, normalizeRound, poolTeams, randomDeck,
  roundHints, suggestTeams, withLogoVariant, type League,
} from '../src/lib/teams'

const root = join(import.meta.dir, '..')
const python = (code: string) => execFileSync('python3', ['-c', code], { cwd: root })
const COLLECTIONS: League[] = ['FOOD', 'BRAND', 'APP', 'TV', 'CAR']
const entries = TEAMS.filter((t) => COLLECTIONS.includes(t.league))
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
/** Chains, channels and carmakers whose every published logo is a wordmark; they stay playable as color donors. */
const WORDMARK_ONLY = [
  'CAR-FIAT', 'CAR-FORD', 'FOOD-BOJ', 'FOOD-CANE', 'FOOD-CUL', 'FOOD-DUNK', 'FOOD-FIVE', 'FOOD-PAPA',
  'TV-ABC', 'TV-CMT', 'TV-CNN', 'TV-EENT', 'TV-ESPN', 'TV-FOX', 'TV-HBO', 'TV-HGTV', 'TV-TNT', 'TV-TWC', 'TV-VH1',
]
const wordmarks = (league: League) => WORDMARK_ONLY.filter((id) => id.startsWith(`${league}-`)).length

describe('brand collections', () => {
  test('fast food, brands, apps, TV and cars have full rosters split across their categories', () => {
    expect(LEAGUES.BRAND).toEqual({ label: 'BRANDS', conferences: ['Product', 'Service', 'Corporate', 'Personal', 'Store', 'Place'] })
    expect(LEAGUES.APP).toEqual({ label: 'APPS', conferences: ['Built-in', 'Social', 'Games', 'Music & Video', 'Everyday'] })
    expect(LEAGUES.BRAND.conferences.map((c) => filterTeams('BRAND', c, '').length)).toEqual([5, 5, 5, 4, 5, 5])
    expect(LEAGUES.APP.conferences.map((c) => filterTeams('APP', c, '').length)).toEqual([8, 6, 6, 5, 5])
    expect(LEAGUES.TV).toEqual({ label: 'TV', conferences: ['Broadcast', 'Cable', 'Music & Pop', 'Kids', 'Discovery & Lifestyle'] })
    expect(LEAGUES.TV.conferences.map((c) => filterTeams('TV', c, '').length)).toEqual([6, 6, 5, 7, 6])
    expect(LEAGUES.CAR).toEqual({ label: 'CARS', conferences: ['American', 'Japanese & Korean', 'German', 'Italian', 'British'] })
    expect(LEAGUES.CAR.conferences.map((c) => filterTeams('CAR', c, '').length)).toEqual([6, 8, 5, 5, 6])
    for (const [league, size] of [['FOOD', 30], ['BRAND', 29], ['APP', 30], ['TV', 30], ['CAR', 30]] as const) {
      expect(filterTeams(league, 'All', '')).toHaveLength(size)
      expect(new Set(filterTeams(league, 'All', '').map(fullName)).size).toBe(size)
    }
    expect(new Set(TEAMS.map((t) => t.id)).size).toBe(TEAMS.length)
    expect(new Set(entries.map((t) => norm(fullName(t)))).size).toBe(entries.length)
  })

  test('every logo and alternate is local vector artwork; extra marks exist only where they are distinct', () => {
    for (const team of entries) {
      for (const variant of logoVariants(team)) {
        expect(variant.logo).toMatch(/^\/logos\/svg\/(fast-food|brands|apps|tv|cars)\/.+\.svg$/)
        expect(existsSync(join(root, 'public', variant.logo))).toBe(true)
      }
      expect(new Set(logoVariants(team).map((v) => v.logo)).size).toBe(logoVariants(team).length)
    }
    expect(entries.filter((t) => t.alternateLogos?.length).length).toBeGreaterThanOrEqual(70)
  })

  test('artwork never spells the answer, apart from the wordmark-only entries kept as color donors', () => {
    expect(entries.filter((t) => t.showsName).map((t) => t.id).sort()).toEqual(WORDMARK_ONLY)
    for (const team of entries) {
      const answers = [fullName(team), team.abbr, ...(team.aliases ?? [])].map(norm).filter((a) => a.length > 2)
      for (const variant of team.alternateLogos ?? []) {
        expect(variant.label.length).toBeGreaterThan(0)
        for (const answer of answers) expect(norm(variant.label)).not.toContain(answer)
      }
      if (team.showsName) expect(team.alternateLogos).toBeUndefined()
    }
  })

  test('manifests pin each source, checksum, reviewed edit and the palette roles found in the artwork', () => {
    python(`
import hashlib, json, sys
from pathlib import Path
sys.path.insert(0, 'scripts')
from brand_rosters import ROSTERS
from build_brand_teams import build_entry
from download_brand_logos import artwork_palette, brand_colors, pinned_sources, manifest_path
from nfl_vector_artwork import validate_vector
teams = {t['id']: t for t in json.loads(Path('src/lib/teams.json').read_text())['teams']}
for league, roster in ROSTERS.items():
    rows = {row[0]: row for row in roster}
    pinned = {(s['teamId'], s['id']): s for s in pinned_sources(league)}
    items = json.loads(manifest_path(league).read_text())['assets']
    assert len(items) == len(rows) == (29 if league == 'BRAND' else 30), league
    for item in items:
        assert teams[item['id']] == build_entry(league, item, rows[item['abbr']]), item['id']
        for art in item['artwork']:
            source = pinned.pop((item['id'], art['id']))
            assert all(art.get(k) == source.get(k) for k in source if k != 'teamId'), (item['id'], art['id'])
            raw = (Path('public') / art['path'].lstrip('/')).read_bytes()
            validate_vector(raw)
            assert hashlib.sha256(raw).hexdigest() == art['sha256'] and len(raw) <= 400_000
            colors = brand_colors(raw)
            assert colors == art['colors'], (item['id'], art['id'])
            assert artwork_palette(colors, *rows[item['abbr']][3:5]) == (art['sourcePalette'], art['unusedSourceSlots'])
    assert not pinned, f'sources missing from the manifest: {sorted(pinned)}'
`)
  }, 30000)

  test('shuffle cycles each brand mark once and saved rounds keep the exact alternate', () => {
    const donor = findTeam('PRO-BUF')!
    for (const team of entries.filter((t) => t.alternateLogos?.length)) {
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
        const round = normalizeRound({ o: team.id, c: donor.id, v: 7, l: variant.id, g: 'team' })
        expect(round.l).toBe(variant.id)
        expect(round.v).toBe(contrastSafePermutation(withLogoVariant(team, variant.id), donor.palette, 7))
        expect(deckFromStorage(JSON.stringify([round]))).toEqual([round])
      }
    }
  })

  test('names, short codes and aliases are accepted and suggested; the shared Happy Star accepts both chains', () => {
    for (const team of entries) {
      for (const answer of [fullName(team), team.abbr, ...(team.aliases ?? [])]) {
        expect(isCorrectGuess(answer, team)).toBe(true)
        // Suggestions start at two letters, so one-letter names such as "E!" are typed in full.
        if (norm(answer).length >= 2) expect(suggestTeams(answer, TEAMS.length)).toContain(team)
      }
      expect(isCorrectGuess('unrelated answer', team)).toBe(false)
    }
    expect(isCorrectGuess("Carl's Jr.", findTeam('FOOD-HARD')!)).toBe(true)
    expect(isCorrectGuess("Hardee's", findTeam('FOOD-CARL')!)).toBe(true)
  })

  test('random decks draw brand, app, channel and car logos, keep wordmarks as color donors and show the type as a hint', () => {
    expect(ALL_POOL_IDS).toEqual(expect.arrayContaining(['Fast Food', 'Brands', 'Apps', 'TV', 'Cars']))
    expect(poolTeams(['Brands', 'Apps'])).toHaveLength(59)
    expect(poolTeams(['TV', 'Cars'])).toHaveLength(60)
    expect(logoPoolTeams(['Fast Food'])).toHaveLength(30 - wordmarks('FOOD'))
    expect(logoPoolTeams(['TV'])).toHaveLength(30 - wordmarks('TV'))
    expect(logoPoolTeams(['Cars'])).toHaveLength(30 - wordmarks('CAR'))
    for (const [logos, colors] of [[['Fast Food'], ['Fast Food']], [['Brands'], ['Apps']], [['Apps'], ['NFL']], [['Cars'], ['TV']], [['TV', 'Cars'], ['Cars']]]) {
      for (let n = 0; n < 5; n++) {
        const deck = randomDeck({ rounds: 20, logoPools: logos, colorPools: colors, guess: 'both', hints: true })
        expect(deck).toHaveLength(20)
        expect(new Set(deck.map((r) => r.o)).size).toBe(20)
        for (const round of deck) {
          expect(findTeam(round.o)!.showsName).toBeUndefined()
          expect(poolTeams(colors)).toContain(findTeam(round.c)!)
        }
        expect(deckFromStorage(JSON.stringify(deck))).toEqual(deck)
      }
    }
    const place = filterTeams('BRAND', 'Place', '')[0]
    const game = filterTeams('APP', 'Games', '')[0]
    expect(roundHints({ o: place.id, c: game.id, v: 0 })).toEqual(['Logo: Place brand', 'Colors: Games app'])
    expect(roundHints({ o: 'CAR-BMW', c: 'TV-NICK', v: 0 })).toEqual(['Logo: German car', 'Colors: Kids channel'])
  })
})

describe('brand artwork pipeline', () => {
  test('reviewed edits strip a wordmark and crop, and reject stale or unsafe sources', () => {
    python(`
import sys
sys.path.insert(0, 'scripts')
from xml.etree import ElementTree as ET
from brand_vector import import_brand_vector
def svg(body, attrs=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:i="urn:editor" viewBox="0 0 100 100" {attrs}>{body}</svg>'.encode()
source = svg('<metadata>editor</metadata><path fill="rgb(100%,50%,0%)" d="M0 0h40v40z"/><path fill="#000" d="M50 50h40v10z"/>', 'i:junk="1"')
raw = import_brand_vector(source, {'removeNodes': ['2'], 'viewBox': '-1 -1 42 42'})
root = ET.fromstring(raw)
assert root.get('viewBox') == '-1 -1 42 42' and root.get('width') == '42'
assert len(root) == 1 and root[0].get('fill') == '#FF8000', 'wordmark, editor data or unreadable color kept'
assert not any(k.startswith('{urn:editor}') for k in root.attrib), 'editor attributes kept'
assert ET.fromstring(import_brand_vector(svg('<path d="M0 0h9v9z"/>'), {'fill': '#00754A'})).get('fill') == '#00754A'
sheet = svg('<style>.a{fill:#f00}</style><path class="a" d="M0 0h9v9z"/><path d="M20 0h9v9z"/><path d="M40 0h9v9z"/>')
icon = ET.fromstring(import_brand_vector(sheet, {'keepNodes': ['0', '2-3']}))
assert [n.get('d', n.tag[-5:]) for n in icon] == ['style', 'M20 0h9v9z', 'M40 0h9v9z'], 'icon cut from a sheet kept other icons'
for raw, ops in [(source, {'removeNodes': ['9']}), (source, {'removeNodes': ['1', '1']}),
                 (source, {'fill': 'red'}), (source, {'viewBox': '0 0 0 10'}), (source, {'recolor': {}}),
                 (sheet, {'keepNodes': ['3-2']}), (sheet, {'keepNodes': ['1-9']}),
                 (svg('<text>Brand</text>'), {}), (svg('<image href="logo.png"/>'), {}),
                 (svg('<path d="M0 0h9v9z"/><text>Brand</text>'), {'removeNodes': ['0']})]:
    try: import_brand_vector(raw, ops)
    except (ValueError, IndexError): pass
    else: raise AssertionError(f'unsafe artwork or edit accepted: {ops}')
`)
  })

  test('palette roles skip white, never repeat a color and mark roles the artwork lacks', () => {
    python(`
import sys
sys.path.insert(0, 'scripts')
from download_brand_logos import artwork_palette
assert artwork_palette(['#FFFFFF', '#0088D7'], 'EA0045', '0088D7') == (['#0088D7', '#000000', '#FFFFFF'], [1])
assert artwork_palette(['#451500', '#FFFFFF'], 'AC2318', '441500') == (['#451500', '#808080', '#FFFFFF'], [1])
assert artwork_palette(['#E4002B', '#000000', '#FFFFFF'], 'E4002B', '000000') == (['#E4002B', '#000000', '#FFFFFF'], [])
`)
  })

  test('refresh reuses verified assets offline and rejects changed or unsafe sources before writing', () => {
    python(`
import contextlib, io, json, shutil, sys, tempfile
from pathlib import Path
sys.path.insert(0, 'scripts')
import download_brand_logos as d
root = Path.cwd()
with tempfile.TemporaryDirectory() as folder:
    d.ROOT = Path(folder)
    d.SOURCES = d.ROOT / 'sources.json'
    shutil.copy(root / 'scripts/brand_artwork_sources.json', d.SOURCES)
    (d.ROOT / 'public/logos/svg').mkdir(parents=True)
    shutil.copy(root / 'public/logos/svg/fast-food-manifest.json', d.ROOT / 'public/logos/svg/fast-food-manifest.json')
    shutil.copytree(root / 'public/logos/svg/fast-food', d.ROOT / 'public/logos/svg/fast-food')
    manifest = d.ROOT / 'public/logos/svg/fast-food-manifest.json'
    before = manifest.read_bytes()
    assets = {p: p.read_bytes() for p in (d.ROOT / 'public/logos/svg/fast-food').rglob('*.svg')}
    d.fetch_source = lambda _: (_ for _ in ()).throw(AssertionError('verified asset was fetched'))
    with contextlib.redirect_stdout(io.StringIO()): d.refresh('FOOD')
    assert manifest.read_bytes() == before
    sources = json.loads(d.SOURCES.read_text())
    for bad, payload in [('changed', b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 9"><image href="x.png"/></svg>'),
                         ('dropped', None)]:
        edited = [dict(s) for s in sources]
        if payload is None:
            edited = [s for s in edited if (s['teamId'], s['id']) != ('FOOD-MCD', 'primary')]
        else:
            next(s for s in edited if s['teamId'].startswith('FOOD-'))['sourceSha256'] = '0' * 64
            d.fetch_source = lambda _, payload=payload: payload
        d.SOURCES.write_text(json.dumps(edited))
        try:
            with contextlib.redirect_stdout(io.StringIO()): d.refresh('FOOD')
        except ValueError: pass
        else: raise AssertionError(f'{bad} source accepted')
        assert manifest.read_bytes() == before
        assert all(p.read_bytes() == raw for p, raw in assets.items()), 'failed refresh changed artwork'
`)
  }, 30000)
})
