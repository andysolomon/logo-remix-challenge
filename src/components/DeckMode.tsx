import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { deckUndoReducer, findTeam, fullName, GUESS_TARGETS, GUESS_LABEL, roundHints, roundTarget, speak, voiceSupported, TIMER_OPTIONS, HIGH_SCORE_LIMIT, MAX_DECK_ROUNDS, type GameMode, type HighScore, type GuessTarget, type Round, type TimerSeconds } from '../lib/teams'
import { Logo } from './Logo'
import { RandomDeckModal } from './RandomDeckModal'
import { useDialogA11y } from './SettingsModal'

interface Props {
  deck: Round[]
  portrait: boolean
  timer: TimerSeconds
  gameMode: GameMode
  guessTarget: GuessTarget
  voice: boolean
  highScores: HighScore[]
  deckWideMutationVersion: number
  onDeck: (d: Round[]) => void
  onEdit: (i: number) => void
  onTimer: (t: TimerSeconds) => void
  onGameMode: (m: GameMode) => void
  onGuessTarget: (t: GuessTarget) => void
  onVoice: (on: boolean) => void
  onStart: () => void
  onCreate: () => void
  hidden?: boolean
}

export function DeckMode({ deck, portrait, timer, gameMode, guessTarget, voice, highScores, deckWideMutationVersion, onDeck, onEdit, onTimer, onGameMode, onGuessTarget, onVoice, onStart, onCreate, hidden }: Props) {
  const [hsOpen, setHsOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [rndOpen, setRndOpen] = useState(false)
  const closeRandom = useCallback(() => setRndOpen(false), [])
  const closeHighScores = useCallback(() => setHsOpen(false), [])
  const [undo, dispatchUndo] = useReducer(deckUndoReducer, null)
  const rollDeck = (rounds: Round[], replace: boolean) => {
    dispatchUndo({ type: 'ordinary' })
    onDeck((replace ? rounds : [...deck, ...rounds]).slice(0, MAX_DECK_ROUNDS))
  }
  useEffect(() => {
    if (!confirmClear) return
    const t = setTimeout(() => setConfirmClear(false), 4000)
    return () => clearTimeout(t)
  }, [confirmClear])
  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => dispatchUndo({ type: 'ordinary' }), 6000)
    return () => clearTimeout(t)
  }, [undo])
  useEffect(() => {
    dispatchUndo({ type: 'deck-wide' })
  }, [deckWideMutationVersion])
  useEffect(() => {
    if (!hidden) return
    setHsOpen(false)
    setRndOpen(false)
    setConfirmClear(false)
    dispatchUndo({ type: 'ordinary' })
  }, [hidden])
  const mut = (fn: (d: Round[]) => Round[]) => {
    dispatchUndo({ type: 'ordinary' })
    onDeck(fn([...deck]))
  }
  const destructive = (next: Round[], label: string) => {
    dispatchUndo({ type: 'destructive', deck, label })
    onDeck(next)
  }
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
    destructive([], `Cleared ${deck.length} round${deck.length === 1 ? '' : 's'}.`)
  }
  const swap = (d: Round[], a: number, b: number) => {
    ;[d[a], d[b]] = [d[b], d[a]]
    return d
  }
  return (
    <div className={`deck${portrait ? ' portrait' : ''}`} id="panel-deck" role="tabpanel" aria-labelledby="tab-deck" hidden={hidden}>
      <div className="deck-cards">
        {deck.length === 0 ? (
          <div className="deck-empty">
            <h2>Your deck is empty</h2>
            <p>Remix a logo to add your first round.</p>
            <button className="btn-create" onClick={onCreate}>
              CREATE A ROUND
            </button>
            <span className="deck-empty-or">OR</span>
            <button className="btn-roll" onClick={() => setRndOpen(true)}>
              🎲 ROLL A RANDOM DECK
            </button>
          </div>
        ) : (
          <>
            <div className="deck-toolbar">
              <button className="tool-btn accent" onClick={() => setRndOpen(true)} title="Generate random rounds from the leagues you pick">
                <span aria-hidden="true">🎲</span> Random deck
              </button>
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
                      {GUESS_TARGETS.map((t) => [t, GUESS_LABEL[t]] as const).map(([t, lb]) => (
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
                    <button className="icon-btn" aria-label="Duplicate" title={deck.length >= MAX_DECK_ROUNDS ? 'Deck is full' : 'Duplicate round'} disabled={deck.length >= MAX_DECK_ROUNDS} onClick={() => mut((d) => { d.splice(i + 1, 0, { ...d[i] }); return d })}>
                      ⧉
                    </button>
                    <button className="icon-btn danger" aria-label="Delete" onClick={() => destructive(deck.filter((_, j) => j !== i), `Deleted round ${i + 1}.`)}>
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
        <div className="rail-card setup-card">
          <div className="setup-body">
            <div className="rail-title">GAME SETUP</div>
            <div className="rounds-count">
              {deck.length} <span>ROUNDS</span>
            </div>
            <div className="rail-label" id="deck-timer-label">TIME PER ROUND</div>
            <div className="grid4" role="group" aria-labelledby="deck-timer-label">
              {TIMER_OPTIONS.map((t) => (
                <button key={t} type="button" className={`opt${timer === t ? ' active' : ''}`} aria-pressed={timer === t} onClick={() => onTimer(t)}>
                  {t}s
                </button>
              ))}
            </div>
            {!(TIMER_OPTIONS as readonly number[]).includes(timer) && <div className="mode-hint">Custom: {timer}s per round (change in ⚙ Settings)</div>}
            <div className="rail-label" id="deck-guess-label">DEFAULT GUESS MODE</div>
            <div className="grid3" role="group" aria-labelledby="deck-guess-label">
              {GUESS_TARGETS.map((t) => [t, GUESS_LABEL[t]] as const).map(([t, lb]) => (
                <button key={t} type="button" className={`opt mode${guessTarget === t ? ' active' : ''}`} aria-pressed={guessTarget === t} onClick={() => onGuessTarget(t)}>
                  {lb}
                </button>
              ))}
            </div>
            <div className="mode-hint">
              Sets every card in the deck — afterwards you can still switch any single card between Logo, Colors, or Both (name both teams to score).
            </div>

            <div className="rail-label" id="deck-mode-label">ANSWER STYLE</div>
            <div className="grid2" role="group" aria-labelledby="deck-mode-label">
              {(
                [
                  ['type', 'Type'],
                  ['host', 'Host Mode'],
                ] as [GameMode, string][]
              ).map(([m, lb]) => (
                <button key={m} type="button" className={`opt mode${gameMode === m ? ' active' : ''}`} aria-pressed={gameMode === m} onClick={() => onGameMode(m)}>
                  {lb}
                </button>
              ))}
            </div>
            <div className="mode-hint">
              {gameMode === 'host'
                ? 'Everyone shouts the answer — the host taps Correct or Incorrect. No typing.'
                : 'One player types the answer each round.'}
            </div>
            <div className="rail-label" id="deck-voice-label">VOICE ANNOUNCER</div>
            <div className="grid2" role="group" aria-labelledby="deck-voice-label">
              <button type="button" className={`opt mode${voice ? ' active' : ''}`} aria-pressed={voice} onClick={() => { onVoice(true); speak(guessTarget) }} disabled={!voiceSupported()}>
                🔊 On
              </button>
              <button type="button" className={`opt mode${voice ? '' : ' active'}`} aria-pressed={!voice} onClick={() => onVoice(false)}>
                Off
              </button>
            </div>
            <div className="mode-hint">
              {voiceSupported()
                ? `Announces the prompt each round, then correct or not quite, and the final score.`
                : 'Voice is not supported in this browser.'}
            </div>
          </div>

          <div className="rail-footer">
            <button className={`btn-start${deck.length ? '' : ' disabled'}`} onClick={onStart} disabled={deck.length === 0}>
              START GAME
            </button>
          </div>
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
      {undo && (
        <div className="undo-bar" role="status" aria-live="polite">
          <span>{undo.label}</span>
          <button onClick={() => { onDeck(undo.deck); dispatchUndo({ type: 'restored' }) }}>UNDO</button>
        </div>
      )}
      {rndOpen && <RandomDeckModal deck={deck} guessTarget={guessTarget} onRoll={rollDeck} onClose={closeRandom} />}
      {hsOpen && <HighScoresModal highScores={highScores} onClose={closeHighScores} />}
    </div>
  )
}

function HighScoresModal({ highScores, onClose }: { highScores: HighScore[]; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useDialogA11y(dialogRef, closeRef, onClose)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="hs-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div id="hs-title" className="rail-title">HIGH SCORES</div>
          <button ref={closeRef} type="button" className="close-btn" aria-label="Close high scores" onClick={onClose}>
            <span aria-hidden="true">✕</span>
            <span>Close</span>
          </button>
        </div>
        <div className="modal-body">
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
    </div>
  )
}
