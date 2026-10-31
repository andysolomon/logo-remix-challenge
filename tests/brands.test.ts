import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  ALL_POOL_IDS, LEAGUES, TEAMS, contrastSafePermutation, deckFromStorage, filterTeams, findTeam, fullName,
  colorPoolTeams, isCorrectGuess, logoPoolTeams, logoVariants, nextLogoVariant, normalizeRound, poolTeams, randomDeck,
  roundHints, suggestTeams, withLogoVariant, type League,
} from '../src/lib/teams'

const root = join(import.meta.dir, '..')
const python = (code: string) => execFileSync('python3', ['-c', code], { cwd: root })
const COLLECTIONS: League[] = ['FOOD', 'BRAND', 'FLAG', 'APP', 'TV', 'CAR', 'LUX', 'CLOTH', 'CHAR', 'SWEET']
const entries = TEAMS.filter((t) => COLLECTIONS.includes(t.league))
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
/** Entries with name-visible imported artwork; random decks skip them, but they can still be picked by hand. */
const WORDMARK_ONLY = [
  'APP-CANDY', 'APP-IMDB',
  'BRAND-3M', 'BRAND-76', 'BRAND-AMEX', 'BRAND-BOSE', 'BRAND-CAPONE', 'BRAND-CAT', 'BRAND-CISCO', 'BRAND-CITI', 'BRAND-COKE', 'BRAND-COSTCO', 'BRAND-CVS', 'BRAND-DELL',
  'BRAND-DHL', 'BRAND-DRPEPPER', 'BRAND-EXXON', 'BRAND-FEDEX', 'BRAND-HASBRO', 'BRAND-IBM', 'BRAND-INTEL', 'BRAND-KELLOGGS', 'BRAND-KROGER', 'BRAND-LAYS', 'BRAND-LEGO', 'BRAND-LYFT',
  'BRAND-MARVEL', 'BRAND-MATTEL', 'BRAND-MOBIL', 'BRAND-MTNDEW', 'BRAND-NASA', 'BRAND-NERF', 'BRAND-ORACLE', 'BRAND-PARAMOUNT', 'BRAND-SAMSUNG', 'BRAND-SEGA',
  'BRAND-SONY', 'BRAND-SPRITE', 'BRAND-UBER', 'BRAND-UPS', 'BRAND-VISA', 'BRAND-WHOLEFOODS',
  'CAR-FIAT', 'CAR-FORD',
  'CHAR-AOT', 'CHAR-AVENGERS', 'CHAR-BLUEY', 'CHAR-BOND', 'CHAR-BTTF', 'CHAR-COD', 'CHAR-DEMONSLAYER', 'CHAR-DK', 'CHAR-DRAGONBALL', 'CHAR-ELDENRING', 'CHAR-ENCANTO', 'CHAR-FALLGUYS',
  'CHAR-FROZEN', 'CHAR-GOT', 'CHAR-GTA', 'CHAR-HUNGER', 'CHAR-IRONMAN', 'CHAR-JJK', 'CHAR-JL', 'CHAR-KIRBY', 'CHAR-KUNGFUPANDA', 'CHAR-LIONKING', 'CHAR-MHA', 'CHAR-MINIONS',
  'CHAR-MOANA', 'CHAR-NARUTO', 'CHAR-NEMO', 'CHAR-ONEPIECE', 'CHAR-PAW', 'CHAR-POOH', 'CHAR-SAILORMOON', 'CHAR-SCOOBY', 'CHAR-SESAME', 'CHAR-SHREK', 'CHAR-SIMPSONS', 'CHAR-SMURFS',
  'CHAR-SONIC', 'CHAR-SPLATOON', 'CHAR-SPONGEBOB', 'CHAR-STARWARS', 'CHAR-STITCH', 'CHAR-STRANGER', 'CHAR-TEENTITANS', 'CHAR-TETRIS', 'CHAR-TMNT', 'CHAR-TOYSTORY',
  'CLOTH-DRMARTENS', 'CLOTH-GANT', 'CLOTH-GAP', 'CLOTH-HM', 'CLOTH-JCREW', 'CLOTH-LEE', 'CLOTH-OLDNAVY', 'CLOTH-SUPREME', 'CLOTH-THRASHER', 'CLOTH-UGG', 'CLOTH-UNIQLO',
  'CLOTH-ZARA',
  'FOOD-BOJ', 'FOOD-BOSTON', 'FOOD-CANE', 'FOOD-CARVEL', 'FOOD-CB', 'FOOD-CHEESE', 'FOOD-CINNABON', 'FOOD-CUL', 'FOOD-DENNYS', 'FOOD-EPL', 'FOOD-FAT', 'FOOD-FIREHOUSE',
  'FOOD-FIVE', 'FOOD-FREDDYS', 'FOOD-GC', 'FOOD-HABIT', 'FOOD-HD', 'FOOD-HRC', 'FOOD-IHOP', 'FOOD-JM', 'FOOD-KRISPY', 'FOOD-MOES', 'FOOD-OUTBACK', 'FOOD-PAPA',
  'FOOD-PFC', 'FOOD-PM', 'FOOD-QDOBA', 'FOOD-RAIN', 'FOOD-RUBY', 'FOOD-SNS', 'FOOD-TIMS', 'FOOD-WINGSTOP',
  'LUX-BVLGARI', 'LUX-DIOR', 'LUX-PRADA', 'LUX-RM', 'LUX-TAG', 'LUX-TIFFANY', 'LUX-VCA',
  'SWEET-ALTOIDS', 'SWEET-BENJERRY', 'SWEET-BREYERS', 'SWEET-BUTTERFINGER', 'SWEET-CADBURY', 'SWEET-CHIPSAHOY', 'SWEET-DOUBLEMINT', 'SWEET-DUMDUMS', 'SWEET-ENTENMANNS',
  'SWEET-EXTRA', 'SWEET-FERRERO', 'SWEET-HARIBO', 'SWEET-HOSTESS', 'SWEET-HUBBA', 'SWEET-JELLYBELLY', 'SWEET-JOLLY', 'SWEET-JUICYFRUIT', 'SWEET-KEEBLER',
  'SWEET-KINDER', 'SWEET-KITKAT', 'SWEET-LIFESAVERS', 'SWEET-LITTLEDEBBIE', 'SWEET-MAGNUM', 'SWEET-MENTOS', 'SWEET-MILKA', 'SWEET-MMS', 'SWEET-NERDS',
  'SWEET-NUTELLA', 'SWEET-ORBIT', 'SWEET-OREO', 'SWEET-PEPPERIDGE', 'SWEET-PEZ', 'SWEET-PILLSBURY', 'SWEET-POPSICLE', 'SWEET-POPTARTS', 'SWEET-REESES',
  'SWEET-RICOLA', 'SWEET-SKITTLES', 'SWEET-SNICKERS', 'SWEET-TICTAC', 'SWEET-TOOTSIE', 'SWEET-TRIDENT', 'SWEET-TROLLI', 'SWEET-TWIX', 'SWEET-TWIZZLERS',
  'TV-ABC', 'TV-AMC', 'TV-BBC', 'TV-BEIN', 'TV-BRAVO', 'TV-CMT', 'TV-CNN', 'TV-CW', 'TV-DAZN', 'TV-DISNEYXD', 'TV-EENT', 'TV-ESPN', 'TV-FOODNETWORK', 'TV-FOX',
  'TV-FS1', 'TV-FX', 'TV-HBO', 'TV-HGTV', 'TV-ION', 'TV-MLBN', 'TV-NBATV', 'TV-NFLN', 'TV-NHLN', 'TV-NINE', 'TV-TBS', 'TV-TLC', 'TV-TNT', 'TV-TWC', 'TV-VH1',
]
/**
 * Entries that lead with a symbol and keep a wordmark as a hand-pickable alternate: Barbie's silhouette, the DC peel, the Wells Fargo stagecoach, the TARDIS,
 * the pixel invader, Mario's Power Star, the Vans flying V, the Dunkin' cup, the Waffle House WH, the MK circle, the Chupa Chups daisy, Godiva's rider,
 * the ice-cream heart, the Klondike bear, Lindt's crest and Toblerone's mountain.
 */
