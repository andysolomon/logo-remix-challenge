import { useEffect, useState } from 'react'
import { findTeam, fullName, guessPrompt, roundHints, roundTarget, speak, voiceSupported, TIMER_OPTIONS, HIGH_SCORE_LIMIT, type GameMode, type HighScore, type GuessTarget, type Round, type TimerSeconds } from '../lib/teams'
import { Logo } from './Logo'

interface Props {
  deck: Round[]
  portrait: boolean
  timer: TimerSeconds
  gameMode: GameMode
  guessTarget: GuessTarget
  voice: boolean
  highScores: HighScore[]
  onDeck: (d: Round[]) => void
  onEdit: (i: number) => void
  onTimer: (t: TimerSeconds) => void
  onGameMode: (m: GameMode) => void
  onGuessTarget: (t: GuessTarget) => void
  onVoice: (on: boolean) => void
  onStart: () => void
  onCreate: () => void
}

export function DeckMode({ deck, portrait, timer, gameMode, guessTarget, voice, highScores, onDeck, onEdit, onTimer, onGameMode, onGuessTarget, onVoice, onStart, onCreate }: Props) {
  const [hsOpen, setHsOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  useEffect(() => {
    if (!confirmClear) return
    const t = setTimeout(() => setConfirmClear(false), 4000)
    return () => clearTimeout(t)
  }, [confirmClear])
  const mut = (fn: (d: Round[]) => Round[]) => onDeck(fn([...deck]))
  const shuffle = () =>
    mut((d) => {
      for (let i = d.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[d[i], d[j]] = [d[j], d[i]]
      }
      return d
    })
  const clear = () => {
    if (!confirmClear) return setConfirmClear(true)
    setConfirmClear(false)
    onDeck([])
  }
  const swap = (d: Round[], a: number, b: number) => {
    ;[d[a], d[b]] = [d[b], d[a]]
    return d
  }
  return (
    <div className={`deck${portrait ? ' portrait' : ''}`}>
      <div className="deck-cards">
        {deck.length === 0 ? (
          <div className="deck-empty">
            <h2>Your deck is empty</h2>
            <p>Remix a logo to add your first round.</p>
            <button className="btn-create" onClick={onCreate}>
              CREATE A ROUND
            </button>
          </div>
        ) : (
          <>
            <div className="deck-toolbar">
              <button className="tool-btn" onClick={shuffle} disabled={deck.length < 2} title="Randomize the round order">
                <span aria-hidden="true">🔀</span> Shuffle
              </button>
              <button className={`tool-btn${confirmClear ? ' confirm' : ' danger'}`} onClick={clear} onBlur={() => setConfirmClear(false)} title="Remove every round from the deck">
                {confirmClear ? 'Tap again to clear all' : <><span aria-hidden="true">🗑</span> Clear deck</>}
              </button>
            </div>
          <div className="card-grid">
            {deck.map((r, i) => {
              const ot = findTeam(r.o)!
              const ct = findTeam(r.c)!
              return (
                <div key={`${i}-${r.o}-${r.c}`} className="round-card">
                  <div className="round-label">ROUND {i + 1}</div>
                  <div className="round-logo">
                    <Logo team={ot} palette={ct.palette} perm={r.v} />
                  </div>
                  <div className="round-name">{fullName(ot)}</div>
                  <div className="round-sub">in {fullName(ct)} colors</div>
                  <div className="round-target">
                    <span className="round-target-lb">GUESS</span>
                    <div className="seg-group" role="group" aria-label={`Round ${i + 1}: what to guess`}>
                      {(
                        [
                          ['team', 'Logo'],
                          ['colors', 'Colors'],
                        ] as [GuessTarget, string][]
                      ).map(([t, lb]) => (
                        <button
                          key={t}
                          className={`seg${roundTarget(r, guessTarget) === t ? ' active' : ''}`}
                          aria-pressed={roundTarget(r, guessTarget) === t}
                          title={`Guess the ${lb}`}
                          onClick={() => mut((d) => { d[i] = { ...d[i], g: t }; return d })}
                        >
                          {lb}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="round-hint">
                    <span className="round-target-lb">HINT</span>
                    <button
                      className={`hint-toggle${r.h ? ' active' : ''}`}
                      aria-pressed={!!r.h}
                      title={r.h ? 'Hide the league/conference hint' : 'Show the league/conference hint'}
                      onClick={() => mut((d) => { d[i] = { ...d[i], h: !d[i].h }; return d })}
                    >
                      {r.h ? roundHints(r).join(' · ') : 'Off'}
                    </button>
                  </div>
                  <div className="round-ctl">
                    <button className={`icon-btn${i === 0 ? ' dim' : ''}`} aria-label="Move earlier" onClick={() => i > 0 && mut((d) => swap(d, i - 1, i))}>
                      ◀
                    </button>
                    <button
                      className={`icon-btn${i === deck.length - 1 ? ' dim' : ''}`}
                      aria-label="Move later"
                      onClick={() => i < deck.length - 1 && mut((d) => swap(d, i, i + 1))}
                    >
                      ▶
                    </button>
                    <button className="edit-btn" onClick={() => onEdit(i)}>
                      Edit
                    </button>
                    <button className="icon-btn" aria-label="Duplicate" onClick={() => mut((d) => { d.splice(i + 1, 0, { ...d[i] }); return d })}>
                      ⧉
                    </button>
                    <button className="icon-btn danger" aria-label="Delete" onClick={() => mut((d) => { d.splice(i, 1); return d })}>
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          </>
        )}
      </div>
      <aside className="rail">
        <div className="rail-card">
          <div className="rail-title">GAME SETUP</div>
          <div className="rounds-count">
            {deck.length} <span>ROUNDS</span>
          </div>
          <div className="rail-label">TIME PER ROUND</div>
          <div className="grid4">
            {TIMER_OPTIONS.map((t) => (
              <button key={t} className={`opt${timer === t ? ' active' : ''}`} onClick={() => onTimer(t)}>
                {t}s
              </button>
            ))}
          </div>
          {!(TIMER_OPTIONS as readonly number[]).includes(timer) && <div className="mode-hint">Custom: {timer}s per round (change in ⚙ Settings)</div>}
          <div className="rail-label">DEFAULT GUESS MODE</div>
          <div className="grid2">
            {(
              [
                ['team', 'Guess the Logo'],
                ['colors', 'Guess the Colors'],
              ] as [GuessTarget, string][]
            ).map(([t, lb]) => (
              <button key={t} className={`opt mode${guessTarget === t ? ' active' : ''}`} onClick={() => onGuessTarget(t)}>
                {lb}
              </button>
            ))}
          </div>
          <div className="mode-hint">
            Applies to rounds without their own setting — switch any card between Logo and Colors.
          </div>

          <div className="rail-label">ANSWER STYLE</div>
          <div className="grid2">
            {(
              [
                ['type', 'Type the Answer'],
                ['host', 'Host Mode'],
              ] as [GameMode, string][]
            ).map(([m, lb]) => (
              <button key={m} className={`opt mode${gameMode === m ? ' active' : ''}`} onClick={() => onGameMode(m)}>
                {lb}
              </button>
            ))}
          </div>
          <div className="mode-hint">
            {gameMode === 'host'
              ? 'Everyone shouts the answer — the host taps Correct or Incorrect. No typing.'
              : 'One player types the answer each round.'}
          </div>
          <div className="rail-label">VOICE ANNOUNCER</div>
          <div className="grid2">
            <button className={`opt mode${voice ? ' active' : ''}`} onClick={() => { onVoice(true); speak(guessPrompt(guessTarget)) }} disabled={!voiceSupported()}>
              🔊 On
            </button>
            <button className={`opt mode${voice ? '' : ' active'}`} onClick={() => onVoice(false)}>
              Off
            </button>
          </div>
          <div className="mode-hint">
            {voiceSupported()
              ? `Announces “${guessPrompt(guessTarget)}” at the start of every round.`
              : 'Voice is not supported in this browser.'}
          </div>

          <button className={`btn-start${deck.length ? '' : ' disabled'}`} onClick={onStart} aria-disabled={deck.length === 0}>
            START GAME
          </button>
        </div>
        <button className="rail-card hs-btn" onClick={() => setHsOpen(true)} aria-haspopup="dialog">
          <span className="rail-label">HIGH SCORES</span>
          <span className="hs-top">
            {highScores.length ? (
              <>
                <span className="hs-initials">{highScores[0].initials}</span>
                <span className="hs-score">{highScores[0].score}</span>
              </>
            ) : (
              <span className="hs-empty">No scores yet</span>
            )}
          </span>
          <span className="hs-view">View board ▸</span>
        </button>
      </aside>
      {hsOpen && <HighScoresModal highScores={highScores} onClose={() => setHsOpen(false)} />}
    </div>
  )
}

function HighScoresModal({ highScores, onClose }: { highScores: HighScore[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="hs-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div id="hs-title" className="rail-title">HIGH SCORES</div>
          <button className="close-btn" aria-label="Close high scores" onClick={onClose}>
            <span aria-hidden="true">✕</span>
            <span>Close</span>
          </button>
        </div>
        {highScores.length ? (
          <ol className="hs-board">
            {highScores.map((h, i) => (
              <li key={`${h.date}-${i}`} className="hs-row">
                <span className="hs-rank">{String(i + 1).padStart(2, '0')}</span>
                <span className="hs-initials">{h.initials}</span>
                <span className="hs-score">{h.score}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="hs-empty">No scores yet — top {HIGH_SCORE_LIMIT} runs go here.</div>
        )}
      </div>
    </div>
  )
}
