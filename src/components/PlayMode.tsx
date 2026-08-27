import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { findTeam, fullName, guessPrompt, roundTarget, speak, isCorrectGuess, insertHighScore, normalizeInitials, qualifiesForHighScore, INITIALS_LENGTH, type GameMode, type GuessTarget, type HighScore, type Round, type TimerSeconds } from '../lib/teams'
import { Logo } from './Logo'

type Phase = 'intro' | 'question' | 'reveal' | 'initials' | 'results'
type Kind = 'correct' | 'wrong' | 'timeout'
const REVEAL_MS = 1700
const TICK_MS = 100

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
  const [kind, setKind] = useState<Kind>('correct')
  const [results, setResults] = useState<boolean[]>([])
  const [initials, setInitials] = useState('')
  // Timestamp of the entry this run just added, so the board can highlight it.
  const [entryDate, setEntryDate] = useState<number | null>(null)

  const iv = useRef<number | undefined>(undefined)
  const tm = useRef<number | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)
  const initialsRef = useRef<HTMLInputElement>(null)
  const phaseRef = useRef<Phase>('intro')
  phaseRef.current = phase
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
      setRIdx(i)
      setGuess('')
      setTimeLeft(timer)
      setPhase('question')
      if (voice) speak(guessPrompt(roundTarget(deck[i], guessTarget)))
      const started = performance.now()
      iv.current = window.setInterval(() => {
        const t = timer - (performance.now() - started) / 1000
        if (t <= 0) {
          window.clearInterval(iv.current)
          setTimeLeft(0)
          revealRef.current('timeout')
        } else setTimeLeft(Math.round(t * 10) / 10)
      }, TICK_MS)
    },
    [timer, voice, guessTarget, deck],
  )

  const reveal = useCallback(
    (k: Kind) => {
      if (phaseRef.current !== 'question') return
      window.clearInterval(iv.current)
      const ok = k === 'correct'
      setKind(k)
      setPhase('reveal')
      setScore((s) => s + (ok ? 1 : 0))
      setResults((r) => [...r, ok])
      tm.current = window.setTimeout(() => {
        setRIdx((cur) => {
          const n = cur + 1
          if (n >= deck.length) finishRef.current()
          else beginRound(n)
          return cur
        })
      }, REVEAL_MS)
    },
    [deck.length, beginRound],
  )
  const revealRef = useRef(reveal)
  revealRef.current = reveal

  const finish = useCallback(() => {
    setPhase(qualifiesForHighScore(scoreRef.current, highScores) ? 'initials' : 'results')
  }, [highScores])
  const finishRef = useRef(finish)
  finishRef.current = finish

  // Auto-focus the guess input each round (type mode only).
  useEffect(() => {
    if (phase === 'question' && gameMode === 'type') inputRef.current?.focus()
    if (phase === 'initials') initialsRef.current?.focus()
  }, [phase, rIdx, gameMode])

  const submitInitials = (e: FormEvent) => {
    e.preventDefault()
    const ini = normalizeInitials(initials)
    if (ini.length !== INITIALS_LENGTH) return
    const entry: HighScore = { initials: ini, score: scoreRef.current, total: deck.length, date: Date.now() }
    onHighScores(insertHighScore(highScores, entry))
    setEntryDate(entry.date)
    setPhase('results')
  }

  const restart = () => {
    clearTimers()
    setScore(0)
    setRIdx(0)
    setResults([])
    setInitials('')
    setEntryDate(null)
    setGuess('')
    setPhase('intro')
  }
  const quit = () => {
    clearTimers()
    if (voice) window.speechSynthesis?.cancel()
    onQuit()
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (phase !== 'question' || !guess.trim()) return
    const t = findTeam(target === 'colors' ? deck[rIdx].c : deck[rIdx].o)!
    reveal(isCorrectGuess(guess, t) ? 'correct' : 'wrong')
  }

  // The intro promises what the deck actually asks, which may be one mode or both.
  const targets = new Set(deck.map((r) => roundTarget(r, guessTarget)))
  const introSub = targets.size > 1
    ? 'Some rounds want the logo’s team, some want whose colors it wears. Always name a team.'
    : targets.has('colors')
      ? 'Ignore the logo. Name the team whose colors it wears.'
      : 'Ignore the colors. Name the team behind the logo.'

  const round = deck[rIdx]
  const target: GuessTarget = round ? roundTarget(round, guessTarget) : guessTarget
  const ot = round ? findTeam(round.o)! : null
  const ct = round ? findTeam(round.c)! : null

  return (
    <div className="play">
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
          <button className="btn-begin" onClick={() => beginRound(0)}>
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
              <div>SCORE {score}</div>
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
              <Logo team={ot} palette={ct.palette} perm={round.v} />
            </div>
          </div>
          <div className="prompt">{target === 'colors' ? "WHICH TEAM'S COLORS?" : 'WHOSE LOGO IS THIS?'}</div>
          {gameMode === 'type' ? (
            <form className="guess-form" onSubmit={submit}>
              <input
                ref={inputRef}
                className="guess-input"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="Type the team…"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="go"
                aria-label="Your guess"
              />
              <button type="submit" className="btn-submit">
                SUBMIT
              </button>
            </form>
          ) : (
            <div className="host">
              <div className="host-hint">Shout the team — the host taps the verdict</div>
              <div className="host-row">
                <button className="btn-correct" onClick={() => reveal('correct')}>
                  ✓ CORRECT
                </button>
                <button className="btn-wrong" onClick={() => reveal('wrong')}>
                  ✕ INCORRECT
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'reveal' && ot && ct && (
        <div className="reveal pop">
          <div className={`reveal-icon k-${kind}`}>{kind === 'correct' ? '✓' : kind === 'wrong' ? '✕' : '!'}</div>
          <div className={`reveal-title k-${kind}`}>{kind === 'correct' ? 'CORRECT' : kind === 'wrong' ? 'NOT QUITE' : "TIME'S UP"}</div>
          <div className="reveal-logo">
            <Logo team={target === 'colors' ? ct : ot} />
          </div>
          <div className="reveal-name">{fullName(target === 'colors' ? ct : ot)}</div>
          <div className="reveal-note">
            {target === 'colors' ? `colors worn by the ${fullName(ot)} logo` : `wearing ${fullName(ct)} colors`}
          </div>
          {kind === 'correct' && <div className="plus-one">+1</div>}
        </div>
      )}

      {phase === 'initials' && (
        <form className="initials rise" onSubmit={submitInitials}>
          <div className="new-high">NEW HIGH SCORE</div>
          <div className="final-score">
            {score} / {deck.length}
          </div>
          <label className="final-label" htmlFor="initials">ENTER YOUR INITIALS</label>
          <input
            id="initials"
            ref={initialsRef}
            className="initials-input"
            value={initials}
            onChange={(e) => setInitials(normalizeInitials(e.target.value))}
            maxLength={INITIALS_LENGTH}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder={'A'.repeat(INITIALS_LENGTH)}
            aria-describedby="initials-hint"
          />
          <div id="initials-hint" className="intro-sub">{INITIALS_LENGTH} letters or numbers</div>
          <button type="submit" className="btn-again" disabled={initials.length !== INITIALS_LENGTH}>
            SAVE SCORE
          </button>
        </form>
      )}

      {phase === 'results' && (
        <div className="results rise">
          <div className="final-label">FINAL SCORE</div>
          <div className="final-score">
            {score} / {deck.length}
          </div>
          {entryDate != null && <div className="new-high">NEW HIGH SCORE</div>}
          {highScores.length > 0 && (
            <ol className="hs-board dark">
              {highScores.map((h, i) => (
                <li key={`${h.date}-${i}`} className={`hs-row${h.date === entryDate ? ' mine' : ''}`}>
                  <span className="hs-rank">{String(i + 1).padStart(2, '0')}</span>
                  <span className="hs-initials">{h.initials}</span>
                  <span className="hs-score">{h.score}</span>
                </li>
              ))}
            </ol>
          )}
          <div className="recap">
            {results.map((ok, i) => {
              const r = deck[i]
              if (!r) return null
              const o = findTeam(r.o)!
              const c = findTeam(r.c)!
              return (
                <div key={i} className="recap-row">
                  <div className={`recap-mark ${ok ? 'ok' : 'no'}`}>{ok ? '✓' : '✕'}</div>
                  <div className="recap-thumb">
                    <Logo team={o} palette={c.palette} perm={r.v} />
                  </div>
                  <div className="recap-name">{fullName(roundTarget(r, guessTarget) === 'colors' ? c : o)}</div>
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
