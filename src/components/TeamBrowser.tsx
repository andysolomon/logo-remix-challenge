import { useEffect, useRef } from 'react'
import { filterTeams, fullName, isBrandLeague, LEAGUES, type League, type Team } from '../lib/teams'
import { Logo } from './Logo'

export interface BrowserState {
  league: League
  conference: string
  query: string
}

interface Props {
  title: string
  state: BrowserState
  onState: (s: BrowserState) => void
  selectedId: string | null
  onSelect: (t: Team) => void
  showSwatches?: boolean
  portrait?: boolean
}

export function TeamBrowser({ title, state, onState, selectedId, onSelect, showSwatches, portrait }: Props) {
  const leagueRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const group = leagueRef.current
    const active = group?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
    if (!group || !active || group.scrollWidth <= group.clientWidth) return
    // Keep a restored selection visible without scrolling the page or logo list.
    const bounds = group.getBoundingClientRect()
    const button = active.getBoundingClientRect()
    if (button.left < bounds.left + 6) group.scrollLeft -= bounds.left + 6 - button.left
    else if (button.right > bounds.right - 6) group.scrollLeft += button.right - bounds.right + 6
  }, [state.league, portrait])
  const teams = filterTeams(state.league, state.conference, state.query)
  const chips = ['All', ...LEAGUES[state.league].conferences]
  const brands = isBrandLeague(state.league)
  const panelId = `browser-${title.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <section className="panel" aria-labelledby={panelId}>
      <div className={`panel-head${portrait ? ' wrap' : ''}`}>
        <div id={panelId} className="panel-title">{title}</div>
        <div ref={leagueRef} className="seg" role="group" aria-label="League or category">
          {(Object.keys(LEAGUES) as League[]).map((lg) => (
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
      <input
        className="search"
        value={state.query}
        onChange={(e) => onState({ ...state, query: e.target.value })}
        placeholder={brands ? 'Search brands' : 'Search teams'}
        type="search"
        autoComplete="off"
        aria-label={`Search ${title.toLowerCase()} ${brands ? 'brands' : 'teams'}`}
      />
      <div className="chips" role="group" aria-label={state.league === 'BRAND' ? 'Brand type filter' : brands ? 'Category filter' : 'Conference filter'}>
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
      <div className="tile-grid" role="list" aria-label={`${title} results, ${teams.length} ${brands ? 'brand' : 'team'}${teams.length === 1 ? '' : 's'}`}>
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
