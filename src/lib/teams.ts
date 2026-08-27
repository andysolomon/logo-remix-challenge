import data from './teams.json'

export type League = 'PRO' | 'COL'

export interface Team {
  id: string
  league: League
  conference: string
  region: string
  name: string
  abbr: string
  palette: [string, string, string]
  /** Optional exact source colors when the downloaded PNG differs from the displayed palette. */
  sourcePalette?: [string, string, string]
  /** Path under public/ to the team's logo, e.g. "/logos/svg/nfl/kc.svg" (SVG preferred; PNGs fall back to canvas recolor). */
  logo: string
}

export interface Round {
  o: string
  c: string
  v: number
  /** Per-round guess target; falls back to the deck default when unset. */
  g?: GuessTarget
  /** Show league/conference hints for this round (e.g. "Logo: NFL · Colors: ACC"). */
  h?: boolean
}

export type GameMode = 'type' | 'host'
/** What the player is asked to identify: the team behind the logo, the team whose colors it wears, or both. */
export type GuessTarget = 'team' | 'colors' | 'both'
export const GUESS_TARGETS: GuessTarget[] = ['team', 'colors', 'both']
export const isGuessTarget = (v: unknown): v is GuessTarget => GUESS_TARGETS.includes(v as GuessTarget)
/** Button labels for each guess target, shared by the settings, deck cards and random deck modal. */
export const GUESS_LABEL: Record<GuessTarget, string> = { team: 'Logo', colors: 'Colors', both: 'Both' }
export const TIMER_OPTIONS = [5, 10, 15, 30] as const
export type TimerSeconds = number
export const TIMER_MIN = 3
export const TIMER_MAX = 120
export const clampTimer = (n: number) => Math.min(TIMER_MAX, Math.max(TIMER_MIN, Math.round(n)))

export const TEAMS = data.teams as Team[]
export const LEAGUES = data.leagues as Record<League, { label: string; conferences: string[] }>
export const PERMS = data.permutations as number[][]
export const SEED_DECK = data.seed_deck as Round[]
export const LS = data.localStorage_keys

const byId = new Map(TEAMS.map((t) => [t.id, t]))
export const findTeam = (id: string): Team | undefined => byId.get(id)
// Conference entries carry an empty name; trim keeps their display clean.
export const fullName = (t: Team) => `${t.region} ${t.name}`.trim()

export const norm = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')

export function isCorrectGuess(guess: string, team: Team): boolean {
  const g = norm(guess)
  if (!g) return false
  return [fullName(team), team.region, team.name, team.abbr].map(norm).includes(g)
}

export function filterTeams(league: League, conference: string, query: string): Team[] {
  const q = query.trim().toLowerCase()
  return TEAMS.filter(
    (t) =>
      t.league === league &&
      (conference === 'All' || t.conference === conference) &&
      (!q || `${t.region} ${t.name} ${t.abbr}`.toLowerCase().includes(q)),
  )
}

// ---- persistence ----
const safeGet = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const safeSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* ignore */
  }
}

export function loadDeck(): Round[] {
  try {
    const d = JSON.parse(safeGet(LS.deck) ?? 'null')
    if (Array.isArray(d) && d.length && d.every((r) => findTeam(r.o) && findTeam(r.c) && typeof r.v === 'number' && (r.g === undefined || isGuessTarget(r.g)) && (r.h === undefined || typeof r.h === 'boolean'))) return d
  } catch {
    /* ignore */
  }
  return SEED_DECK
}
export const saveDeck = (d: Round[]) => safeSet(LS.deck, JSON.stringify(d))

export function loadTimer(): TimerSeconds {
  const t = parseInt(safeGet(LS.timer) ?? '', 10)
  return Number.isFinite(t) && t >= TIMER_MIN && t <= TIMER_MAX ? t : 15
}
export const saveTimer = (t: TimerSeconds) => safeSet(LS.timer, String(t))

// ---------- High scores (arcade-style top 10) ----------
export const HIGH_SCORE_LIMIT = 10
export const INITIALS_LENGTH = 3
export const INITIALS_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LEGACY_INITIALS = '???'

export interface HighScore {
  initials: string
  score: number
  total: number
  date: number
}

// Higher score first; on ties the earlier entry keeps its spot, like an arcade cabinet.
const rankHighScores = (list: HighScore[]) =>
  [...list].sort((a, b) => b.score - a.score || a.date - b.date).slice(0, HIGH_SCORE_LIMIT)

const isHighScore = (h: unknown): h is HighScore =>
  typeof h === 'object' && h !== null &&
  typeof (h as HighScore).initials === 'string' &&
  typeof (h as HighScore).score === 'number' && (h as HighScore).score >= 0 &&
  typeof (h as HighScore).total === 'number' &&
  typeof (h as HighScore).date === 'number'

export function loadHighScores(): HighScore[] {
  try {
    const list = JSON.parse(safeGet(LS.highScores) ?? 'null')
    if (Array.isArray(list)) return rankHighScores(list.filter(isHighScore))
  } catch {
    /* ignore */
  }
  // Migrate the pre-leaderboard single best score so it is not lost.
  const legacy = parseInt(safeGet(LS.highScore) ?? '', 10)
  return legacy > 0 ? [{ initials: LEGACY_INITIALS, score: legacy, total: legacy, date: 0 }] : []
}
export const saveHighScores = (list: HighScore[]) => safeSet(LS.highScores, JSON.stringify(rankHighScores(list)))

