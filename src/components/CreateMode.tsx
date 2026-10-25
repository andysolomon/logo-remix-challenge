import { useEffect, useRef, useState } from 'react'
import { COLOR_DONOR_LEAGUES, COLOR_SOURCE_NOTE, findPlayer, findTeam, hasJerseys, JERSEYS_FILTER, MAX_DECK_ROUNDS, nextContrastSafePermutation, nextLogoVariant, withLogoVariant, type Player, type Round, type Team } from '../lib/teams'
import { JerseyCanvas } from './JerseyCanvas'
import { RemixCanvas, type AddState } from './RemixCanvas'
import { TeamBrowser, type BrowserState } from './TeamBrowser'

export interface CreateState {
  oId: string | null
  cId: string | null
  perm: number
  logoVariant?: string
  editIdx: number | null
  step: 1 | 2 | 3
  browserO: BrowserState
  browserC: BrowserState
  /** "Who wore it?" round: the jersey picked from the Original browser's Jerseys filter, in place of a logo. */
  pId: string | null
}

export const initialCreateState: CreateState = {
  oId: null,
  cId: null,
  perm: 0,
  editIdx: null,
  step: 1,
  browserO: { league: 'PRO', conference: 'All' },
  browserC: { league: 'PRO', conference: 'All' },
  pId: null,
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
  // A picked jersey, or browsing jerseys with no logo picked, swaps the remix canvas for the jersey preview.
  const jersey = !!player || (!original && state.browserO.conference === JERSEYS_FILTER && hasJerseys(state.browserO.league))
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
    setState((s) => (s.oId === t.id ? { ...s, oId: null, logoVariant: undefined, step: 1 } : { ...s, oId: t.id, pId: null, logoVariant: undefined, step: 2 }))
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
  // A jersey round has no logo or colors, so picking a jersey drops them.
  const selectPlayer = (p: Player) =>
    setState((s) => (s.pId === p.id ? { ...s, pId: null, step: 1 } : { ...s, pId: p.id, oId: null, cId: null, perm: 0, logoVariant: undefined, step: 3 }))
  const clearPlayer = () => setState((s) => ({ ...s, pId: null, step: 1 }))
  const add = () => {
    if (!original) return
    const round: Round = colors ? { o: original.id, c: colors.id, v: state.perm, l: state.logoVariant } : { o: original.id, v: 0, l: state.logoVariant }
    // Reset the canvas to its default state for the next remix.
    commit(round, (s) => ({ ...s, oId: null, cId: null, perm: 0, logoVariant: undefined, step: 1 }))
  }
  const addJersey = () => {
    if (player) commit({ o: player.team, v: 0, p: player.id }, (s) => ({ ...s, pId: null, step: 1 }))
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

  const canvas = jersey ? (
    <JerseyCanvas player={player} addState={jerseyAddState} onAdd={addJersey} onClear={clearPlayer} portrait={portrait} />
  ) : (
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
    const steps: [1 | 2 | 3, string][] = jersey
      ? [
          [1, '1 · Original'],
          [3, '2 · Preview'],
        ]
      : [
          [1, '1 · Original'],
          [2, '2 · Colors'],
          [3, '3 · Remix'],
        ]
    return (
      <div className="create-port portrait" {...panelProps} hidden={hidden}>
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
            jerseys={{ selectedId: state.pId, onSelect: selectPlayer }}
            portrait
          />
        )}
        {state.step === 2 && !jersey && original && (
          <button type="button" className="btn-keep-original" onClick={keepOriginalColors}>
            Skip · keep the original colors →
          </button>
        )}
        {state.step === 2 && !jersey && (
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
    <div className={`create-land${jersey ? ' jersey' : ''}`} {...panelProps} hidden={hidden}>
      <TeamBrowser
        title="ORIGINAL"
        state={state.browserO}
        onState={(b) => setState((s) => ({ ...s, browserO: b }))}
        selectedId={state.oId}
        onSelect={selectOriginal}
        jerseys={{ selectedId: state.pId, onSelect: selectPlayer }}
      />
      {canvas}
      {!jersey && (
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
      )}
    </div>
  )
}
