import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ALL_POOL_IDS,
  LEAGUES,
  TEAMS,
  TEAM_POOLS,
  filterTeams,
  poolTeams,
  roundHints,
  teamHint,
} from '../src/lib/teams'

const root = join(import.meta.dir, '..')

const COBB_SCHOOLS = [
  'Allatoona',
  'Campbell',
  'Cobb Horizon',
  'Harrison',
  'Hillgrove',
  'Kell',
  'Kennesaw Mountain',
  'Lassiter',
  'McEachern',
  'North Cobb',
  'Osborne',
  'Pebblebrook',
  'Pope',
  'South Cobb',
  'Sprayberry',
  'Walton',
  'Wheeler',
]

// Provenance classes a roster entry may claim. `community` covers third-party
// mirrors (VNN sportshub uploads outside a school's own site, vhv.rs,
// scorestream) for schools whose real mark no official/district/Wikipedia page
// carries. scripts/download_cobb_svgs.py owns the canonical set.
const SOURCE_KINDS = ['official', 'district', 'wikipedia', 'community']

// Tests that drive a builder or downloader end to end re-read every pixel of
// all 17 marks, twice, in pure Python. The community mirrors are far larger
// files than the Wikipedia thumbnails they replaced, which puts those two
// tests over bun's 5s default, so they state their own budget.
const FULL_PIPELINE_TIMEOUT = 30_000

const HEX = /^#[0-9A-F]{6}$/
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const hsTeams = TEAMS.filter((t) => t.league === 'HS')

function python(code: string) {
  const run = spawnSync('python3', ['-c', code], { cwd: root, encoding: 'utf8' })
  return { status: run.status, stdout: run.stdout, stderr: run.stderr }
}

describe('high-school league data', () => {
  test('HIGH SCHOOL league is configured with the Cobb County conference', () => {
    expect(LEAGUES.HS).toEqual({ label: 'HIGH SCHOOL', conferences: ['Cobb County'] })
  })

  test('all 17 Cobb County schools are present exactly once', () => {
    expect(hsTeams.map((t) => t.region).sort()).toEqual(COBB_SCHOOLS)
    const ids = hsTeams.map((t) => t.id)
    expect(new Set(ids).size).toBe(17)
    for (const t of hsTeams) expect(t.id).toMatch(/^HS-[A-Z]+$/)
  })

  test('every team carries Cobb County, a nickname, and a valid three-color palette', () => {
    for (const t of hsTeams) {
      expect(t.conference).toBe('Cobb County')
      // Cobb Horizon has no athletics program, hence no nickname.
      if (t.region !== 'Cobb Horizon') expect(t.name.length).toBeGreaterThan(0)
      expect(t.palette).toHaveLength(3)
      for (const hex of t.palette) expect(hex).toMatch(HEX)
      expect(t.logo.startsWith('/logos/svg/high-school/')).toBe(true)
    }
  })

  test('every logo asset passes the production structural validator', () => {
    for (const t of hsTeams) {
      const data = readFileSync(join(root, 'public', t.logo))
      expect(data.length).toBeGreaterThan(0)
      if (t.logo.endsWith('.svg')) {
        expect(data.toString('utf8', 0, 4096)).toContain('<svg')
      } else {
        expect(data.subarray(0, 8).equals(PNG_MAGIC)).toBe(true)
      }
    }
    const checked = python(`
import json, pathlib, sys
sys.path.insert(0, 'scripts')
from download_cobb_svgs import is_valid_cobb_image
items = json.load(open('public/logos/svg/hs-manifest.json'))['assets']
assert all(is_valid_cobb_image((p := pathlib.Path('public') / a['path'].lstrip('/')).read_bytes(), p) for a in items)
`)
    expect(checked).toEqual({ status: 0, stdout: '', stderr: '' })
  })

  test('the manifest matches the teams and records a source for each asset', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'public/logos/svg/hs-manifest.json'), 'utf8'))
    expect(manifest.assets).toHaveLength(17)
    const byId = new Map(hsTeams.map((t) => [t.id, t]))
    for (const a of manifest.assets) {
      const team = byId.get(a.id)!
      expect(team).toBeDefined()
      expect(a.path).toBe(team.logo)
      expect(a.palette).toEqual(team.palette)
      expect(SOURCE_KINDS).toContain(a.sourceKind)
      expect(a.sourceUrl).toMatch(/^https:\/\//)
      expect(['svg', 'png']).toContain(a.format)
      expect(a.sourcePalette).toHaveLength(3)
      expect(Array.isArray(a.unusedSourceSlots)).toBe(true)
    }
  })

  test('two-color marks explicitly document unused source slots and all used slots occur in artwork', () => {
    const checked = python(`
import json, pathlib, sys
sys.path.insert(0, 'scripts')
from download_cobb_svgs import UNUSED_SOURCE_SLOTS, artwork_colors
items = json.load(open('public/logos/svg/hs-manifest.json'))['assets']
assert UNUSED_SOURCE_SLOTS == {'CAMP': [2], 'HORZ': [2], 'LASS': [1], 'OSBO': [1], 'PEBB': [2], 'WALT': [1]}
for a in items:
    colors, _ = artwork_colors(pathlib.Path('public') / a['path'].lstrip('/'))
    for slot, source in enumerate(a['sourcePalette']):
        if slot not in a['unusedSourceSlots']:
            assert source in colors, (a['abbr'], slot)
`)
    expect(checked).toEqual({ status: 0, stdout: '', stderr: '' })
    for (const abbr of ['CAMP', 'HORZ', 'LASS', 'OSBO', 'PEBB', 'WALT']) {
      expect(hsTeams.find((t) => t.abbr === abbr)?.unusedSourceSlots).toBeDefined()
    }
  })
})

