import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  TEAMS,
  backdropSlot,
  contrastSafePermutations,
  exactContrastSafePermutations,
  findTeam,
  frameSlot,
  isColorDonor,
  logoVariants,
  nextContrastSafePermutation,
  normalizeRound,
  remixLayout,
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
/** `hex` is `base` or `base` darkened with its hue kept: every channel scaled by the same whole-channel factor. */
const sameHueDarker = (hex: string, base: string) => {
  if (hex === base) return true
  const channels = [1, 3, 5].map((i) => parseInt(base.slice(i, i + 2), 16))
  for (let factor = 0; factor < 255; factor++) {
    const scaled = '#' + channels.map((c) => Math.round((c * factor) / 255).toString(16).padStart(2, '0')).join('').toUpperCase()
    if (scaled === hex) return true
  }
  return false
}

const artwork = TEAMS.flatMap((team) =>
  logoVariants(team).map((variant) => withLogoVariant(team, variant.id === 'primary' ? undefined : variant.id)),
)
const tiled = artwork.filter((art) => backdropSlot(art) !== undefined)
const oneColor = tiled.filter((art) => frameSlot(art) !== undefined)
const twoColor = tiled.filter((art) => frameSlot(art) === undefined)
const donors = TEAMS.filter(isColorDonor)
const logoSlot = (art: Team) => remixLayout(art).artwork[0]

