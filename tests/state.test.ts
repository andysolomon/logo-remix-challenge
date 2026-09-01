import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import {
  ALL_POOL_IDS,
  HIGH_SCORE_LIMIT,
  LS,
  MAX_DECK_ROUNDS,
  PERMS,
  SEED_DECK,
  contrastSafePermutation,
  contrastSafePermutations,
  deckFromStorage,
  deckUndoReducer,
  findTeam,
  insertHighScore,
  loadDeck,
  loadHighScores,
  loadTimer,
  normalizeDeck,
  normalizeRound,
  randomDeck,
  resolveRemixTargetColors,
  saveDeck,
  saveHighScores,
  type DeckUndoSnapshot,
  type HighScore,
  type RandomDeckOptions,
  type Round,
  type Team,
} from '../src/lib/teams'

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const stored = new Map<string, string>()
const localStorageMock: Storage = {
  get length() {
    return stored.size
  },
  clear: () => stored.clear(),
  getItem: (key) => stored.get(key) ?? null,
  key: (index) => [...stored.keys()][index] ?? null,
  removeItem: (key) => {
    stored.delete(key)
  },
  setItem: (key, value) => {
    stored.set(key, String(value))
  },
}

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorageMock })

beforeEach(() => stored.clear())
afterAll(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else delete (globalThis as { localStorage?: Storage }).localStorage
})

const baseRound: Round = { o: 'PRO-BAL', c: 'PRO-BUF', v: 0, g: 'both', h: true }

describe('deck persistence and normalization', () => {
  test('keeps a deliberately saved empty deck empty', () => {
    saveDeck([])

    expect(stored.get(LS.deck)).toBe('[]')
    expect(loadDeck()).toEqual([])
    expect(deckFromStorage('[]')).toEqual([])
  })

  test('falls back from missing, empty, malformed, and invalid deck values', () => {
    const fallback = normalizeDeck(SEED_DECK)

    for (const value of [null, '', '{', 'null', '{}', '[null]', '[{"o":"missing","c":"PRO-BUF","v":0}]']) {
      expect(deckFromStorage(value)).toEqual(fallback)
    }
  })

  test('caps oversized persisted decks and saved decks at twenty rounds', () => {
    const oversized = Array.from({ length: MAX_DECK_ROUNDS + 7 }, () => ({ ...baseRound }))

    expect(deckFromStorage(JSON.stringify(oversized))).toHaveLength(MAX_DECK_ROUNDS)
    saveDeck(oversized)
    expect(JSON.parse(stored.get(LS.deck)!)).toHaveLength(MAX_DECK_ROUNDS)
    expect(loadDeck()).toHaveLength(MAX_DECK_ROUNDS)
  })

  test('rejects malformed timers instead of partially parsing them', () => {
    stored.set(LS.timer, '30 seconds')
    expect(loadTimer()).toBe(15)
    stored.set(LS.timer, '0x1e')
    expect(loadTimer()).toBe(15)
    stored.set(LS.timer, '30')
    expect(loadTimer()).toBe(30)
    stored.set(LS.timer, '121')
    expect(loadTimer()).toBe(15)
  })

  test('normalizes stale permutation indexes without mutating round identity fields', () => {
    const stale = { ...baseRound, v: -999 }
    const normalized = normalizeRound(stale)
    const original = findTeam(stale.o)!
    const colors = findTeam(stale.c)!

    expect(normalized).toEqual({
      ...stale,
      v: contrastSafePermutation(original, colors.palette, stale.v),
    })
    expect(contrastSafePermutations(original, colors.palette)).toContain(normalized.v)
    expect(stale.v).toBe(-999)
  })
})

describe('random append safety', () => {
  const options: RandomDeckOptions = {
    rounds: MAX_DECK_ROUNDS,
    logoPools: ALL_POOL_IDS,
    colorPools: ALL_POOL_IDS,
    guess: 'mix',
    hints: true,
  }

  test('uses only remaining capacity and excludes existing and generated pair duplicates', () => {
    const existing = Array.from({ length: MAX_DECK_ROUNDS - 1 }, () => ({ ...baseRound }))
    const generated = randomDeck(options, existing)

    expect(generated).toHaveLength(1)
    expect(`${generated[0].o}|${generated[0].c}`).not.toBe(`${baseRound.o}|${baseRound.c}`)
    expect(generated[0].o).not.toBe(generated[0].c)

    const largerBatch = randomDeck(options, [baseRound])
    const pairs = largerBatch.map((round) => `${round.o}|${round.c}`)
    expect(largerBatch).toHaveLength(MAX_DECK_ROUNDS - 1)
    expect(new Set(pairs).size).toBe(pairs.length)
    expect(pairs).not.toContain(`${baseRound.o}|${baseRound.c}`)
  })

  test('returns no append rounds for a full deck', () => {
    const full = Array.from({ length: MAX_DECK_ROUNDS }, () => ({ ...baseRound }))
    expect(randomDeck(options, full)).toEqual([])
  })
})

