import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TEAMS, canvasFacingColors, findTeam, logoVariants, resolveRemixTargetColors, sinksIntoDark, withLogoVariant } from '../src/lib/teams'

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
const DARK_TILE = '#1C1915'

describe('dark artwork sits on a light plate wherever the screen is dark', () => {
  test('a raw logo sinks when none of its painted colors reads on the dark tile', () => {
    // A black serif wordmark on nothing: invisible on the dark theme without a plate.
    const vca = findTeam('LUX-VCA')!
    expect(canvasFacingColors(vca)).toEqual(['#231815'])
    expect(sinksIntoDark(vca)).toBe(true)
    // Red and white arrowhead (its gold slot is unused): reads on its own.
    const chiefs = findTeam('PRO-KC')!
    expect(canvasFacingColors(chiefs)).toEqual(['#E31837', '#FFFFFF'])
    expect(sinksIntoDark(chiefs)).toBe(false)
    // Only painted slots count: unused slots never rescue the artwork.
    for (const team of TEAMS) {
      for (const variant of logoVariants(team)) {
        const art = withLogoVariant(team, variant.id === 'primary' ? undefined : variant.id)
        const colors = canvasFacingColors(art)
        expect(colors.length).toBeGreaterThan(0)
        expect(sinksIntoDark(art)).toBe(colors.every((c) => contrast(c, DARK_TILE) < 1.5))
      }
    }
    expect(TEAMS.filter((t) => sinksIntoDark(t)).length).toBeGreaterThan(20)
  })

  test('a remix is judged by whatever meets the canvas: its frame, its backdrop or its artwork colors', () => {
    const navy = ['#002244', '#0B1F3A', '#FFFFFF'] as const
    const bright = ['#D50A0A', '#FFB612', '#FFFFFF'] as const
    const wordmark = withLogoVariant(findTeam('PRO-KC')!, 'alternate') // one color: tile and frame
    const logo = findTeam('PRO-BUF')! // three colors: no tile
    for (const art of [wordmark, logo]) {
      for (const palette of [navy, bright]) {
        const target = resolveRemixTargetColors(art, palette, 0)
        const facing = canvasFacingColors(art, target)
        expect(sinksIntoDark(art, target)).toBe(facing.every((c) => contrast(c, DARK_TILE) < 1.5))
      }
    }
    // The frame alone decides for one-color artwork, the painted artwork slots for full-color artwork.
    expect(canvasFacingColors(wordmark, ['#111111', '#222222', '#333333'])).toEqual(['#333333'])
    expect(canvasFacingColors(logo, ['#111111', '#222222', '#333333'])).toEqual(['#111111', '#222222', '#333333'])
    expect(sinksIntoDark(logo, ['#111111', '#222222', '#333333'])).toBe(true)
    expect(sinksIntoDark(logo, ['#111111', '#222222', '#FFFFFF'])).toBe(false)
  })

  test('Logo.tsx adds the plate class once the artwork shows, and styles.css paints it only on dark screens', () => {
    const logo = readFileSync(join(root, 'src/components/Logo.tsx'), 'utf8')
    expect(logo).toContain("const showPlate = sinksIntoDark(team, target ?? undefined) && (!hasTargetPalette || remixStatus === 'ready')")
    expect(logo).toContain("(showPlate ? ' dark-ink' : '')")
    const css = readFileSync(join(root, 'src/styles.css'), 'utf8')
    expect(css).toMatch(/:root\[data-theme="dark"\] \.logo\.dark-ink:not\(\.backdrop\), \.play \.logo\.dark-ink:not\(\.backdrop\) \{[^\n]*background-color: #F7F5F1;/)
    expect(css).toMatch(/:root\[data-theme="dark"\] \.logo\.backdrop\.dark-ink, \.play \.logo\.backdrop\.dark-ink \{[^\n]*box-shadow/)
    // Never on the light theme, where the artwork already reads.
    expect(css).not.toMatch(/\n\.logo\.dark-ink/)
  })
})
