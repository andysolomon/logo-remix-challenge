import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { cutPiece, type CutKeep, type LogoPart, type PartShape } from '../lib/parts'
import { scanLogo, type LogoScan } from '../lib/partsScan'
import type { Point } from '../lib/trace'
import type { Team } from '../lib/teams'
import { PartThumb } from './PartsTray'

/** A part on its way to the tray; `origin` names where in its logo it came from. */
export type TakenPart = PartShape & { origin?: string }

interface Props {
  /** Artwork parts are taken from, alternate already applied; null until a logo is picked. */
  team: Team | null
  name: string
  tray: LogoPart[]
  onAdd: (parts: TakenPart[]) => void
  canShuffle: boolean
  onShuffle: () => void
  portrait: boolean
}

const ScissorsIcon = () => (
  <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="6" cy="7" r="2.5" />
    <circle cx="6" cy="17" r="2.5" />
    <path d="M8 8.5L20 17M8 15.5L20 7" />
  </svg>
)

/** A drag adds a point to the loop every time it moves this far (stage units). */
const DRAW_STEP = 1.4
/** The loop may run a little past the stage, around artwork that touches its edge. */
const clampPoint = (n: number) => Math.min(108, Math.max(-8, n))
const round = (n: number) => Math.round(n * 10) / 10

/**
 * Designer's Parts tool: split the picked logo into parts and take the ones you want, by tapping them
 * or, when the piece is fused into a bigger shape, by drawing a loop around it.
 */
