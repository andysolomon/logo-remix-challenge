import { useRef, useState } from 'react'
import { ALL_POOL_IDS, COLOR_POOLS, COLOR_POOL_IDS, COLOR_SOURCE_NOTE, MAX_DECK_ROUNDS, RANDOM_ROUND_OPTIONS, TEAM_POOLS, colorPoolTeams, logoPoolTeams, randomDeck, type GuessTarget, type RandomDeckOptions, type RandomGuess, type Round, type TeamPool } from '../lib/teams'
import { useDialogA11y } from './SettingsModal'

interface Props {
  deck: Round[]
  guessTarget: GuessTarget
  onRoll: (rounds: Round[], replace: boolean) => void
  onClose: () => void
}

// Remember the last roll so re-rolling with the same recipe is one tap.
let lastOptions: RandomDeckOptions | null = null

export function RandomDeckModal({ deck, guessTarget, onRoll, onClose }: Props) {
  const [opts, setOpts] = useState<RandomDeckOptions>(
    () => lastOptions ?? { rounds: 10, logoPools: ['SEC'], colorPools: ['NFL'], guess: guessTarget, hints: true },
  )
  const [replace, setReplace] = useState(true)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useDialogA11y(dialogRef, closeRef, onClose)

  const logoCount = logoPoolTeams(opts.logoPools).length
  const colorCount = colorPoolTeams(opts.colorPools).length
  const capacity = replace ? MAX_DECK_ROUNDS : Math.max(0, MAX_DECK_ROUNDS - deck.length)
  const rollCount = Math.min(opts.rounds, capacity)
  const ready = logoCount > 0 && colorCount > 0 && rollCount > 0

  const roll = () => {
    if (!ready) return
    lastOptions = opts
    const rollOpts = { ...opts, rounds: rollCount }
    onRoll(randomDeck(rollOpts, replace ? [] : deck), replace)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="rnd-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div id="rnd-title" className="rail-title">RANDOM DECK</div>
          <button ref={closeRef} type="button" className="close-btn" aria-label="Close random deck" onClick={onClose}>
            <span aria-hidden="true">✕</span>
            <span>Close</span>
          </button>
        </div>

        <div className="modal-body">
          <div className="rail-label" id="rnd-rounds-label">ROUNDS</div>
          <div className="grid4" role="group" aria-labelledby="rnd-rounds-label">
            {RANDOM_ROUND_OPTIONS.map((n) => (
              <button key={n} type="button" className={`opt${opts.rounds === n ? ' active' : ''}`} aria-pressed={opts.rounds === n} onClick={() => setOpts((o) => ({ ...o, rounds: n }))}>
                {n}
              </button>
            ))}
          </div>

          <PoolPicker label="LOGOS FROM" pools={TEAM_POOLS} allIds={ALL_POOL_IDS} value={opts.logoPools} count={logoCount} onChange={(v) => setOpts((o) => ({ ...o, logoPools: v }))} />
          <PoolPicker label="COLORS FROM" pools={COLOR_POOLS} allIds={COLOR_POOL_IDS} value={opts.colorPools} count={colorCount} unit="palettes" onChange={(v) => setOpts((o) => ({ ...o, colorPools: v }))} />
          <div className="mode-hint">{COLOR_SOURCE_NOTE}</div>

          <div className="rail-label" id="rnd-guess-label">GUESS</div>
          <div className="grid4" role="group" aria-labelledby="rnd-guess-label">
            {(
              [
                ['team', 'Logo'],
                ['colors', 'Colors'],
                ['both', 'Both'],
                ['mix', 'Mix'],
              ] as [RandomGuess, string][]
            ).map(([g, lb]) => (
              <button key={g} type="button" className={`opt mode${opts.guess === g ? ' active' : ''}`} aria-pressed={opts.guess === g} onClick={() => setOpts((o) => ({ ...o, guess: g }))}>
                {lb}
              </button>
            ))}
          </div>
          <div className="mode-hint">
            {opts.guess === 'mix' ? 'Each round randomly asks for the logo or the colors.' : opts.guess === 'both' ? 'Every round asks for the names behind the logo and the colors.' : opts.guess === 'colors' ? 'Every round asks whose colors the logo is wearing.' : 'Every round asks which team or brand the logo belongs to.'}
          </div>

          <div className="rail-label" id="rnd-hints-label">HINTS</div>
          <div className="grid2" role="group" aria-labelledby="rnd-hints-label">
            <button type="button" className={`opt mode${opts.hints ? ' active' : ''}`} aria-pressed={opts.hints} onClick={() => setOpts((o) => ({ ...o, hints: true }))}>
              Show league
            </button>
            <button type="button" className={`opt mode${opts.hints ? '' : ' active'}`} aria-pressed={!opts.hints} onClick={() => setOpts((o) => ({ ...o, hints: false }))}>
              Off
            </button>
          </div>

          {deck.length > 0 && (
            <>
              <div className="rail-label" id="rnd-deck-label">CURRENT DECK</div>
              <div className="grid2" role="group" aria-labelledby="rnd-deck-label">
                <button type="button" className={`opt mode${replace ? '' : ' active'}`} aria-pressed={!replace} onClick={() => setReplace(false)}>
                  Add to deck
                </button>
                <button type="button" className={`opt mode${replace ? ' active' : ''}`} aria-pressed={replace} onClick={() => setReplace(true)}>
                  Replace deck
                </button>
              </div>
              <div className="mode-hint">{replace ? `Clears your ${deck.length} current round${deck.length === 1 ? '' : 's'} first.` : capacity ? `Adds up to ${rollCount} new round${rollCount === 1 ? '' : 's'} after your current deck (20 maximum).` : 'Your deck is at the 20-round maximum.'}</div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className={`btn-start${ready ? '' : ' disabled'}`} onClick={roll} disabled={!ready} aria-label={ready ? `Roll ${rollCount} random round${rollCount === 1 ? '' : 's'}` : 'Roll disabled, adjust options'}>
            🎲 ROLL {rollCount || opts.rounds} ROUND{(rollCount || opts.rounds) === 1 ? '' : 'S'}
          </button>
          {!ready && <div className="mode-hint">{capacity === 0 ? 'Replace the deck to roll new rounds.' : 'Pick at least one collection for logos and one for colors.'}</div>}
        </div>
      </div>
    </div>
  )
}

function PoolPicker({
  label,
  pools,
  allIds,
  value,
  count,
  unit = 'logos',
  onChange,
}: {
  label: string
  pools: TeamPool[]
  allIds: string[]
  value: string[]
  count: number
  unit?: string
  onChange: (v: string[]) => void
}) {
  // Pools outside this picker's list (an older saved recipe, say) count as nothing selected.
  const chosen = value.filter((id) => allIds.includes(id))
  const all = chosen.length === allIds.length
  const toggle = (id: string) => onChange(chosen.includes(id) ? chosen.filter((v) => v !== id) : [...chosen, id])
  return (
    <>
      <div className="pool-head">
        <span className="rail-label">{label}</span>
        <span className="pool-count">{count} {unit}</span>
      </div>
      <div className="chips" role="group" aria-label={label}>
        <button type="button" className={`chip${all ? ' active' : ''}`} aria-pressed={all} onClick={() => onChange(all ? [] : allIds)}>
          All
        </button>
        {pools.map((p) => {
          const on = chosen.includes(p.id)
          return (
            <button key={p.id} type="button" className={`chip${on ? ' active' : ''}`} aria-pressed={on} onClick={() => toggle(p.id)}>
              {p.label}
            </button>
          )
        })}
      </div>
    </>
  )
}
