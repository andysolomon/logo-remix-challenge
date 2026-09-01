import { useEffect, useRef, useState, type RefObject } from 'react'
import { clampTimer, GUESS_TARGETS, GUESS_LABEL, speak, voiceSupported, TIMER_MAX, TIMER_MIN, TIMER_OPTIONS, type GameMode, type GuessTarget, type TimerSeconds } from '../lib/teams'

const DIALOG_FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

/** Escape, initial/return focus, and Tab cycling inside a modal dialog. */
export function useDialogA11y(dialogRef: RefObject<HTMLElement | null>, closeRef: RefObject<HTMLButtonElement | null>, onClose: () => void) {
  const prevFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    prevFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      const dialog = dialogRef.current
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !dialog) return
      const nodes = Array.from(dialog.querySelectorAll(DIALOG_FOCUSABLE)).filter(
        (el) => el instanceof HTMLElement && !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
      ) as HTMLElement[]
      if (!nodes.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement
      if (e.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last || !dialog.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      const el = prevFocusRef.current
      if (el && !el.closest('[hidden]')) el.focus()
    }
  }, [onClose, dialogRef, closeRef])
}

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
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => setCustom(String(timer)), [timer])
  useDialogA11y(dialogRef, closeRef, onClose)

  const commitCustom = () => {
    const n = parseInt(custom, 10)
    if (Number.isFinite(n)) onTimer(clampTimer(n))
    else setCustom(String(timer))
  }
  const step = (d: number) => onTimer(clampTimer(timer + d))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div id="settings-title" className="rail-title">SETTINGS</div>
          <button ref={closeRef} type="button" className="close-btn" aria-label="Close settings" onClick={onClose}>
            <span aria-hidden="true">✕</span>
            <span>Close</span>
          </button>
        </div>

        <div className="modal-body">
          <div className="rail-label" id="settings-timer-label">TIME PER ROUND</div>
          <div className="grid4" role="group" aria-labelledby="settings-timer-label">
            {TIMER_OPTIONS.map((t) => (
              <button key={t} type="button" className={`opt${timer === t ? ' active' : ''}`} aria-pressed={timer === t} onClick={() => onTimer(t)}>
                {t}s
              </button>
            ))}
          </div>
          <div className="rail-label" id="settings-custom-label">CUSTOM ({TIMER_MIN}–{TIMER_MAX}s)</div>
          <div className="stepper" role="group" aria-labelledby="settings-custom-label">
            <button type="button" className="opt" aria-label="Decrease time" onClick={() => step(-1)}>
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
            <button type="button" className="opt" aria-label="Increase time" onClick={() => step(1)}>
              +
            </button>
          </div>
          <div className="mode-hint">Currently {timer} seconds per round.</div>

          <div className="rail-label" id="settings-guess-label">DEFAULT GUESS MODE</div>
          <div className="grid3" role="group" aria-labelledby="settings-guess-label">
            {GUESS_TARGETS.map((t) => [t, GUESS_LABEL[t]] as const).map(([t, lb]) => (
              <button key={t} type="button" className={`opt mode${guessTarget === t ? ' active' : ''}`} aria-pressed={guessTarget === t} onClick={() => onGuessTarget(t)}>
                {lb}
              </button>
            ))}
          </div>
          <div className="mode-hint">
            {guessTarget === 'both'
              ? 'Both: name the logo’s team and the team whose colors it wears — a point only when both are right.'
              : 'Sets every card in the deck — each deck card can still be switched individually afterwards.'}
          </div>

          <div className="rail-label" id="settings-mode-label">ANSWER STYLE</div>
          <div className="grid2" role="group" aria-labelledby="settings-mode-label">
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

          <div className="rail-label" id="settings-voice-label">VOICE ANNOUNCER</div>
          <div className="grid2" role="group" aria-labelledby="settings-voice-label">
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

        <div className="modal-footer">
          <button type="button" className="btn-start" onClick={onClose}>
            DONE
          </button>
        </div>
      </div>
    </div>
  )
}