const WORDMARK_ALTERNATES = [
  'BRAND-BARBIE', 'BRAND-DC', 'BRAND-WELLS', 'CHAR-DOCTORWHO', 'CHAR-INVADER', 'CHAR-MARIO', 'CLOTH-VANS', 'FOOD-DUNK', 'FOOD-WAFFLE', 'LUX-MK',
  'SWEET-CHUPA', 'SWEET-GODIVA', 'SWEET-GOODHUMOR', 'SWEET-KLONDIKE', 'SWEET-LINDT', 'SWEET-TOBLERONE',
]
const wordmarks = (league: League) => WORDMARK_ONLY.filter((id) => id.startsWith(`${league}-`)).length

describe('brand collections', () => {
  test('fast food, brands, apps, TV, cars, luxury, clothing, characters and sweets have full rosters split across their categories', () => {
    expect(LEAGUES.BRAND).toEqual({ label: 'BRANDS', conferences: ['Product', 'Service', 'Corporate', 'Personal', 'Store'] })
    expect(LEAGUES.APP).toEqual({ label: 'APPS', conferences: ['Built-in', 'Social', 'Games', 'Music & Video', 'Everyday', 'Productivity'] })
    expect(LEAGUES.BRAND.conferences.map((c) => filterTeams('BRAND', c, '').length)).toEqual([30, 37, 52, 4, 12])
    expect(LEAGUES.FOOD).toEqual({ label: 'RESTAURANTS', conferences: ['Burgers', 'Chicken', 'Sandwiches', 'Pizza', 'Mexican & Asian', 'Coffee & Treats', 'Casual Dining'] })
    expect(LEAGUES.FOOD.conferences.map((c) => filterTeams('FOOD', c, '').length)).toEqual([19, 11, 8, 8, 8, 15, 24])
    expect(LEAGUES.CHAR).toEqual({ label: 'CHARACTERS', conferences: ['Marvel', 'DC', 'Disney & Pixar', 'Star Wars', 'Movies & TV', 'Video Games', 'Cartoons & Anime'] })
    expect(LEAGUES.CHAR.conferences.map((c) => filterTeams('CHAR', c, '').length)).toEqual([10, 8, 13, 11, 21, 29, 23])
    expect(LEAGUES.SWEET).toEqual({ label: 'SWEETS', conferences: ['Chocolate', 'Gummy & Chewy', 'Hard Candy', 'Gum & Mints', 'Cookies & Cakes', 'Ice Cream'] })
    expect(LEAGUES.SWEET.conferences.map((c) => filterTeams('SWEET', c, '').length)).toEqual([15, 7, 6, 9, 9, 6])
    expect(LEAGUES.APP.conferences.map((c) => filterTeams('APP', c, '').length)).toEqual([35, 32, 23, 27, 32, 26])
    expect(LEAGUES.TV).toEqual({ label: 'TV', conferences: ['Broadcast', 'Cable', 'Music & Pop', 'Kids', 'Discovery & Lifestyle', 'Sports', 'International'] })
    expect(LEAGUES.TV.conferences.map((c) => filterTeams('TV', c, '').length)).toEqual([12, 16, 5, 13, 13, 15, 24])
    expect(LEAGUES.CAR).toEqual({ label: 'CARS', conferences: ['American', 'Japanese & Korean', 'German', 'Italian', 'British'] })
    expect(LEAGUES.CAR.conferences.map((c) => filterTeams('CAR', c, '').length)).toEqual([6, 8, 5, 5, 6])
    expect(LEAGUES.LUX).toEqual({ label: 'LUXURY', conferences: ['Fashion House', 'Leather Goods', 'Watchmaker', 'Jeweler'] })
    expect(LEAGUES.LUX.conferences.map((c) => filterTeams('LUX', c, '').length)).toEqual([10, 6, 8, 6])
    expect(LEAGUES.CLOTH).toEqual({ label: 'CLOTHING', conferences: ['Sportswear', 'Streetwear', 'Outdoor', 'Preppy', 'Everyday', 'Surf & Skate', 'Footwear'] })
    expect(LEAGUES.CLOTH.conferences.map((c) => filterTeams('CLOTH', c, '').length)).toEqual([27, 19, 26, 19, 17, 23, 16])
    for (const [league, size] of [['FOOD', 93], ['BRAND', 135], ['FLAG', 123], ['APP', 175], ['TV', 98], ['CAR', 30], ['LUX', 30], ['CLOTH', 147], ['CHAR', 115], ['SWEET', 52]] as const) {
      expect(filterTeams(league, 'All', '')).toHaveLength(size)
      expect(new Set(filterTeams(league, 'All', '').map(fullName)).size).toBe(size)
    }
    expect(new Set(TEAMS.map((t) => t.id)).size).toBe(TEAMS.length)
    expect(new Set(entries.map((t) => norm(fullName(t)))).size).toBe(entries.length)
  })

  test('every logo and alternate is local vector artwork; extra marks exist only where they are distinct', () => {
    for (const team of entries) {
      for (const variant of logoVariants(team)) {
        expect(variant.logo).toMatch(/^\/logos\/svg\/(fast-food|brands|flags|apps|tv|cars|luxury|clothing|characters|sweets)\/.+\.svg$/)
        expect(existsSync(join(root, 'public', variant.logo))).toBe(true)
      }
      expect(new Set(logoVariants(team).map((v) => v.logo)).size).toBe(logoVariants(team).length)
    }
    expect(entries.filter((t) => t.alternateLogos?.length).length).toBeGreaterThanOrEqual(400)
  })

  test('artwork never spells the answer, apart from the wordmark-only entries kept for manual selection', () => {
    expect(entries.filter((t) => t.showsName).map((t) => t.id).sort()).toEqual(WORDMARK_ONLY)
    for (const team of entries) {
      const answers = [fullName(team), team.abbr, ...(team.aliases ?? [])].map(norm).filter((a) => a.length > 2)
      for (const variant of team.alternateLogos ?? []) {
        expect(variant.label.length).toBeGreaterThan(0)
        for (const answer of answers) expect(norm(variant.label)).not.toContain(answer)
      }
      if (team.showsName) expect(team.alternateLogos).toBeUndefined()
    }
    // A wordmark survives only behind a symbol primary, flagged so it never reads as the brand's logo.
    const flagged = entries.filter((t) => t.alternateLogos?.some((v) => v.showsName))
    expect(flagged.map((t) => t.id).sort()).toEqual(WORDMARK_ALTERNATES)
    for (const team of flagged) {
      expect(team.showsName).toBeUndefined()
      expect(team.alternateLogos!.filter((v) => v.showsName).map((v) => v.id)).toEqual(['wordmark'])
      expect(withLogoVariant(team, 'wordmark').showsName).toBe(true)
      expect(withLogoVariant(team).showsName).toBeUndefined()
    }
    expect(findTeam('LUX-MK')!.logo).toBe('/logos/svg/luxury/mk.svg')
    expect(findTeam('FOOD-DUNK')!.alternateLogos![0]).toMatchObject({ id: 'wordmark', label: 'Wordmark', logo: '/logos/svg/fast-food/alternates/dunk-wordmark.svg', showsName: true })
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
    assert len(items) == len(rows) == {'FOOD': 93, 'BRAND': 135, 'FLAG': 123, 'APP': 175, 'TV': 98, 'CLOTH': 147, 'NHL': 32, 'WNBA': 15, 'CHAR': 115, 'LANDMARK': 40, 'SWEET': 52}.get(league, 30), league
    for item in items:
        assert teams[item['id']] == build_entry(league, item, rows[item['abbr']]), item['id']
        for art in item['artwork']:
            source = pinned.pop((item['id'], art['id']))
            assert all(art.get(k) == source.get(k) for k in source if k != 'teamId'), (item['id'], art['id'])
            raw = (Path('public') / art['path'].lstrip('/')).read_bytes()
            validate_vector(raw)
            assert hashlib.sha256(raw).hexdigest() == art['sha256'] and len(raw) <= (750_000 if league == 'FLAG' else 400_000)
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
  }, 60000)

  test('random decks draw brand, app, channel, car, luxury, clothing, character and sweets logos, skip wordmarks, take colors from teams and show the type as a hint', () => {
    expect(ALL_POOL_IDS).toEqual(expect.arrayContaining(['Fast Food', 'Brands', 'Apps', 'TV', 'Cars', 'Luxury', 'Clothing', 'Characters', 'Sweets']))
    expect(poolTeams(['Brands', 'Apps'])).toHaveLength(310)
    expect(poolTeams(['Characters'])).toHaveLength(115)
    expect(poolTeams(['Sweets'])).toHaveLength(52)
    expect(poolTeams(['TV', 'Cars'])).toHaveLength(128)
    expect(poolTeams(['Luxury', 'Clothing'])).toHaveLength(177)
    expect(logoPoolTeams(['Fast Food'])).toHaveLength(93 - wordmarks('FOOD'))
    expect(logoPoolTeams(['Brands'])).toHaveLength(135 - wordmarks('BRAND'))
    expect(logoPoolTeams(['Characters'])).toHaveLength(115 - wordmarks('CHAR'))
    expect(logoPoolTeams(['Sweets'])).toHaveLength(52 - wordmarks('SWEET'))
    expect(logoPoolTeams(['TV'])).toHaveLength(98 - wordmarks('TV'))
    expect(logoPoolTeams(['Cars'])).toHaveLength(30 - wordmarks('CAR'))
    expect(logoPoolTeams(['Luxury'])).toHaveLength(30 - wordmarks('LUX'))
    expect(logoPoolTeams(['Clothing'])).toHaveLength(147 - wordmarks('CLOTH'))
    // Brand palettes never color a round, so a wordmark-only brand sits random decks out entirely.
    expect(colorPoolTeams(['Fast Food', 'Brands', 'Apps', 'TV', 'Cars', 'Luxury', 'Clothing', 'Characters', 'Sweets'])).toEqual([])
    expect(randomDeck({ rounds: 20, logoPools: ['Brands'], colorPools: ['Apps'], guess: 'both', hints: true })).toEqual([])
    for (const [logos, colors] of [[['Fast Food'], ['NFL']], [['Brands'], ['NBA']], [['Apps'], ['NFL']], [['Cars'], ['SEC']], [['TV', 'Cars'], ['NFL', 'NBA']], [['Luxury'], ['NBA']], [['Clothing', 'Luxury'], ['NFL', 'SEC']], [['Characters'], ['NFL']], [['Characters', 'Fast Food'], ['NBA', 'ACC']], [['Sweets', 'Characters'], ['NFL']]]) {
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
    const store = filterTeams('BRAND', 'Store', '')[0]
    const game = filterTeams('APP', 'Games', '')[0]
    expect(roundHints({ o: store.id, c: game.id, v: 0 })).toEqual(['Logo: Store brand', 'Colors: Games app'])
    expect(roundHints({ o: 'CAR-BMW', c: 'TV-NICK', v: 0 })).toEqual(['Logo: German car', 'Colors: Kids channel'])
    expect(roundHints({ o: 'LUX-ROLEX', c: 'NBA-ATL', v: 0 })).toEqual(['Logo: Luxury watchmaker', 'Colors: NBA'])
    expect(roundHints({ o: 'LUX-HERMES', c: 'COL-ALA', v: 0 })).toEqual(['Logo: Luxury leather goods', 'Colors: SEC'])
    expect(roundHints({ o: 'CLOTH-TNF', c: 'PRO-KC', v: 0 })).toEqual(['Logo: Outdoor brand', 'Colors: NFL - AFC'])
    expect(roundHints({ o: 'CLOTH-CROCS', c: 'TV-CBC', v: 0 })).toEqual(['Logo: Footwear brand', 'Colors: International channel'])
    expect(roundHints({ o: 'APP-MSWORD', c: 'TV-GOLFCH', v: 0 })).toEqual(['Logo: Productivity app', 'Colors: Sports channel'])
    expect(roundHints({ o: 'CLOTH-QUIKSILVER', c: 'NBA-ATL', v: 0 })).toEqual(['Logo: Surf & Skate brand', 'Colors: NBA'])
    expect(roundHints({ o: 'CHAR-BATMAN', c: 'PRO-KC', v: 0 })).toEqual(['Logo: CHARACTERS - DC', 'Colors: NFL - AFC'])
    expect(roundHints({ o: 'CHAR-TRIFORCE', v: 0 })).toEqual(['Logo: CHARACTERS - Video Games'])
    expect(roundHints({ o: 'SWEET-GODIVA', c: 'NBA-ATL', v: 0 })).toEqual(['Logo: SWEETS - Chocolate', 'Colors: NBA'])
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
cropped = ET.fromstring(import_brand_vector(source, {'viewBox': '0 0 40 40', 'clipToViewBox': True}))
ns = {'s': 'http://www.w3.org/2000/svg'}
clip = cropped.find('s:defs/s:clipPath', ns)
assert clip.get('clipPathUnits') == 'userSpaceOnUse'
assert clip[0].attrib == {'x': '0', 'y': '0', 'width': '40', 'height': '40'}
assert cropped[-1].get('clip-path') == f"url(#{clip.get('id')})"
assert len(cropped[-1]) == 2, 'crop preserves source paths inside an explicit clip'
collision = svg('<defs><clipPath id="reviewed-artwork-crop"><rect width="10" height="10"/></clipPath></defs><path d="M0 0h9v9z"/>')
clipped = ET.fromstring(import_brand_vector(collision, {'viewBox': '0 0 10 10', 'clipToViewBox': True}))
assert clipped[-1].get('clip-path') == 'url(#reviewed-artwork-crop-1)'
for raw, ops in [(source, {'removeNodes': ['9']}), (source, {'removeNodes': ['1', '1']}),
                 (source, {'clipToViewBox': True}), (source, {'viewBox': '0 0 40 40', 'clipToViewBox': False}),
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
