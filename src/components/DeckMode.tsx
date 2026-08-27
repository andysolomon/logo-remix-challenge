import { findTeam, fullName, guessPrompt, roundTarget, speak, voiceSupported, TIMER_OPTIONS, type GameMode, type GuessTarget, type Round, type TimerSeconds } from '../lib/teams'
import { Logo } from './Logo'

interface Props {
  deck: Round[]
  portrait: boolean
  timer: TimerSeconds
  gameMode: GameMode
  guessTarget: GuessTarget
  voice: boolean
  highScore: number
  onDeck: (d: Round[]) => void
  onEdit: (i: number) => void
  onTimer: (t: TimerSeconds) => void
  onGameMode: (m: GameMode) => void
  onGuessTarget: (t: GuessTarget) => void
  onVoice: (on: boolean) => void
  onStart: () => void
  onCreate: () => void
}

export function DeckMode({ deck, portrait, timer, gameMode, guessTarget, voice, highScore, onDeck, onEdit, onTimer, onGameMode, onGuessTarget, onVoice, onStart, onCreate }: Props) {
  const mut = (fn: (d: Round[]) => Round[]) => onDeck(fn([...deck]))
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
                  <div className="round-target" role="group" aria-label={`Round ${i + 1} guess mode`}>
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
                        onClick={() => mut((d) => { d[i] = { ...d[i], g: t }; return d })}
                      >
                        Guess the {lb}
                      </button>
                    ))}
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
        <div className="rail-card hs">
          <div className="rail-label">HIGH SCORE</div>
          <div className="hs-value">{highScore > 0 ? `${highScore} correct` : '—'}</div>
        </div>
      </aside>
    </div>
  )
}
