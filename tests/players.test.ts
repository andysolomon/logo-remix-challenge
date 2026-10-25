import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ALL_POOL_IDS,
  MAX_DECK_ROUNDS,
  PLAYERS,
  SEED_DECK,
  deckFromStorage,
  filterPlayers,
  findPlayer,
  findTeam,
  isCorrectPlayerGuess,
  jerseyColors,
  jerseyLine,
  normalizeRound,
  playerSurname,
  randomDeck,
  replaceRound,
  roundHints,
  roundPlayer,
  roundTarget,
  seasonLabel,
  shuffleRoundLogo,
  suggestPlayers,
  type Round,
} from '../src/lib/teams'

const root = join(import.meta.dir, '..')
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')
const player = (id: string) => findPlayer(id)!

describe('jersey data', () => {
  test('every jersey belongs to a current NFL or NBA team and is unique by team, number and season', () => {
    expect(PLAYERS.length).toBeGreaterThanOrEqual(140)
    expect(new Set(PLAYERS.map((p) => p.id)).size).toBe(PLAYERS.length)
    for (const p of PLAYERS) {
      const team = findTeam(p.team)
      expect(team?.league).toBe(p.league)
      expect(p.id).toBe(`${p.team}-${p.number}-${p.season}`)
      expect(p.number).toMatch(/^(0|[1-9]\d?)$/)
      expect(p.season).toBeGreaterThanOrEqual(1960)
      expect(p.season).toBeLessThanOrEqual(2025)
      expect(p.position).toMatch(/^[A-Z][a-z]+( [a-z]+)?$/)
    }
    expect(PLAYERS.filter((p) => p.league === 'NBA').length).toBeGreaterThanOrEqual(60)
    expect(PLAYERS.filter((p) => p.league === 'PRO').length).toBeGreaterThanOrEqual(60)
  })

  test('NBA seasons span two years and NFL seasons are one', () => {
    expect(seasonLabel(player('NBA-CHI-23-1995'))).toBe('1995–96')
    expect(seasonLabel(player('NBA-LAL-33-1979'))).toBe('1979–80')
    expect(seasonLabel(player('NBA-BOS-0-2023'))).toBe('2023–24')
    expect(seasonLabel(player('PRO-KC-15-2023'))).toBe('2023')
    expect(jerseyLine(player('NBA-CHI-23-1995'))).toBe('#23 · Chicago Bulls · 1995–96')
  })

  test('the same player can wear several jerseys, each its own round', () => {
    const kobe = PLAYERS.filter((p) => p.name === 'Kobe Bryant').map((p) => p.number)
    expect(kobe.sort()).toEqual(['24', '8'])
    expect(PLAYERS.filter((p) => p.name === 'LeBron James').map((p) => p.team).sort()).toEqual(['NBA-CLE', 'NBA-LAL', 'NBA-MIA'])
  })

  test('jersey numbers read on the jersey body', () => {
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    for (const id of new Set(PLAYERS.map((p) => p.team))) {
      const { body, number, trim } = jerseyColors(findTeam(id)!)
      const [hi, lo] = [luminance(body), luminance(number)].sort((a, b) => b - a)
      expect((hi + 0.05) / (lo + 0.05)).toBeGreaterThanOrEqual(1.4)
      expect(new Set([body, number, trim]).size).toBe(3)
    }
  })

  test('the browser filters by league and era', () => {
    const nineties = filterPlayers('NBA', '1990s')
    expect(nineties.length).toBeGreaterThan(0)
    expect(nineties.every((p) => p.league === 'NBA' && p.season >= 1990 && p.season < 2000)).toBe(true)
    expect(filterPlayers('PRO', 'Before 1990').every((p) => p.season < 1990)).toBe(true)
    expect(filterPlayers('PRO', '2020s').some((p) => p.season === 2024)).toBe(true)
    expect(filterPlayers('NBA', 'All').length + filterPlayers('PRO', 'All').length).toBe(PLAYERS.length)
  })
})

describe('guessing the player', () => {
  test('full name, surname and nicknames count; accents, punctuation and suffixes are forgiven', () => {
    const mj = player('NBA-CHI-23-1995')
    for (const guess of ['Michael Jordan', 'michael jordan', 'Jordan', 'MJ']) expect(isCorrectPlayerGuess(guess, mj)).toBe(true)
    for (const guess of ['Michael', 'Scottie Pippen', '', '23']) expect(isCorrectPlayerGuess(guess, mj)).toBe(false)
    expect(isCorrectPlayerGuess('Luka Doncic', player('NBA-DAL-77-2023'))).toBe(true)
    expect(isCorrectPlayerGuess('Shaq', player('NBA-LAL-34-1999'))).toBe(true)
    expect(isCorrectPlayerGuess('oneal', player('NBA-ORL-32-1994'))).toBe(true)
    expect(isCorrectPlayerGuess('Beckham', player('PRO-NYG-13-2014'))).toBe(true)
    expect(isCorrectPlayerGuess('Odell Beckham Jr', player('PRO-NYG-13-2014'))).toBe(true)
    expect(isCorrectPlayerGuess('Gilgeous-Alexander', player('NBA-OKC-2-2024'))).toBe(true)
    expect(isCorrectPlayerGuess('JJ Watt', player('PRO-HOU-99-2014'))).toBe(true)
    expect(playerSurname('Odell Beckham Jr.')).toBe('Beckham')
  })

  test('autocomplete offers each name once and never tags it with a team or season', () => {
    const picks = suggestPlayers('kob')
    expect(picks.map((p) => p.name)).toEqual(['Kobe Bryant'])
    expect(suggestPlayers('k')).toEqual([])
    const names = suggestPlayers('le', 20).map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
    const input = read('src/components/GuessInput.tsx')
    expect(input).toContain("suggestPlayers(value).map((p) => ({ key: p.id, name: p.name }))")
  })
})

