import { useEffect, useState } from 'react'
import { ALL_POOL_IDS, RANDOM_ROUND_OPTIONS, TEAM_POOLS, poolTeams, randomDeck, type GuessTarget, type RandomDeckOptions, type RandomGuess, type Round } from '../lib/teams'

interface Props {
  deckCount: number
  guessTarget: GuessTarget
  onRoll: (rounds: Round[], replace: boolean) => void
  onClose: () => void
}

// Remember the last roll so re-rolling with the same recipe is one tap.
let lastOptions: RandomDeckOptions | null = null

export function RandomDeckModal({ deckCount, guessTarget, onRoll, onClose }: Props) {
  const [opts, setOpts] = useState<RandomDeckOptions>(
    () => lastOptions ?? { rounds: 10, logoPools: ['SEC'], colorPools: ['NFL'], guess: guessTarget, hints: false },
  )
  const [replace, setReplace] = useState(true)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const logoCount = poolTeams(opts.logoPools).length
  const colorCount = poolTeams(opts.colorPools).length
  const ready = logoCount > 0 && colorCount > 0

  const roll = () => {
    if (!ready) return
    lastOptions = opts
    onRoll(randomDeck(opts), replace)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rnd-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div id="rnd-title" className="rail-title">RANDOM DECK</div>
          <button className="close-btn" aria-label="Close random deck" onClick={onClose}>
            <span aria-hidden="true">✕</span>
            <span>Close</span>
          </button>
        </div>

        <div className="rail-label">ROUNDS</div>
        <div className="grid4">
          {RANDOM_ROUND_OPTIONS.map((n) => (
            <button key={n} className={`opt${opts.rounds === n ? ' active' : ''}`} onClick={() => setOpts((o) => ({ ...o, rounds: n }))}>
              {n}
            </button>
          ))}
        </div>

        <PoolPicker label="LOGOS FROM" value={opts.logoPools} count={logoCount} onChange={(v) => setOpts((o) => ({ ...o, logoPools: v }))} />
        <PoolPicker label="COLORS FROM" value={opts.colorPools} count={colorCount} onChange={(v) => setOpts((o) => ({ ...o, colorPools: v }))} />

        <div className="rail-label">GUESS</div>
        <div className="grid3">
          {(
            [
              ['team', 'Logo'],
              ['colors', 'Colors'],
              ['mix', 'Mix'],
            ] as [RandomGuess, string][]
          ).map(([g, lb]) => (
            <button key={g} className={`opt mode${opts.guess === g ? ' active' : ''}`} onClick={() => setOpts((o) => ({ ...o, guess: g }))}>
              {lb}
            </button>
          ))}
        </div>
        <div className="mode-hint">
          {opts.guess === 'mix' ? 'Each round randomly asks for the logo or the colors.' : opts.guess === 'colors' ? 'Every round asks whose colors the logo is wearing.' : 'Every round asks which team the logo belongs to.'}
        </div>

        <div className="rail-label">HINTS</div>
        <div className="grid2">
          <button className={`opt mode${opts.hints ? ' active' : ''}`} onClick={() => setOpts((o) => ({ ...o, hints: true }))}>
            Show league
          </button>
          <button className={`opt mode${opts.hints ? '' : ' active'}`} onClick={() => setOpts((o) => ({ ...o, hints: false }))}>
            Off
          </button>
        </div>

        {deckCount > 0 && (
          <>
            <div className="rail-label">CURRENT DECK</div>
            <div className="grid2">
              <button className={`opt mode${replace ? '' : ' active'}`} onClick={() => setReplace(false)}>
                Add to deck
              </button>
              <button className={`opt mode${replace ? ' active' : ''}`} onClick={() => setReplace(true)}>
                Replace deck
              </button>
            </div>
            <div className="mode-hint">{replace ? `Clears your ${deckCount} current round${deckCount === 1 ? '' : 's'} first.` : `Appends after your ${deckCount} current round${deckCount === 1 ? '' : 's'}.`}</div>
          </>
        )}

        <button className={`btn-start${ready ? '' : ' disabled'}`} onClick={roll} aria-disabled={!ready}>
          🎲 ROLL {opts.rounds} ROUNDS
        </button>
        {!ready && <div className="mode-hint">Pick at least one league for logos and one for colors.</div>}
      </div>
    </div>
  )
}

function PoolPicker({ label, value, count, onChange }: { label: string; value: string[]; count: number; onChange: (v: string[]) => void }) {
  const all = value.length === ALL_POOL_IDS.length
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  return (
    <>
      <div className="pool-head">
        <span className="rail-label">{label}</span>
        <span className="pool-count">{count} teams</span>
      </div>
      <div className="chips" role="group" aria-label={label}>
        <button className={`chip${all ? ' active' : ''}`} aria-pressed={all} onClick={() => onChange(all ? [] : ALL_POOL_IDS)}>
          All
        </button>
        {TEAM_POOLS.map((p) => {
          const on = value.includes(p.id)
          return (
            <button key={p.id} className={`chip${on ? ' active' : ''}`} aria-pressed={on} onClick={() => toggle(p.id)}>
              {p.label}
            </button>
          )
        })}
      </div>
    </>
  )
}
