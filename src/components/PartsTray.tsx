import { partsSummary, type BuildState } from '../lib/build'
import { partViewBox, thumbTile, type LogoPart, type PartShape } from '../lib/parts'

/** A part on its own: its outline in a square, on a contrasting tile when its color would vanish. */
export function PartThumb({ part, color, className = '' }: { part: PartShape; color?: string; className?: string }) {
  const fill = color ?? part.color
  const tile = thumbTile(fill)
  return (
    <svg className={`part-thumb${tile ? ' tiled' : ''}${className ? ' ' + className : ''}`} style={tile ? { background: tile } : undefined} viewBox={partViewBox(part.box)} aria-hidden="true">
      <path d={part.d} fill={fill} fillRule="evenodd" />
    </svg>
  )
}

export const ArrowIcon = () => (
  <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

const CloseIcon = () => (
  <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

interface Props {
  parts: LogoPart[]
  build: BuildState
  /** Parts: collect and drop parts. Build: place them on the logo. */
  tool: 'parts' | 'build'
  /** Logo parts are being taken from; its parts are marked as the newest. */
  sourceId: string | null
  onRemove: (id: string) => void
  onPlace: (id: string) => void
  onSelectLayer: (layerId: string) => void
  onBuild: () => void
  onTakeParts: () => void
  /** Empty the tray and start the logo over. */
  onClear: () => void
}

/** Color a part shows in the tray: its slot color once it is on the logo, its own color until then. */
export const trayColor = (part: LogoPart, build: BuildState) => {
  const layer = build.layers.find((l) => l.partId === part.id)
  return layer ? build.colors[layer.slot] : part.color
}

/** The tray: every part taken so far, from any logo. The right column in landscape. */
export function PartsTray({ parts, build, tool, sourceId, onRemove, onPlace, onSelectLayer, onBuild, onTakeParts, onClear }: Props) {
  return (
    <section className="panel parts-tray" aria-labelledby="parts-tray-title">
      <div className="tray-head">
        <div id="parts-tray-title" className="panel-title">YOUR PARTS</div>
        {parts.length > 0 && (
          <button type="button" className="btn-clear" onClick={onClear} aria-label="Remove all your parts and start over">
            clear
          </button>
        )}
        <div className="tray-count" aria-label={partsSummary(parts)}>{parts.length}</div>
      </div>
      <div className="panel-note">{tool === 'build' ? 'Tap Place to drop a part onto your logo.' : 'Parts you take from any logo collect here.'}</div>
      <div className="tray-list" role="list" aria-label="Your parts">
        {parts.map((p) => {
          const layers = build.layers.filter((l) => l.partId === p.id)
          const selected = layers.find((l) => l.id === build.selected)
          const fresh = tool === 'parts' && p.sourceId === sourceId
          return (
            <div key={p.id} role="listitem" className={`tray-row${(tool === 'build' ? selected : fresh) ? ' current' : ''}`}>
              <PartThumb part={p} color={trayColor(p, build)} />
              <div className="tray-text">
                <div className="tray-name">{p.name}</div>
                <div className="tray-sub">{p.source}</div>
              </div>
              {tool === 'parts' ? (
                <button type="button" className="tray-remove" onClick={() => onRemove(p.id)} aria-label={`Remove ${p.name} from your parts`}>
                  <CloseIcon />
                </button>
              ) : layers.length ? (
                <button
                  type="button"
                  className={`tray-badge${selected ? ' selected' : ''}`}
                  aria-pressed={!!selected}
                  aria-label={selected ? `${p.name} is selected` : `Select ${p.name} on your logo`}
                  onClick={() => onSelectLayer((selected ?? layers[layers.length - 1]).id)}
                >
                  {selected ? 'Selected' : 'On logo'}
                </button>
              ) : (
                <button type="button" className="tray-place" onClick={() => onPlace(p.id)} aria-label={`Place ${p.name} on your logo`}>
                  Place
                </button>
              )}
            </div>
          )
        })}
        {tool === 'parts' && <div className="tray-hint">{parts.length ? 'Pick another logo on the left to take parts from it too.' : 'Pick a logo on the left, tap the parts you want, then add them.'}</div>}
        {tool === 'build' && !parts.length && <div className="tray-hint">No parts yet. Take some from any logo first.</div>}
      </div>
      {tool === 'parts' ? (
        <button type="button" className="btn-shuffle tray-go" onClick={onBuild} disabled={!parts.length}>
          Build with these
          <ArrowIcon />
        </button>
      ) : (
        <button type="button" className="btn-shuffle tray-go" onClick={onTakeParts}>
          <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Take more parts
        </button>
      )}
    </section>
  )
}

/** Phone: the tray as a bar under the Parts step, with the way on to Build. Tapping a part drops it. */
export function PartsTrayBar({ parts, build, onRemove, onBuild }: Pick<Props, 'parts' | 'build' | 'onRemove' | 'onBuild'>) {
  return (
    <div className="tray-bar" role="group" aria-label="Your parts">
      <div className="tray-bar-thumbs">
        {parts.map((p) => (
          <button key={p.id} type="button" className="tray-bar-part" onClick={() => onRemove(p.id)} aria-label={`Remove ${p.name} from your parts`} title={`Remove ${p.name}`}>
            <PartThumb part={p} color={trayColor(p, build)} />
            <span className="tray-bar-x" aria-hidden="true">
              <CloseIcon />
            </span>
          </button>
        ))}
      </div>
      <div className="tray-text">
        <div className="tray-name">{parts.length === 1 ? '1 part' : `${parts.length} parts`}</div>
        <div className="tray-sub">{parts.length ? `from ${new Set(parts.map((p) => p.sourceId)).size === 1 ? '1 logo' : `${new Set(parts.map((p) => p.sourceId)).size} logos`}` : 'Add parts to build'}</div>
      </div>
      <button type="button" className="btn-shuffle tray-bar-go" onClick={onBuild} disabled={!parts.length}>
        Build
        <ArrowIcon />
      </button>
    </div>
  )
}
