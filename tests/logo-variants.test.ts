import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { TEAMS, contrastSafePermutation, deckFromStorage, fullName, isCorrectGuess, logoVariants, nextLogoVariant, normalizeRound, withLogoVariant } from '../src/lib/teams'

const root = join(import.meta.dir, '..')
const nfl = TEAMS.filter((team) => team.league === 'PRO')

describe('NFL logo variants', () => {
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