// A run makes the board when there is an open slot or it beats the lowest entry (ties do not bump anyone).
export const qualifiesForHighScore = (score: number, list: HighScore[]) =>
  score > 0 && (list.length < HIGH_SCORE_LIMIT || score > list[list.length - 1].score)

export const insertHighScore = (list: HighScore[], entry: HighScore) => rankHighScores([...list, entry])

export function loadGameMode(): GameMode {
  const m = safeGet(LS.gameMode)
  return m === 'host' ? 'host' : 'type'
}
export const saveGameMode = (m: GameMode) => safeSet(LS.gameMode, m)
export function loadGuessTarget(): GuessTarget {
  const t = safeGet(LS.guessTarget)
  return isGuessTarget(t) ? t : 'team'
}
export const saveGuessTarget = (t: GuessTarget) => safeSet(LS.guessTarget, t)
export const loadVoice = (): boolean => safeGet(LS.voice) === '1'
export const saveVoice = (on: boolean) => safeSet(LS.voice, on ? '1' : '0')

/** Baked Chatterbox clips in public/voice/; one file per guess prompt. */
const VOICE_CLIPS: Record<GuessTarget, string> = {
  team: '/voice/guess-logo.wav',
  colors: '/voice/guess-colors.wav',
  both: '/voice/guess-both.wav',
}

let voicePlayer: HTMLAudioElement | null = null

export const voiceSupported = () => typeof Audio !== 'undefined'

/** Stop the current announcer clip, if any. */
export function stopSpeak() {
  if (!voicePlayer) return
  try {
    voicePlayer.pause()
    if (voicePlayer.src) voicePlayer.currentTime = 0
  } catch {
    /* ignore */
  }
}

/** Play the Chatterbox clip for a guess target. Reuses one Audio element so iPad stays unlocked after the first tap. */
export function speak(target: GuessTarget) {
  if (!voiceSupported()) return
  const src = VOICE_CLIPS[target]
  try {
    if (!voicePlayer) voicePlayer = new Audio()
    stopSpeak()
    if (!voicePlayer.src.endsWith(src)) voicePlayer.src = src
    void voicePlayer.play().catch(() => {})
  } catch {
    /* ignore */
  }
}
export const roundTarget = (r: Round, fallback: GuessTarget): GuessTarget => r.g ?? fallback
export const guessPrompt = (t: GuessTarget) => (t === 'both' ? 'Guess the Logo and the Colors!' : t === 'colors' ? 'Guess the Colors!' : 'Guess the Logo!')
/** Where a team plays: the league label for pro teams, the conference for college. */
export const teamHint = (t: Team) => (t.league === 'COL' ? t.conference : LEAGUES[t.league].label)
/** Hint lines for a round, one for the logo team and one for the colors team. */
export const roundHints = (r: Round): [string, string] => [
  `Logo: ${teamHint(findTeam(r.o)!)}`,
  `Colors: ${teamHint(findTeam(r.c)!)}`,
]

// ---------- Random deck generator ----------
/** A selectable slice of teams: the NFL as a whole, or one college conference. */
export interface TeamPool {
  id: string
  label: string
  match: (t: Team) => boolean
}
export const TEAM_POOLS: TeamPool[] = [
  { id: 'NFL', label: LEAGUES.PRO.label, match: (t) => t.league === 'PRO' },
  ...LEAGUES.COL.conferences.map((c) => ({ id: c, label: c, match: (t: Team) => t.league === 'COL' && t.conference === c })),
]
export const ALL_POOL_IDS = TEAM_POOLS.map((p) => p.id)
export const RANDOM_ROUND_OPTIONS = [5, 10, 15, 20] as const

export type RandomGuess = GuessTarget | 'mix'
export interface RandomDeckOptions {
  rounds: number
  logoPools: string[]
  colorPools: string[]
  guess: RandomGuess
  hints: boolean
}

export const poolTeams = (ids: string[]) => {
  const pools = TEAM_POOLS.filter((p) => ids.includes(p.id))
  return TEAMS.filter((t) => pools.some((p) => p.match(t)))
}

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]
const samePalette = (a: Team, b: Team) => a.palette.join() === b.palette.join()

/**
 * Build random remix rounds from the chosen pools. Never pairs a team with itself or with a
 * look-alike palette, never repeats a pairing already in `existing`, and spreads originals out
 * so the same logo does not show up twice until every candidate has been used.
 * May return fewer rounds than asked for when the pools are too small.
 */
export function randomDeck(opts: RandomDeckOptions, existing: Round[] = []): Round[] {
  const logos = poolTeams(opts.logoPools)
  const colors = poolTeams(opts.colorPools)
  if (!logos.length || !colors.length) return []
  const seen = new Set(existing.map((r) => `${r.o}|${r.c}`))
  const out: Round[] = []
  let fresh = [...logos]
  for (let attempt = 0; out.length < opts.rounds && attempt < opts.rounds * 40; attempt++) {
    if (!fresh.length) fresh = [...logos]
    const o = pick(fresh)
    const options = colors.filter((c) => c.id !== o.id && !samePalette(c, o) && !seen.has(`${o.id}|${c.id}`))
    if (!options.length) {
      fresh = fresh.filter((t) => t.id !== o.id)
      continue
    }
    const c = pick(options)
    seen.add(`${o.id}|${c.id}`)
    fresh = fresh.filter((t) => t.id !== o.id)
    const g: GuessTarget = opts.guess === 'mix' ? (Math.random() < 0.5 ? 'team' : 'colors') : opts.guess
    out.push({ o: o.id, c: c.id, v: Math.floor(Math.random() * PERMS.length), g, h: opts.hints || undefined })
  }
  return out
}
