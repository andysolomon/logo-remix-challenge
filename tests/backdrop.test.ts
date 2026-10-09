import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  TEAMS,
  backdropSlot,
  contrastSafePermutations,
  findTeam,
  logoVariants,
  nextContrastSafePermutation,
  normalizeRound,
  resolveRemixTargetColors,
  withLogoVariant,
  type Team,
} from '../src/lib/teams'

const root = join(import.meta.dir, '..')

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const artwork = TEAMS.flatMap((team) =>
  logoVariants(team).map((variant) => withLogoVariant(team, variant.id === 'primary' ? undefined : variant.id)),
)
const oneColor = artwork.filter((art) => backdropSlot(art) !== undefined)
const logoSlot = (art: Team) => [0, 1, 2].find((slot) => !art.unusedSourceSlots!.includes(slot))!

describe('one-color logos remix onto a backdrop', () => {
  test('a logo gets a backdrop exactly when its artwork shows a single palette color', () => {
    // Colors as Logo.tsx recolors them: resolved SVG fills (fill-less shapes render black), gradient
    // stops and embedded bitmaps, or a PNG's opaque pixels.
    const report = execFileSync('python3', ['-c', `
import base64, io, json, re, sys
from pathlib import Path
from PIL import Image
sys.path.insert(0, 'scripts')
from download_extra_logos import inspect_artwork
from download_hbcu_svgs import to_hex
from download_nba_svgs import artwork_colors
from build_teams import dist_sq
teams = json.loads(Path('src/lib/teams.json').read_text())['teams']
out = {}
for team in teams:
    variants = [('primary', team['logo'], team.get('sourcePalette', team['palette']), team.get('unusedSourceSlots'))]
    for v in team.get('alternateLogos', []):
        variants.append((v['id'], v['logo'], v.get('sourcePalette', team['palette']), v.get('unusedSourceSlots')))
    for vid, logo, source, unused in variants:
        data = (Path('public') / logo.lstrip('/')).read_bytes()
        if logo.endswith('.svg'):
            text = data.decode('utf-8', 'replace')
            colors = artwork_colors(data)
            colors += [c for c in map(to_hex, re.findall(r'stop-color\\s*[:=]\\s*["\\']?\\s*(#[0-9a-fA-F]{3,8}|rgba?\\([^)]*\\)|[a-zA-Z]+)', text)) if c]
            for raster in re.findall(r'data:image/[a-z]+;base64,([A-Za-z0-9+/=\\s]+)', text):
                image = Image.open(io.BytesIO(base64.b64decode(raster))).convert('RGBA')
                counts = {}
                for r, g, b, a in image.get_flattened_data():
                    if a >= 240:
                        counts['#%02X%02X%02X' % (r, g, b)] = counts.get('#%02X%02X%02X' % (r, g, b), 0) + 1
                colors += sorted(counts, key=counts.get, reverse=True)[:100]
        else:
            colors = inspect_artwork(data, 'png')
        used = [slot for slot, color in enumerate(source) if any(dist_sq(color, c) <= 90 * 90 for c in colors)]
        out[team['id'] + '/' + vid] = {'used': used, 'unused': unused}
print(json.dumps(out))
`], { cwd: root, maxBuffer: 16 * 1024 * 1024 }).toString()
    const coverage = JSON.parse(report) as Record<string, { used: number[]; unused: number[] | null }>

    const flagged: string[] = []
    for (const team of TEAMS) {
      for (const variant of logoVariants(team)) {
        const key = `${team.id}/${variant.id}`
        const { used, unused } = coverage[key]
        const art = withLogoVariant(team, variant.id === 'primary' ? undefined : variant.id)
        expect([key, used.length]).not.toEqual([key, 0])
        expect([key, backdropSlot(art) !== undefined]).toEqual([key, used.length === 1])
        // Recorded coverage must match the artwork, so the rule cannot silently drift from it.
        if (unused?.length) expect([key, unused]).toEqual([key, [0, 1, 2].filter((slot) => !used.includes(slot))])
        if (used.length === 1) flagged.push(key)
      }
    }
    expect(flagged.length).toBe(oneColor.length)
    for (const key of ['MLB-NYY/primary', 'FOOD-MCD/primary', 'COL-ALA/primary', 'COL-IVY/primary', 'PRO-KC/alternate']) {
      expect(flagged).toContain(key)
    }
    // Vanderbilt's black and gold live in an embedded bitmap; it shows two colors already.
    expect(flagged).not.toContain('COL-VAN/primary')
  }, 60000)

  test('the backdrop takes an unused slot and the artwork keeps its only one', () => {
    expect(backdropSlot(findTeam('MLB-NYY')!)).toBe(1)
    expect(backdropSlot(findTeam('COL-WVU')!)).toBe(0)
    expect(backdropSlot(findTeam('PRO-BAL')!)).toBeUndefined()
    expect(backdropSlot(findTeam('NBA-ATL')!)).toBeUndefined()

    const kc = findTeam('PRO-KC')!
    expect(backdropSlot(kc)).toBeUndefined()
    expect(backdropSlot(withLogoVariant(kc, 'alternate'))).toBe(1)
  })

  test('every color assignment keeps the logo readable on a backdrop that reads on the canvas', () => {
    expect(oneColor.length).toBeGreaterThan(40)
    for (const art of oneColor) {
      const backdrop = backdropSlot(art)!
      for (const donor of TEAMS) {
        for (const permutation of contrastSafePermutations(art, donor.palette)) {
          const colors = resolveRemixTargetColors(art, donor.palette, permutation)
          // Exact team colors: the backdrop is one of the donor's own palette colors.
          expect(donor.palette).toContain(colors[backdrop])
          expect(contrast(colors[logoSlot(art)], colors[backdrop])).toBeGreaterThanOrEqual(1.5)
          expect(contrast(colors[backdrop], '#FFFFFF')).toBeGreaterThanOrEqual(1.5)
        }
      }
    }
  })

  test('Shuffle Colors cycles which team color is the logo and which is the backdrop', () => {
    const yankees = findTeam('MLB-NYY')!
    const steelers = findTeam('PRO-PIT')!.palette
    const looks = new Set<string>()
    let permutation = 0
    for (let i = 0; i < contrastSafePermutations(yankees, steelers).length; i++) {
      permutation = nextContrastSafePermutation(yankees, steelers, permutation)
      const colors = resolveRemixTargetColors(yankees, steelers, permutation)
      looks.add(`${colors[0]} on ${colors[1]}`)
    }
    expect([...looks].sort()).toEqual(['#000000 on #FFB612', '#FFB612 on #000000', '#FFFFFF on #000000', '#FFFFFF on #FFB612'])
  })

  test('saved rounds normalize to a backdrop-safe assignment', () => {
    const round = normalizeRound({ o: 'MLB-LAD', c: 'COL-TEX', v: 99 })
    const colors = resolveRemixTargetColors(findTeam('MLB-LAD')!, findTeam('COL-TEX')!.palette, round.v)
    expect(contrastSafePermutations(findTeam('MLB-LAD')!, findTeam('COL-TEX')!.palette)).toContain(round.v)
    expect(colors[1]).not.toBe('#FFFFFF')
  })

  test('with no readable mapping only the backdrop darkens; the logo keeps its exact color', () => {
    const yankees = findTeam('MLB-NYY')!
    const white = ['#FFFFFF', '#FFFFFF', '#FFFFFF'] as const
    expect(contrastSafePermutations(yankees, white)).toHaveLength(1)
    const colors = resolveRemixTargetColors(yankees, white, 0)
    expect(colors[0]).toBe('#FFFFFF')
    expect(colors[2]).toBe('#FFFFFF')
    expect(contrast(colors[1], '#FFFFFF')).toBeGreaterThanOrEqual(1.5)
  })

  test('Logo renders the backdrop only on remixes, once the recolored artwork is ready', () => {
    const logo = readFileSync(join(root, 'src/components/Logo.tsx'), 'utf8')
    expect(logo).toContain("const showBackdrop = backdrop !== undefined && remixStatus === 'ready'")
    expect(logo).toContain('const backdrop = target && slot !== undefined ? target[slot] : undefined')
    const css = readFileSync(join(root, 'src/styles.css'), 'utf8')
    expect(css).toContain('.logo.backdrop {')
  })
})
