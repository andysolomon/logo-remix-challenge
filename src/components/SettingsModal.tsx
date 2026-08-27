import { useEffect, useState } from 'react'
import { clampTimer, guessPrompt, GUESS_TARGETS, GUESS_LABEL, speak, voiceSupported, TIMER_MAX, TIMER_MIN, TIMER_OPTIONS, type GameMode, type GuessTarget, type TimerSeconds } from '../lib/teams'

interface Props {
  timer: TimerSeconds
  gameMode: GameMode
  guessTarget: GuessTarget
  voice: boolean
  onTimer: (t: TimerSeconds) => void
  onGameMode: (m: GameMode) => void
  onGuessTarget: (t: GuessTarget) => void
  onVoice: (on: boolean) => void
  onClose: () => void
}

export function SettingsModal({ timer, gameMode, guessTarget, voice, onTimer, onGameMode, onGuessTarget, onVoice, onClose }: Props) {
  const [custom, setCustom] = useState(String(timer))
  useEffect(() => setCustom(String(timer)), [timer])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const commitCustom = () => {
    const n = parseInt(custom, 10)
    if (Number.isFinite(n)) onTimer(clampTimer(n))
    else setCustom(String(timer))
  }
  const step = (d: number) => onTimer(clampTimer(timer + d))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div id="settings-title" className="rail-title">SETTINGS</div>
          <button className="close-btn" aria-label="Close settings" onClick={onClose}>
            <span aria-hidden="true">✕</span>
            <span>Close</span>
          </button>
        </div>

        <div className="rail-label">TIME PER ROUND</div>
        <div className="grid4">
          {TIMER_OPTIONS.map((t) => (
            <button key={t} className={`opt${timer === t ? ' active' : ''}`} onClick={() => onTimer(t)}>
              {t}s
            </button>
          ))}
        </div>
        <div className="rail-label">CUSTOM ({TIMER_MIN}–{TIMER_MAX}s)</div>
        <div className="stepper">
          <button className="opt" aria-label="Decrease time" onClick={() => step(-1)}>
            −
          </button>
          <input
            className="stepper-input"
            type="number"
            inputMode="numeric"
            min={TIMER_MIN}
            max={TIMER_MAX}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onBlur={commitCustom}
            onKeyDown={(e) => e.key === 'Enter' && commitCustom()}
            aria-label="Seconds per round"
          />
          <button className="opt" aria-label="Increase time" onClick={() => step(1)}>
            +
          </button>
        </div>
        <div className="mode-hint">Currently {timer} seconds per round.</div>

        <div className="rail-label">DEFAULT GUESS MODE</div>
        <div className="grid3">
          {GUESS_TARGETS.map((t) => [t, GUESS_LABEL[t].long] as const).map(([t, lb]) => (
            <button key={t} className={`opt mode${guessTarget === t ? ' active' : ''}`} onClick={() => onGuessTarget(t)}>
              {lb}
            </button>
          ))}
        </div>
        <div className="mode-hint">
          {guessTarget === 'both'
            ? 'Both: name the logo’s team and the team whose colors it wears — a point only when both are right.'
            : 'Applies to rounds without their own setting — each deck card can override this.'}
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

        <button className="btn-start" onClick={onClose}>
          DONE
        </button>
      </div>
    </div>
  )
}
