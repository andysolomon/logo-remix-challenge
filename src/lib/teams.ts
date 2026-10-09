import data from './teams.json'

export type League = 'PRO' | 'NBA' | 'MLB' | 'COL' | 'HS' | 'FOOD' | 'BRAND' | 'APP'

export interface LogoVariant {
  id: string
  label: string
  logo: string
  sourcePalette?: [string, string, string]
  unusedSourceSlots?: number[]
}

export interface Team {
  id: string
  league: League
  conference: string
  region: string
  name: string
  abbr: string
  /** Common nicknames and alternate abbreviations accepted in guesses and search. */
  aliases?: string[]
  palette: [string, string, string]
  /** Optional exact source colors when the artwork differs from the displayed palette. */
  sourcePalette?: [string, string, string]
  /** Source palette slots absent from the artwork. Two unused slots mark one-color art, which remixes onto a backdrop. */
  unusedSourceSlots?: number[]
  /** Path under public/ to the team's logo, e.g. "/logos/svg/nfl/kc.svg" (SVG preferred; PNGs fall back to canvas recolor). */
  logo: string
  alternateLogos?: LogoVariant[]
  /** The only available artwork spells the brand's name, so random decks use it as a color donor only. */
  showsName?: boolean
}

export interface Round {
  o: string
  c: string
  v: number
  /** Per-round guess target; falls back to the deck default when unset. */
  g?: GuessTarget
  /** Show league/conference hints for this round (e.g. "Logo: NFL · Colors: ACC"). */
  h?: boolean
  /** Stable alternate artwork id for the original team; unset uses its primary logo. */
  l?: string
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
export const SEED_DECK: Round[] = data.seed_deck.map((r) => ({ ...r, h: true }))
export const LS = data.localStorage_keys
/** Matches the baked score vocabulary (`you-scored-0..20` / `out-of-1..20`). */
export const MAX_DECK_ROUNDS = 20

const byId = new Map(TEAMS.map((t) => [t.id, t]))
export const findTeam = (id: string): Team | undefined => byId.get(id)
// Conference entries carry an empty name; trim keeps their display clean.
export const fullName = (t: Team) => `${t.region} ${t.name}`.trim()

export const logoVariants = (team: Team): LogoVariant[] => [
  { id: 'primary', label: 'Primary', logo: team.logo, sourcePalette: team.sourcePalette, unusedSourceSlots: team.unusedSourceSlots },
  ...(team.alternateLogos ?? []),
]

/** Resolve artwork only: team identity, donor palette and guessing answers stay the same. */
export function withLogoVariant(team: Team, id?: string): Team {
  const variant = team.alternateLogos?.find((v) => v.id === id)
  return variant ? { ...team, logo: variant.logo, sourcePalette: variant.sourcePalette ?? team.palette, unusedSourceSlots: variant.unusedSourceSlots } : team
}

export function nextLogoVariant(team: Team, current?: string): string | undefined {
  const variants = logoVariants(team)
  const at = Math.max(0, variants.findIndex((v) => v.id === (current ?? 'primary')))
  const next = variants[(at + 1) % variants.length].id
  return next === 'primary' ? undefined : next
}

export const norm = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')

export function isCorrectGuess(guess: string, team: Team): boolean {
  const g = norm(guess)
  if (!g) return false
  return [fullName(team), team.region, team.name, team.abbr, ...(team.aliases ?? [])].map(norm).includes(g)
}

/**
 * Autocomplete candidates for a typed guess: name-start matches first, then
 * anywhere-matches, so "mia" offers Miami before Miami-adjacent spellings.
 * Needs two characters so the list doesn't fire on the first keystroke.
 */
export function suggestTeams(query: string, limit = 6): Team[] {
  const q = norm(query)
  if (q.length < 2) return []
  const starts: Team[] = []
  const inside: Team[] = []
  for (const t of TEAMS) {
    const keys = [fullName(t), t.region, t.name, t.abbr, ...(t.aliases ?? [])].map(norm)
    if (keys.some((k) => k.startsWith(q))) starts.push(t)
    else if (keys.some((k) => k.includes(q))) inside.push(t)
  }
  return [...starts, ...inside].slice(0, limit)
}

export function filterTeams(league: League, conference: string, query: string): Team[] {
  const q = norm(query)
  return TEAMS.filter(
    (t) =>
      t.league === league &&
      (conference === 'All' || t.conference === conference) &&
      (!q || [fullName(t), t.abbr, ...(t.aliases ?? [])].some((name) => norm(name).includes(q))),
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
const storedInteger = (value: string | null) =>
  value !== null && /^(0|[1-9]\d*)$/.test(value) ? Number(value) : NaN

export function deckFromStorage(value: string | null): Round[] {
  try {
    const d = JSON.parse(value ?? 'null')
    if (Array.isArray(d) && d.every(isRound)) return normalizeDeck(d)
  } catch {
    /* ignore */
  }
  return normalizeDeck(SEED_DECK)
}
export const loadDeck = (): Round[] => deckFromStorage(safeGet(LS.deck))
export const saveDeck = (d: Round[]) => safeSet(LS.deck, JSON.stringify(normalizeDeck(d)))

export function loadTimer(): TimerSeconds {
  const t = storedInteger(safeGet(LS.timer))
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

const isSafeNonNegInt = (n: unknown, max = Number.MAX_SAFE_INTEGER): n is number =>
  typeof n === 'number' &&
  Number.isFinite(n) &&
  Number.isInteger(n) &&
  Number.isSafeInteger(n) &&
  n >= 0 &&
  n <= max

const isValidInitials = (initials: unknown): initials is string =>
  typeof initials === 'string' &&
  (initials === LEGACY_INITIALS ||
    (initials.length === INITIALS_LENGTH &&
      [...initials].every((ch) => INITIALS_ALPHABET.includes(ch))))

const isHighScore = (h: unknown): h is HighScore => {
  if (typeof h !== 'object' || h === null) return false
  const { initials, score, total, date } = h as HighScore
  return (
    isValidInitials(initials) &&
    isSafeNonNegInt(score, MAX_DECK_ROUNDS) &&
    isSafeNonNegInt(total, MAX_DECK_ROUNDS) &&
    total > 0 &&
    score <= total &&
    isSafeNonNegInt(date)
  )
}

export function loadHighScores(): HighScore[] {
  try {
    const list = JSON.parse(safeGet(LS.highScores) ?? 'null')
    if (Array.isArray(list)) return rankHighScores(list.filter(isHighScore))
  } catch {
    /* ignore */
  }
  // Migrate the pre-leaderboard single best score so it is not lost.
  const legacy = storedInteger(safeGet(LS.highScore))
  return legacy >= 1 && legacy <= MAX_DECK_ROUNDS
    ? [{ initials: LEGACY_INITIALS, score: legacy, total: legacy, date: 0 }]
    : []
}
export const saveHighScores = (list: HighScore[]) =>
  safeSet(LS.highScores, JSON.stringify(rankHighScores(list.filter(isHighScore))))

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
  return isGuessTarget(t) ? t : 'both'
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
/** What one entry of a collection is called in search and result labels. */
export const entryNoun = (league: League) => (league === 'APP' ? 'app' : league === 'FOOD' || league === 'BRAND' ? 'brand' : 'team')
/** Where a team plays: the league label for pro teams and fast food, the conference for college and high school, the type for brands and apps. */
export const teamHint = (t: Team) =>
  t.league === 'COL' || t.league === 'HS'
    ? t.conference
    : t.league === 'BRAND'
      ? `${t.conference} brand`
      : t.league === 'APP'
        ? `${t.conference} app`
        : LEAGUES[t.league].label
/** Hint lines for a round, one for the logo team and one for the colors team. */
export const roundHints = (r: Round): [string, string] => [
  `Logo: ${teamHint(findTeam(r.o)!)}`,
  `Colors: ${teamHint(findTeam(r.c)!)}`,
]

// ---------- Random deck generator ----------
/** A selectable slice of teams: a pro league, one college conference, or a high-school district. */
export interface TeamPool {
  id: string
  label: string
  match: (t: Team) => boolean
}
export const TEAM_POOLS: TeamPool[] = [
  { id: 'NFL', label: LEAGUES.PRO.label, match: (t) => t.league === 'PRO' },
  { id: 'NBA', label: LEAGUES.NBA.label, match: (t) => t.league === 'NBA' },
  { id: 'MLB', label: LEAGUES.MLB.label, match: (t) => t.league === 'MLB' },
  { id: 'Fast Food', label: LEAGUES.FOOD.label, match: (t) => t.league === 'FOOD' },
  { id: 'Brands', label: LEAGUES.BRAND.label, match: (t) => t.league === 'BRAND' },
  { id: 'Apps', label: LEAGUES.APP.label, match: (t) => t.league === 'APP' },
  ...LEAGUES.COL.conferences.map((c) => ({ id: c, label: c, match: (t: Team) => t.league === 'COL' && t.conference === c })),
  ...LEAGUES.HS.conferences.map((c) => ({ id: c, label: c, match: (t: Team) => t.league === 'HS' && t.conference === c })),
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

/** Pool members whose artwork can be a round's logo; name-spelling marks only donate colors. */
export const logoPoolTeams = (ids: string[]) => poolTeams(ids).filter((t) => !t.showsName)

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]
const samePalette = (a: Team, b: Team) => a.palette.join() === b.palette.join()

const channelLuminance = (hex: string) => {
  const values = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = values.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrastRatio = (a: string, b: string) => {
  const l1 = channelLuminance(a)
  const l2 = channelLuminance(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

const palettePairs = [[0, 1], [0, 2], [1, 2]] as const
const DETAIL_CONTRAST = 1.5
const LIGHT_SURFACE = '#FFFFFF'
const SURFACE_CONTRAST = 1.5
const ARTWORK_ROLES = [0, 1] as const

/** For one-color artwork: the only palette slot it uses and the unused slot painted behind it. */
const oneColorSlots = (original: Team): { logo: number; backdrop: number } | undefined => {
  const unused = original.unusedSourceSlots ?? []
  if (unused.length !== 2) return undefined
  return { logo: [0, 1, 2].find((slot) => !unused.includes(slot))!, backdrop: Math.min(...unused) }
}

/**
 * Source slot painted behind one-color artwork. A remix of a logo that uses a single palette slot
 * would show just one of the color team's colors (often a lone black or solid silhouette), so it
 * sits on a backdrop in another of that team's colors. Undefined when the artwork shows two or more.
 */
export const backdropSlot = (original: Team): number | undefined => oneColorSlots(original)?.backdrop

type RemixRoles = {
  /** Slot pairs that must stay visibly distinct after recoloring. */
  criticalPairs: readonly (readonly [number, number])[]
  /** Slots drawn directly on the light canvas, most important first. */
  canvasRoles: readonly number[]
  /** Canvas roles an exact permutation must keep readable. */
  surfaceRoles: readonly number[]
}

const remixRoles = (original: Team): RemixRoles => {
  const oneColor = oneColorSlots(original)
  if (oneColor) {
    // The artwork sits wholly on its backdrop, so only the logo/backdrop and backdrop/canvas edges show.
    const { logo, backdrop } = oneColor
    return { criticalPairs: [[logo, backdrop]], canvasRoles: [backdrop], surfaceRoles: [backdrop] }
  }
  const source = original.sourcePalette ?? original.palette
  return {
    criticalPairs: palettePairs.filter(([a, b]) => contrastRatio(source[a], source[b]) >= DETAIL_CONTRAST),
    canvasRoles: ARTWORK_ROLES,
    surfaceRoles: ARTWORK_ROLES.filter((role) => contrastRatio(source[role], LIGHT_SURFACE) >= SURFACE_CONTRAST),
  }
}

type PermutationScore = {
  weakestDetail: number
  surface: number[]
}

const permutationScore = (
  targetPalette: readonly string[],
  permutation: readonly number[],
  { criticalPairs, canvasRoles }: RemixRoles,
): PermutationScore => ({
  weakestDetail: criticalPairs.length
    ? Math.min(...criticalPairs.map(([a, b]) => contrastRatio(targetPalette[permutation[a]], targetPalette[permutation[b]])))
    : Infinity,
  surface: canvasRoles.map((role) => contrastRatio(targetPalette[permutation[role]], LIGHT_SURFACE)),
})

/** Critical detail first, then each canvas role's light-surface contrast in order. */
const betterScore = (a: PermutationScore, b: PermutationScore): boolean => {
  if (a.weakestDetail !== b.weakestDetail) return a.weakestDetail > b.weakestDetail
  const at = a.surface.findIndex((contrast, i) => contrast !== b.surface[i])
  return at >= 0 && a.surface[at] > b.surface[at]
}

const exactContrastSafePermutations = (original: Team, targetPalette: readonly string[]): number[] => {
  if (targetPalette.length < 3) return [0]
  const { criticalPairs, surfaceRoles } = remixRoles(original)
  return PERMS.map((_, i) => i).filter((i) => {
    const p = PERMS[i]
    return criticalPairs.every(([a, b]) => contrastRatio(targetPalette[p[a]], targetPalette[p[b]]) >= DETAIL_CONTRAST) &&
      surfaceRoles.every((role) => contrastRatio(targetPalette[p[role]], LIGHT_SURFACE) >= SURFACE_CONTRAST)
  })
}

const hexFromChannels = (channels: readonly number[]) =>
  '#' + channels.map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase()

/** Preserve hue while applying the least whole-channel darkening needed on the light canvas. */
const darkenForLightSurface = (hex: string): string => {
  if (contrastRatio(hex, LIGHT_SURFACE) >= SURFACE_CONTRAST) return hex
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  let low = 0
  let high = 255
  let best = '#000000'
  while (low <= high) {
    const factor = Math.floor((low + high) / 2)
    const candidate = hexFromChannels(channels.map((channel) => Math.round(channel * factor / 255)))
    if (contrastRatio(candidate, LIGHT_SURFACE) >= SURFACE_CONTRAST) {
      best = candidate
      low = factor + 1
    } else {
      high = factor - 1
    }
  }
  return best
}

/**
 * Permutations that keep visibly separate source colors distinct and keep source artwork roles that
 * were readable on the light canvas readable after recoloring. One-color artwork instead needs its
 * logo distinct from its backdrop and the backdrop readable on the canvas. If no perfect mapping
 * exists, retain a deterministic fallback that preserves critical artwork detail first, then
 * prioritizes light-surface contrast of the canvas roles (primary then secondary, or the backdrop).
 * The fallback's canvas roles are restyled by `resolveRemixTargetColors` below.
 */
export function contrastSafePermutations(original: Team, targetPalette: readonly string[]): number[] {
  const safe = exactContrastSafePermutations(original, targetPalette)
  if (safe.length) return safe

  const roles = remixRoles(original)
  let fallback = 0
  let best = permutationScore(targetPalette, PERMS[0], roles)
  for (let i = 1; i < PERMS.length; i++) {
    const score = permutationScore(targetPalette, PERMS[i], roles)
    if (betterScore(score, best)) {
      best = score
      fallback = i
    }
  }
  return [fallback]
}

/** Resolve an arbitrary/stale permutation index to a contrast-safe permutation for this remix. */
export function contrastSafePermutation(original: Team, targetPalette: readonly string[], requested: number): number {
  const safe = contrastSafePermutations(original, targetPalette)
  const n = Number.isFinite(requested) ? Math.trunc(requested) : 0
  const normalized = ((n % PERMS.length) + PERMS.length) % PERMS.length
  if (safe.includes(normalized)) return normalized
  return safe[((normalized % safe.length) + safe.length) % safe.length]
}

/**
 * Resolve target colors by source slot. Exact safe mappings retain the team palette verbatim. When
 * no exact permutation exists, only the roles drawn on the light canvas are darkened: source artwork
 * roles 0/1, with source slot 2 kept as the target palette's exact light/negative-space color, or a
 * one-color logo's backdrop, with the logo's own color kept exact.
 */
export function resolveRemixTargetColors(
  original: Team,
  targetPalette: readonly string[],
  requested: number,
): [string, string, string] {
  const permutation = contrastSafePermutation(original, targetPalette, requested)
  const p = PERMS[permutation]
  const mapped: [string, string, string] = [
    targetPalette[p[0]] ?? original.palette[0],
    targetPalette[p[1]] ?? original.palette[1],
    targetPalette[p[2]] ?? original.palette[2],
  ]
  if (exactContrastSafePermutations(original, targetPalette).length) return mapped
  for (const role of remixRoles(original).canvasRoles) mapped[role] = darkenForLightSurface(mapped[role])
  return mapped
}

export function nextContrastSafePermutation(original: Team, targetPalette: readonly string[], current: number): number {
  const safe = contrastSafePermutations(original, targetPalette)
  const at = safe.indexOf(contrastSafePermutation(original, targetPalette, current))
  return safe[(at + 1) % safe.length]
}

function isRound(r: unknown): r is Round {
  if (typeof r !== 'object' || r === null) return false
  const round = r as Round
  return !!findTeam(round.o) && !!findTeam(round.c) && Number.isFinite(round.v) &&
    (round.g === undefined || isGuessTarget(round.g)) &&
    (round.h === undefined || typeof round.h === 'boolean') &&
    (round.l === undefined || typeof round.l === 'string')
}

export function normalizeRound(round: Round): Round {
  const original = findTeam(round.o)
  const colors = findTeam(round.c)
  if (!original || !colors) return round
  const { l, ...base } = round
  const validLogo = original.alternateLogos?.some((variant) => variant.id === l)
  return { ...base, ...(validLogo ? { l } : {}), v: contrastSafePermutation(withLogoVariant(original, l), colors.palette, round.v) }
}

export const normalizeDeck = (deck: Round[]) => deck.slice(0, MAX_DECK_ROUNDS).map(normalizeRound)

export interface DeckUndoSnapshot {
  deck: Round[]
  label: string
}

export type DeckUndoAction =
  | { type: 'destructive'; deck: Round[]; label: string }
  | { type: 'ordinary' | 'deck-wide' | 'restored' }

/** One-shot destructive deck history. Every other deck mutation invalidates the snapshot. */
export function deckUndoReducer(state: DeckUndoSnapshot | null, action: DeckUndoAction): DeckUndoSnapshot | null {
  if (action.type === 'destructive') return { deck: normalizeDeck(action.deck), label: action.label }
  return state === null ? state : null
}

/**
 * Build random remix rounds from the chosen pools. Logos that spell the brand's name only donate
 * colors. Never pairs a team with itself or with a
 * look-alike palette, never repeats a pairing already in `existing`, and spreads originals out
 * so the same logo does not show up twice until every candidate has been used.
 * May return fewer rounds than asked for when the pools are too small.
 */
export function randomDeck(opts: RandomDeckOptions, existing: Round[] = []): Round[] {
  const logos = logoPoolTeams(opts.logoPools)
  const colors = poolTeams(opts.colorPools)
  if (!logos.length || !colors.length) return []
  const seen = new Set(existing.map((r) => `${r.o}|${r.c}`))
  const out: Round[] = []
  let fresh = [...logos]
  const capacity = Math.max(0, MAX_DECK_ROUNDS - existing.length)
  const requested = Math.min(capacity, Math.max(0, Math.floor(opts.rounds)))
  for (let attempt = 0; out.length < requested && attempt < requested * 40; attempt++) {
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
    const safePerms = contrastSafePermutations(o, c.palette)
    out.push({ o: o.id, c: c.id, v: pick(safePerms), g, h: opts.hints || undefined })
  }
  return out
}
