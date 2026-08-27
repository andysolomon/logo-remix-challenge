import data from './teams.json'

export type League = 'PRO' | 'COL'
export type Shape = 'shield' | 'circle' | 'hex' | 'diamond' | 'square' | 'pennant'
export type Deco = 'stripe' | 'star' | 'dots' | 'none'

export interface Team {
  id: string
  league: League
  conference: string
  region: string
  name: string
  abbr: string
  palette: [string, string, string]
  shape: Shape
  deco: Deco
}

export interface Round {
  o: string
  c: string
  v: number
}

export type GameMode = 'type' | 'host'
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
export const fullName = (t: Team) => `${t.region} ${t.name}`

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
    if (Array.isArray(d) && d.length && d.every((r) => findTeam(r.o) && findTeam(r.c) && typeof r.v === 'number')) return d
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

export function loadHighScore(): number {
  const h = parseInt(safeGet(LS.highScore) ?? '', 10)
  return h > 0 ? h : 0
}
export const saveHighScore = (h: number) => safeSet(LS.highScore, String(h))

export function loadGameMode(): GameMode {
  const m = safeGet(LS.gameMode)
  return m === 'host' ? 'host' : 'type'
}
export const saveGameMode = (m: GameMode) => safeSet(LS.gameMode, m)
