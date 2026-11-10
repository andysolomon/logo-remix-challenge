import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import {
  DEFAULT_BUILD_NAME,
  clearLayers,
  duplicateLayer,
  layerBox,
  layerTransform,
  partsSummary,
  placePart,
  placedParts,
  removeLayer,
  rotateBuildColors,
  shiftLayer,
  snapGuides,
  snapMove,
  snapRotation,
  snapScale,
  updateLayer,
  type BuildLayer,
  type BuildState,
} from '../lib/build'
import type { LogoPart } from '../lib/parts'
import { ColorPicker } from './ColorPicker'
import { PartThumb, trayColor } from './PartsTray'

interface Props {
  parts: LogoPart[]
  build: BuildState
  onBuild: (fn: (b: BuildState) => BuildState) => void
  name: string
  onName: (name: string) => void
  /** Export background, shown behind the logo like the file will have it. */
  background: string | null
  /** Team whose palette the colors started from, if any. */
  paletteName: string | null
  onPalette: () => void
  onTakeParts: () => void
  /** Empty the tray and start the logo over. */
  onClearParts: () => void
  portrait: boolean
}

type Gesture = { kind: 'move' | 'scale' | 'rotate'; start: BuildLayer; x: number; y: number; rect: DOMRect; moved: boolean; fromBox: boolean }

const SLOT_NAMES = ['Color 1', 'Color 2', 'Color 3']
/** A dragged part snaps to the stage's edges and middle from this many screen pixels away. */
const SNAP_PX = 8

/**
 * Designer's Build tool: the stage where taken parts become a logo. A part is dragged to move it,
 * resized from the corner handles, turned from the handle above it, and painted in one of three
 * color slots.
 */
