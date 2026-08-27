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
  return (
    <section className="panel">
      <div className={`panel-head${portrait ? ' wrap' : ''}`}>
        <div className="panel-title">{title}</div>
        <div className="seg">
          {(['PRO', 'COL'] as League[]).map((lg) => (
            <button
              key={lg}
              className={`seg-btn${state.league === lg ? ' active' : ''}`}
              onClick={() => onState({ ...state, league: lg, conference: 'All' })}
            >
              {LEAGUES[lg].label}
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
      <div className="chips">
        {chips.map((c) => (
          <button key={c} className={`chip${state.conference === c ? ' active' : ''}`} onClick={() => onState({ ...state, conference: c })}>
            {c}
          </button>
        ))}
      </div>
      <div className="tile-grid">
        {teams.map((t) => {
          const sel = t.id === selectedId
          return (
            <button
              key={t.id}
              className={`tile${showSwatches ? ' colors' : ''}${sel ? ' selected' : ''}`}
              onClick={() => onSelect(t)}
              aria-pressed={sel}
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
          )
        })}
      </div>
    </section>
  )
}
