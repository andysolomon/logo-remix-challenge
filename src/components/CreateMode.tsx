import { useEffect, useRef, useState } from 'react'
import { COLOR_DONOR_LEAGUES, COLOR_SOURCE_NOTE, findPlayer, findTeam, MAX_DECK_ROUNDS, nextContrastSafePermutation, nextLogoVariant, withLogoVariant, type Player, type Round, type Team } from '../lib/teams'
import { JerseyBrowser, type JerseyBrowserState } from './JerseyBrowser'
import { JerseyCanvas } from './JerseyCanvas'
import { RemixCanvas, type AddState } from './RemixCanvas'
import { TeamBrowser, type BrowserState } from './TeamBrowser'

/** What Create is making: a logo remix, or a "Who wore it?" jersey round. */
export type CreateKind = 'remix' | 'jersey'
const KINDS: [CreateKind, string][] = [
  ['remix', 'Logo remix'],
  ['jersey', 'Who wore it?'],
]

export interface CreateState {
  kind: CreateKind
  oId: string | null
  cId: string | null
  perm: number
  logoVariant?: string
  editIdx: number | null
  step: 1 | 2 | 3
  browserO: BrowserState
  browserC: BrowserState
  /** Jersey rounds: the picked player, the portrait step and the jersey browser's filters. */
  pId: string | null
  jerseyStep: 1 | 2
  browserP: JerseyBrowserState
}

export const initialCreateState: CreateState = {
  kind: 'remix',
  oId: null,
  cId: null,
  perm: 0,
  editIdx: null,
  step: 1,
  browserO: { league: 'PRO', conference: 'All' },
  browserC: { league: 'PRO', conference: 'All' },
  pId: null,
  jerseyStep: 1,
  browserP: { league: 'NBA', era: 'All' },
}

interface Props {
  state: CreateState
  setState: (fn: (s: CreateState) => CreateState) => void
  portrait: boolean
  deckCount: number
  onAddRound: (round: Round, editIdx: number | null) => boolean
  hidden?: boolean
}

const panelProps = {
  id: 'panel-create',
  role: 'tabpanel' as const,
  'aria-labelledby': 'tab-create',
}

