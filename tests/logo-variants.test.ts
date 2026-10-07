import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { TEAMS, contrastSafePermutation, deckFromStorage, fullName, isCorrectGuess, logoVariants, nextLogoVariant, normalizeRound, withLogoVariant } from '../src/lib/teams'

const root = join(import.meta.dir, '..')
const nfl = TEAMS.filter((team) => team.league === 'PRO')

describe('NFL logo variants', () => {
  test('every NFL team offers real vector artwork that stays editable at any size', () => {
    const cleveland = nfl.find((team) => team.id === 'PRO-CLE')!
    expect(withLogoVariant(cleveland, 'dawg-2023').logo).toEndWith('.svg')
    for (const team of nfl) {
      expect(team.alternateLogos!.some((variant) => variant.logo.endsWith('.svg'))).toBe(true)
    }
    execFileSync('python3', ['-c', `
import json, sys
from pathlib import Path
sys.path.insert(0, 'scripts')
from nfl_vector_artwork import validate_vector
manifest = json.loads(Path('public/logos/svg/nfl-alternates-manifest.json').read_text())
for item in manifest:
    if item['format'] == 'svg':
        validate_vector((Path('public') / item['path'].lstrip('/')).read_bytes())
    else:
        from PIL import Image
        image = Image.open(Path('public') / item['path'].lstrip('/')).convert('RGBA')
        assert max(image.crop(image.getbbox()).size) >= item['minRasterSize']
`], { cwd: root })
  })

  test('vector imports reject bitmap wrappers, live fonts, missing dimensions and external resources', () => {
    execFileSync('python3', ['-c', `
import sys
sys.path.insert(0, 'scripts')
from nfl_vector_artwork import import_vector, validate_vector
def svg(body, box='0 0 100 100'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{box}">{body}</svg>'.encode()
for raw in [svg('<image href="data:image/png;base64,AAAA"/>'),
            svg('<text>Font dependency</text>'), svg('<path d="M0 0h10v10z"/>', '0 0 0 0'),
            svg('<use href="https://example.com/logo.svg#mark"/>'), svg('')]:
    try: validate_vector(raw)
    except ValueError: pass
    else: raise AssertionError('invalid vector source accepted')
raw = svg('<path fill="#fff" d="M0 0h100v100H0z"/><path fill="#fff" d="M10 10h10v10z"/>')
root = validate_vector(import_vector(raw, {'removePaths': ['M0 0h100v100H0z']}))
assert len(root) == 1 and root[0].get('fill') == '#fff', 'white artwork was removed with the page'
try: import_vector(raw, {'removePaths': ['changed-source-background']})
except ValueError: pass
else: raise AssertionError('changed background accepted without review')
`], { cwd: root })
  })

  test('source refresh follows the guest SVG form and stops when the download is unavailable', () => {
    execFileSync('python3', ['-c', `
import io, sys, urllib.parse
from unittest.mock import patch
sys.path.insert(0, 'scripts')
from nfl_source_download import fetch_logowik_svg
url = 'https://logowik.com/example-logo.html'
svg = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>'
form = b'<input type="hidden" name="_token" value="normal-session-token">'
links = b'<a href="https://logowik.com/down?file=pdf"><img src="download/svg/pdf.svg"></a><a href="https://logowik.com/down?file=svg"><img src="download/svg/svg.svg"></a>'
class Opener:
    def __init__(self, pages): self.pages, self.requests = list(pages), []
    def open(self, request, timeout):
        self.requests.append(request)
        return io.BytesIO(self.pages.pop(0))
opener = Opener([form, links, svg])
with patch('urllib.request.build_opener', return_value=opener):
    assert fetch_logowik_svg(url) == svg
assert [r.full_url for r in opener.requests] == [url, url, 'https://logowik.com/down?file=svg']
assert opener.requests[1].get_method() == 'POST'
assert urllib.parse.parse_qs(opener.requests[1].data.decode()) == {'_token': ['normal-session-token']}
for pages in [[b'<p>Sign in or verification required</p>'],
              [form, b'<p>No download available</p>'],
              [form, links.replace(b'https://logowik.com/down?file=svg', b'https://example.com/other.svg')]]:
    with patch('urllib.request.build_opener', return_value=Opener(pages)):
        try: fetch_logowik_svg(url)
        except ValueError: pass
        else: raise AssertionError('unavailable or foreign download accepted')
`], { cwd: root })
  })

  test('refresh reuses verified assets, preserves the roster and rejects incomplete sources before writing', () => {
    execFileSync('python3', ['-c', `
import contextlib, io, json, shutil, sys, tempfile
from pathlib import Path
sys.path.insert(0, 'scripts')
import download_nfl_alternates as n
root = Path.cwd()
original = n.TEAMS.read_bytes()
with tempfile.TemporaryDirectory() as folder:
    n.ROOT = Path(folder)
    n.TEAMS = n.ROOT / 'teams.json'
    n.SOURCES = n.ROOT / 'sources.json'
    n.MANIFEST = n.ROOT / 'manifest.json'
    n.TEAMS.write_bytes(original)
    shutil.copy(root / 'scripts/nfl_alternate_sources.json', n.SOURCES)
    shutil.copy(root / 'public/logos/svg/nfl-alternates-manifest.json', n.MANIFEST)
    shutil.copytree(root / 'public/logos/svg/nfl/alternates', n.ROOT / 'public/logos/svg/nfl/alternates')
    n.fetch = lambda _: (_ for _ in ()).throw(AssertionError('valid cached asset was fetched'))
    with contextlib.redirect_stdout(io.StringIO()): n.refresh()
    assert n.TEAMS.read_bytes() == original, 'refresh changed unrelated data or serialization'
    before = n.MANIFEST.read_bytes()
    sources = json.loads(n.SOURCES.read_text())
    assets = {p: p.read_bytes() for p in (n.ROOT / 'public/logos/svg/nfl/alternates').iterdir()}
    bad = [dict(s) for s in sources]
    bad[0]['sourceUrl'] = 'https://example.com/bitmap-wrapper.svg'
    n.SOURCES.write_text(json.dumps(bad))
    n.fetch = lambda _: b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><image href="data:image/png;base64,AAAA"/></svg>'
    try:
        with contextlib.redirect_stdout(io.StringIO()): n.refresh()
    except ValueError: pass
    else: raise AssertionError('bitmap wrapper accepted')
    assert n.TEAMS.read_bytes() == original and n.MANIFEST.read_bytes() == before
    assert all(p.read_bytes() == raw for p, raw in assets.items()), 'failed import changed artwork'
    bad = [dict(s) for s in sources]
    next(s for s in bad if s['id'] == 'brownie')['minRasterSize'] = 4096
    n.SOURCES.write_text(json.dumps(bad))
    try:
        with contextlib.redirect_stdout(io.StringIO()): n.refresh()
    except ValueError: pass
    else: raise AssertionError('undersized raster accepted')
    assert n.TEAMS.read_bytes() == original and n.MANIFEST.read_bytes() == before
    assert all(p.read_bytes() == raw for p, raw in assets.items())
    sources = [s for s in sources if s['teamId'] != 'PRO-ARI']
    n.SOURCES.write_text(json.dumps(sources))
    try: n.refresh()
    except ValueError: pass
    else: raise AssertionError('incomplete NFL catalog accepted')
    assert n.TEAMS.read_bytes() == original
    assert n.MANIFEST.read_bytes() == before
`], { cwd: root })
  })

  test('every NFL team has distinct, locally stored alternate artwork with a recorded source', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'public/logos/svg/nfl-alternates-manifest.json'), 'utf8'))
    for (const team of nfl) {
      expect(team.alternateLogos?.length).toBeGreaterThan(0)
      const variants = logoVariants(team)
      expect(new Set(variants.map((v) => v.id)).size).toBe(variants.length)
      expect(new Set(variants.map((v) => v.logo)).size).toBe(variants.length)
      for (const variant of team.alternateLogos!) {
        expect(existsSync(join(root, 'public', variant.logo))).toBe(true)
        const asset = manifest.find((item: { teamId: string; id: string }) => item.teamId === team.id && item.id === variant.id)
        expect(asset.sourceUrl).toMatch(/^https:\/\//)
        expect(asset.path).toBe(variant.logo)
        expect(createHash('sha256').update(readFileSync(join(root, 'public', variant.logo))).digest('hex')).toBe(asset.sha256)
        expect(variant.sourcePalette).toHaveLength(3)
        expect(variant.sourcePalette!.every((color) => /^#[0-9A-F]{6}$/.test(color))).toBe(true)
      }
    }
  })

  test('shuffle cycles every artwork once and returns to the primary without changing identity', () => {
    for (const team of nfl) {
      let current: string | undefined
      const seen = new Set<string>()
      for (let i = 0; i < logoVariants(team).length; i++) {
        const resolved = withLogoVariant(team, current)
        seen.add(resolved.logo)
        expect(resolved.id).toBe(team.id)
        expect(fullName(resolved)).toBe(fullName(team))
        expect(resolved.palette).toEqual(team.palette)
        expect(isCorrectGuess(team.name, resolved)).toBe(true)
        current = nextLogoVariant(team, current)
      }
      expect(current).toBeUndefined()
      expect(seen.size).toBe(logoVariants(team).length)
    }
    const college = TEAMS.find((team) => team.league === 'COL')!
    expect(nextLogoVariant(college)).toBeUndefined()
  })

  test('saving and reloading rounds retains the exact alternate and normalizes against its artwork colors', () => {
    const donor = TEAMS.find((team) => team.id === 'PRO-BUF')!
    for (const team of nfl) {
      for (const variant of team.alternateLogos!) {
        const round = { o: team.id, c: donor.id, v: -999, l: variant.id, g: 'both' as const, h: true }
        const normalized = normalizeRound(round)
        expect(normalized.l).toBe(variant.id)
        expect(normalized.v).toBe(contrastSafePermutation(withLogoVariant(team, variant.id), donor.palette, round.v))
        expect(deckFromStorage(JSON.stringify([normalized]))).toEqual([normalized])
        expect(round.v).toBe(-999)
      }
    }
  })

  test('old decks and missing alternates fall back to primary without losing the other round settings', () => {
    const team = nfl[0]
    const old = { o: team.id, c: 'PRO-BUF', v: 0, g: 'colors' as const, h: false }
    expect(deckFromStorage(JSON.stringify([old]))).toEqual([normalizeRound(old)])
    const stale = { ...old, l: 'removed-or-foreign-artwork' }
    expect(deckFromStorage(JSON.stringify([stale]))).toEqual([normalizeRound(old)])
    expect(withLogoVariant(team, stale.l)).toBe(team)
    const primary = { ...old, l: 'primary' }
    expect(normalizeRound(primary)).toEqual(normalizeRound(old))
  })
})
