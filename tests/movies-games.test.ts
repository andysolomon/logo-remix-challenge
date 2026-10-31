import { describe, expect, test } from 'bun:test'
import {
  LEAGUES, deckFromStorage, entryNoun, filterTeams, findTeam, isCorrectGuess, logoPoolTeams, randomDeck, roundHints, suggestTeams,
} from '../src/lib/teams'

const MOVED_MOVIES = ['GHOSTBUSTERS', 'SCOOBY', 'JURASSIC', 'HP', 'BTTF', 'GODZILLA', 'BOND', 'LOTR', 'HUNGER', 'MINIONS', 'SHREK', 'KUNGFUPANDA']
const MOVED_GAMES = ['TRIFORCE', 'POKEBALL', 'PIKACHU', 'TEAMROCKET', 'METROID', 'ANIMALCROSSING', 'MARIO', 'KIRBY', 'DK', 'SPLATOON', 'AC', 'GOW', 'GTA',
  'ELDENRING', 'SONIC', 'CREEPER', 'HALFLIFE', 'APERTURE', 'UMBRELLA', 'OVERWATCH', 'VALORANT', 'LOL', 'PUBG', 'APEX', 'COD', 'BRAWL', 'PACMAN',
  'INVADER', 'TETRIS', 'FALLGUYS']

describe('movies and video games', () => {
  test('CHARACTERS movies and games moved into their own collections, and saved rounds follow them', () => {
    for (const [league, moved] of [['MOVIE', MOVED_MOVIES], ['GAME', MOVED_GAMES]] as const) {
      for (const abbr of moved) {
        expect(findTeam(`CHAR-${abbr}`)).toBeUndefined()
        expect(findTeam(`${league}-${abbr}`)!.league).toBe(league)
        expect(deckFromStorage(JSON.stringify([{ o: `CHAR-${abbr}`, c: 'PRO-KC', v: 0, g: 'team' }]))![0].o).toBe(`${league}-${abbr}`)
      }
    }
    const saved = [{ o: 'CHAR-SCOOBY', c: 'NBA-LAL', v: 1 }, { o: 'CHAR-MARIO', v: 0 }, { o: 'CHAR-BATMAN', c: 'PRO-KC', v: 0 }]
    expect(deckFromStorage(JSON.stringify(saved))!.map((r) => r.o)).toEqual(['MOVIE-SCOOBY', 'GAME-MARIO', 'CHAR-BATMAN'])
    expect(LEAGUES.CHAR.conferences).not.toContain('Video Games')
  })

  test('Halloween classics, haunted movies and games answer by their names and nicknames', () => {
    expect(filterTeams('MOVIE', 'Halloween', '').map((t) => t.abbr).sort()).toEqual([
      'ADDAMS', 'BEETLEJUICE', 'CASPER', 'CORALINE', 'FRANKENSTEIN', 'GHOSTBUSTERS', 'GOOSEBUMPS', 'GREMLINS', 'HAUNTEDMANSION', 'HOTELT', 'NIGHTMARE', 'SCOOBY',
    ])
    expect(isCorrectGuess('Scooby Doo', findTeam('MOVIE-SCOOBY')!)).toBe(true)
    expect(isCorrectGuess('Nightmare Before Christmas', findTeam('MOVIE-NIGHTMARE')!)).toBe(true)
    expect(isCorrectGuess('Hotel T', findTeam('MOVIE-HOTELT')!)).toBe(true)
    expect(isCorrectGuess('Smash Bros', findTeam('GAME-SMASHBROS')!)).toBe(true)
    expect(isCorrectGuess('FNAF', findTeam('GAME-FNAF')!)).toBe(true)
    expect(isCorrectGuess('FIFA', findTeam('GAME-EAFC')!)).toBe(true)
    // Short forms that already answer other entries stay with them.
    expect(isCorrectGuess('GT', findTeam('GAME-GRANTURISMO')!)).toBe(false)
    expect(isCorrectGuess('Smash', findTeam('GAME-SMASHBROS')!)).toBe(false)
    expect(suggestTeams('goosebumps')[0].id).toBe('MOVIE-GOOSEBUMPS')
    expect(entryNoun('MOVIE')).toBe('movie')
    expect(entryNoun('GAME')).toBe('game')
  })

  test('random decks draw name-free movie and game marks with genre hints', () => {
    expect(logoPoolTeams(['Movies']).map((t) => t.abbr)).toEqual(expect.arrayContaining(['GHOSTBUSTERS', 'GOOSEBUMPS', 'FRANKENSTEIN', 'TOTORO']))
    expect(logoPoolTeams(['Movies', 'Video Games']).every((t) => !t.showsName)).toBe(true)
    const deck = randomDeck({ rounds: 20, logoPools: ['Movies', 'Video Games'], colorPools: ['NFL'], guess: 'both', hints: true })
    expect(deck).toHaveLength(20)
    for (const round of deck) expect(['MOVIE', 'GAME']).toContain(findTeam(round.o)!.league)
    expect(roundHints({ o: 'MOVIE-GHOSTBUSTERS', v: 0 })).toEqual(['Logo: MOVIES - Halloween'])
    expect(roundHints({ o: 'GAME-ROCKETLEAGUE', c: 'NBA-BOS', v: 0 })).toEqual(['Logo: VIDEO GAMES - Sports & Racing', 'Colors: NBA'])
  })
})