describe('every remix shows all three of the color team’s colors', () => {
  test('artwork gets a tile exactly when it leaves a palette slot out, and a frame when it paints only one', () => {
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
            # A gradient stop without a stop-color paints the SVG default, black (as the brand refresh records).
            colors += ['#000000'] * len(re.findall(r'<stop\\b(?![^>]*stop-color)[^>]*>', text))
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

    const framed: string[] = []
    const plainTile: string[] = []
    for (const team of TEAMS) {
      for (const variant of logoVariants(team)) {
        const key = `${team.id}/${variant.id}`
        const { used, unused } = coverage[key]
        const art = withLogoVariant(team, variant.id === 'primary' ? undefined : variant.id)
        expect([key, used.length]).not.toEqual([key, 0])
        expect([key, backdropSlot(art) !== undefined]).toEqual([key, used.length < 3])
        expect([key, frameSlot(art) !== undefined]).toEqual([key, used.length === 1])
        // Recorded coverage must match the artwork, so the rule cannot silently drift from it.
        if (unused?.length) expect([key, unused]).toEqual([key, [0, 1, 2].filter((slot) => !used.includes(slot))])
        // The artwork, tile and frame between them cover all three slots exactly once.
        const { artwork: painted, backdrop, frame } = remixLayout(art)
        expect([key, painted]).toEqual([key, used])
        expect([key, [...painted, ...(backdrop === undefined ? [] : [backdrop]), ...(frame === undefined ? [] : [frame])].sort()]).toEqual([key, [0, 1, 2]])
        if (used.length === 1) framed.push(key)
        else if (used.length === 2) plainTile.push(key)
      }
    }
    expect(framed.length).toBe(oneColor.length)
    expect(plainTile.length).toBe(twoColor.length)
    for (const key of ['MLB-NYY/primary', 'FOOD-MCD/primary', 'COL-ALA/primary', 'COL-IVY/primary', 'PRO-KC/alternate', 'BRAND-APPLE/primary', 'BRAND-MJ/primary']) {
      expect(framed).toContain(key)
    }
    expect(plainTile).toContain('PRO-CLE/alternate')
    expect(plainTile).toContain('BRAND-APPLE/rainbow-apple')
    // Vanderbilt's black and gold, and the Chiefs' red and white, live in embedded bitmaps: two colors, so a tile.
    expect(plainTile).toContain('COL-VAN/primary')
    expect(plainTile).toContain('PRO-KC/primary')
  }, 60000)

  test('the tile and frame take the unused slots and the artwork keeps its own', () => {
    expect(remixLayout(findTeam('MLB-NYY')!)).toEqual({ artwork: [0], backdrop: 1, frame: 2 })
    expect(remixLayout(findTeam('COL-WVU')!)).toEqual({ artwork: [1], backdrop: 0, frame: 2 })
    expect(remixLayout(findTeam('BRAND-MJ')!)).toEqual({ artwork: [0], backdrop: 1, frame: 2 })
    expect(remixLayout(findTeam('PRO-BAL')!)).toEqual({ artwork: [0, 1, 2] })
    expect(remixLayout(findTeam('NBA-ATL')!)).toEqual({ artwork: [0, 2], backdrop: 1 })
    expect(remixLayout(findTeam('NBA-BOS')!)).toEqual({ artwork: [0, 1, 2] })
    expect(backdropSlot(findTeam('PRO-BAL')!)).toBeUndefined()
    expect(frameSlot(findTeam('PRO-BAL')!)).toBeUndefined()

    // The Chiefs arrowhead is a bitmap of red and white: a gold tile. Their wordmark alternate: tile and frame.
    const kc = findTeam('PRO-KC')!
    expect(remixLayout(kc)).toEqual({ artwork: [0, 2], backdrop: 1 })
    expect(frameSlot(kc)).toBeUndefined()
    expect(backdropSlot(withLogoVariant(kc, 'alternate'))).toBe(1)
    expect(frameSlot(withLogoVariant(kc, 'alternate'))).toBe(2)

    // Two-color artwork: a tile in the one slot it leaves out, no frame.
    const dawg = withLogoVariant(findTeam('PRO-CLE')!, 'alternate')
    expect(remixLayout(dawg)).toEqual({ artwork: [0, 1], backdrop: 2 })
    const rainbow = withLogoVariant(findTeam('BRAND-APPLE')!, 'rainbow-apple')
    expect(remixLayout(rainbow)).toEqual({ artwork: [0, 1], backdrop: 2 })

    // Malformed data is tolerated: duplicates and out-of-range slots are ignored.
    const odd = { ...kc, unusedSourceSlots: [2, 2, 7] }
    expect(remixLayout(odd)).toEqual({ artwork: [0, 1], backdrop: 2 })
  })

  test('one-color logos show all three colors: logo on tile, tile inside frame, frame on the canvas', () => {
    expect(oneColor.length).toBeGreaterThan(40)
    expect(donors.length).toBeGreaterThan(100)
    let pairs = 0
    let fallbacks = 0
    for (const art of oneColor) {
      const { backdrop, frame } = remixLayout(art) as { backdrop: number; frame: number }
      const logo = logoSlot(art)
      for (const donor of donors) {
        pairs += 1
        const exact = exactContrastSafePermutations(art, donor.palette).length > 0
        if (!exact) fallbacks += 1
        for (const permutation of contrastSafePermutations(art, donor.palette)) {
          const colors = resolveRemixTargetColors(art, donor.palette, permutation)
          // The logo and its tile are always exact team colors. So is the frame, unless no assignment
          // reads on the canvas: then it is a team color darkened with its hue kept, and it still reads.
          expect(donor.palette).toContain(colors[logo])
          expect(donor.palette).toContain(colors[backdrop])
          expect(donor.palette.some((base) => sameHueDarker(colors[frame], base))).toBe(true)
          expect(contrast(colors[frame], '#FFFFFF')).toBeGreaterThanOrEqual(1.5)
          // Three team colors land in three distinct places.
          expect(new Set(colors).size).toBe(new Set(donor.palette).size)
          if (exact) {
            expect(donor.palette).toContain(colors[frame])
            expect(contrast(colors[logo], colors[backdrop])).toBeGreaterThanOrEqual(1.5)
            expect(contrast(colors[backdrop], colors[frame])).toBeGreaterThanOrEqual(1.5)
          }
        }
      }
    }
    // A palette with two near-identical colors (Grambling's two golds, a navy next to black) cannot
    // separate all three edges; such fallbacks stay rare and keep the logo readable on its tile.
    expect(fallbacks / pairs).toBeLessThan(0.1)
    const grambling = findTeam('COL-GRAM')!
    const yankees = findTeam('MLB-NYY')!
    expect(exactContrastSafePermutations(yankees, grambling.palette)).toEqual([])
    const [fallback] = contrastSafePermutations(yankees, grambling.palette)
    const colors = resolveRemixTargetColors(yankees, grambling.palette, fallback)
    expect(contrast(colors[0], colors[1])).toBeGreaterThanOrEqual(1.5)
  }, 90000)

  test('two-color logos show the third color on a tile that reads under both artwork colors and on the canvas', () => {
    expect(twoColor.length).toBeGreaterThan(40)
    let pairs = 0
    let fallbacks = 0
    for (const art of twoColor) {
      const { artwork: painted, backdrop } = remixLayout(art) as { artwork: number[]; backdrop: number }
      for (const donor of donors) {
        pairs += 1
        const exact = exactContrastSafePermutations(art, donor.palette).length > 0
        if (!exact) fallbacks += 1
        for (const permutation of contrastSafePermutations(art, donor.palette)) {
          const colors = resolveRemixTargetColors(art, donor.palette, permutation)
          for (const slot of painted) {
            expect(donor.palette).toContain(colors[slot])
            if (exact) expect(contrast(colors[slot], colors[backdrop])).toBeGreaterThanOrEqual(1.5)
          }
          expect(donor.palette.some((base) => sameHueDarker(colors[backdrop], base))).toBe(true)
          expect(contrast(colors[backdrop], '#FFFFFF')).toBeGreaterThanOrEqual(1.5)
          expect(new Set(colors).size).toBe(new Set(donor.palette).size)
        }
      }
    }
    // Palettes whose two accent colors sit at the same luminance (a mid blue beside a red) put one of
    // them against the tile whatever the assignment; those fallbacks are a minority.
    expect(fallbacks / pairs).toBeLessThan(0.35)
  }, 90000)

  test('Shuffle Colors cycles which team color is the logo, the tile and the frame', () => {
    const yankees = findTeam('MLB-NYY')!
    const steelers = findTeam('PRO-PIT')!.palette
    const looks = new Set<string>()
    let permutation = 0
    for (let i = 0; i < contrastSafePermutations(yankees, steelers).length; i++) {
      permutation = nextContrastSafePermutation(yankees, steelers, permutation)
      const colors = resolveRemixTargetColors(yankees, steelers, permutation)
      looks.add(`${colors[0]} on ${colors[1]} in ${colors[2]}`)
    }
    // Gold on white would be the only unreadable logo/tile pair, and a white frame would vanish on the canvas.
    expect([...looks].sort()).toEqual([
      '#000000 on #FFFFFF in #FFB612',
      '#FFB612 on #FFFFFF in #000000',
      '#FFFFFF on #000000 in #FFB612',
      '#FFFFFF on #FFB612 in #000000',
    ])
  })

  test('saved rounds normalize to a tile-safe assignment', () => {
    const round = normalizeRound({ o: 'MLB-LAD', c: 'COL-TEX', v: 99 })
    const colors = resolveRemixTargetColors(findTeam('MLB-LAD')!, findTeam('COL-TEX')!.palette, round.v)
    expect(contrastSafePermutations(findTeam('MLB-LAD')!, findTeam('COL-TEX')!.palette)).toContain(round.v)
    const { frame } = remixLayout(findTeam('MLB-LAD')!)
    expect(frame).toBeDefined()
    expect(colors[frame!]).not.toBe('#FFFFFF')
  })

  test('with no readable mapping only the frame darkens; the logo and tile keep their exact colors', () => {
    const yankees = findTeam('MLB-NYY')!
    const white = ['#FFFFFF', '#FFFFFF', '#FFFFFF'] as const
    expect(contrastSafePermutations(yankees, white)).toHaveLength(1)
    const colors = resolveRemixTargetColors(yankees, white, 0)
    expect(colors[0]).toBe('#FFFFFF')
    expect(colors[1]).toBe('#FFFFFF')
    expect(contrast(colors[2], '#FFFFFF')).toBeGreaterThanOrEqual(1.5)

    // Two-color artwork darkens only its tile.
    const dawg = withLogoVariant(findTeam('PRO-CLE')!, 'alternate')
    const dawgColors = resolveRemixTargetColors(dawg, white, 0)
    expect(dawgColors[0]).toBe('#FFFFFF')
    expect(dawgColors[1]).toBe('#FFFFFF')
    expect(contrast(dawgColors[2], '#FFFFFF')).toBeGreaterThanOrEqual(1.5)
  })

  test('Logo renders the tile and frame only on remixes, once the recolored artwork is ready', () => {
    const logo = readFileSync(join(root, 'src/components/Logo.tsx'), 'utf8')
    expect(logo).toContain("const showBackdrop = backdrop !== undefined && remixStatus === 'ready'")
    expect(logo).toContain('const backdrop = target && layout.backdrop !== undefined ? target[layout.backdrop] : undefined')
    expect(logo).toContain('const frame = target && layout.frame !== undefined ? target[layout.frame] : undefined')
    expect(logo).toContain('backgroundImage: framedTileImage(backdrop, frame)')
    expect(logo).toContain("frame !== undefined ? 'logo backdrop framed' : 'logo backdrop'")
    const css = readFileSync(join(root, 'src/styles.css'), 'utf8')
    expect(css).toContain('.logo.backdrop {')
    expect(css).toContain('.logo.backdrop.framed {')
    expect(css).toMatch(/\.logo\.backdrop \{[^\n]*background-size: 100% 100%;/)
  })
})
