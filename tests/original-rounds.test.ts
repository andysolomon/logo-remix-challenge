import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  deckFromStorage,
  findTeam,
  isAllowedRound,
  normalizeDeck,
  normalizeRound,
  replaceRound,
  roundColors,
  roundHints,
  roundTarget,
  type Round,
} from '../src/lib/teams'

const root = join(import.meta.dir, '..')
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')

describe('a logo can go in the deck without a remix', () => {
  test('a round with no color team keeps its logo in its original colors, from any collection', () => {
    for (const o of ['SOCCER-ROM', 'FOOD-MCD', 'PRO-KC', 'MLB-NYY']) {
      const round: Round = { o, v: 0 }
      expect(isAllowedRound(round)).toBe(true)
      expect(normalizeRound(round)).toEqual({ o, v: 0 })
      expect(roundColors(round)).toBe(findTeam(o)!)
    }
  })

  test('an original-colors round always asks for the logo, with a logo hint only', () => {
    const round = normalizeRound({ o: 'SOCCER-ROM', v: 5, g: 'colors', h: true })
    expect(round).toEqual({ o: 'SOCCER-ROM', v: 0, h: true })
    for (const fallback of ['team', 'colors', 'both'] as const) expect(roundTarget(round, fallback)).toBe('team')
    expect(roundHints(round)).toEqual(['Logo: Serie A'])
    // Remixes are untouched.
    expect(roundTarget({ o: 'SOCCER-ROM', c: 'PRO-KC', v: 0 }, 'colors')).toBe('colors')
    expect(roundHints({ o: 'SOCCER-ROM', c: 'PRO-KC', v: 0 })).toEqual(['Logo: Serie A', 'Colors: NFL'])
  })

  test('an original-colors round keeps a valid alternate logo', () => {
    expect(normalizeRound({ o: 'PRO-KC', v: 0, l: 'alternate' })).toEqual({ o: 'PRO-KC', v: 0, l: 'alternate' })
    expect(normalizeRound({ o: 'PRO-KC', v: 0, l: 'missing' })).toEqual({ o: 'PRO-KC', v: 0 })
  })

  test('saved decks mixing remixes and original-colors rounds load intact', () => {
    const deck = normalizeDeck([
      { o: 'SOCCER-ROM', v: 0, h: true },
      { o: 'FOOD-MCD', c: 'PRO-KC', v: 0, g: 'colors' },
      { o: 'FOOD-MCD', v: 0, l: 'red-square' },
    ])
    expect(deck).toHaveLength(3)
    expect(deck[0]).toEqual({ o: 'SOCCER-ROM', v: 0, h: true })
    expect(deck[1]).toMatchObject({ o: 'FOOD-MCD', c: 'PRO-KC', g: 'colors' })
    expect(deck[2]).toEqual({ o: 'FOOD-MCD', v: 0, l: 'red-square' })
    expect(deckFromStorage(JSON.stringify(deck))).toEqual(deck)
    // An unknown color team still marks the save as corrupt (falling back to the starter deck); only a missing one means original colors.
    expect(deckFromStorage(JSON.stringify([{ o: 'SOCCER-ROM', c: 'NOPE', v: 0 }]))).toEqual(deckFromStorage(null))
  })

  test('editing a remix into an original drops the old colors but keeps the round settings', () => {
    const remix = normalizeRound({ o: 'FOOD-MCD', c: 'PRO-KC', v: 0, g: 'team', h: true })
    expect(replaceRound(remix, { o: 'SOCCER-ROM', v: 0, l: undefined })).toEqual({ o: 'SOCCER-ROM', v: 0, h: true })
    const original: Round = { o: 'SOCCER-ROM', v: 0, h: false }
    expect(replaceRound(original, { o: 'SOCCER-ROM', c: 'PRO-KC', v: 0 })).toMatchObject({ o: 'SOCCER-ROM', c: 'PRO-KC', h: false })
  })

  test('Create enables Add with only a logo picked and labels it as the original', () => {
    const create = read('src/components/CreateMode.tsx')
    expect(create).toContain("!original ? 'disabled'")
    expect(create).toContain('{ o: original.id, v: 0, l: state.logoVariant }')
    expect(create).toContain('Skip · keep the original colors →')
    const remix = read('src/components/RemixCanvas.tsx')
    expect(remix).toContain("'+ ADD ORIGINAL'")
    expect(remix).toContain("'Original colors · or pick a source →'")
  })
})