export function CreateMode({ state, setState, portrait, deckCount, onAddRound, hidden }: Props) {
  const originalTeam = state.oId ? findTeam(state.oId) ?? null : null
  const original = originalTeam ? withLogoVariant(originalTeam, state.logoVariant) : null
  const colors = state.cId ? findTeam(state.cId) ?? null : null
  const player = state.pId ? findPlayer(state.pId) ?? null : null
  const [justAdded, setJustAdded] = useState(false)
  const addedTimer = useRef<number | undefined>(undefined)
  const addLock = useRef(false)
  useEffect(() => () => window.clearTimeout(addedTimer.current), [])

  const deckFull = state.editIdx == null && deckCount >= MAX_DECK_ROUNDS
  // A logo with no color source goes in as-is, in its original colors.
  const addState: AddState = justAdded ? 'added' : deckFull ? 'full' : !original ? 'disabled' : state.editIdx != null ? 'save' : 'add'
  const jerseyAddState: AddState = justAdded ? 'added' : deckFull ? 'full' : !player ? 'disabled' : state.editIdx != null ? 'save' : 'add'

  // Clicking the already-selected tile deselects it.
  const selectOriginal = (t: Team) =>
    setState((s) => (s.oId === t.id ? { ...s, oId: null, logoVariant: undefined, step: 1 } : { ...s, oId: t.id, logoVariant: undefined, step: 2 }))
  const selectColors = (t: Team) =>
    setState((s) => (s.cId === t.id ? { ...s, cId: null, perm: 0, step: 2 } : { ...s, cId: t.id, step: 3 }))
  const clearOriginal = () => setState((s) => ({ ...s, oId: null, logoVariant: undefined, step: 1 }))
  const clearColors = () => setState((s) => ({ ...s, cId: null, perm: 0, step: 2 }))
  const keepOriginalColors = () => setState((s) => ({ ...s, cId: null, perm: 0, step: 3 }))
  const clearAll = () => setState((s) => ({ ...s, oId: null, cId: null, perm: 0, logoVariant: undefined, editIdx: null, step: 1 }))
  const shuffle = () => {
    if (original && colors) setState((s) => ({ ...s, perm: nextContrastSafePermutation(original, colors.palette, s.perm) }))
  }
  const shuffleLogo = () => {
    if (originalTeam) setState((s) => ({ ...s, logoVariant: nextLogoVariant(originalTeam, s.logoVariant) }))
  }
  const selectPlayer = (p: Player) =>
    setState((s) => (s.pId === p.id ? { ...s, pId: null, jerseyStep: 1 } : { ...s, pId: p.id, jerseyStep: 2 }))
  const clearPlayer = () => setState((s) => ({ ...s, pId: null, jerseyStep: 1 }))
  const add = () => {
    if (!original) return
    const round: Round = colors ? { o: original.id, c: colors.id, v: state.perm, l: state.logoVariant } : { o: original.id, v: 0, l: state.logoVariant }
    // Reset the canvas to its default state for the next remix.
    commit(round, (s) => ({ ...s, oId: null, cId: null, perm: 0, logoVariant: undefined, step: 1 }))
  }
  const addJersey = () => {
    if (player) commit({ o: player.team, v: 0, p: player.id }, (s) => ({ ...s, pId: null, jerseyStep: 1 }))
  }
  const commit = (round: Round, reset: (s: CreateState) => CreateState) => {
    if (deckFull || addLock.current) return
    addLock.current = true
    const added = onAddRound(round, state.editIdx)
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
      setState(reset)
    }, 1000)
  }

  const kindSwitch = (
    <div className="seg create-kind" role="group" aria-label="Round type">
      {KINDS.map(([k, lb]) => (
        <button key={k} type="button" className={`seg-btn${state.kind === k ? ' active' : ''}`} aria-pressed={state.kind === k} onClick={() => setState((s) => ({ ...s, kind: k }))}>
          {lb}
        </button>
      ))}
    </div>
  )

  if (state.kind === 'jersey') {
    const browser = (
      <JerseyBrowser state={state.browserP} onState={(b) => setState((s) => ({ ...s, browserP: b }))} selectedId={state.pId} onSelect={selectPlayer} portrait={portrait} />
    )
    const preview = <JerseyCanvas player={player} addState={jerseyAddState} onAdd={addJersey} onClear={clearPlayer} portrait={portrait} />
    if (!portrait) {
      return (
        <div className="create-land jersey" {...panelProps} hidden={hidden}>
          {kindSwitch}
          {browser}
          {preview}
        </div>
      )
    }
    const steps: [1 | 2, string][] = [
      [1, '1 · Jersey'],
      [2, '2 · Preview'],
    ]
    return (
      <div className="create-port portrait" {...panelProps} hidden={hidden}>
        {kindSwitch}
        <div className="steps" role="group" aria-label="Create jersey round steps">
          {steps.map(([n, lb]) => (
            <button
              key={n}
              type="button"
              className={`step${state.jerseyStep === n ? ' active' : ''}`}
              aria-current={state.jerseyStep === n ? 'step' : undefined}
              onClick={() => setState((s) => ({ ...s, jerseyStep: n }))}
            >
              {lb}
            </button>
          ))}
        </div>
        {state.jerseyStep === 1 ? browser : preview}
      </div>
    )
  }

  const canvas = (
    <RemixCanvas
      original={original}
      colors={colors}
      perm={state.perm}
      addState={addState}
      onShuffle={shuffle}
      onShuffleLogo={shuffleLogo}
      logoVariant={state.logoVariant}
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
      <div className="create-port portrait" {...panelProps} hidden={hidden}>
        {kindSwitch}
        <div className="steps" role="group" aria-label="Create remix steps">
          {steps.map(([n, lb]) => (
            <button
              key={n}
              type="button"
              className={`step${state.step === n ? ' active' : ''}`}
              aria-current={state.step === n ? 'step' : undefined}
              onClick={() => setState((s) => ({ ...s, step: n }))}
            >
              {lb}
            </button>
          ))}
        </div>
        {state.step === 1 && (
          <TeamBrowser
            title="CHOOSE THE ORIGINAL"
            state={state.browserO}
            onState={(b) => setState((s) => ({ ...s, browserO: b }))}
            selectedId={state.oId}
            onSelect={selectOriginal}
            portrait
          />
        )}
        {state.step === 2 && original && (
          <button type="button" className="btn-keep-original" onClick={keepOriginalColors}>
            Skip · keep the original colors →
          </button>
        )}
        {state.step === 2 && (
          <TeamBrowser
            title="CHOOSE THE COLORS"
            state={state.browserC}
            onState={(b) => setState((s) => ({ ...s, browserC: b }))}
            selectedId={state.cId}
            onSelect={selectColors}
            showSwatches
            leagues={COLOR_DONOR_LEAGUES}
            note={COLOR_SOURCE_NOTE}
            portrait
          />
        )}
        {state.step === 3 && canvas}
      </div>
    )
  }

  return (
    <div className="create-land" {...panelProps} hidden={hidden}>
      {kindSwitch}
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
        leagues={COLOR_DONOR_LEAGUES}
        note={COLOR_SOURCE_NOTE}
      />
    </div>
  )
}
