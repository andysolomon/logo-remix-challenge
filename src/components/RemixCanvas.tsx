import { fullName, type Team } from '../lib/teams'
import { Logo } from './Logo'

export type AddState = 'disabled' | 'add' | 'save' | 'added'

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
  const label = addState === 'added' ? 'ADDED ✓' : addState === 'save' ? 'SAVE ROUND' : '+ ADD ROUND'
  const colorText = colors ? fullName(colors) : original ? 'Now pick a color team →' : 'Pick a team'
  // Key forces the pop animation to replay whenever the remix changes.
  const remixKey = `${original?.id}-${colors?.id}-${colors ? perm : 0}`
  return (
    <section className="canvas">
      <div className="micro-row">
        <div className="micro">ORIGINAL</div>
        {original && (
          <button className="btn-clear" onClick={onClearOriginal} aria-label="Clear original team">
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
          <button className="btn-clear" onClick={onClearColors} aria-label="Clear color team">
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
      <div className="action-row">
        <button className="btn-shuffle" onClick={onShuffle}>
          Shuffle Colors
        </button>
        <button
          className={`btn-add${addState === 'disabled' ? ' disabled' : ''}${addState === 'added' ? ' added' : ''}`}
          onClick={onAdd}
          aria-disabled={addState === 'disabled'}
        >
          {label}
        </button>
      </div>
      {(original || colors) && (
        <button className="btn-clear all" onClick={onClearAll}>
          Clear both
        </button>
      )}
    </section>
  )
}
