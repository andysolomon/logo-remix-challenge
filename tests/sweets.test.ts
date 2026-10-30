import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  ALL_POOL_IDS, COLOR_POOLS, LEAGUES, TEAMS, colorPoolTeams, deckFromStorage, entryNoun, filterTeams, findTeam, fullName,
  isCorrectGuess, logoPoolTeams, normalizeRound, poolTeams, randomDeck, roundHints, suggestTeams, teamHint, withLogoVariant,
} from '../src/lib/teams'

const root = join(import.meta.dir, '..')
const sweets = filterTeams('SWEET', 'All', '')
const KINDS = ['Chocolate', 'Gummy & Chewy', 'Hard Candy', 'Gum & Mints', 'Cookies & Cakes', 'Ice Cream']
/** Entries that lead with a name-free mark; every other sweets brand publishes only a wordmark. */
const SYMBOLS = ['SWEET-CHUPA', 'SWEET-GODIVA', 'SWEET-GOODHUMOR', 'SWEET-HERSHEY', 'SWEET-KLONDIKE', 'SWEET-LINDT', 'SWEET-TOBLERONE']
/** Hershey's, M&M's and Oreo opened in BRANDS. */
const MOVED = ['HERSHEY', 'MMS', 'OREO']

describe('the SWEETS collection', () => {
  test('52 candy and sweets brands are grouped by kind of treat', () => {
    expect(LEAGUES.SWEET).toEqual({ label: 'SWEETS', conferences: KINDS })
    expect(sweets).toHaveLength(52)
    expect(KINDS.map((k) => filterTeams('SWEET', k, '').length)).toEqual([15, 7, 6, 9, 9, 6])
    expect(new Set(sweets.map(fullName)).size).toBe(52)
    expect(findTeam('SWEET-REESES')!.conference).toBe('Chocolate')
    expect(findTeam('SWEET-HARIBO')!.conference).toBe('Gummy & Chewy')
    expect(findTeam('SWEET-CHUPA')!.conference).toBe('Hard Candy')
    expect(findTeam('SWEET-TICTAC')!.conference).toBe('Gum & Mints')
    expect(findTeam('SWEET-OREO')!.conference).toBe('Cookies & Cakes')
    expect(findTeam('SWEET-KLONDIKE')!.conference).toBe('Ice Cream')
    expect(entryNoun('SWEET')).toBe('brand')
    for (const team of sweets) {
      expect(team.logo).toBe(`/logos/svg/sweets/${team.abbr.toLowerCase()}.svg`)
      expect(existsSync(join(root, 'public', team.logo))).toBe(true)
    }
  })

  test("Hershey's, M&M's and Oreo moved out of BRANDS with their artwork, and saved rounds follow them", () => {
    for (const abbr of MOVED) {
      expect(findTeam(`BRAND-${abbr}`)).toBeUndefined()
      expect(findTeam(`SWEET-${abbr}`)!.league).toBe('SWEET')
    }
    expect(filterTeams('BRAND', 'All', '')).toHaveLength(135)
    expect(findTeam('SWEET-HERSHEY')!.logo).toBe('/logos/svg/sweets/hershey.svg')
    const kept = { o: 'PRO-BUF', c: 'NBA-LAL', v: 0, g: 'both' as const }
    const saved = JSON.stringify([
      { o: 'BRAND-HERSHEY', c: 'PRO-KC', v: 2, g: 'team' },
      { o: 'BRAND-OREO', v: 0 },
      { o: 'BRAND-MMS', c: 'COL-ALA', v: 1 },
      kept,
    ])
    expect(deckFromStorage(saved)).toEqual([
      normalizeRound({ o: 'SWEET-HERSHEY', c: 'PRO-KC', v: 2, g: 'team' }),
      normalizeRound({ o: 'SWEET-OREO', v: 0 }),
      normalizeRound({ o: 'SWEET-MMS', c: 'COL-ALA', v: 1 }),
      normalizeRound(kept),
    ])
  })

  test('names and common short forms grade and autocomplete; a parent company alone is not an answer', () => {
    for (const team of sweets) {
      for (const answer of [fullName(team), team.abbr, ...(team.aliases ?? [])]) {
        expect(isCorrectGuess(answer, team)).toBe(true)
        if (answer.replace(/[^a-z0-9]/gi, '').length >= 2) expect(suggestTeams(answer, TEAMS.length)).toContain(team)
      }
      expect(isCorrectGuess('unrelated answer', team)).toBe(false)
    }
    expect(isCorrectGuess('KitKat', findTeam('SWEET-KITKAT')!)).toBe(true)
    expect(isCorrectGuess('Ben and Jerrys', findTeam('SWEET-BENJERRY')!)).toBe(true)
    expect(isCorrectGuess("Wall's", findTeam('SWEET-GOODHUMOR')!)).toBe(true)
    expect(isCorrectGuess('Chips Ahoy', findTeam('SWEET-CHIPSAHOY')!)).toBe(true)
    expect(isCorrectGuess('Mars', findTeam('SWEET-SNICKERS')!)).toBe(false)
    expect(isCorrectGuess('Wrigley', findTeam('SWEET-EXTRA')!)).toBe(false)
    expect(isCorrectGuess('Ferrero', findTeam('SWEET-NUTELLA')!)).toBe(false)
  })

  test('symbol marks lead where a brand has one, keeping its wordmark as a flagged alternate', () => {
    expect(sweets.filter((t) => !t.showsName).map((t) => t.id).sort()).toEqual(SYMBOLS)
    for (const id of ['SWEET-CHUPA', 'SWEET-GODIVA', 'SWEET-GOODHUMOR', 'SWEET-KLONDIKE', 'SWEET-LINDT', 'SWEET-TOBLERONE']) {
      const team = findTeam(id)!
      expect(team.alternateLogos!.map((v) => v.id)).toContain('wordmark')
      expect(withLogoVariant(team, 'wordmark').showsName).toBe(true)
    }
    expect(findTeam('SWEET-TOBLERONE')!.alternateLogos!.map((v) => v.id)).toEqual(['mountain-1999', 'wordmark'])
    // Toblerone's mountain is one gold color, so a remix shows it on a backdrop tile.
    expect(findTeam('SWEET-TOBLERONE')!.unusedSourceSlots).toEqual([1, 2])
  })

  test('hints name the kind of treat; sweets are logo-only and wordmarks sit random decks out', () => {
    expect(teamHint(findTeam('SWEET-REESES')!)).toBe('SWEETS - Chocolate')
    expect(roundHints({ o: 'SWEET-KLONDIKE', c: 'PRO-KC', v: 0 })).toEqual(['Logo: SWEETS - Ice Cream', 'Colors: NFL - AFC'])
    expect(roundHints({ o: 'SWEET-CHUPA', v: 0 })).toEqual(['Logo: SWEETS - Hard Candy'])
    expect(ALL_POOL_IDS).toContain('Sweets')
    expect(COLOR_POOLS.some((p) => p.league === 'SWEET')).toBe(false)
    expect(poolTeams(['Sweets'])).toEqual(sweets)
    expect(colorPoolTeams(['Sweets'])).toEqual([])
    expect(logoPoolTeams(['Sweets']).map((t) => t.id).sort()).toEqual(SYMBOLS)
    expect(randomDeck({ rounds: 10, logoPools: ['NFL'], colorPools: ['Sweets'], guess: 'both', hints: true })).toEqual([])
    for (let n = 0; n < 5; n++) {
      const deck = randomDeck({ rounds: 10, logoPools: ['Sweets'], colorPools: ['NFL', 'NBA'], guess: 'both', hints: true })
      expect(deck).toHaveLength(10)
      for (const round of deck) {
        expect(SYMBOLS).toContain(round.o)
        expect(['PRO', 'NBA']).toContain(findTeam(round.c)!.league)
      }
      expect(deckFromStorage(JSON.stringify(deck))).toEqual(deck)
    }
    // A wordmark can still be picked by hand, as a remix or in its own colors.
    const picked = [normalizeRound({ o: 'SWEET-SNICKERS', c: 'COL-ALA', v: 0 }), normalizeRound({ o: 'SWEET-REESES', v: 0 })]
    expect(deckFromStorage(JSON.stringify(picked))).toEqual(picked)
  })
})
