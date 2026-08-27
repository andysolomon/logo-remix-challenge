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

/** Round prompt or reveal verdict. Score lines go through `speakScore`. */
export type VoiceClipId = GuessTarget | 'correct' | 'wrong' | 'timeout'

/** Baked Chatterbox clips in public/voice/. Score uses you-scored-N + out-of-M joined in-browser. */
const VOICE_CLIPS: Record<VoiceClipId, readonly string[]> = {
  team: [
    '/voice/guess-logo.wav',
    '/voice/guess-logo-2.wav',
    '/voice/guess-logo-3.wav',
    '/voice/guess-logo-4.wav',
  ],
  colors: [
    '/voice/guess-colors.wav',
    '/voice/guess-colors-2.wav',
    '/voice/guess-colors-3.wav',
    '/voice/guess-colors-4.wav',
  ],
  both: [
    '/voice/guess-both.wav',
    '/voice/guess-both-2.wav',
    '/voice/guess-both-3.wav',
    '/voice/guess-both-4.wav',
  ],
  correct: [
    '/voice/correct.wav',
    '/voice/correct-2.wav',
    '/voice/correct-3.wav',
    '/voice/correct-4.wav',
  ],
  wrong: [
    '/voice/wrong.wav',
    '/voice/wrong-2.wav',
    '/voice/wrong-3.wav',
    '/voice/wrong-4.wav',
  ],
  timeout: [
    '/voice/timeout.wav',
    '/voice/timeout-2.wav',
    '/voice/timeout-3.wav',
    '/voice/timeout-4.wav',
  ],
}

const voiceClipBags = new Map<VoiceClipId, string[]>()
const lastVoiceClips = new Map<VoiceClipId, string>()

const nextVoiceClip = (id: VoiceClipId) => {
  let bag = voiceClipBags.get(id)
  if (!bag?.length) {
    bag = [...VOICE_CLIPS[id]]
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[bag[i], bag[j]] = [bag[j], bag[i]]
    }
    const last = lastVoiceClips.get(id)
    if (last && bag[bag.length - 1] === last) {
      ;[bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]]
    }
    voiceClipBags.set(id, bag)
  }
  const clip = bag.pop()!
  lastVoiceClips.set(id, clip)
  return clip
}

const VOICE_SCORE_MAX = 20
const VOICE_GAME_OVER = '/voice/game-over.wav'

let voicePlayer: HTMLAudioElement | null = null
let scoreBlobUrl: string | null = null
let speakGen = 0
const wavCache = new Map<string, ArrayBuffer>()

export const voiceSupported = () => typeof Audio !== 'undefined'

const ensurePlayer = () => {
  if (!voicePlayer) voicePlayer = new Audio()
  return voicePlayer
}

const revokeScoreBlob = () => {
  if (!scoreBlobUrl) return
  URL.revokeObjectURL(scoreBlobUrl)
  scoreBlobUrl = null
}

/** Stop the current announcer clip, if any. */
export function stopSpeak() {
  speakGen += 1
  revokeScoreBlob()
  if (!voicePlayer) return
  try {
    voicePlayer.pause()
    if (voicePlayer.src) voicePlayer.currentTime = 0
  } catch {
    /* ignore */
  }
}

const playSrc = (src: string) => {
  if (!voiceSupported()) return
  const player = ensurePlayer()
  const keepBlob = src === scoreBlobUrl
  speakGen += 1
  if (!keepBlob) revokeScoreBlob()
  try {
    player.pause()
    player.src = src
    void player.play().catch(() => {})
  } catch {
    /* ignore */
  }
}

/** Play a prompt or verdict clip. Reuses one Audio element so iPad stays unlocked after the first tap. */
export function speak(id: VoiceClipId) {
  playSrc(nextVoiceClip(id))
}

/** Announce the final score as one joined wav: “You scored N” + “out of M”. */
export function speakScore(score: number, total: number) {
  const s = Math.round(score)
  const t = Math.round(total)
  if (s < 0 || t < 1 || s > VOICE_SCORE_MAX || t > VOICE_SCORE_MAX) {
    playSrc(VOICE_GAME_OVER)
    return
  }
  void playJoined([`/voice/you-scored-${s}.wav`, `/voice/out-of-${t}.wav`])
}

const ascii = (buf: ArrayBuffer, off: number, n: number) =>
  String.fromCharCode(...new Uint8Array(buf, off, n))