export function BuildCanvas({ parts, build, onBuild, name, onName, background, paletteName, onPalette, onTakeParts, onClearParts, portrait }: Props) {
  const partOf = (layer: BuildLayer) => parts.find((p) => p.id === layer.partId)
  // The layer being dragged, with its in-flight change; committed on release so a drag re-renders only the stage.
  const [live, setLive] = useState<BuildLayer | null>(null)
  const liveRef = useRef<BuildLayer | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const stage = useRef<HTMLDivElement>(null)
  const layers = build.layers.map((l) => (live && l.id === live.id ? live : l)).filter((l) => partOf(l))
  const selected = layers.find((l) => l.id === build.selected) ?? null
  const selectedPart = selected ? partOf(selected)! : null
  const at = selected ? build.layers.findIndex((l) => l.id === selected.id) : -1

  const [picker, setPicker] = useState<number | null>(null)
  const select = (id: string | null) => onBuild((b) => (b.selected === id ? b : { ...b, selected: id }))
  const change = (patch: Partial<BuildLayer>) => selected && onBuild((b) => updateLayer(b, selected.id, patch))

  const stageUnits = (g: Gesture, clientX: number, clientY: number) => {
    const k = 100 / g.rect.width
    return { x: (clientX - g.rect.left) * k, y: (clientY - g.rect.top) * k }
  }
  const begin = (e: PointerEvent, kind: Gesture['kind'], layer: BuildLayer, fromBox = false) => {
    if (e.button > 0 || !stage.current) return
    e.preventDefault()
    e.stopPropagation()
    stage.current.setPointerCapture(e.pointerId)
    stage.current.focus({ preventScroll: true })
    gesture.current = { kind, start: layer, x: e.clientX, y: e.clientY, rect: stage.current.getBoundingClientRect(), moved: false, fromBox }
    select(layer.id)
  }
  const onMove = (e: PointerEvent) => {
    const g = gesture.current
    if (!g) return
    if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 3) return
    g.moved = true
    const from = stageUnits(g, g.x, g.y)
    const to = stageUnits(g, e.clientX, e.clientY)
    let next: BuildLayer
    if (g.kind === 'move') {
      next = { ...g.start, x: g.start.x + to.x - from.x, y: g.start.y + to.y - from.y }
    } else if (g.kind === 'scale') {
      const d0 = Math.hypot(from.x - g.start.x, from.y - g.start.y) || 1
      next = { ...g.start, scale: (g.start.scale * Math.hypot(to.x - g.start.x, to.y - g.start.y)) / d0 }
    } else {
      const a0 = Math.atan2(from.y - g.start.y, from.x - g.start.x)
      const a1 = Math.atan2(to.y - g.start.y, to.x - g.start.x)
      next = { ...g.start, rotation: snapRotation(g.start.rotation + ((a1 - a0) * 180) / Math.PI) }
    }
    // Same limits as a committed change, so the drag never shows what a release would undo.
    const limit = (l: BuildLayer) => updateLayer({ ...build, layers: [l] }, l.id, {}).layers[0]
    const part = partOf(next)
    if (part && g.kind !== 'rotate') {
      const within = (SNAP_PX * 100) / g.rect.width
      next = limit(g.kind === 'move' ? snapMove(limit(next), part, within) : snapScale(limit(next), part, within))
    } else next = limit(next)
    liveRef.current = next
    setLive(next)
  }
  const onUp = (e: PointerEvent) => {
    const g = gesture.current
    gesture.current = null
    const done = liveRef.current
    liveRef.current = null
    setLive(null)
    if (!g) return
    if (done) {
      onBuild((b) => updateLayer(b, done.id, done))
    } else if (g.fromBox && g.kind === 'move' && !g.moved) {
      // A tap inside the selection box: another part under the finger takes the selection;
      // the selected part itself, or bare canvas, lets go of it.
      const under = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el instanceof SVGElement && el.dataset.layer)
      const id = (under as SVGElement | undefined)?.dataset.layer
      select(id && id !== g.start.id ? id : null)
    }
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!selected || e.target !== e.currentTarget) return
    const step = e.shiftKey ? 5 : 1
    const moves: Record<string, Partial<BuildLayer>> = {
      ArrowLeft: { x: selected.x - step },
      ArrowRight: { x: selected.x + step },
      ArrowUp: { y: selected.y - step },
      ArrowDown: { y: selected.y + step },
      '+': { scale: selected.scale * 1.05 },
      '=': { scale: selected.scale * 1.05 },
      '-': { scale: selected.scale / 1.05 },
      '[': { rotation: selected.rotation - 15 },
      ']': { rotation: selected.rotation + 15 },
    }
    if (moves[e.key]) change(moves[e.key])
    else if (e.key === 'Delete' || e.key === 'Backspace') onBuild((b) => removeLayer(b, selected.id))
    else if (e.key === 'Escape') select(null)
    else return
    e.preventDefault()
  }

  const setColor = (slot: number, hex: string) =>
    onBuild((b) => {
      const colors: BuildState['colors'] = [...b.colors]
      colors[slot] = hex
      return { ...b, colors, paletteId: null }
    })

  const onLogo = placedParts(build.layers, parts)
  const art = (
    <svg className="build-art" viewBox="0 0 100 100" aria-hidden="true">
      {layers.map((l) => {
        const part = partOf(l)!
        return <path key={l.id} data-layer={l.id} transform={layerTransform(l, part)} d={part.d} fill={build.colors[l.slot]} fillRule="evenodd" onPointerDown={(e) => begin(e, 'move', l)} />
      })}
    </svg>
  )
  const box = selected && selectedPart ? layerBox(selected, selectedPart) : null
  // While a part is dragged or resized, the stage lines it has snapped onto light up.
  const livePart = live ? partOf(live) : undefined
  const guides = live && livePart ? snapGuides(live, livePart) : null
  const preview = (
    <div className={`cp-stage${background ? ' bg' : ''}`} style={background ? { background } : undefined}>
      <svg className="build-mini" viewBox="0 0 100 100" aria-hidden="true">
        {layers.map((l) => {
          const part = partOf(l)!
          return <path key={l.id} transform={layerTransform(l, part)} d={part.d} fill={build.colors[l.slot]} fillRule="evenodd" />
        })}
      </svg>
    </div>
  )
  const describe = layers.length
    ? `Your logo: ${layers.map((l) => partOf(l)!.name).join(', ')}, back to front.`
    : 'Your logo is empty.'

  return (
    <>
      <div className="parts-head">
        <div className="micro-row">
          <div className="micro">YOUR LOGO</div>
          {build.layers.length > 0 && (
            <button type="button" className="btn-clear" onClick={() => onBuild(clearLayers)} aria-label="Clear your logo: take every part off it">
              clear
            </button>
          )}
        </div>
        <input
          className="canvas-name build-name"
          value={name}
          placeholder={DEFAULT_BUILD_NAME}
          maxLength={40}
          spellCheck={false}
          aria-label="Logo name, used for the file name"
          onChange={(e) => onName(e.target.value)}
        />
        <div className="parts-status">{onLogo.length ? partsSummary(onLogo) : 'Place parts to start your logo'}</div>
      </div>

      <div
        className="canvas-hero"
        onPointerDown={(e) => {
          // A press beside the stage lets go of the selection too.
          if (e.target === e.currentTarget) select(null)
        }}
      >
        <div className={`parts-frame stage-edge${background ? ' bg' : ''}`}>
          <div
            ref={stage}
            className="parts-stage build-stage"
            style={background ? { background } : undefined}
            tabIndex={0}
            role="group"
            aria-label={`${describe}${selectedPart ? ` ${selectedPart.name} is selected: arrow keys move it, plus and minus resize it, brackets turn it.` : ''}`}
            onPointerDown={(e) => {
              // A press on the empty stage lets go of the selection.
              if (e.target === e.currentTarget || (e.target as Element).classList.contains('build-art')) select(null)
            }}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onKeyDown={onKey}
          >
            {art}
            {!layers.length && (
              <div className="build-empty">
                {parts.length ? (portrait ? 'Tap a part below to place it' : 'Tap Place on a part to put it here') : 'Take parts from a logo, then place them here'}
              </div>
            )}
            {guides?.x.map((x) => <span key={`x${x}`} className="build-guide v" style={{ left: `${x}%` }} />)}
            {guides?.y.map((y) => <span key={`y${y}`} className="build-guide h" style={{ top: `${y}%` }} />)}
            {box && selected && (
              <div
                className="build-sel"
                style={{ left: `${box.cx}%`, top: `${box.cy}%`, width: `${box.w}%`, height: `${box.h}%`, transform: `translate(-50%, -50%) rotate(${box.rotation}deg)` }}
                onPointerDown={(e) => begin(e, 'move', selected, true)}
              >
                {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                  <span key={corner} className={`build-handle ${corner}`} onPointerDown={(e) => begin(e, 'scale', selected)} />
                ))}
                <span className="build-turn-line" />
                <span className="build-handle turn" onPointerDown={(e) => begin(e, 'rotate', selected)} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="part-tools" role="group" aria-label={selectedPart ? `Selected part: ${selectedPart.name}` : 'Selected part'}>
        <button
          type="button"
          className="part-tool"
          disabled={!selected}
          onClick={() => selected && change({ slot: selected.slot + 1 })}
          aria-label={selectedPart ? `${selectedPart.name} uses color ${selected!.slot + 1}. Tap to move it to the next color.` : 'Color of the selected part'}
        >
          <span className="part-tool-swatch" style={{ background: selected ? build.colors[selected.slot] : 'transparent' }} />
          {selected ? SLOT_NAMES[selected.slot] : 'Color'}
        </button>
        <button type="button" className="part-tool" disabled={!selected} onClick={() => selected && change({ flip: !selected.flip })} aria-pressed={!!selected?.flip}>
          <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4v16M8 8l-4 4 4 4M16 8l4 4-4 4" />
          </svg>
          Flip
        </button>
        <button type="button" className="part-tool" disabled={!selected} onClick={() => selected && onBuild((b) => duplicateLayer(b, selected.id))}>
          <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="8" y="8" width="11" height="11" rx="2" />
            <path d="M5 15V6a1 1 0 0 1 1-1h9" />
          </svg>
          Copy
        </button>
        <button type="button" className="part-tool icon" disabled={!selected || at <= 0} onClick={() => selected && onBuild((b) => shiftLayer(b, selected.id, -1))} aria-label={selectedPart ? `Send ${selectedPart.name} backward` : 'Send backward'} title="Send backward">
          <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M7 14l5 5 5-5" />
          </svg>
        </button>
        <button type="button" className="part-tool icon" disabled={!selected || at >= build.layers.length - 1} onClick={() => selected && onBuild((b) => shiftLayer(b, selected.id, 1))} aria-label={selectedPart ? `Bring ${selectedPart.name} forward` : 'Bring forward'} title="Bring forward">
          <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 19V5M7 10l5-5 5 5" />
          </svg>
        </button>
        <button type="button" className="part-tool danger" disabled={!selected} onClick={() => selected && onBuild((b) => removeLayer(b, selected.id))}>
          <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
          </svg>
          Delete
        </button>
      </div>

      {layers.length > 0 && (
        <div className="build-layers">
          <div className="micro">LAYERS · BACK TO FRONT</div>
          <div className="layer-strip" role="group" aria-label="Layers, back to front">
            {layers.map((l) => {
              const part = partOf(l)!
              const on = l.id === build.selected
              return (
                <button key={l.id} type="button" className={`layer-chip${on ? ' selected' : ''}`} aria-pressed={on} onClick={() => select(on ? null : l.id)}>
                  <PartThumb part={part} color={build.colors[l.slot]} />
                  <span className="layer-chip-name">{part.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="design-slots" role="group" aria-label="Logo colors by slot">
        <div className="design-chips">
          {build.colors.map((hex, slot) => {
            const used = selected?.slot === slot
            return (
              <button
                key={slot}
                type="button"
                className={`design-chip${used || picker === slot ? ' open' : ''}`}
                style={{ background: hex }}
                title={SLOT_NAMES[slot]}
                aria-label={`${SLOT_NAMES[slot]}, ${hex}${used ? ', used by the selected part' : ''}`}
                aria-expanded={picker === slot}
                onClick={() => setPicker((p) => (p === slot ? null : slot))}
              />
            )
          })}
        </div>
        <div className="color-caption">{paletteName ? `${paletteName} colors` : 'Custom colors'}</div>
        {picker !== null && (
          <ColorPicker key={picker} value={build.colors[picker]} label={SLOT_NAMES[picker]} onChange={(hex) => setColor(picker, hex)} onClose={() => setPicker(null)} preview={preview} />
        )}
      </div>

      {portrait && (
        <div className="build-layers">
          <div className="micro-row">
            <div className="micro">YOUR PARTS</div>
            {parts.length > 0 && (
              <button type="button" className="btn-clear" onClick={onClearParts} aria-label="Remove all your parts and start over">
                clear
              </button>
            )}
          </div>
          <div className="layer-strip" role="group" aria-label="Your parts">
            {parts.map((p) => {
              const placed = build.layers.filter((l) => l.partId === p.id)
              const on = placed.some((l) => l.id === build.selected)
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`layer-chip${on ? ' selected' : ''}`}
                  aria-label={placed.length ? `Select ${p.name} on your logo` : `Place ${p.name} on your logo`}
                  onClick={() => (placed.length ? select(placed[placed.length - 1].id) : onBuild((b) => placePart(b, p)))}
                >
                  <PartThumb part={p} color={trayColor(p, build)} />
                  <span className="layer-chip-name">{placed.length ? 'On logo' : 'Place'}</span>
                </button>
              )
            })}
            <button type="button" className="layer-chip more" onClick={onTakeParts}>
              <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="layer-chip-name">More parts</span>
            </button>
          </div>
        </div>
      )}

      <div className="action-row design-actions">
        <button type="button" className="btn-shuffle" onClick={onPalette}>
          Start From a Palette
        </button>
        <button type="button" className="btn-shuffle" onClick={() => onBuild(rotateBuildColors)} disabled={!layers.length}>
          Rotate Colors
        </button>
      </div>
    </>
  )
}
