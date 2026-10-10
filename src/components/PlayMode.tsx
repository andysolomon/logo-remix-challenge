import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { findTeam, formatScore, fullName, roundCredit, roundHints, spokenScore, roundTarget, speak, speakScore, stopSpeak, isCorrectGuess, insertHighScore, qualifiesForHighScore, INITIALS_LENGTH, INITIALS_ALPHABET, type GameMode, type GuessTarget, type HighScore, type Round, type TimerSeconds } from '../lib/teams'
import { Logo } from './Logo'
import { GuessInput } from './GuessInput'

type Phase = 'intro' | 'question' | 'reveal' | 'initials' | 'results'
// 'half': a "both" round with exactly one source named, worth half a point.
type Kind = 'correct' | 'half' | 'wrong' | 'timeout'
const REVEAL_MS = 1700
const REVEAL_TITLE: Record<Kind, string> = { correct: 'Correct', half: 'Half right', wrong: 'Not quite', timeout: "Time's up" }
const REVEAL_ICON: Record<Kind, string> = { correct: '✓', half: '½', wrong: '✕', timeout: '!' }
const TICK_MS = 100
/** Mouse/trackpad devices get the caret handed to them; touch devices don't. */
const prefersAutoFocus = () =>
  typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? true
    : window.matchMedia('(hover: hover) and (pointer: fine)').matches

interface Props {
  deck: Round[]
  timer: TimerSeconds
  gameMode: GameMode
  guessTarget: GuessTarget
  voice: boolean
  highScores: HighScore[]
  onHighScores: (list: HighScore[]) => void
  onQuit: () => void
}

