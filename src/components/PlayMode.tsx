import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { findTeam, fullName, isCorrectGuess, type GameMode, type Round, type TimerSeconds } from '../lib/teams'
import { Logo } from './Logo'

type Phase = 'intro' | 'question' | 'reveal' | 'results'
type Kind = 'correct' | 'wrong' | 'timeout'
const REVEAL_MS = 1700
const TICK_MS = 100

interface Props {
  deck: Round[]
  timer: TimerSeconds
  gameMode: GameMode
  highScore: number
  onHighScore: (n: number) => void
  onQuit: () => void
}

export function PlayMode({ deck, timer, gameMode, highScore, onHighScore, onQuit }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [rIdx, setRIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState<number>(timer)
  const [guess, setGuess] = useState('')
  const [kind, setKind] = useState<Kind>('correct')
  const [results, setResults] = useState<boolean[]>([])
  const [newHigh, setNewHigh] = useState(false)

  const iv = useRef<number | undefined>(undefined)
  const tm = useRef<number | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)
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
    [timer],
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
    const s = scoreRef.current
    const nh = s > highScore
    if (nh) onHighScore(s)
    setNewHigh(nh)
    setPhase('results')
  }, [highScore, onHighScore])
  const finishRef = useRef(finish)
  finishRef.current = finish

  // Auto-focus the guess input each round (type mode only).
  useEffect(() => {
    if (phase === 'question' && gameMode === 'type') inputRef.current?.focus()
  }, [phase, rIdx, gameMode])

  const restart = () => {
    clearTimers()
    setScore(0)
    setRIdx(0)
    setResults([])
    setNewHigh(false)
    setGuess('')
    setPhase('intro')
  }
  const quit = () => {
    clearTimers()
    onQuit()
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (phase !== 'question' || !guess.trim()) return
    const t = findTeam(deck[rIdx].o)!
    reveal(isCorrectGuess(guess, t) ? 'correct' : 'wrong')
  }

  const round = deck[rIdx]
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
          <div className="intro-sub">Ignore the colors. Recognize the team.</div>
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
          <div className="prompt">WHOSE LOGO IS THIS?</div>
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
              <div className="host-hint">Shout it out — the host taps the verdict</div>
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
            <Logo team={ot} />
          </div>
          <div className="reveal-name">{fullName(ot)}</div>
          <div className="reveal-note">wearing {fullName(ct)} colors</div>
          {kind === 'correct' && <div className="plus-one">+1</div>}
        </div>
      )}

      {phase === 'results' && (
        <div className="results rise">
          <div className="final-label">FINAL SCORE</div>
          <div className="final-score">
            {score} / {deck.length}
          </div>
          {newHigh && <div className="new-high">NEW HIGH SCORE</div>}
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
                  <div className="recap-name">{fullName(o)}</div>
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