describe('contrast fallback', () => {
  test('darkens artwork roles but preserves the exact negative-space color when no exact mapping exists', () => {
    const original: Team = {
      ...findTeam('PRO-BUF')!,
      palette: ['#000000', '#FFFFFF', '#808080'],
      sourcePalette: ['#000000', '#FFFFFF', '#808080'],
    }
    const target = ['#FFFFFF', '#FFFFFF', '#FFFFFF'] as const
    const safe = contrastSafePermutations(original, target)
    const resolved = resolveRemixTargetColors(original, target, 0)

    expect(safe).toHaveLength(1)
    expect(resolved[0]).not.toBe('#FFFFFF')
    expect(resolved[1]).not.toBe('#FFFFFF')
    expect(resolved[2]).toBe('#FFFFFF')
  })

  test('keeps target palette colors exact when a safe permutation exists', () => {
    const original = findTeam('PRO-BAL')!
    const target = findTeam('PRO-BUF')!.palette
    const permutation = contrastSafePermutations(original, target)[0]
    const resolved = resolveRemixTargetColors(original, target, permutation)

    expect(resolved).toEqual(PERMS[permutation].map((index) => target[index]))
  })
})

describe('one-shot destructive Undo state', () => {
  test('stores one normalized snapshot and restore consumes it', () => {
    const deck = [{ ...baseRound, v: -999 }, { ...baseRound, o: 'PRO-CIN', v: 999 }]
    let undo: DeckUndoSnapshot | null = deckUndoReducer(null, {
      type: 'destructive',
      deck,
      label: 'Cleared 2 rounds.',
    })

    expect(undo).toEqual({ deck: normalizeDeck(deck), label: 'Cleared 2 rounds.' })
    undo = deckUndoReducer(undo, { type: 'restored' })
    expect(undo).toBeNull()
  })

  test('ordinary and deck-wide default-mode mutations invalidate stale snapshots', () => {
    const snapshot = deckUndoReducer(null, { type: 'destructive', deck: [baseRound], label: 'Deleted round 1.' })

    expect(deckUndoReducer(snapshot, { type: 'ordinary' })).toBeNull()
    expect(deckUndoReducer(snapshot, { type: 'deck-wide' })).toBeNull()
  })

  test('a later destructive mutation replaces rather than stacks history', () => {
    const first = deckUndoReducer(null, { type: 'destructive', deck: [baseRound], label: 'First' })
    const secondDeck = [{ ...baseRound, o: 'PRO-CIN' }]
    const second = deckUndoReducer(first, { type: 'destructive', deck: secondDeck, label: 'Second' })

    expect(second).toEqual({ deck: normalizeDeck(secondDeck), label: 'Second' })
  })
})

