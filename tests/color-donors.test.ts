import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ALL_POOL_IDS,
  COLOR_DONOR_LEAGUES,
  COLOR_POOLS,
  COLOR_POOL_IDS,
  COLOR_SOURCE_NOTE,
  LEAGUES,
  SEED_DECK,
  TEAMS,
  TEAM_POOLS,
  colorPoolTeams,
  deckFromStorage,
  filterTeams,
  findTeam,
  isAllowedRound,
  isColorDonor,
  normalizeDeck,
  poolTeams,
  randomDeck,
  type League,
  type Round,
} from '../src/lib/teams'

const root = join(import.meta.dir, '..')
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')

describe('only NFL, NBA and college palettes color a remix', () => {
  test('the donor collections are NFL, NBA and college; every other collection is logo-only', () => {
    expect(COLOR_DONOR_LEAGUES).toEqual(['PRO', 'NBA', 'COL'])
    expect(LEAGUES.PRO.label).toBe('NFL')
    const logoOnly: League[] = ['MLB', 'SOCCER', 'HS', 'FOOD', 'BRAND', 'APP', 'TV', 'CAR', 'LUX', 'CLOTH']
    expect([...COLOR_DONOR_LEAGUES, ...logoOnly].sort()).toEqual(Object.keys(LEAGUES).sort())
    for (const team of TEAMS) expect(isColorDonor(team)).toBe(COLOR_DONOR_LEAGUES.includes(team.league))
    for (const league of logoOnly) expect(filterTeams(league, 'All', '').length).toBeGreaterThan(0)
    expect(COLOR_SOURCE_NOTE).toBe('Colors come from NFL, NBA and college teams only.')
  })

  test('random decks offer only donor pools for colors and draw no colors from the others', () => {
    expect(COLOR_POOL_IDS).toEqual(['NFL', 'NBA', ...LEAGUES.COL.conferences])
    expect(COLOR_POOLS.map((p) => p.id)).toEqual(COLOR_POOL_IDS)
    for (const pool of TEAM_POOLS) {
      const members = poolTeams([pool.id])
      expect(members.length).toBeGreaterThan(0)
      expect(members.every((t) => t.league === pool.league)).toBe(true)
      expect(colorPoolTeams([pool.id])).toEqual(COLOR_POOL_IDS.includes(pool.id) ? members : [])
    }
    expect(colorPoolTeams(ALL_POOL_IDS)).toEqual(TEAMS.filter(isColorDonor))
    for (const colors of [['MLB'], ['Soccer'], ['Fast Food', 'Brands', 'Apps', 'TV', 'Cars'], ['Cobb County']]) {
      expect(randomDeck({ rounds: 20, logoPools: ALL_POOL_IDS, colorPools: colors, guess: 'mix', hints: true })).toEqual([])
    }
    for (let n = 0; n < 5; n++) {
      const deck = randomDeck({ rounds: 20, logoPools: ALL_POOL_IDS, colorPools: ALL_POOL_IDS, guess: 'mix', hints: true })
      expect(deck).toHaveLength(20)
      for (const round of deck) expect(isColorDonor(findTeam(round.c)!)).toBe(true)
    }
  })

  test('saved rounds whose colors came from a logo-only collection are dropped; the rest of the deck survives', () => {
    const ok: Round = { o: 'FOOD-MCD', c: 'PRO-KC', v: 0 }
    const brandColors: Round = { o: 'PRO-KC', c: 'FOOD-MCD', v: 0 }
    const mlbColors: Round = { o: 'NBA-ATL', c: 'MLB-NYY', v: 0, g: 'team' }
    expect(isAllowedRound(ok)).toBe(true)
    expect(isAllowedRound(brandColors)).toBe(false)
    expect(isAllowedRound(mlbColors)).toBe(false)
    const kept = normalizeDeck([ok])
    expect(kept).toHaveLength(1)
    expect(kept[0]).toMatchObject({ o: 'FOOD-MCD', c: 'PRO-KC' })
    expect(normalizeDeck([brandColors, ok, mlbColors])).toEqual(kept)
    expect(deckFromStorage(JSON.stringify([brandColors, ok, mlbColors]))).toEqual(kept)
    expect(SEED_DECK.every(isAllowedRound)).toBe(true)
  })

  test('the Colors browsers and the random deck modal offer only the donor collections', () => {
    const browser = read('src/components/TeamBrowser.tsx')
    expect(browser).toContain('leagues?: readonly League[]')
    expect(browser).toContain("const offered = (Object.keys(LEAGUES) as League[]).filter((lg) => !leagues || leagues.includes(lg))")
    expect(browser).toContain("const state = offered.includes(rawState.league) ? rawState : { league: offered[0], conference: 'All' }")
    for (const file of ['src/components/CreateMode.tsx', 'src/components/DesignerMode.tsx']) {
      const source = read(file)
      // Both layouts of the colors browser carry the restriction; the logo browser stays unrestricted.
      expect(source.match(/leagues=\{COLOR_DONOR_LEAGUES\}/g)).toHaveLength(2)
      expect(source.match(/note=\{COLOR_SOURCE_NOTE\}/g)).toHaveLength(2)
      expect(source.match(/showSwatches/g)).toHaveLength(2)
    }
    const modal = read('src/components/RandomDeckModal.tsx')
    expect(modal).toContain('pools={COLOR_POOLS} allIds={COLOR_POOL_IDS}')
    expect(modal).toContain('colorPoolTeams(opts.colorPools)')
    expect(modal).toContain('{COLOR_SOURCE_NOTE}')
  })
})
