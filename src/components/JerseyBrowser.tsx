import { filterPlayers, findTeam, JERSEY_ERAS, LEAGUES, PLAYER_POOLS, seasonLabel, type Player, type PlayerLeague } from '../lib/teams'
import { Jersey } from './Jersey'

export interface JerseyBrowserState {
  league: PlayerLeague
  era: string
}

interface Props {
  state: JerseyBrowserState
  onState: (s: JerseyBrowserState) => void
  selectedId: string | null
  onSelect: (p: Player) => void
  portrait?: boolean
}

/** Pick a famous jersey: NFL or NBA, narrowed by era. Tiles name the player, since the creator is choosing the answer. */
export function JerseyBrowser({ state, onState, selectedId, onSelect, portrait }: Props) {
  const players = filterPlayers(state.league, state.era)
  return (
    <section className="panel" aria-labelledby="browser-jersey">
      <div className={`panel-head${portrait ? ' wrap' : ''}`}>
        <div id="browser-jersey" className="panel-title">CHOOSE THE JERSEY</div>
        <div className="seg" role="group" aria-label="League">
          {PLAYER_POOLS.map(({ league }) => (
            <button
              key={league}
              type="button"
              className={`seg-btn${state.league === league ? ' active' : ''}`}
              aria-pressed={state.league === league}
              onClick={() => onState({ league, era: 'All' })}
            >
              {LEAGUES[league].label}
            </button>
          ))}
        </div>
      </div>
      <div className="panel-note">Players guess who wore it from the team, the number and the season.</div>
      <div className="chips" role="group" aria-label="Era filter">
        {['All', ...JERSEY_ERAS].map((era) => (
          <button
            key={era}
            type="button"
            className={`chip${state.era === era ? ' active' : ''}`}
            aria-pressed={state.era === era}
            onClick={() => onState({ ...state, era })}
          >
            {era}
          </button>
        ))}
      </div>
      <div className="tile-grid" role="list" aria-label={`Jersey results, ${players.length} jersey${players.length === 1 ? '' : 's'}`}>
        {players.map((p) => {
          const sel = p.id === selectedId
          return (
            <div key={p.id} role="listitem">
              <button
                type="button"
                className={`tile${sel ? ' selected' : ''}`}
                onClick={() => onSelect(p)}
                aria-pressed={sel}
                aria-label={`${p.name}, number ${p.number}, ${findTeam(p.team)!.name}, ${seasonLabel(p)}`}
              >
                <div className="tile-logo">
                  <Jersey player={p} />
                </div>
                <div className="tile-name">{p.name}</div>
                <div className="tile-variants">
                  {findTeam(p.team)!.abbr} · #{p.number} · {seasonLabel(p)}
                </div>
                {sel && <div className="check">✓</div>}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