const extractWavPcm = (buf: ArrayBuffer) => {
  const v = new DataView(buf)
  if (ascii(buf, 0, 4) !== 'RIFF' || ascii(buf, 8, 4) !== 'WAVE') throw new Error('not wav')
  let off = 12
  let format = 0
  let channels = 0
  let sampleRate = 0
  let bits = 0
  let pcm: Uint8Array | null = null
  while (off + 8 <= buf.byteLength) {
    const id = ascii(buf, off, 4)
    const size = v.getUint32(off + 4, true)
    const start = off + 8
    if (id === 'fmt ') {
      format = v.getUint16(start, true)
      channels = v.getUint16(start + 2, true)
      sampleRate = v.getUint32(start + 4, true)
      bits = v.getUint16(start + 14, true)
    } else if (id === 'data') {
      pcm = new Uint8Array(buf, start, size)
    }
    off = start + size + (size & 1)
  }
  if (!pcm || !sampleRate || !channels || !bits) throw new Error('bad wav')
  return { format, channels, sampleRate, bits, pcm }
}

const writeWav = (
  pcm: Uint8Array,
  meta: { format: number; channels: number; sampleRate: number; bits: number },
) => {
  const blockAlign = meta.channels * (meta.bits / 8)
  const byteRate = meta.sampleRate * blockAlign
  const fmtSize = 16
  const factSize = meta.format === 1 ? 0 : 4
  const riffSize = 4 + 8 + fmtSize + (factSize ? 8 + factSize : 0) + 8 + pcm.byteLength
  const out = new ArrayBuffer(8 + riffSize)
  const view = new DataView(out)
  const bytes = new Uint8Array(out)
  let o = 0
  const str = (s: string) => {
    for (let i = 0; i < s.length; i++) bytes[o++] = s.charCodeAt(i)
  }
  const u16 = (n: number) => {
    view.setUint16(o, n, true)
    o += 2
  }
  const u32 = (n: number) => {
    view.setUint32(o, n, true)
    o += 4
  }
  str('RIFF')
  u32(riffSize)
  str('WAVE')
  str('fmt ')
  u32(fmtSize)
  u16(meta.format)
  u16(meta.channels)
  u32(meta.sampleRate)
  u32(byteRate)
  u16(blockAlign)
  u16(meta.bits)
  if (factSize) {
    str('fact')
    u32(factSize)
    u32(pcm.byteLength / blockAlign)
  }
  str('data')
  u32(pcm.byteLength)
  bytes.set(pcm, o)
  return new Blob([out], { type: 'audio/wav' })
}

const joinWavs = (buffers: ArrayBuffer[]) => {
  const parts = buffers.map(extractWavPcm)
  const meta = { format: parts[0].format, channels: parts[0].channels, sampleRate: parts[0].sampleRate, bits: parts[0].bits }
  for (const p of parts) {
    if (p.format !== meta.format || p.channels !== meta.channels || p.sampleRate !== meta.sampleRate || p.bits !== meta.bits) {
      throw new Error('wav mismatch')
    }
  }
  const gapBytes = Math.round(meta.sampleRate * 0.06) * (meta.bits / 8) * meta.channels
  const gap = new Uint8Array(gapBytes)
  const chunks = parts.flatMap((p, i) => (i ? [gap, p.pcm] : [p.pcm]))
  const pcm = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0))
  let w = 0
  for (const c of chunks) {
    pcm.set(c, w)
    w += c.byteLength
  }
  return writeWav(pcm, meta)
}

const loadWav = async (url: string) => {
  const hit = wavCache.get(url)
  if (hit) return hit
  const res = await fetch(url)
  if (!res.ok) throw new Error(`voice ${res.status}`)
  const buf = await res.arrayBuffer()
  wavCache.set(url, buf)
  return buf
}

const playJoined = async (urls: string[]) => {
  if (!voiceSupported()) return
  const gen = ++speakGen
  try {
    const bufs = await Promise.all(urls.map(loadWav))
    if (gen !== speakGen) return
    const blob = joinWavs(bufs)
    revokeScoreBlob()
    scoreBlobUrl = URL.createObjectURL(blob)
    const player = ensurePlayer()
    if (gen !== speakGen) return
    player.pause()
    player.src = scoreBlobUrl
    void player.play().catch(() => {})
  } catch {
    if (gen !== speakGen) return
    playSrc(urls[0])
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
