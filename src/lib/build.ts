import { normalizeHex, slug, type DesignColors, type ExportFormat } from './designer'
import { PART_UNITS, type LogoPart } from './parts'

/**
 * Designer mode's builder: compose a logo out of parts taken from existing logos.
 *
 * A build is a stack of layers, back to front. Each layer places one part on the 100 x 100 stage with
 * a position, a size, a rotation and an optional flip, and paints it in one of the logo's three color
 * slots, so the whole logo recolors from three swatches like any other logo in the game.
 *
 * Pure (no DOM): the stage and the pointer handling live in BuildCanvas.tsx, file output in exportLogo.ts.
 */

export interface BuildLayer {
  id: string
  partId: string
  /** Color slot (0..2) that paints the part. */
  slot: number
  /** Center of the part on the stage. */
  x: number
  y: number
  /** Size relative to the part as it was taken. */
  scale: number
  /** Degrees, clockwise. */
  rotation: number
  flip: boolean
}

export interface BuildState {
  /** Back to front. */
  layers: BuildLayer[]
  selected: string | null
  colors: DesignColors
  /** Team whose palette seeded the colors; cleared once a slot is edited by hand. */
  paletteId: string | null
  /** Layers ever made, for ids. */
  serial: number
}

/** Colors of an empty logo; a slot nothing uses yet takes the color of the first part that needs it. */
export const BUILD_COLORS: DesignColors = ['#17150F', '#D8442B', '#F5F2EC']
export const emptyBuild: BuildState = { layers: [], selected: null, colors: BUILD_COLORS, paletteId: null, serial: 0 }

export const MIN_SCALE = 0.1
export const MAX_SCALE = 8
/** A part's color counts as a slot's color within this RGB distance. */
const SAME_COLOR = 48
/** Rotation snaps to the nearest 45 degrees within this many degrees. */
const SNAP = 4

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const colorDistance = (a: string, b: string) => {
  const x = rgb(a), y = rgb(b)
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}
const fmt = (n: number) => String(Math.round(n * 100) / 100)
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Middle of a part where it was taken, to the precision transforms are written in. */
const centerOf = (part: LogoPart) => ({ x: Number(fmt(part.box.x + part.box.w / 2)), y: Number(fmt(part.box.y + part.box.h / 2)) })

/** Degrees in (-180, 180]. */
export const normalizeRotation = (deg: number) => {
  const r = ((deg % 360) + 360) % 360
  return r > 180 ? r - 360 : r
}

/** Snap a dragged rotation to the nearest 45 degrees when it is close. */
export function snapRotation(deg: number): number {
  const r = normalizeRotation(deg)
  const near = Math.round(r / 45) * 45
  return Math.abs(r - near) <= SNAP ? normalizeRotation(near) : r
}

/**
 * The slot a newly placed part paints with. A part whose color the logo already has shares that slot;
 * otherwise it brings its color to a slot nothing uses; with all three taken it joins the nearest.
 * A logo started from a palette keeps the palette: the part takes a free slot without recoloring it.
 */
export function slotForPart(build: BuildState, color: string): { slot: number; colors: DesignColors } {
  const used = new Set(build.layers.map((l) => l.slot))
  const slots = [0, 1, 2]
  const nearest = (among: number[]) => among.reduce((best, s) => (colorDistance(build.colors[s], color) < colorDistance(build.colors[best], color) ? s : best))
  const free = slots.filter((s) => !used.has(s))
  if (build.paletteId) return { slot: nearest(free.length ? free : slots), colors: build.colors }
  const taken = slots.filter((s) => used.has(s))
  const same = taken.length ? nearest(taken) : -1
  if (same >= 0 && colorDistance(build.colors[same], color) <= SAME_COLOR) return { slot: same, colors: build.colors }
  if (free.length) {
    const colors: DesignColors = [...build.colors]
    colors[free[0]] = normalizeHex(color) ?? color
    return { slot: free[0], colors }
  }
  return { slot: nearest(slots), colors: build.colors }
}

/** Put a part on the logo where it sat in its own logo, in front of everything, and select it. */
export function placePart(build: BuildState, part: LogoPart): BuildState {
  const { slot, colors } = slotForPart(build, part.color)
  const serial = build.serial + 1
  const layer: BuildLayer = {
    id: `L${serial}`,
    partId: part.id,
    slot,
    x: clamp(centerOf(part).x, 0, PART_UNITS),
    y: clamp(centerOf(part).y, 0, PART_UNITS),
    scale: 1,
    rotation: 0,
    flip: false,
  }
  return { ...build, layers: [...build.layers, layer], selected: layer.id, colors, serial }
}

/** Change a layer, keeping it on the stage and within the size limits. */
export function updateLayer(build: BuildState, id: string, patch: Partial<BuildLayer>): BuildState {
  return {
    ...build,
    layers: build.layers.map((l) => {
      if (l.id !== id) return l
      const next = { ...l, ...patch }
      return {
        ...next,
        x: clamp(next.x, 0, PART_UNITS),
        y: clamp(next.y, 0, PART_UNITS),
        scale: clamp(next.scale, MIN_SCALE, MAX_SCALE),
        rotation: normalizeRotation(next.rotation),
        slot: ((Math.round(next.slot) % 3) + 3) % 3,
      }
    }),
  }
}

