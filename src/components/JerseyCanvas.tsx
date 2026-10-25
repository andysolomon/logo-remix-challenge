import { jerseyLine, type Player } from '../lib/teams'
import { Jersey } from './Jersey'
import type { AddState } from './RemixCanvas'

interface Props {
  player: Player | null
  addState: AddState
  onAdd: () => void
  onClear: () => void
  portrait?: boolean
}

/** Preview of a "Who wore it?" round: the jersey players will see, and the answer they need to name. */
export function JerseyCanvas({ player, addState, onAdd, onClear, portrait }: Props) {
  const label = addState === 'added' ? 'ADDED ✓' : addState === 'full' ? 'DECK FULL · 20' : addState === 'save' ? 'SAVE ROUND' : '+ ADD ROUND'
  const addDisabled = addState === 'disabled' || addState === 'full' || addState === 'added'
  const liveStatus =
    addState === 'added'
      ? 'Round added to deck.'
      : addState === 'full'
        ? 'Deck is full. Remove a round before adding more.'
        : addState === 'save'
          ? 'Ready to save round changes.'
          : ''
  const addAriaLabel =
    addState === 'added' ? 'Round added' : addState === 'full' ? 'Deck full, cannot add round' : addState === 'save' ? 'Save round changes' : 'Add jersey round to deck'
  return (
    <section className="canvas" aria-label="Jersey preview">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveStatus}
      </div>
      <div className="micro-row">
        <div className="micro">WHO WORE IT?</div>
        {player && (
          <button type="button" className="btn-clear" onClick={onClear} aria-label="Clear jersey">
            clear
          </button>
        )}
      </div>
      <div className={`canvas-name${player ? '' : ' placeholder'}`}>{player ? player.name : 'Pick a jersey'}</div>
      {player && <div className="logo-variant-label">{jerseyLine(player)}</div>}
      <div className="canvas-hero">
        {player ? (
          <div key={player.id} className="hero-logo pop">
            <Jersey player={player} />
          </div>
        ) : (
          <div className="empty-circle">{portrait ? 'Pick a jersey in step 1' : 'Pick a jersey on the left to make a “Who wore it?” round'}</div>
        )}
      </div>
      <div className="micro-row">
        <div className="micro">HINT</div>
      </div>
      <div className="color-row">
        <div className={`color-name${player ? '' : ' placeholder'}`}>{player ? player.position : 'The player’s position'}</div>
      </div>
      <div className="canvas-footer">
        <div className="action-row add-row">
          <button type="button" className={`btn-add${addDisabled ? ' disabled' : ''}${addState === 'added' ? ' added' : ''}`} onClick={onAdd} disabled={addDisabled} aria-label={addAriaLabel}>
            {label}
          </button>
        </div>
      </div>
    </section>
  )
}
