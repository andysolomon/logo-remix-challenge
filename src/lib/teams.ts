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
/** What the player is asked to identify: the team behind the logo, or the team whose colors it wears. */
export type GuessTarget = 'team' | 'colors'
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
    if (Array.isArray(d) && d.length && d.every((r) => findTeam(r.o) && findTeam(r.c) && typeof r.v === 'number' && (r.g === undefined || r.g === 'team' || r.g === 'colors') && (r.h === undefined || typeof r.h === 'boolean'))) return d
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
  return safeGet(LS.guessTarget) === 'colors' ? 'colors' : 'team'
}
export const saveGuessTarget = (t: GuessTarget) => safeSet(LS.guessTarget, t)
export const loadVoice = (): boolean => safeGet(LS.voice) === '1'
export const saveVoice = (on: boolean) => safeSet(LS.voice, on ? '1' : '0')

export const voiceSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window
/** Announce a line via the browser's built-in voice; silently no-ops where unsupported. */
export function speak(text: string) {
  if (!voiceSupported()) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1.05
    u.pitch = 1.1
    window.speechSynthesis.speak(u)
  } catch {
    /* ignore */
  }
}
export const roundTarget = (r: Round, fallback: GuessTarget): GuessTarget => r.g ?? fallback
export const guessPrompt = (t: GuessTarget) => (t === 'colors' ? 'Guess the Colors!' : 'Guess the Logo!')
/** Where a team plays: the league label for pro teams, the conference for college. */
export const teamHint = (t: Team) => (t.league === 'COL' ? t.conference : LEAGUES[t.league].label)
/** Hint lines for a round, one for the logo team and one for the colors team. */
export const roundHints = (r: Round): [string, string] => [
  `Logo: ${teamHint(findTeam(r.o)!)}`,
  `Colors: ${teamHint(findTeam(r.c)!)}`,
]