/** A second copy of a layer, nudged so it shows, directly in front of the original and selected. */
export function duplicateLayer(build: BuildState, id: string): BuildState {
  const at = build.layers.findIndex((l) => l.id === id)
  if (at < 0) return build
  const serial = build.serial + 1
  const src = build.layers[at]
  const copy: BuildLayer = { ...src, id: `L${serial}`, x: clamp(src.x + 5, 0, PART_UNITS), y: clamp(src.y + 5, 0, PART_UNITS) }
  const layers = [...build.layers]
  layers.splice(at + 1, 0, copy)
  return { ...build, layers, selected: copy.id, serial }
}

export function removeLayer(build: BuildState, id: string): BuildState {
  const layers = build.layers.filter((l) => l.id !== id)
  return { ...build, layers, selected: build.selected === id ? null : build.selected }
}

/** Dropping a part from the tray takes every copy of it off the logo too. */
export function removePart(build: BuildState, partId: string): BuildState {
  const layers = build.layers.filter((l) => l.partId !== partId)
  return { ...build, layers, selected: layers.some((l) => l.id === build.selected) ? build.selected : null }
}

/** Move a layer one step back (-1) or forward (1) in the stack. */
export function shiftLayer(build: BuildState, id: string, by: -1 | 1): BuildState {
  const at = build.layers.findIndex((l) => l.id === id)
  const to = at + by
  if (at < 0 || to < 0 || to >= build.layers.length) return build
  const layers = [...build.layers]
  ;[layers[at], layers[to]] = [layers[to], layers[at]]
  return { ...build, layers }
}

/** Start the logo's colors from a team palette, slot for slot. */
export function seedBuildColors(build: BuildState, paletteId: string, palette: readonly string[]): BuildState {
  const colors = [0, 1, 2].map((s) => normalizeHex(palette[s] ?? '') ?? build.colors[s]) as DesignColors
  return { ...build, colors, paletteId }
}

/** Cycle the three colors through the slots, so every part takes its neighbor's color. */
export function rotateBuildColors(build: BuildState): BuildState {
  const [a, b, c] = build.colors
  return { ...build, colors: [b, c, a] }
}

// ---------------------------------------------------------------- geometry
/** The layer's box on the stage before rotation: its center and its size. */
export function layerBox(layer: BuildLayer, part: LogoPart) {
  return { cx: layer.x, cy: layer.y, w: part.box.w * layer.scale, h: part.box.h * layer.scale, rotation: layer.rotation }
}

/** SVG transform that carries the part's path from where it was taken to where the layer puts it. */
export function layerTransform(layer: BuildLayer, part: LogoPart): string {
  const { x: cx, y: cy } = centerOf(part)
  const sx = layer.flip ? -layer.scale : layer.scale
  const rotate = layer.rotation ? ` rotate(${fmt(layer.rotation)})` : ''
  return `translate(${fmt(layer.x)} ${fmt(layer.y)})${rotate} scale(${fmt(sx)} ${fmt(layer.scale)}) translate(${fmt(-cx)} ${fmt(-cy)})`
}

type PartLookup = (id: string) => LogoPart | undefined
const lookup = (parts: readonly LogoPart[]): PartLookup => {
  const byId = new Map(parts.map((p) => [p.id, p]))
  return (id) => byId.get(id)
}

export const BUILD_SVG_SIZE = 1024

/**
 * Standalone SVG of the built logo: the stage itself, edge to edge, so the file shows exactly what the
 * stage shows. Artwork that runs past the stage is cropped at its edge, and an optional solid
 * background fills it. Null for an empty logo.
 */
export function buildSvg(build: Pick<BuildState, 'layers' | 'colors'>, parts: readonly LogoPart[], opts: { background?: string | null; size?: number } = {}): string | null {
  const find = lookup(parts)
  const body = build.layers
    .map((layer) => {
      const part = find(layer.partId)
      return part ? `<path transform="${layerTransform(layer, part)}" fill="${build.colors[layer.slot]}" fill-rule="evenodd" d="${part.d}"/>` : ''
    })
    .join('')
  if (!body) return null
  const size = opts.size ?? BUILD_SVG_SIZE
  const stage = `width="${PART_UNITS}" height="${PART_UNITS}"`
  const background = opts.background ? `<rect ${stage} fill="${opts.background}"/>` : ''
  // The clip keeps the crop when the file is opened in an editor, which shows what lies outside the view box.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${PART_UNITS} ${PART_UNITS}">` +
    `<clipPath id="stage"><rect ${stage}/></clipPath>${background}<g clip-path="url(#stage)">${body}</g></svg>`
  )
}

// ---------------------------------------------------------------- words
export const DEFAULT_BUILD_NAME = 'Untitled logo'

/** Download name for a built logo, e.g. `logo-remix-river-hawks.png`. */
export const buildFileName = (name: string, format: ExportFormat) => `logo-remix-${slug(name) || 'custom-logo'}.${format}`

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`

/** "4 parts from 3 logos", for the parts on the logo or the parts in the tray. */
export function partsSummary(parts: readonly LogoPart[]): string {
  if (!parts.length) return 'No parts yet'
  return `${count(parts.length, 'part')} from ${count(new Set(parts.map((p) => p.sourceId)).size, 'logo')}`
}

/** The parts on the logo, one entry per layer. */
export function placedParts(layers: readonly BuildLayer[], parts: readonly LogoPart[]): LogoPart[] {
  const find = lookup(parts)
  return layers.map((l) => find(l.partId)).filter((p): p is LogoPart => !!p)
}
