import { useEffect, useRef, type WheelEvent } from 'react'
import { entryNoun, filterTeams, fullName, LEAGUES, type League, type Team } from '../lib/teams'
import { Logo } from './Logo'

export interface BrowserState {
  league: League
  conference: string
}

interface Props {
  title: string
  state: BrowserState
  onState: (s: BrowserState) => void
  selectedId: string | null
  onSelect: (t: Team) => void
  showSwatches?: boolean
  portrait?: boolean
  /** Collections offered, in LEAGUES order; all of them when omitted. A restored state outside the list shows the first. */
  leagues?: readonly League[]
  /** One line under the title explaining the collections on offer. */
  note?: string
}

/** A mouse wheel scrolls a swipeable row sideways; trackpads and touch already scroll it natively. */
function wheelSideways(e: WheelEvent<HTMLDivElement>) {
  const row = e.currentTarget
  if (row.scrollWidth <= row.clientWidth || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return
  row.scrollLeft += e.deltaY
}

export function TeamBrowser({ title, state: rawState, onState, selectedId, onSelect, showSwatches, portrait, leagues, note }: Props) {
  const offered = (Object.keys(LEAGUES) as League[]).filter((lg) => !leagues || leagues.includes(lg))
  const state = offered.includes(rawState.league) ? rawState : { league: offered[0], conference: 'All' }
  const leagueRef = useRef<HTMLDivElement>(null)
  const chipsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Keep a restored selection visible without scrolling the page or logo list.
    for (const group of [leagueRef.current, chipsRef.current]) {
      const active = group?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
      if (!group || !active || group.scrollWidth <= group.clientWidth) continue
      const bounds = group.getBoundingClientRect()
      const button = active.getBoundingClientRect()
      if (button.left < bounds.left + 6) group.scrollLeft -= bounds.left + 6 - button.left
      else if (button.right > bounds.right - 6) group.scrollLeft += button.right - bounds.right + 6
    }
  }, [state.league, state.conference, portrait])
  const teams = filterTeams(state.league, state.conference, '')
  const chips = ['All', ...LEAGUES[state.league].conferences]
  const noun = entryNoun(state.league)
  const panelId = `browser-${title.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <section className="panel" aria-labelledby={panelId}>
      <div className={`panel-head${portrait ? ' wrap' : ''}`}>
        <div id={panelId} className="panel-title">{title}</div>
        <div ref={leagueRef} className="seg" role="group" aria-label="League or category" onWheel={wheelSideways}>
          {offered.map((lg) => (
            <button
              key={lg}
              type="button"
              className={`seg-btn${state.league === lg ? ' active' : ''}`}
              aria-pressed={state.league === lg}
              onClick={() => onState({ ...state, league: lg, conference: 'All' })}
            >
              {lg === 'HS' ? 'HS' : LEAGUES[lg].label}
            </button>
          ))}
        </div>
      </div>
      {note && <div className="panel-note">{note}</div>}
      <div ref={chipsRef} className="chips" role="group" aria-label={state.league === 'BRAND' ? 'Brand type filter' : state.league === 'SOCCER' ? 'League filter' : noun === 'team' || state.league === 'MLS' ? 'Conference filter' : 'Category filter'} onWheel={wheelSideways}>
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            className={`chip${state.conference === c ? ' active' : ''}`}
            aria-pressed={state.conference === c}
            onClick={() => onState({ ...state, conference: c })}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="tile-grid" role="list" aria-label={`${title} results, ${teams.length} ${noun}${teams.length === 1 ? '' : 's'}`}>
        {teams.map((t) => {
          const sel = t.id === selectedId
          return (
            <div key={t.id} role="listitem">
              <button
                type="button"
                className={`tile${showSwatches ? ' colors' : ''}${sel ? ' selected' : ''}`}
                onClick={() => onSelect(t)}
                aria-pressed={sel}
                aria-label={fullName(t)}
              >
                <div className="tile-logo">
                  <Logo team={t} />
                </div>
                <div className="tile-name">{fullName(t)}</div>
                {!showSwatches && t.alternateLogos?.length ? <div className="tile-variants">{t.alternateLogos.length + 1} logos</div> : null}
                {showSwatches && (
                  <div className="swatches">
                    {t.palette.map((h, i) => (
                      <span key={i} className={`swatch ${portrait ? 's13' : 's12'}`} style={{ background: h }} />
                    ))}
                  </div>
                )}
                {sel && <div className="check">✓</div>}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
