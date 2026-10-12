import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TEAMS, canShuffleRoundColors, contrastSafePermutations, findTeam, logoVariants, normalizeRound, shuffleRoundColors, shuffleRoundLogo, withLogoVariant, type Round } from '../src/lib/teams'

const withAlternates = TEAMS.find((t) => t.league === 'PRO' && (t.alternateLogos?.length ?? 0) > 0)!
const withoutAlternates = TEAMS.find((t) => !t.alternateLogos?.length)!
const donors = TEAMS.filter((t) => t.league === 'PRO' && t.id !== withAlternates.id)
// A color team that leaves the logo more than one readable arrangement.
const multi = donors.find((c) => contrastSafePermutations(withAlternates, c.palette).length > 1)!

describe('deck card shuffles', () => {
  test('Shuffle Logo walks every alternate and wraps back to the primary, keeping guess and hint', () => {
    const start: Round = normalizeRound({ o: withAlternates.id, c: multi.id, v: 0, g: 'colors', h: true })
    const seen: (string | undefined)[] = [start.l]
    let r = start
    for (let i = 1; i < logoVariants(withAlternates).length; i++) {
      r = shuffleRoundLogo(r)
      seen.push(r.l)
      expect(r).toMatchObject({ o: start.o, c: start.c, g: 'colors', h: true })
      expect(contrastSafePermutations(withLogoVariant(withAlternates, r.l), multi.palette)).toContain(r.v)
    }
    expect(new Set(seen).size).toBe(logoVariants(withAlternates).length)
    expect(shuffleRoundLogo(r).l).toBeUndefined()
  })

  test('Shuffle Logo leaves a logo with no alternates alone', () => {
    const r: Round = { o: withoutAlternates.id, v: 0 }
    expect(shuffleRoundLogo(r)).toEqual(r)
  })

  test('Shuffle Colors cycles through the contrast-safe arrangements only', () => {
    const safe = contrastSafePermutations(withAlternates, multi.palette)
    let r: Round = normalizeRound({ o: withAlternates.id, c: multi.id, v: safe[0], h: true })
    expect(canShuffleRoundColors(r)).toBe(true)
    const seen = [r.v]
    for (let i = 1; i < safe.length; i++) {
      r = shuffleRoundColors(r)
      expect(r).toMatchObject({ o: withAlternates.id, c: multi.id, h: true })
      seen.push(r.v)
    }
    expect([...seen].sort()).toEqual([...safe].sort())
    expect(shuffleRoundColors(r).v).toBe(safe[0])
  })

  test('original-colors rounds have nothing to shuffle colors with', () => {
    const r: Round = { o: withAlternates.id, v: 0 }
    expect(canShuffleRoundColors(r)).toBe(false)
    expect(shuffleRoundColors(r)).toEqual(r)
  })

  test('every deck card offers labeled Logo and Colors shuffles', () => {
    const deck = readFileSync(join(import.meta.dir, '..', 'src/components/DeckMode.tsx'), 'utf8')
    expect(deck).toContain('shuffleRoundLogo(d[i])')
    expect(deck).toContain('shuffleRoundColors(d[i])')
    expect(deck).toContain('aria-label={`Shuffle round ${i + 1} logo`}')
    expect(deck).toContain('aria-label={`Shuffle round ${i + 1} colors`}')
    expect(findTeam(multi.id)).toBeDefined()
  })
})
