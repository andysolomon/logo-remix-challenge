import { filterTeams, fullName, LEAGUES, type League, type Team } from '../lib/teams'
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
  const teams = filterTeams(state.league, state.conference, state.query)
  const chips = ['All', ...LEAGUES[state.league].conferences]
  const panelId = `browser-${title.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <section className="panel" aria-labelledby={panelId}>
      <div className={`panel-head${portrait ? ' wrap' : ''}`}>
        <div id={panelId} className="panel-title">{title}</div>
        <div className="seg" role="group" aria-label="League">
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
        placeholder="Search teams"
        type="search"
        autoComplete="off"
        aria-label={`Search ${title.toLowerCase()} teams`}
      />
      <div className="chips" role="group" aria-label="Conference filter">
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
      <div className="tile-grid" role="list" aria-label={`${title} results, ${teams.length} team${teams.length === 1 ? '' : 's'}`}>
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
