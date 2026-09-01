import { fullName, type Team } from '../lib/teams'
import { Logo } from './Logo'

export type AddState = 'disabled' | 'full' | 'add' | 'save' | 'added'

interface Props {
  original: Team | null
  colors: Team | null
  perm: number
  addState: AddState
  onShuffle: () => void
  onAdd: () => void
  onClearOriginal: () => void
  onClearColors: () => void
  onClearAll: () => void
  portrait?: boolean
}

export function RemixCanvas({ original, colors, perm, addState, onShuffle, onAdd, onClearOriginal, onClearColors, onClearAll, portrait }: Props) {
  const label = addState === 'added' ? 'ADDED ✓' : addState === 'full' ? 'DECK FULL · 20' : addState === 'save' ? 'SAVE ROUND' : '+ ADD ROUND'
  const addDisabled = addState === 'disabled' || addState === 'full' || addState === 'added'
  const colorText = colors ? fullName(colors) : original ? 'Now pick a color team →' : 'Pick a team'
  const liveStatus =
    addState === 'added'
      ? 'Round added to deck.'
      : addState === 'full'
        ? 'Deck is full. Remove a round before adding more.'
        : addState === 'save'
          ? 'Ready to save round changes.'
          : ''
  const addAriaLabel =
    addState === 'added'
      ? 'Round added'
      : addState === 'full'
        ? 'Deck full, cannot add round'
        : addState === 'save'
          ? 'Save round changes'
          : 'Add round to deck'
  // Key forces the pop animation to replay whenever the remix changes.
  const remixKey = `${original?.id}-${colors?.id}-${colors ? perm : 0}`
  return (
    <section className="canvas" aria-label="Remix preview">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveStatus}
      </div>
      <div className="micro-row">
        <div className="micro">ORIGINAL</div>
        {original && (
          <button type="button" className="btn-clear" onClick={onClearOriginal} aria-label="Clear original team">
            clear
          </button>
        )}
      </div>
      <div className={`canvas-name${original ? '' : ' placeholder'}`}>{original ? fullName(original) : 'Pick a team'}</div>
      <div className="canvas-hero">
        {original ? (
          <div key={remixKey} className="hero-logo pop">
            {colors ? <Logo team={original} palette={colors.palette} perm={perm} /> : <Logo team={original} />}
          </div>
        ) : (
          <div className="empty-circle">{portrait ? 'Pick an original team in step 1' : 'Pick an original team on the left to start a remix'}</div>
        )}
      </div>
      <div className="micro-row">
        <div className="micro">COLORS</div>
        {colors && (
          <button type="button" className="btn-clear" onClick={onClearColors} aria-label="Clear color team">
            clear
          </button>
        )}
      </div>
      <div className="color-row">
        <div className={`color-name${colors ? '' : ' placeholder'}`}>{colorText}</div>
        {colors && (
          <div className="swatches">
            {colors.palette.map((h, i) => (
              <span key={i} className="swatch s16" style={{ background: h }} />
            ))}
          </div>
        )}
      </div>
      <div className="canvas-footer">
        <div className="action-row">
          <button type="button" className="btn-shuffle" onClick={onShuffle} disabled={!original || !colors} aria-label="Shuffle color assignment">
            Shuffle Colors
          </button>
          <button
            type="button"
            className={`btn-add${addDisabled ? ' disabled' : ''}${addState === 'added' ? ' added' : ''}`}
            onClick={onAdd}
            disabled={addDisabled}
            aria-label={addAriaLabel}
          >
            {label}
          </button>
        </div>
        {(original || colors) && (
          <button type="button" className="btn-clear all" onClick={onClearAll} aria-label="Clear original and color teams">
            Clear both
          </button>
        )}
      </div>
    </section>
  )
}