export function PartsCanvas({ team, name, tray, onAdd, canShuffle, onShuffle, portrait }: Props) {
  const logo = team?.logo ?? null
  const [scanned, setScanned] = useState<{ logo: string; scan: LogoScan | null } | null>(null)
  useEffect(() => {
    if (!logo) return
    let alive = true
    scanLogo(logo).then((scan) => alive && setScanned({ logo, scan }))
    return () => {
      alive = false
    }
  }, [logo])
  const scanning = !!logo && scanned?.logo !== logo
  const scan = logo && scanned?.logo === logo ? scanned.scan : null
  const parts = scan?.parts ?? []

  const [mode, setMode] = useState<'tap' | 'cut'>('tap')
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  // The loop being drawn: one entry per drag or tap, so Undo takes back a whole gesture.
  const [strokes, setStrokes] = useState<Point[][]>([])
  const [keep, setKeep] = useState<CutKeep>('inside')
  useEffect(() => {
    setPicked(new Set())
    setStrokes([])
  }, [logo])

  const origin = (key: string) => `${logo}#${key}`
  const inTray = (key: string) => tray.some((p) => p.origin === origin(key))
  const chosen = parts.filter((p) => picked.has(p.key))
  const fresh = chosen.filter((p) => !inTray(p.key))
  const toggle = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })
  const allPicked = parts.length > 0 && parts.every((p) => picked.has(p.key))
  const addPicked = () => {
    if (!fresh.length) return
    onAdd(fresh.map(({ key, area: _area, ...shape }) => ({ ...shape, origin: origin(key) })))
    setPicked(new Set())
  }

  const loop = useMemo(() => strokes.flat(), [strokes])
  const piece = useMemo(() => (scan && mode === 'cut' ? cutPiece(scan, loop, keep) : null), [scan, mode, loop, keep])
  const addPiece = () => {
    if (!piece) return
    const { key: _key, area: _area, ...shape } = piece
    onAdd([shape])
    setStrokes([])
  }

  const drawing = useRef(false)
  const stagePoint = (e: PointerEvent<SVGSVGElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect()
    return [round(clampPoint(((e.clientX - r.left) / r.width) * 100)), round(clampPoint(((e.clientY - r.top) / r.height) * 100))]
  }
  const startStroke = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button > 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    const p = stagePoint(e)
    setStrokes((s) => [...s, [p]])
  }
  const extendStroke = (e: PointerEvent<SVGSVGElement>) => {
    if (!drawing.current) return
    const p = stagePoint(e)
    setStrokes((s) => {
      const stroke = s[s.length - 1]
      const last = stroke?.[stroke.length - 1]
      if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) < DRAW_STEP) return s
      return [...s.slice(0, -1), [...stroke, p]]
    })
  }
  const endStroke = () => {
    drawing.current = false
  }

  const fused = parts.length === 1
  const status = !team
    ? ''
    : scanning
    ? 'Finding parts…'
    : !scan
    ? 'This logo’s parts could not be read. Try another logo.'
    : mode === 'cut'
    ? fused
      ? 'This logo is one fused shape. Draw around the piece you want.'
      : 'Draw around the piece you want.'
    : fused
    ? 'This logo is one fused shape. Cut out the piece you want.'
    : `${parts.length} parts found. Tap the ones you want.`

  const loopPath = loop.length >= 2 ? `M${loop.map((p) => p.join(' ')).join('L')}${loop.length >= 3 ? 'Z' : ''}` : ''
  // Handles mark where each gesture started, and every tapped point.
  const anchors = strokes.flatMap((s) => (s.length === 1 ? s : [s[0], s[s.length - 1]]))

  return (
    <>
      <div className="parts-head">
        <div className="micro">TAKE PARTS FROM</div>
        <div className={`canvas-name${team ? '' : ' placeholder'}`}>{team ? name : 'Pick a logo'}</div>
        <div className="parts-status">
          <span role="status" aria-live="polite" aria-atomic="true">
            {status}
          </span>
          {scan && mode === 'tap' && parts.length > 1 && (
            <button type="button" className="btn-clear" onClick={() => setPicked(allPicked ? new Set() : new Set(parts.map((p) => p.key)))} aria-label={allPicked ? 'Select no parts' : 'Select all parts'}>
              {allPicked ? 'none' : 'all'}
            </button>
          )}
        </div>
      </div>

      <div className="canvas-hero">
        {!team ? (
          <div className="empty-circle">{portrait ? 'Pick a logo in step 1 to take parts from it' : 'Pick a logo on the left to take parts from it'}</div>
        ) : !scan ? (
          <div className="parts-frame">
            <div className="parts-stage parts-wait">{scanning ? 'Finding parts…' : 'No parts found'}</div>
          </div>
        ) : mode === 'tap' ? (
          <div className="parts-frame">
            <svg className="parts-stage" viewBox="0 0 100 100" role="img" aria-label={`${name} logo${chosen.length ? `, ${chosen.length} of ${parts.length} parts selected` : ''}`}>
              <image href={scan.preview} width="100" height="100" opacity={chosen.length ? 0.22 : 1} />
              {chosen.map((p) => (
                <path key={p.key} d={p.d} fill={p.color} fillRule="evenodd" />
              ))}
              {chosen.map((p) => (
                <g key={p.key}>
                  <path className="part-halo" d={p.d} />
                  <path className="part-dash" d={p.d} />
                </g>
              ))}
              {/* Largest first, so a small part on top of a big one takes the tap. */}
              {parts.map((p) => (
                <path key={p.key} className="part-hit" d={p.d} fillRule="evenodd" onClick={() => toggle(p.key)} />
              ))}
            </svg>
          </div>
        ) : (
          <div className="parts-frame">
            <svg
              className="parts-stage cut-stage"
              viewBox="0 0 100 100"
              role="img"
              aria-label={`${name} logo. Draw a loop around the piece to cut out.`}
              onPointerDown={startStroke}
              onPointerMove={extendStroke}
              onPointerUp={endStroke}
              onPointerCancel={endStroke}
            >
              <image href={scan.preview} width="100" height="100" opacity={0.22} />
              {piece && <path d={piece.d} fill={piece.color} fillRule="evenodd" />}
              {loopPath && <path className="cut-loop" d={loopPath} />}
              {anchors.map((p, i) => (
                <circle key={i} className="cut-anchor" cx={p[0]} cy={p[1]} r="1.6" />
              ))}
            </svg>
          </div>
        )}
      </div>

      {scan && mode === 'tap' && (
        <div className="parts-grid" role="group" aria-label="Parts of this logo">
          {parts.map((p) => {
            const on = picked.has(p.key)
            const taken = inTray(p.key)
            return (
              <button key={p.key} type="button" className={`part-chip${on ? ' selected' : ''}`} aria-pressed={on} onClick={() => toggle(p.key)}>
                <PartThumb part={p} />
                <span className="part-chip-text">
                  <span className="part-chip-name">{p.name}</span>
                  <span className="part-chip-sub">{on ? 'Selected' : taken ? 'In your parts' : 'Tap to select'}</span>
                </span>
                {on && (
                  <span className="check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {scan && mode === 'cut' && (
        <div className="cut-row">
          <div className="seg-toggle" role="group" aria-label="Which side of the cut to keep">
            <button type="button" className={`seg-toggle-btn${keep === 'inside' ? ' active' : ''}`} aria-pressed={keep === 'inside'} onClick={() => setKeep('inside')}>
              Keep inside
            </button>
            <button type="button" className={`seg-toggle-btn${keep === 'outside' ? ' active' : ''}`} aria-pressed={keep === 'outside'} onClick={() => setKeep('outside')}>
              Keep outside
            </button>
          </div>
          <div className="cut-piece" role="status" aria-live="polite">
            {piece ? <PartThumb part={piece} /> : <div className="part-thumb empty" aria-hidden="true" />}
            <div className="tray-text">
              <div className="tray-name">Your piece</div>
              <div className="tray-sub">{piece ? 'Updates as you draw' : loop.length >= 3 ? 'Nothing inside the loop' : 'Draw a loop to cut'}</div>
            </div>
          </div>
          <div className="cut-edit">
            <button type="button" className="part-tool" onClick={() => setStrokes((s) => s.slice(0, -1))} disabled={!strokes.length}>
              Undo
            </button>
            <button type="button" className="part-tool" onClick={() => setStrokes([])} disabled={!strokes.length}>
              Clear
            </button>
          </div>
        </div>
      )}

      {team && (
        <div className="parts-mode-row">
          <div className="seg-toggle" role="group" aria-label="How to take parts">
            <button type="button" className={`seg-toggle-btn${mode === 'tap' ? ' active' : ''}`} aria-pressed={mode === 'tap'} onClick={() => setMode('tap')}>
              Tap parts
            </button>
            <button type="button" className={`seg-toggle-btn${mode === 'cut' ? ' active' : ''}`} aria-pressed={mode === 'cut'} onClick={() => setMode('cut')} disabled={!scan}>
              <ScissorsIcon />
              Cut a piece
            </button>
          </div>
          <div className="mode-hint">
            {mode === 'cut' ? 'Drag to draw freehand, or tap to drop points. The loop closes itself.' : 'When the piece you want is fused into a bigger shape, cut it out by hand.'}
          </div>
        </div>
      )}

      <div className="action-row design-actions">
        {mode === 'cut' && team ? (
          <>
            <button type="button" className="btn-shuffle" onClick={() => setMode('tap')}>
              Cancel
            </button>
            <button type="button" className={`btn-add${piece ? '' : ' disabled'}`} onClick={addPiece} disabled={!piece}>
              + ADD CUT PIECE
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-shuffle" onClick={onShuffle} disabled={!canShuffle} aria-label="Shuffle logo alternate">
              Shuffle Logo
            </button>
            <button type="button" className={`btn-add${fresh.length ? '' : ' disabled'}`} onClick={addPicked} disabled={!fresh.length}>
              {fresh.length ? `+ ADD ${fresh.length} PART${fresh.length === 1 ? '' : 'S'}` : chosen.length ? 'ALREADY IN YOUR PARTS' : 'PICK A PART'}
            </button>
          </>
        )}
      </div>
    </>
  )
}