describe('jersey rounds', () => {
  test('a jersey round follows its player: the team, and no colors, art or guess target', () => {
    const r = normalizeRound({ o: 'PRO-KC', c: 'PRO-DAL', v: 3, g: 'both', l: 'x', h: false, p: 'NBA-CHI-23-1995' })
    expect(r).toEqual({ o: 'NBA-CHI', v: 0, h: false, p: 'NBA-CHI-23-1995' })
    expect(roundTarget(r, 'both')).toBe('player')
    expect(roundPlayer(r)?.name).toBe('Michael Jordan')
    expect(roundHints(r)).toEqual(['Position: Guard'])
    expect(shuffleRoundLogo(r)).toBe(r)
  })

  test('editing swaps between a jersey and a remix while keeping the hint switch', () => {
    const jersey = normalizeRound({ o: 'NBA-CHI', v: 0, h: false, p: 'NBA-CHI-23-1995' })
    expect(replaceRound(jersey, { o: 'PRO-KC', c: 'PRO-DAL', v: 0 })).toMatchObject({ o: 'PRO-KC', c: 'PRO-DAL', h: false })
    expect(replaceRound(jersey, { o: 'PRO-KC', c: 'PRO-DAL', v: 0 }).p).toBeUndefined()
    const remix = normalizeRound({ o: 'PRO-KC', c: 'PRO-DAL', v: 0, g: 'colors', h: true })
    expect(replaceRound(remix, { o: 'PRO-KC', v: 0, p: 'PRO-KC-15-2023' })).toEqual({ o: 'PRO-KC', v: 0, h: true, p: 'PRO-KC-15-2023' })
  })

  test('saved decks keep jersey rounds; an unknown jersey is not a valid round', () => {
    const deck: Round[] = [{ o: 'NBA-CHI', v: 0, h: true, p: 'NBA-CHI-23-1995' }, { o: 'PRO-KC', c: 'PRO-DAL', v: 0, h: true }]
    expect(deckFromStorage(JSON.stringify(deck))[0]).toEqual(deck[0])
    expect(deckFromStorage(JSON.stringify([{ o: 'NBA-CHI', v: 0, p: 'NBA-CHI-99-1800' }]))).toEqual(SEED_DECK.map(normalizeRound))
  })

  test('random decks draw jerseys alone or as a coin flip with remixes, never repeating one', () => {
    const only = randomDeck({ rounds: 20, logoPools: [], colorPools: [], guess: 'both', hints: true, playerPools: ['NBA'] })
    expect(only).toHaveLength(20)
    expect(only.every((r) => r.p && findPlayer(r.p)!.league === 'NBA' && r.o === findPlayer(r.p)!.team && r.h)).toBe(true)
    expect(new Set(only.map((r) => r.p)).size).toBe(20)

    const existing = only.slice(0, 15)
    const more = randomDeck({ rounds: 5, logoPools: [], colorPools: [], guess: 'both', hints: false, playerPools: ['NBA'] }, existing)
    expect(more).toHaveLength(5)
    expect(more.some((r) => existing.some((e) => e.p === r.p))).toBe(false)
    expect(more.every((r) => r.h === undefined)).toBe(true)

    let jerseys = 0
    let remixes = 0
    for (let i = 0; i < 10; i++) {
      for (const r of randomDeck({ rounds: 20, logoPools: ALL_POOL_IDS, colorPools: ['NFL'], guess: 'both', hints: true, playerPools: ['NFL', 'NBA'] })) {
        if (r.p) jerseys++
        else remixes++
      }
    }
    expect(jerseys + remixes).toBe(200)
    expect(jerseys).toBeGreaterThan(50)
    expect(remixes).toBeGreaterThan(50)

    expect(randomDeck({ rounds: 10, logoPools: ['NFL'], colorPools: ['NFL'], guess: 'both', hints: true }).some((r) => r.p)).toBe(false)
    expect(randomDeck({ rounds: 10, logoPools: [], colorPools: [], guess: 'both', hints: true, playerPools: [] })).toEqual([])
    expect(randomDeck({ rounds: 30, logoPools: [], colorPools: [], guess: 'both', hints: true, playerPools: ['NFL'] })).toHaveLength(MAX_DECK_ROUNDS)
  })

  test('Play asks who wore it, grades the player and skips the logo announcer clip', () => {
    const play = read('src/components/PlayMode.tsx')
    expect(play).toContain("player ? 'WHO WORE IT?'")
    expect(play).toContain('isCorrectPlayerGuess(guess, player)')
    expect(play).toContain("if (voice && ask !== 'player') speak(ask)")
    expect(play).toContain('players={!!player}')
    const jersey = read('src/components/Jersey.tsx')
    // The jersey names the team and season, never the player.
    expect(jersey).not.toContain('player.name')
  })
})