describe('high score persistence and validation', () => {
  const validEntry = (overrides: Partial<HighScore> = {}): HighScore => ({
    initials: 'ABC',
    score: 12,
    total: 20,
    date: 1_700_000_000_000,
    ...overrides,
  })

  test('loads valid persisted records and ranks by score then earlier date', () => {
    const entries = [
      validEntry({ initials: 'LOW', score: 5, date: 3 }),
      validEntry({ initials: 'TOP', score: 18, date: 2 }),
      validEntry({ initials: 'TIE', score: 18, date: 1 }),
      validEntry({ initials: 'MID', score: 12, date: 4 }),
    ]
    stored.set(LS.highScores, JSON.stringify(entries))

    expect(loadHighScores()).toEqual([
      validEntry({ initials: 'TIE', score: 18, date: 1 }),
      validEntry({ initials: 'TOP', score: 18, date: 2 }),
      validEntry({ initials: 'MID', score: 12, date: 4 }),
      validEntry({ initials: 'LOW', score: 5, date: 3 }),
    ])
  })

  test('migrates a legacy single best score when the leaderboard list is missing', () => {
    stored.set(LS.highScore, '15')

    expect(loadHighScores()).toEqual([{ initials: '???', score: 15, total: 15, date: 0 }])
  })

  test('migrates legacy scores only within 1..MAX_DECK_ROUNDS', () => {
    for (const value of ['1', '20']) {
      stored.clear()
      stored.set(LS.highScore, value)
      const score = Number(value)
      expect(loadHighScores()).toEqual([{ initials: '???', score, total: score, date: 0 }])
    }
  })

  test('rejects invalid legacy single-score values', () => {
    for (const value of ['0', '-1', '9.5', '21', '9999999999999999', 'not-a-score', '']) {
      stored.clear()
      stored.set(LS.highScore, value)
      expect(loadHighScores()).toEqual([])
    }
  })

  test('filters malformed records without throwing', () => {
    const malformed = [
      validEntry({ initials: 'OKA' }),
      { initials: 'NAN', score: NaN, total: 10, date: 1 },
      { initials: 'INF', score: 10, total: Infinity, date: 1 },
      { initials: 'FRQ', score: 9.5, total: 10, date: 1 },
      { initials: 'NEG', score: -1, total: 10, date: 1 },
      { initials: 'BIG', score: MAX_DECK_ROUNDS + 1, total: 20, date: 1 },
      { initials: 'OVR', score: 10, total: MAX_DECK_ROUNDS + 1, date: 1 },
      { initials: 'BAD', score: 12, total: 10, date: 1 },
      { initials: 'ab', score: 10, total: 10, date: 1 },
      { initials: 'ABCD', score: 10, total: 10, date: 1 },
      { initials: 'AB!', score: 10, total: 10, date: 1 },
      { initials: 'LEG', score: 10, total: 0, date: 1 },
      null,
      'not-an-entry',
    ]
    stored.set(LS.highScores, JSON.stringify(malformed))

    expect(() => loadHighScores()).not.toThrow()
    expect(loadHighScores()).toEqual([validEntry({ initials: 'OKA' })])
  })

  test('accepts legacy ??? initials and zero date while rejecting other invalid initials', () => {
    stored.set(
      LS.highScores,
      JSON.stringify([
        validEntry({ initials: '???', score: 8, total: 10, date: 0 }),
        validEntry({ initials: 'XYZ', score: 7, total: 10, date: 2 }),
        { initials: '???', score: 9, total: 10, date: -1 },
      ]),
    )

    expect(loadHighScores()).toEqual([
      validEntry({ initials: '???', score: 8, total: 10, date: 0 }),
      validEntry({ initials: 'XYZ', score: 7, total: 10, date: 2 }),
    ])
  })

  test('filters invalid records before saving', () => {
    const mixed = [
      validEntry({ initials: 'OKA' }),
      { initials: 'BAD', score: 12, total: 10, date: 1 },
      { initials: 'NEG', score: -1, total: 10, date: 1 },
      { initials: 'BIG', score: MAX_DECK_ROUNDS + 1, total: 20, date: 1 },
    ]
    saveHighScores(mixed as HighScore[])
    expect(JSON.parse(stored.get(LS.highScores)!)).toEqual([validEntry({ initials: 'OKA' })])
    expect(loadHighScores()).toEqual([validEntry({ initials: 'OKA' })])
  })

  test('keeps top-10 ordering and tie behavior when saving and inserting', () => {
    const letters = 'ABCDEFGHIJ'
    const base = Array.from({ length: HIGH_SCORE_LIMIT }, (_, i) =>
      validEntry({ initials: `${letters[i]}${letters[i]}${letters[i]}`, score: i + 1, date: i + 1 }),
    )
    saveHighScores(base)
    const ranked = loadHighScores()
    expect(ranked).toHaveLength(HIGH_SCORE_LIMIT)
    expect(ranked[0].score).toBe(HIGH_SCORE_LIMIT)
    expect(ranked.at(-1)?.score).toBe(1)

    const bumped = insertHighScore(ranked, validEntry({ initials: 'NEW', score: 5, date: 99 }))
    expect(bumped).toHaveLength(HIGH_SCORE_LIMIT)
    expect(bumped.some((entry) => entry.initials === 'NEW')).toBe(true)
    expect(bumped.at(-1)?.score).toBe(2)
  })
})