describe('high-school asset pipeline regressions', () => {
  test('downloader and builder share one source-kind set that admits community mirrors', () => {
    const run = python(`
import json, pathlib, sys, tempfile
sys.path.insert(0, 'scripts')
import build_hs_teams as b
from download_cobb_svgs import SOURCE_KINDS
import download_cobb_svgs as d

assert SOURCE_KINDS == {'official', 'district', 'wikipedia', 'community'}, SOURCE_KINDS
# The builder validates against the downloader's set, not a copy of its own.
assert b.SOURCE_KINDS is SOURCE_KINDS
assert {s[4] for s in b.SCHOOLS} <= SOURCE_KINDS

# The five schools whose real mark only a third-party mirror carries, in the
# roster and in the manifest the builder validates.
MIRRORED = {'CAMP', 'KELL', 'MCEA', 'NCOB', 'PEBB'}
assert {s[0] for s in b.SCHOOLS if s[4] == 'community'} == MIRRORED
rows = b.validate_manifest()
assert len(rows) == 17
assert {r['abbr'] for r in rows if r['sourceKind'] == 'community'} == MIRRORED
# A mirror with no richer page than the asset cites the asset itself.
for row in rows:
    if row['abbr'] in MIRRORED:
        assert row['sourcePage'] == row['sourceUrl'], row['abbr']

# An invented kind is still refused by both halves of the pipeline.
payload = json.loads(b.MANIFEST.read_text())
b.MANIFEST = pathlib.Path(tempfile.mkdtemp()) / 'hs-manifest.json'
b.SCHOOLS = [s[:4] + ('fanart',) + s[5:] if s[0] == 'CAMP' else s for s in b.SCHOOLS]
for a in payload['assets']:
    if a['abbr'] == 'CAMP':
        a['sourceKind'] = 'fanart'
b.MANIFEST.write_text(json.dumps(payload))
try: b.validate_manifest()
except ValueError: pass
else: raise AssertionError('builder accepted an unknown sourceKind')
d.SCHOOLS = [s[:4] + ('fanart',) + s[5:] if s[0] == 'CAMP' else s for s in d.SCHOOLS]
d.fetch = lambda _: (_ for _ in ()).throw(AssertionError('network should not be used'))
sys.argv = ['download_cobb_svgs.py']
assert d.main() == 2
`)
    expect(run.status).toBe(0)
  })

  test('a JPEG mirror is re-encoded as PNG and a post-IEND tail is dropped', () => {
    const run = python(`
import base64, pathlib, sys, tempfile
sys.path.insert(0, 'scripts')
import download_cobb_svgs as d

# 16x16 baseline JPEG, 2x2 chroma subsampled: left half #C81E28, right #1E46C8.
JPEG = base64.b64decode(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsK'
    'CwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQU'
    'FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAQABADASIA'
    'AhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAABQf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEB'
    'AAAAAAAAAAAAAAAAAAAAB//EABoRAAICAwAAAAAAAAAAAAAAAAAHRINFwsP/2gAMAwEAAhEDEQA/'
    'AIIHMByAp51e4junH28z/9k='
)
png = d.jpeg_to_png(JPEG)
width, height, depth, ctype, interlace = d.validate_png(png)[:5]
assert (width, height, depth, ctype, interlace) == (16, 16, 8, 2, 0)

# Both halves land in the right place: sampling inside each one proves the
# Huffman decode, dequantization, IDCT and chroma upsampling all line up,
# which counting colors cannot -- ringing splits a flat fill into many shades.
w, h, channels, samples = d.decode_jpeg(JPEG)
assert (w, h, channels) == (16, 16, 3)
def pixel(x, y):
    at = (y * w + x) * channels
    return tuple(samples[at : at + channels])
def near(got, want):
    return all(abs(a - b) <= 3 for a, b in zip(got, want))
assert near(pixel(3, 8), (0xC8, 0x1E, 0x28)), pixel(3, 8)
assert near(pixel(12, 8), (0x1E, 0x46, 0xC8)), pixel(12, 8)
assert near(bytes.fromhex(d.png_colors_any(png)[0][0][1:]), (0xC8, 0x1E, 0x28))

# Only the shapes the league stores are converted, and only for a PNG asset.
assert d.normalize_asset(JPEG, pathlib.Path('x.png')) == png
assert d.normalize_asset(JPEG, pathlib.Path('x.svg')) == JPEG
assert not d.is_valid_cobb_image(JPEG, pathlib.Path('x.png'))

# Kell's mirror appends bytes after IEND. Trimming them restores exactly the
# stored asset, and nothing inside the datastream is touched.
kell = (d.DEST_DIR / 'kell.png').read_bytes()
tail = kell + b'\\x00trailing junk'
assert not d.is_valid_cobb_image(tail, pathlib.Path('kell.png'))
assert d.normalize_asset(tail, pathlib.Path('kell.png')) == kell
assert d.normalize_asset(kell, pathlib.Path('kell.png')) == kell
# A file whose chunk list cannot be walked is left for the validator to reject.
assert d.trim_after_iend(d.PNG_MAGIC + b'\\x00\\x00') == d.PNG_MAGIC + b'\\x00\\x00'

# install_download validates what it stores, so the JPEG lands on disk as PNG.
scratch = pathlib.Path(tempfile.mkdtemp())
d.OUT, d.DEST_DIR = scratch, scratch / 'high-school'
d.DEST_DIR.mkdir()
dest = d.DEST_DIR / 'test.png'
school = ('TEST', 'Test', 'Testers', 'https://example.test/x.jpg', 'community', 'https://example.test/x.jpg')
item = d.install_download(school, dest, JPEG)
assert dest.read_bytes() == png
assert item['format'] == 'png' and item['path'] == '/logos/svg/high-school/test.png'
assert list(d.DEST_DIR.iterdir()) == [dest], 'staged file left behind'
`)
    expect(run.status).toBe(0)
    expect(run.stderr).toBe('')
  })

  test('--only merges local success and forced fetch failure preserves the complete manifest', () => {
    const run = python(`
import pathlib, sys
sys.path.insert(0, 'scripts')
import download_cobb_svgs as d
before = d.MANIFEST.read_bytes()
d.fetch = lambda _: (_ for _ in ()).throw(AssertionError('network should not be used'))
sys.argv = ['download_cobb_svgs.py', '--only', 'CAMP']
assert d.main() == 0
assert len(__import__('json').loads(d.MANIFEST.read_text())['assets']) == 17
after_only = d.MANIFEST.read_bytes()
assert after_only == before
d.fetch = lambda _: (_ for _ in ()).throw(RuntimeError('simulated offline'))
sys.argv = ['download_cobb_svgs.py', '--force', '--only', 'CAMP']
assert d.main() == 1
assert d.MANIFEST.read_bytes() == after_only
assert (d.DEST_DIR / 'camp.png').is_file()
`)
    expect(run.status).toBe(0)
  }, FULL_PIPELINE_TIMEOUT)

  test('truncated, CRC-invalid, and decoded-scanline-invalid PNGs are rejected', () => {
    const run = python(`
import struct, sys, zlib
sys.path.insert(0, 'scripts')
from download_cobb_svgs import validate_png
def chunk(kind, body):
    return struct.pack('>I', len(body)) + kind + body + struct.pack('>I', zlib.crc32(kind + body) & 0xffffffff)
ihdr = struct.pack('>IIBBBBB', 1, 1, 8, 6, 0, 0, 0)
good = b'\\x89PNG\\r\\n\\x1a\\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(b'\\x00\\x01\\x02\\x03\\xff')) + chunk(b'IEND', b'')
validate_png(good)
bad_crc = bytearray(good); bad_crc[-1] ^= 1
bad_scanline = b'\\x89PNG\\r\\n\\x1a\\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(b'\\x00')) + chunk(b'IEND', b'')
for bad in (good[:-5], bytes(bad_crc), bad_scanline):
    try: validate_png(bad)
    except ValueError: pass
    else: raise AssertionError('malformed PNG accepted')
`)
    expect(run).toEqual({ status: 0, stdout: '', stderr: '' })
  })

  test('structurally malformed PNGs are rejected and their well-formed twins are not', () => {
    const run = python(`
import struct, sys, zlib
sys.path.insert(0, 'scripts')
from download_cobb_svgs import validate_png

def chunk(kind, body):
    return struct.pack('>I', len(body)) + kind + body + struct.pack('>I', zlib.crc32(kind + body) & 0xffffffff)

def png(ihdr, raw, plte=b'', extra=b''):
    head = bytes([137, 80, 78, 71, 13, 10, 26, 10]) + chunk(b'IHDR', ihdr)
    palette = chunk(b'PLTE', plte) if plte else b''
    return head + extra + palette + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')

def rejects(data, label):
    try: validate_png(data)
    except ValueError: return
    raise AssertionError('accepted ' + label)

RGBA = struct.pack('>IIBBBBB', 1, 1, 8, 6, 0, 0, 0)
IDX8 = struct.pack('>IIBBBBB', 1, 1, 8, 3, 0, 0, 0)
IDX4 = struct.pack('>IIBBBBB', 1, 1, 4, 3, 0, 0, 0)
GRAY = struct.pack('>IIBBBBB', 1, 1, 8, 0, 0, 0, 0)
# 8x1 at depth 4 puts Adam7 pass 2 at raw byte 3 with four padding bits.
LACE = struct.pack('>IIBBBBB', 8, 1, 4, 3, 0, 0, 1)
PIXEL, ONE_ENTRY, LACED = bytes([0, 1, 2, 3, 255]), bytes([17, 34, 51]), bytes(9)

# Each valid twin must pass, so the rejections below prove a specific rule and
# not a validator that has simply started refusing everything.
validate_png(png(RGBA, PIXEL))
validate_png(png(RGBA, PIXEL, extra=chunk(b'zzZz', b'x')))
validate_png(png(IDX8, bytes([0, 0]), plte=ONE_ENTRY))
validate_png(png(IDX4, bytes([0, 0]), plte=ONE_ENTRY))
validate_png(png(LACE, LACED, plte=ONE_ENTRY))
RGB = struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)
RGB_PIXEL = bytes([0, 1, 2, 0])
valid_rgb = bytes([137, 80, 78, 71, 13, 10, 26, 10]) + chunk(b'IHDR', RGB) + chunk(b'PLTE', ONE_ENTRY) + chunk(b'tRNS', bytes([0, 0, 0, 0, 0, 0])) + chunk(b'IDAT', zlib.compress(RGB_PIXEL)) + chunk(b'IEND', b'')
validate_png(valid_rgb)

rejects(png(RGBA, PIXEL, extra=chunk(b'ZzZz', b'x')), 'unknown critical chunk')
rejects(png(RGBA, PIXEL, extra=chunk(b'tRnS', b'x')), 'reserved chunk bit')
rejects(png(IDX8, bytes([0, 1]), plte=ONE_ENTRY), 'palette index past the PLTE')
rejects(png(IDX4, bytes([0, 15]), plte=ONE_ENTRY), 'non-zero scanline padding bits')
rejects(png(LACE, LACED[:3] + bytes([15]) + LACED[4:], plte=ONE_ENTRY), 'non-zero Adam7 padding bits')
rejects(png(IDX8, bytes([0, 0])), 'indexed PNG with no PLTE')
rejects(png(GRAY, bytes([0, 0]), plte=ONE_ENTRY), 'PLTE in a grayscale PNG')
rejects(png(RGBA, PIXEL, extra=chunk(b'tRNS', bytes([0, 0]))), 'tRNS beside an alpha channel')
rejects(png(RGB, RGB_PIXEL, plte=ONE_ENTRY, extra=chunk(b'tRNS', bytes([0, 0, 0, 0, 0, 0]))), 'PLTE after tRNS')
`)
    expect(run).toEqual({ status: 0, stdout: '', stderr: '' })
  })

  test('the college builder swaps teams JSON atomically and leaves the HS block intact', () => {
    const run = python(`
import contextlib, io, json, os, pathlib, sys, tempfile
sys.path.insert(0, 'scripts')
import build_teams as b
real = pathlib.Path('src/lib/teams.json').read_bytes()
native_replace = os.replace
with tempfile.TemporaryDirectory() as tmp:
    tmp = pathlib.Path(tmp)
    b.TEAMS_JSON = tmp / 'teams.json'
    b.TEAMS_JSON.write_bytes(real)
    sys.argv = ['build_teams.py']
    swapped = []
    def spy(src, dst):
        swapped.append(str(dst))
        json.loads(pathlib.Path(src).read_text())  # the staged file is whole before it lands
        native_replace(src, dst)
    os.replace = spy
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            assert b.main() == 0
        assert swapped == [str(b.TEAMS_JSON)], swapped
        assert b.TEAMS_JSON.read_bytes() == real, 'rebuild is not idempotent'
        teams = json.loads(b.TEAMS_JSON.read_text())['teams']
        assert sum(t['league'] == 'HS' for t in teams) == 17
        assert sum(t['league'] == 'PRO' for t in teams) == 32
        assert list(tmp.iterdir()) == [b.TEAMS_JSON], 'staged file left behind'

        # A swap that fails must leave the previous roster exactly as it was.
        os.replace = lambda *_: (_ for _ in ()).throw(OSError('simulated'))
        with contextlib.redirect_stdout(io.StringIO()):
            try:
                b.main()
            except OSError:
                pass
            else:
                raise AssertionError('a failed swap was swallowed')
        assert b.TEAMS_JSON.read_bytes() == real
        assert list(tmp.iterdir()) == [b.TEAMS_JSON], 'staged file left behind after failure'
    finally:
        os.replace = native_replace
`)
    expect(run).toEqual({ status: 0, stdout: '', stderr: '' })
  }, FULL_PIPELINE_TIMEOUT)

  test('the HS builder rejects an incomplete manifest without altering teams JSON', () => {
    const run = python(`
import json, pathlib, sys, tempfile
sys.path.insert(0, 'scripts')
import build_hs_teams as b
with tempfile.TemporaryDirectory() as td:
    td = pathlib.Path(td)
    b.MANIFEST = td / 'manifest.json'
    b.TEAMS_JSON = td / 'teams.json'
    b.MANIFEST.write_text(json.dumps({'assets': []}))
    original = pathlib.Path('src/lib/teams.json').read_bytes()
    b.TEAMS_JSON.write_bytes(original)
    sys.argv = ['build_hs_teams.py']
    assert b.main() == 1
    assert b.TEAMS_JSON.read_bytes() == original
`)
    expect(run.status).toBe(0)
    expect(run.stderr).toContain('expected 17')
  })

  test('the college builder rejects incomplete or invalid HS entries without altering teams JSON', () => {
    const run = python(`
import copy, json, pathlib, sys, tempfile
sys.path.insert(0, 'scripts')
import build_teams as b
original = pathlib.Path('src/lib/teams.json').read_bytes()
base = json.loads(original)
cases = []
missing = copy.deepcopy(base)
missing['teams'] = [t for t in missing['teams'] if t['id'] != 'HS-WHEE']
cases.append(missing)
invalid = copy.deepcopy(base)
next(t for t in invalid['teams'] if t['id'] == 'HS-WALT')['conference'] = 'Not Cobb County'
cases.append(invalid)
for candidate in cases:
    with tempfile.TemporaryDirectory() as td:
        td = pathlib.Path(td)
        b.TEAMS_JSON = td / 'teams.json'
        b.TEAMS_JSON.write_bytes(json.dumps(candidate).encode())
        sys.argv = ['build_teams.py']
        assert b.main() == 1
        assert b.TEAMS_JSON.read_bytes() == json.dumps(candidate).encode()
        assert list(td.iterdir()) == [b.TEAMS_JSON]
`)
    expect(run.status).toBe(0)
  })
})

