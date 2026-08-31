import { useEffect, useRef, useState } from 'react'
import { findTeam, MAX_DECK_ROUNDS, nextContrastSafePermutation, type Round, type Team } from '../lib/teams'
import { RemixCanvas, type AddState } from './RemixCanvas'
import { TeamBrowser, type BrowserState } from './TeamBrowser'

export interface CreateState {
  oId: string | null
  cId: string | null
  perm: number
  editIdx: number | null
  step: 1 | 2 | 3
  browserO: BrowserState
  browserC: BrowserState
}

export const initialCreateState: CreateState = {
  oId: null,
  cId: null,
  perm: 0,
  editIdx: null,
  step: 1,
  browserO: { league: 'PRO', conference: 'All', query: '' },
  browserC: { league: 'PRO', conference: 'All', query: '' },
}

interface Props {
  state: CreateState
  setState: (fn: (s: CreateState) => CreateState) => void
  portrait: boolean
  deckCount: number
  onAddRound: (round: Round, editIdx: number | null) => boolean
}

export function CreateMode({ state, setState, portrait, deckCount, onAddRound }: Props) {
  const original = state.oId ? findTeam(state.oId) ?? null : null
  const colors = state.cId ? findTeam(state.cId) ?? null : null
  const [justAdded, setJustAdded] = useState(false)
  const addedTimer = useRef<number | undefined>(undefined)
  const addLock = useRef(false)
  useEffect(() => () => window.clearTimeout(addedTimer.current), [])

  const deckFull = state.editIdx == null && deckCount >= MAX_DECK_ROUNDS
  const addState: AddState = justAdded ? 'added' : deckFull ? 'full' : !original || !colors ? 'disabled' : state.editIdx != null ? 'save' : 'add'

  // Clicking the already-selected tile deselects it.
  const selectOriginal = (t: Team) =>
    setState((s) => (s.oId === t.id ? { ...s, oId: null, step: 1 } : { ...s, oId: t.id, step: 2 }))
  const selectColors = (t: Team) =>
    setState((s) => (s.cId === t.id ? { ...s, cId: null, perm: 0, step: 2 } : { ...s, cId: t.id, step: 3 }))
  const clearOriginal = () => setState((s) => ({ ...s, oId: null, step: 1 }))
  const clearColors = () => setState((s) => ({ ...s, cId: null, perm: 0, step: 2 }))
  const clearAll = () => setState((s) => ({ ...s, oId: null, cId: null, perm: 0, editIdx: null, step: 1 }))
  const shuffle = () => {
    if (original && colors) setState((s) => ({ ...s, perm: nextContrastSafePermutation(original, colors.palette, s.perm) }))
  }
  const add = () => {
    if (!original || !colors || deckFull || addLock.current) return
    addLock.current = true
    const added = onAddRound({ o: original.id, c: colors.id, v: state.perm }, state.editIdx)
    if (!added) {
      addLock.current = false
      return
    }
    setState((s) => ({ ...s, editIdx: null }))
    setJustAdded(true)
    window.clearTimeout(addedTimer.current)
    addedTimer.current = window.setTimeout(() => {
      setJustAdded(false)
      addLock.current = false
      // Reset the canvas to its default state for the next remix.
      setState((s) => ({ ...s, oId: null, cId: null, perm: 0, step: 1 }))
    }, 1000)
  }

  const canvas = (
    <RemixCanvas
      original={original}
      colors={colors}
      perm={state.perm}
      addState={addState}
      onShuffle={shuffle}
      onAdd={add}
      onClearOriginal={clearOriginal}
      onClearColors={clearColors}
      onClearAll={clearAll}
      portrait={portrait}
    />
  )

  if (portrait) {
    const steps: [1 | 2 | 3, string][] = [
      [1, '1 · Original'],
      [2, '2 · Colors'],
      [3, '3 · Remix'],
    ]
    return (
      <div className="create-port portrait">
        <div className="steps">
          {steps.map(([n, lb]) => (
            <button key={n} className={`step${state.step === n ? ' active' : ''}`} onClick={() => setState((s) => ({ ...s, step: n }))}>
              {lb}
            </button>
          ))}
        </div>
        {state.step === 1 && (
          <TeamBrowser
            title="CHOOSE THE ORIGINAL TEAM"
            state={state.browserO}
            onState={(b) => setState((s) => ({ ...s, browserO: b }))}
            selectedId={state.oId}
            onSelect={selectOriginal}
            portrait
          />
        )}
        {state.step === 2 && (
          <TeamBrowser
            title="CHOOSE THE COLOR TEAM"
            state={state.browserC}
            onState={(b) => setState((s) => ({ ...s, browserC: b }))}
            selectedId={state.cId}
            onSelect={selectColors}
            showSwatches
            portrait
          />
        )}
        {state.step === 3 && canvas}
      </div>
    )
  }

  return (
    <div className="create-land">
      <TeamBrowser
        title="ORIGINAL"
        state={state.browserO}
        onState={(b) => setState((s) => ({ ...s, browserO: b }))}
        selectedId={state.oId}
        onSelect={selectOriginal}
      />
      {canvas}
      <TeamBrowser
        title="COLORS"
        state={state.browserC}
        onState={(b) => setState((s) => ({ ...s, browserC: b }))}
        selectedId={state.cId}
        onSelect={selectColors}
        showSwatches
      />
    </div>
  )
}
