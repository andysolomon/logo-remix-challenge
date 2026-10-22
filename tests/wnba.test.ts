import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  ALL_POOL_IDS, LEAGUES, TEAMS, colorPoolTeams, deckFromStorage, entryNoun, filterTeams, findTeam, fullName,
  isCorrectGuess, logoPoolTeams, normalizeRound, poolTeams, randomDeck, roundHints, suggestTeams,
} from '../src/lib/teams'

const root = join(import.meta.dir, '..')
const teams = filterTeams('WNBA', 'All', '')
/** Primary marks that spell the team's name: hand-pickable, never drawn by Random Deck. */
const WORDMARKS = ['WNBA-IND', 'WNBA-WAS']

describe('WNBA collection', () => {
  test('all 15 teams of the 2026 season, including both expansion teams, are split by conference', () => {
    expect(LEAGUES.WNBA).toEqual({ label: 'WNBA', conferences: ['Eastern', 'Western'] })
    expect(teams).toHaveLength(15)
    expect(filterTeams('WNBA', 'Eastern', '').map((t) => t.abbr).sort()).toEqual(['ATL', 'CHI', 'CON', 'IND', 'NYL', 'TOR', 'WAS'])
    expect(filterTeams('WNBA', 'Western', '').map((t) => t.abbr).sort()).toEqual(['DAL', 'GSV', 'LAS', 'LVA', 'MIN', 'PHX', 'POR', 'SEA'])
    expect(new Set(teams.map(fullName)).size).toBe(15)
    expect(new Set(TEAMS.map((t) => t.id)).size).toBe(TEAMS.length)
    expect(findTeam('WNBA-POR')!.region).toBe('Portland Fire')
    expect(findTeam('WNBA-TOR')!.region).toBe('Toronto Tempo')
    expect(findTeam('WNBA-GSV')!.region).toBe('Golden State Valkyries')
    expect(entryNoun('WNBA')).toBe('team')
    for (const team of teams) {
      expect(team.logo).toBe(`/logos/svg/wnba/${team.abbr.toLowerCase()}.svg`)
      expect(existsSync(join(root, 'public', team.logo))).toBe(true)
    }
  })

  test('full names, codes and nicknames are accepted and suggested', () => {
    for (const team of teams) {
      for (const answer of [fullName(team), team.abbr, ...(team.aliases ?? [])]) {
        expect(isCorrectGuess(answer, team)).toBe(true)
        expect(suggestTeams(answer, TEAMS.length)).toContain(team)
      }
      expect(isCorrectGuess('unrelated answer', team)).toBe(false)
    }
    expect(isCorrectGuess('Liberty', findTeam('WNBA-NYL')!)).toBe(true)
    expect(isCorrectGuess('Valks', findTeam('WNBA-GSV')!)).toBe(true)
    expect(isCorrectGuess('LA Sparks', findTeam('WNBA-LAS')!)).toBe(true)
    expect(isCorrectGuess('PDX', findTeam('WNBA-POR')!)).toBe(true)
    // Similar names across the two basketball leagues stay separate answers.
    expect(isCorrectGuess('Suns', findTeam('WNBA-CON')!)).toBe(false)
    expect(isCorrectGuess('Mercury', findTeam('NBA-PHX')!)).toBe(false)
  })

  test('hints name the WNBA conference; teams are logo-only and wordmarks sit random decks out', () => {
    expect(roundHints({ o: 'WNBA-NYL', c: 'PRO-KC', v: 0 })).toEqual(['Logo: WNBA - Eastern', 'Colors: NFL - AFC'])
    expect(roundHints({ o: 'WNBA-LVA', v: 0 })).toEqual(['Logo: WNBA - Western'])
    expect(ALL_POOL_IDS).toContain('WNBA')
    expect(poolTeams(['WNBA'])).toEqual(teams)
    expect(colorPoolTeams(['WNBA'])).toEqual([])
    expect(teams.filter((t) => t.showsName).map((t) => t.id).sort()).toEqual(WORDMARKS)
    expect(logoPoolTeams(['WNBA'])).toHaveLength(15 - WORDMARKS.length)
    expect(randomDeck({ rounds: 10, logoPools: ['NFL'], colorPools: ['WNBA'], guess: 'both', hints: true })).toEqual([])
    const deck = randomDeck({ rounds: 10, logoPools: ['WNBA'], colorPools: ['NBA'], guess: 'both', hints: true })
    expect(deck).toHaveLength(10)
    expect(new Set(deck.map((r) => r.o)).size).toBe(10)
    for (const round of deck) {
      expect(findTeam(round.o)!.league).toBe('WNBA')
      expect(WORDMARKS).not.toContain(round.o)
      expect(findTeam(round.c)!.league).toBe('NBA')
    }
    expect(deckFromStorage(JSON.stringify(deck))).toEqual(deck)
    // A wordmark can still be picked by hand, as a remix or in its own colors.
    const picked = [normalizeRound({ o: 'WNBA-WAS', c: 'COL-ALA', v: 0 }), normalizeRound({ o: 'WNBA-IND', v: 0 })]
    expect(deckFromStorage(JSON.stringify(picked))).toEqual(picked)
  })
})