export function PlayMode({ deck, timer, gameMode, guessTarget, voice, highScores, onHighScores, onQuit }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [rIdx, setRIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState<number>(timer)
  const [guess, setGuess] = useState('')
  // Second answer for "both" rounds: the team whose colors the logo wears.
  const [guess2, setGuess2] = useState('')
  // Per-half verdict for "both" rounds, shown on the reveal.
  const [parts, setParts] = useState<[boolean, boolean] | null>(null)
  // "Both" rounds: verdict on the logo answer once the player presses Enter on it, before moving on.
  const [logoChecked, setLogoChecked] = useState<boolean | null>(null)
  // Host mode, "both" rounds: the host's verdict on each half before locking the round in.
  const [hostParts, setHostParts] = useState<[boolean | null, boolean | null]>([null, null])
  const input2Ref = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<Kind>('correct')
  const [credit, setCredit] = useState(0)
  // Points earned per round played: 1, ½ or 0.
  const [results, setResults] = useState<number[]>([])
  // Slot-machine initials: one alphabet index per reel, plus which reel has focus.
  const [reels, setReels] = useState<number[]>(() => Array(INITIALS_LENGTH).fill(0))
  const [reelIdx, setReelIdx] = useState(0)
  // Timestamp of the entry this run just added, so the board can highlight it.
  const [entryDate, setEntryDate] = useState<number | null>(null)

  const iv = useRef<number | undefined>(undefined)
  const tm = useRef<number | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)
  const initialsRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef<Phase>('intro')
  phaseRef.current = phase
  const rIdxRef = useRef(0)
  rIdxRef.current = rIdx
  const scoreRef = useRef(0)
  scoreRef.current = score

  const clearTimers = () => {
    window.clearInterval(iv.current)
    window.clearTimeout(tm.current)
  }
  useEffect(() => clearTimers, [])

  const beginRound = useCallback(
    (i: number) => {
      window.clearInterval(iv.current)
      phaseRef.current = 'question'
      rIdxRef.current = i
      setRIdx(i)
      setGuess('')
      setGuess2('')
      setParts(null)
      setLogoChecked(null)
      setHostParts([null, null])
      setTimeLeft(timer)
      setPhase('question')
      if (voice) speak(roundTarget(deck[i], guessTarget))
      const started = performance.now()
      iv.current = window.setInterval(() => {
        const t = timer - (performance.now() - started) / 1000
        if (t <= 0) {
          window.clearInterval(iv.current)
          setTimeLeft(0)
          timeUpRef.current()
        } else setTimeLeft(Math.round(t * 10) / 10)
      }, TICK_MS)
    },
    [timer, voice, guessTarget, deck],
  )

  const reveal = useCallback(
    (k: Kind, credit: number) => {
      if (phaseRef.current !== 'question') return
      phaseRef.current = 'reveal'
      window.clearInterval(iv.current)
      setKind(k)
      setCredit(credit)
      setPhase('reveal')
      setScore((s) => s + credit)
      setResults((r) => [...r, credit])
      if (voice) speak(k === 'half' ? 'wrong' : k)
      const next = rIdxRef.current + 1
      tm.current = window.setTimeout(() => {
        if (next >= deck.length) finishRef.current()
        else beginRound(next)
      }, REVEAL_MS)
    },
    [deck.length, beginRound, voice],
  )

  const finish = useCallback(() => {
    if (phaseRef.current !== 'reveal') return
    if (voice) speakScore(scoreRef.current, deck.length)
    const nextPhase = qualifiesForHighScore(scoreRef.current, highScores) ? 'initials' : 'results'
    phaseRef.current = nextPhase
    setPhase(nextPhase)
  }, [highScores, voice, deck.length])
  const finishRef = useRef(finish)
  finishRef.current = finish

  // Auto-focus the guess input each round (type mode, pointer devices only): on a
  // phone that would throw the on-screen keyboard over the logo before it's seen,
  // so touch players tap the field when they're ready to answer.
  useEffect(() => {
    if (phase === 'question' && gameMode === 'type' && prefersAutoFocus()) inputRef.current?.focus()
    if (phase === 'initials') initialsRef.current?.focus()
  }, [phase, rIdx, gameMode])

  const spinReel = (i: number, dir: 1 | -1) =>
    setReels((r) => r.map((v, j) => (j === i ? (v + dir + INITIALS_ALPHABET.length) % INITIALS_ALPHABET.length : v)))
  const setReel = (i: number, ch: string) => {
    const v = INITIALS_ALPHABET.indexOf(ch.toUpperCase())
    if (v < 0) return false
    setReels((r) => r.map((x, j) => (j === i ? v : x)))
    return true
  }
  const onReelsKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') saveInitials()
    else if (e.key === 'ArrowUp') spinReel(reelIdx, 1)
    else if (e.key === 'ArrowDown') spinReel(reelIdx, -1)
    else if (e.key === 'ArrowLeft') setReelIdx((i) => Math.max(0, i - 1))
    else if (e.key === 'ArrowRight') setReelIdx((i) => Math.min(INITIALS_LENGTH - 1, i + 1))
    else if (e.key === 'Backspace') setReelIdx((i) => Math.max(0, i - 1))
    else if (e.key.length === 1 && setReel(reelIdx, e.key)) setReelIdx((i) => Math.min(INITIALS_LENGTH - 1, i + 1))
    else return
    e.preventDefault()
  }

  const submitInitials = (e: FormEvent) => {
    e.preventDefault()
    saveInitials()
  }
  const saveInitials = () => {
    if (phaseRef.current !== 'initials') return
    const ini = reels.map((v) => INITIALS_ALPHABET[v]).join('')
    const entry: HighScore = { initials: ini, score: scoreRef.current, total: deck.length, date: Date.now() }
    onHighScores(insertHighScore(highScores, entry))
    setEntryDate(entry.date)
    phaseRef.current = 'results'
    setPhase('results')
  }

  const restart = () => {
    clearTimers()
    if (voice) stopSpeak()
    setScore(0)
    setRIdx(0)
    setResults([])
    setReels(Array(INITIALS_LENGTH).fill(0))
    setReelIdx(0)
    setEntryDate(null)
    setGuess('')
    phaseRef.current = 'intro'
    setPhase('intro')
  }
  const quit = () => {
    clearTimers()
    if (voice) stopSpeak()
    onQuit()
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (phaseRef.current !== 'question') return
    const o = findTeam(deck[rIdx].o)!
    const c = findTeam(deck[rIdx].c)!
    if (target === 'both') {
      if (!guess.trim() && !guess2.trim()) return
      revealBoth(logoChecked ?? isCorrectGuess(guess, o), isCorrectGuess(guess2, c))
      return
    }
    if (!guess.trim()) return
    revealSingle(isCorrectGuess(guess, target === 'colors' ? c : o))
  }

  const revealSingle = (ok: boolean) => reveal(ok ? 'correct' : 'wrong', ok ? 1 : 0)
  // "Both" rounds score half a point per half; one right is a "half" verdict.
  const revealBoth = (logoOk: boolean, colorsOk: boolean) => {
    const pts = roundCredit('both', logoOk, colorsOk)
    setParts([logoOk, colorsOk])
    reveal(pts === 1 ? 'correct' : pts > 0 ? 'half' : 'wrong', pts)
  }

  // Time ran out. On a "both" round, a half that was already locked in still
  // counts: the logo answer once Enter graded it, or a half the host marked correct.
  const timeUp = () => {
    if (phaseRef.current !== 'question') return
    if (target !== 'both') {
      reveal('timeout', 0)
      return
    }
    const logoOk = (gameMode === 'host' ? hostParts[0] : logoChecked) === true
    const colorsOk = gameMode === 'host' && hostParts[1] === true
    const graded = gameMode === 'host' ? hostParts.some((v) => v !== null) : logoChecked !== null
    if (graded) setParts([logoOk, colorsOk])
    reveal('timeout', roundCredit('both', logoOk, colorsOk))
  }
  const timeUpRef = useRef(timeUp)
  timeUpRef.current = timeUp

  // Host mode, "both" rounds: each half gets its own verdict, worth half a point.
  const setHostPart = (i: 0 | 1, ok: boolean) =>
    setHostParts((hp) => (i === 0 ? [ok, hp[1]] : [hp[0], ok]))
  const lockHostVerdict = () => {
    if (phaseRef.current !== 'question') return
    const [a, b] = hostParts
    if (a === null || b === null) return
    revealBoth(a, b)
  }

  // Enter on the logo field grades that answer, locks it in, and hands focus to the colors field.
  const checkLogo = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (phaseRef.current !== 'question' || logoChecked != null) return
    if (!guess.trim()) return
    setLogoChecked(isCorrectGuess(guess, findTeam(deck[rIdx].o)!))
    input2Ref.current?.focus()
  }

  const startGame = () => {
    if (phaseRef.current !== 'intro') return
    beginRound(0)
  }

  // The intro promises what the deck actually asks, which may be one mode or both.
  const targets = new Set(deck.map((r) => roundTarget(r, guessTarget)))
  const introSub = targets.size > 1
    ? 'Rounds vary: some want the name behind the logo, some want whose colors it wears, some want both. Read each prompt.'
    : targets.has('both')
      ? 'Name the team or brand behind the logo and whose colors it wears. Each one you get is worth half a point.'
      : targets.has('colors')
        ? 'Ignore the logo. Name the team or brand whose colors it wears.'
        : 'Ignore the colors. Name the team or brand behind the logo.'

  const round = deck[rIdx]
  const target: GuessTarget = round ? roundTarget(round, guessTarget) : guessTarget
  const ot = round ? findTeam(round.o)! : null
  const ct = round ? findTeam(round.c)! : null
  const questionLocked = phase !== 'question'
  const promptStatus =
    target === 'both' ? 'Name the logo and color sources.' : target === 'colors' ? 'Name the color source.' : 'Name the logo source.'
  const revealStatus =
    phase === 'reveal' && ot && ct
      ? `${REVEAL_TITLE[kind]}. ${
          target === 'both'
            ? `Logo: ${fullName(ot)}. Colors: ${fullName(ct)}.`
            : `${fullName(target === 'colors' ? ct : ot)}.`
        }${credit >= 1 ? ' Plus one.' : credit > 0 ? ' Plus a half.' : ''}`
      : ''
  const liveStatus = phase === 'question' && ot ? `Round ${rIdx + 1} of ${deck.length}. Score ${spokenScore(score)}. ${promptStatus}` : revealStatus

  return (
    <div className="play">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveStatus}
      </div>
      {phase === 'intro' && (
        <div className="intro rise">
          <div className="intro-title">
            LOGO REMIX
            <br />
            CHALLENGE
          </div>
          <div className="intro-meta">
            {deck.length} ROUND{deck.length === 1 ? '' : 'S'} · {timer} SECONDS EACH
          </div>
          <div className="intro-sub">{introSub}</div>
          <button className="btn-begin" onClick={startGame}>
            START
          </button>
          <button className="btn-text" onClick={quit}>
            ← Back to deck
          </button>
        </div>
      )}

      {phase === 'question' && ot && ct && (
        <div className="question">
          <div className="q-top">
            <div>
              ROUND {rIdx + 1} / {deck.length}
            </div>
            <div className="q-right">
              <div>SCORE {formatScore(score)}</div>
              <button className="quit-btn" aria-label="End game" onClick={quit}>
                ✕
              </button>
            </div>
          </div>
          <div className={`timer${timeLeft <= 5 ? ' urgent' : ''}`}>
            <div className="timer-num">{Math.ceil(timeLeft)}</div>
            <div className="timer-bar">
              <div className="timer-fill" style={{ width: `${Math.max(0, (timeLeft / timer) * 100)}%` }} />
            </div>
          </div>
          <div className="q-hero">
            <div key={rIdx} className="q-logo pop-fast">
              <Logo team={ot} palette={ct.palette} perm={round.v} variantId={round.l} />
            </div>
          </div>
          <div className="prompt">{target === 'both' ? 'WHOSE LOGO · WHOSE COLORS?' : target === 'colors' ? 'WHOSE COLORS ARE THESE?' : 'WHOSE LOGO IS THIS?'}</div>
          {round.h && (
            <div className="hints" aria-label="Hints">
              {roundHints(round).map((h) => (
                <span key={h} className="hint-chip">{h}</span>
              ))}
            </div>
          )}
          {gameMode === 'type' ? (
            target === 'both' ? (
              <form className="guess-form both" onSubmit={submit}>
                <label className={`guess-field${logoChecked == null ? '' : logoChecked ? ' ok' : ' no'}`}>
                  <span className="guess-field-lb">LOGO</span>
                  <GuessInput
                    ref={inputRef}
                    value={guess}
                    onChange={setGuess}
                    onKeyDown={checkLogo}
                    readOnly={logoChecked != null}
                    placeholder="Team or brand behind the logo…"
                    enterKeyHint="next"
                    ariaLabel="Team or brand behind the logo"
                  />
                  <span className="guess-field-mark" aria-live="polite">
                    {logoChecked == null ? '' : logoChecked ? '✓' : '✕'}
                  </span>
                </label>
                <label className="guess-field">
                  <span className="guess-field-lb">COLORS</span>
                  <GuessInput
                    ref={input2Ref}
                    value={guess2}
                    onChange={setGuess2}
                    placeholder="Whose colors are these?"
                    enterKeyHint="go"
                    ariaLabel="Team or brand whose colors the logo wears"
                  />
                  <span className="guess-field-mark" aria-hidden="true" />
                </label>
                <button type="submit" className="btn-submit" disabled={questionLocked}>
                  SUBMIT
                </button>
              </form>
            ) : (
              <form className="guess-form" onSubmit={submit}>
                <GuessInput
                  ref={inputRef}
                  value={guess}
                  onChange={setGuess}
                  placeholder="Type the team or brand…"
                  enterKeyHint="go"
                  ariaLabel="Your guess"
                />
                <button type="submit" className="btn-submit" disabled={questionLocked}>
                  SUBMIT
                </button>
              </form>
            )
          ) : (
            <div className="host">
              {target === 'both' ? (
                <>
                  <div className="host-hint">Shout both names — the host grades each half</div>
                  {(['LOGO', 'COLORS'] as const).map((lb, i) => {
                    const v = hostParts[i]
                    const labelId = lb === 'LOGO' ? 'host-both-logo-label' : 'host-both-colors-label'
                    return (
                      <div key={lb} className="host-part" role="group" aria-labelledby={labelId}>
                        <div id={labelId} className="host-part-lb">{lb}</div>
                        <div className="host-row">
                          <button className={`btn-correct${v === false ? ' dim' : ''}`} aria-pressed={v === true} disabled={questionLocked} onClick={() => setHostPart(i as 0 | 1, true)}>
                            ✓ CORRECT
                          </button>
                          <button className={`btn-wrong${v === true ? ' dim' : ''}`} aria-pressed={v === false} disabled={questionLocked} onClick={() => setHostPart(i as 0 | 1, false)}>
                            ✕ INCORRECT
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  <button className="btn-submit host-lock" disabled={questionLocked || hostParts[0] === null || hostParts[1] === null} onClick={lockHostVerdict}>
                    LOCK IN
                  </button>
                </>
              ) : (
                <>
                  <div className="host-hint">Shout the name — the host taps the verdict</div>
                  <div className="host-row">
                    <button className="btn-correct" disabled={questionLocked} onClick={() => revealSingle(true)}>
                      ✓ CORRECT
                    </button>
                    <button className="btn-wrong" disabled={questionLocked} onClick={() => revealSingle(false)}>
                      ✕ INCORRECT
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {phase === 'reveal' && ot && ct && (
        <div className="reveal pop">
          <div className={`reveal-icon k-${kind}`}>{REVEAL_ICON[kind]}</div>
          <div className={`reveal-title k-${kind}`}>{REVEAL_TITLE[kind].toUpperCase()}</div>
          {target === 'both' ? (
            <div className="reveal-pair">
              {([[ot, 'LOGO'], [ct, 'COLORS']] as const).map(([t, lb], i) => (
                <div key={lb} className="reveal-part">
                  <div className="reveal-part-lb">{lb}</div>
                  <div className="reveal-logo">
                    <Logo team={t} variantId={i === 0 ? round?.l : undefined} />
                  </div>
                  <div className="reveal-name">{fullName(t)}</div>
                  {parts && <div className={`reveal-part-mark ${parts[i] ? 'ok' : 'no'}`}>{parts[i] ? '✓ got it' : '✕ missed'}</div>}
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="reveal-logo">
                <Logo team={target === 'colors' ? ct : ot} variantId={target === 'colors' ? undefined : round?.l} />
              </div>
              <div className="reveal-name">{fullName(target === 'colors' ? ct : ot)}</div>
              <div className="reveal-note">
                {target === 'colors' ? `colors worn by the ${fullName(ot)} logo` : `wearing ${fullName(ct)} colors`}
              </div>
            </>
          )}
          {credit > 0 && <div className={`plus-one${credit < 1 ? ' half' : ''}`}>+{formatScore(credit)}</div>}
        </div>
      )}

      {phase === 'initials' && (
        <form className="initials rise" onSubmit={submitInitials}>
          <div className="new-high">NEW HIGH SCORE</div>
          <div className="final-score">
            {formatScore(score)} / {deck.length}
          </div>
          <div id="initials-label" className="final-label">ENTER YOUR INITIALS</div>
          <div
            ref={initialsRef}
            className="reels"
            role="group"
            aria-labelledby="initials-label"
            aria-describedby="initials-hint"
            tabIndex={0}
            onKeyDown={onReelsKey}
          >
            {reels.map((v, i) => {
              const ch = INITIALS_ALPHABET[v]
              const prev = INITIALS_ALPHABET[(v - 1 + INITIALS_ALPHABET.length) % INITIALS_ALPHABET.length]
              const next = INITIALS_ALPHABET[(v + 1) % INITIALS_ALPHABET.length]
              return (
                <div key={i} className={`reel${i === reelIdx ? ' active' : ''}`} onPointerDown={() => setReelIdx(i)}>
                  <button type="button" className="reel-step" tabIndex={-1} aria-label={`Initial ${i + 1}: next letter`} onClick={() => spinReel(i, 1)}>
                    ▲
                  </button>
                  <div className="reel-window" aria-live={i === reelIdx ? 'polite' : undefined}>
                    <span className="reel-ghost" aria-hidden="true">{next}</span>
                    <span className="reel-letter">{ch}</span>
                    <span className="reel-ghost" aria-hidden="true">{prev}</span>
                  </div>
                  <button type="button" className="reel-step" tabIndex={-1} aria-label={`Initial ${i + 1}: previous letter`} onClick={() => spinReel(i, -1)}>
                    ▼
                  </button>
                </div>
              )
            })}
          </div>
          <div id="initials-hint" className="intro-sub">Tap ▲▼ or use arrow keys · type to jump · Enter to save</div>
          <button type="submit" className="btn-again">
            SAVE SCORE
          </button>
        </form>
      )}

      {phase === 'results' && (
        <div className="results rise">
          <div className="final-label">FINAL SCORE</div>
          <div className="final-score">
            {formatScore(score)} / {deck.length}
          </div>
          {entryDate != null && <div className="new-high">NEW HIGH SCORE</div>}
          {highScores.length > 0 && (
            <ol className="hs-board dark">
              {highScores.map((h, i) => (
                <li key={`${h.date}-${i}`} className={`hs-row${h.date === entryDate ? ' mine' : ''}`}>
                  <span className="hs-rank">{String(i + 1).padStart(2, '0')}</span>
                  <span className="hs-initials">{h.initials}</span>
                  <span className="hs-score">{formatScore(h.score)}</span>
                </li>
              ))}
            </ol>
          )}
          <div className="recap">
            {results.map((pts, i) => {
              const r = deck[i]
              if (!r) return null
              const o = findTeam(r.o)!
              const c = findTeam(r.c)!
              return (
                <div key={i} className="recap-row">
                  <div className={`recap-mark ${pts >= 1 ? 'ok' : pts > 0 ? 'half' : 'no'}`}>{pts >= 1 ? '✓' : pts > 0 ? '½' : '✕'}</div>
                  <div className="recap-thumb">
                    <Logo team={o} palette={c.palette} perm={r.v} variantId={r.l} />
                  </div>
                  <div className="recap-name">
                    {roundTarget(r, guessTarget) === 'both' ? `${fullName(o)} · ${fullName(c)}` : fullName(roundTarget(r, guessTarget) === 'colors' ? c : o)}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="results-actions">
            <button className="btn-again" onClick={restart}>
              PLAY AGAIN
            </button>
            <button className="btn-edit-game" onClick={quit}>
              EDIT GAME
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