describe('high-school league gameplay integration', () => {
  test('the browser filter reaches all 17 schools and search narrows them', () => {
    expect(filterTeams('HS', 'All', '')).toHaveLength(17)
    expect(filterTeams('HS', 'Cobb County', '')).toHaveLength(17)
    expect(filterTeams('HS', 'All', 'walton').map((t) => t.name)).toEqual(['Raiders'])
    expect(filterTeams('HS', 'All', 'KMHS')).toHaveLength(1)
  })

  test('Cobb County is a selectable random-deck pool with all 17 teams', () => {
    const pool = TEAM_POOLS.find((p) => p.id === 'Cobb County')
    expect(pool?.label).toBe('Cobb County')
    expect(ALL_POOL_IDS).toContain('Cobb County')
    expect(poolTeams(['Cobb County'])).toHaveLength(17)
  })

  test('round hints identify high-school teams as Cobb County', () => {
    const walton = hsTeams.find((t) => t.region === 'Walton')!
    expect(teamHint(walton)).toBe('Cobb County')
    expect(roundHints({ o: walton.id, c: 'PRO-KC', v: 0 })).toEqual(['Logo: Cobb County', 'Colors: NFL'])
  })

  test('existing NFL and college data is untouched', () => {
    expect(TEAMS.filter((t) => t.league === 'PRO')).toHaveLength(32)
    expect(TEAMS.filter((t) => t.league === 'COL')).toHaveLength(126)
    expect(LEAGUES.PRO.label).toBe('NFL')
    expect(LEAGUES.COL.conferences).toEqual(['ACC', 'Big 12', 'Big Ten', 'Pac-12', 'SEC', 'Ivy', 'HBCU'])
    expect(TEAM_POOLS.map((p) => p.id)).toEqual(['NFL', ...LEAGUES.COL.conferences, 'Cobb County'])
  })

  test('the team browser uses original league controls with compact HS copy', () => {
    const browser = readFileSync(join(root, 'src/components/TeamBrowser.tsx'), 'utf8')
    const css = readFileSync(join(root, 'src/styles.css'), 'utf8')
    expect(browser).toContain('Object.keys(LEAGUES) as League[]')
    expect(browser).toContain('className="seg"')
    expect(browser).toContain('className={`seg-btn${state.league === lg ? \' active\' : \'\'}`}')
    expect(browser).toContain("{lg === 'HS' ? 'HS' : LEAGUES[lg].label}")
    expect(browser).toContain("onState({ ...state, league: lg, conference: 'All' })")
    expect(browser).not.toContain('browser-head')
    expect(browser).not.toContain('league-seg')

    const leagueKeys = Object.keys(LEAGUES)
    expect(leagueKeys).toEqual(['PRO', 'COL', 'HS'])
    expect(leagueKeys.map((lg) => (lg === 'HS' ? 'HS' : LEAGUES[lg as keyof typeof LEAGUES].label))).toEqual(['NFL', 'COLLEGE', 'HS'])
    expect(css).toMatch(/^\.seg \{ display: flex; background: var\(--chip-bg\); border-radius: 10px; padding: 3px; gap: 2px; \}$/m)
    expect(css).toMatch(/^\.seg-btn \{ min-width: 54px; height: 38px; border: none; border-radius: 8px; font: 600 12px var\(--ui\); cursor: pointer; background: transparent; color: var\(--muted\); \}$/m)
    expect(css).not.toContain('.league-seg')
    expect(css).not.toContain('.browser-head')
  })

  test('hidden mode panels override explicit create and deck display rules', () => {
    const css = readFileSync(join(root, 'src/styles.css'), 'utf8')
    const hidden = css.indexOf('[hidden] { display: none !important; }')
    const createLand = css.indexOf('.create-land { flex: 1; min-height: 0; display: grid;')
    const createPort = css.indexOf('.create-port { flex: 1; min-height: 0; display: flex;')
    const deck = css.indexOf('.deck { flex: 1; min-height: 0; display: flex;')
    expect(hidden).toBeGreaterThanOrEqual(0)
    expect(createLand).toBeGreaterThan(hidden)
    expect(createPort).toBeGreaterThan(hidden)
    expect(deck).toBeGreaterThan(hidden)
    expect(css.match(/\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/g)).toHaveLength(1)
  })

  test('all 17 HS teams remain accessible through the browser filter', () => {
    expect(filterTeams('HS', 'All', '').map((t) => t.region).sort()).toEqual(COBB_SCHOOLS)
    expect(filterTeams('HS', 'Cobb County', '').map((t) => t.region).sort()).toEqual(COBB_SCHOOLS)
  })
})
