import { hexToHsv } from './designer'
import {
  AUTO_MIN_SHARE,
  RDP_EPSILON,
  TRANSPARENT,
  loopArea,
  outlines,
  rgbHex,
  segmentImage,
  smoothPath,
  straighten,
  type Point,
  type RasterImage,
} from './trace'

/**
 * Designer mode's parts: split a logo into the shapes it is drawn from, so a new logo can be
 * composed out of pieces of existing ones.
 *
 * A logo is rendered to pixels and split into flat colors by the tracer (trace.ts). Each connected
 * region of one color is a part. A region that encloses other artwork (a shield around a star, an
 * outline around a whole crest) is taken as the solid shape underneath, the way the artwork is
 * stacked; a hole that shows the page through stays a hole. Parts are traced back to vector outlines
 * in a 100 x 100 square, the logo's place on the Designer's stage.
 *
 * When the piece someone wants is fused into a bigger shape, `cutPiece` cuts it out along a
 * hand-drawn loop instead.
 *
 * Pure (no DOM): the browser renders the logo and hands over its pixels (see partsScan.ts).
 */

/** Side of the square parts are measured in. */
export const PART_UNITS = 100
/** Most colors a logo is split into. */
export const MAX_PART_COLORS = 6
/** Most parts offered for one logo, largest first. */
export const MAX_PARTS = 24
/** A region needs this share of the image to be a part of its own (about 8 x 8 px at 768). */
const MIN_PART_SHARE = 1 / 9000
/** Outline loops smaller than this many pixels are dropped. */
const MIN_LOOP = 4

export interface PartBox {
  x: number
  y: number
  w: number
  h: number
}

/** One flat shape: an even-odd path in the 100-unit square, and the color it was drawn in. */
export interface PartShape {
  name: string
  /** `#RRGGBB` the part has in its logo. */
  color: string
  d: string
  box: PartBox
}

/** A part found in a logo; `key` is stable for one scan of that logo. */
export interface ScannedPart extends PartShape {
  key: string
  /** Pixels the part covers. */
  area: number
}

/** A part someone took: it sits in the tray until it is placed on the logo being built. */
export interface LogoPart extends PartShape {
  id: string
  /** Name of the logo it came from. */
  source: string
  sourceId: string
  /** Scan key within its logo (`logo#key`), so a part already taken can be told apart; cut pieces have none. */
  origin?: string
}

export interface PartsScan {
  width: number
  height: number
  /** Color index per pixel into `colors`; TRANSPARENT where the logo paints nothing. */
  ink: Uint8Array
  colors: string[]
  /** Largest first. */
  parts: ScannedPart[]
}

// ---------------------------------------------------------------- names
/** A plain name for a color, used to tell parts apart ("Navy shape", "Gold shape"). */
export function colorName(hex: string): string {
  const { h, s, v } = hexToHsv(hex)
  if (v < 0.16) return 'Black'
  if (s < 0.12) return v > 0.88 ? 'White' : v < 0.4 ? 'Charcoal' : v > 0.7 ? 'Silver' : 'Gray'
  if (s < 0.3 && v > 0.85 && h >= 25 && h < 70) return 'Cream'
  if (h < 12 || h >= 345) return v < 0.55 ? 'Maroon' : 'Red'
  if (h < 38) return v < 0.6 ? 'Brown' : 'Orange'
  if (h < 52) return v < 0.6 ? 'Brown' : 'Gold'
  if (h < 68) return v < 0.6 ? 'Olive' : 'Yellow'
  if (h < 160) return 'Green'
  if (h < 195) return 'Teal'
  if (h < 255) return v < 0.5 ? 'Navy' : s < 0.5 && v > 0.75 ? 'Sky' : 'Blue'
  if (h < 290) return 'Purple'
  return v < 0.55 ? 'Plum' : 'Pink'
}

const luminance = (hex: string) => {
  const c = [1, 3, 5].map((i) => {
    const n = parseInt(hex.slice(i, i + 2), 16) / 255
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

/**
 * Tile color behind a part's thumbnail when its own color would vanish into a panel: near-white parts
 * get a dark tile, near-black ones a light tile, on the light and dark themes alike.
 */
export function thumbTile(hex: string): string | undefined {
  const l = luminance(hex)
  return l > 0.72 ? '#2B2A27' : l < 0.06 ? '#F5F2EC' : undefined
}

/** A square view box around a part with a little air, for thumbnails. */
export function partViewBox(box: PartBox, padding = 0.1): string {
  const side = Math.max(box.w, box.h, 1) * (1 + padding * 2)
  const r = (n: number) => Math.round(n * 100) / 100
  return `${r(box.x + box.w / 2 - side / 2)} ${r(box.y + box.h / 2 - side / 2)} ${r(side)} ${r(side)}`
}

// ---------------------------------------------------------------- scan
/** Pixel to stage units: the image is fitted into the square and centered. */
function unitMap(w: number, h: number) {
  const side = Math.max(w, h)
  const k = PART_UNITS / side
  const tx = ((side - w) / 2) * k
  const ty = ((side - h) / 2) * k
  return { k, tx, ty }
}

/**
 * A pixel outline is a staircase, and the corners of a slanted straight edge sit a full pixel apart, too
 * far for straightening to see one line. The middles of the stair's edges lie on that line exactly, so
 * the outline is followed through them: straight edges come out straight instead of rippled, which
 * shows once a part is enlarged on the stage.
 */
const edgeMidpoints = (loop: Point[]): Point[] =>
  loop.map((p, i): Point => {
    const q = loop[(i + 1) % loop.length]
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
  })

/** Trace a cropped mask (its top-left corner at pixel `ox`, `oy`) into a path in stage units. */
function tracePath(mask: Uint8Array, cw: number, ch: number, ox: number, oy: number, w: number, h: number): { d: string; box: PartBox } | null {
  const { k, tx, ty } = unitMap(w, h)
  const at = (q: Point): Point => [(q[0] + ox) * k + tx, (q[1] + oy) * k + ty]
  let d = ''
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const loop of outlines(mask, cw, ch)) {
    if (Math.abs(loopArea(loop)) < MIN_LOOP) continue
    for (const [x, y] of loop) {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
    d += smoothPath(straighten(edgeMidpoints(loop), RDP_EPSILON), at)
  }
  if (!d) return null
  const [x0, y0] = at([minX, minY])
  const [x1, y1] = at([maxX, maxY])
  const r = (n: number) => Math.round(n * 100) / 100
  return { d, box: { x: r(x0), y: r(y0), w: r(x1 - x0), h: r(y1 - y0) } }
}

/**
 * Fill what a region encloses, in place: cells of the cropped mask that cannot reach the crop's edge
 * become part of the shape, unless the pocket shows the page through (`open` says so for a cell).
 * The crop must leave a one-cell margin around the region.
 */
function fillEnclosed(mask: Uint8Array, cw: number, ch: number, open: (cell: number) => boolean) {
  // 0 = not the region, 1 = the region, 2 = reaches the edge, 3 = pocket left open.
  const stack: number[] = []
  const flood = (start: number, mark: number, visit?: (cell: number) => void) => {
    mask[start] = mark
    stack.push(start)
    while (stack.length) {
      const i = stack.pop()!
      visit?.(i)
      const x = i % cw, y = (i / cw) | 0
      // Around a 4-connected shape the outside is 8-connected.
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue
          const j = ny * cw + nx
          if (mask[j] === 0) {
            mask[j] = mark
            stack.push(j)
          }
        }
      }
    }
  }
  if (mask[0] === 0) flood(0, 2)
  const pocket: number[] = []
  for (let i = 0; i < cw * ch; i++) {
    if (mask[i] !== 0) continue
    pocket.length = 0
    let isOpen = false
    flood(i, 3, (cell) => {
      pocket.push(cell)
      if (!isOpen && open(cell)) isOpen = true
    })
    if (!isOpen) for (const cell of pocket) mask[cell] = 1
  }
  for (let i = 0; i < cw * ch; i++) if (mask[i] !== 1) mask[i] = 0
}

/** Split a rendered logo into parts. Throws TraceError when the image holds no artwork. */
export function scanParts(img: RasterImage): PartsScan {
  const { width: w, height: h } = img
  const n = w * h
  const { labels, layers, rank } = segmentImage(img, { limit: MAX_PART_COLORS, minShare: AUTO_MIN_SHARE, removeBackground: true, dropBlends: true })
  const colors = layers.map((l) => rgbHex(l.color).toUpperCase())
  const ink = new Uint8Array(n)
  for (let i = 0; i < n; i++) ink[i] = labels[i] === TRANSPARENT ? TRANSPARENT : rank[labels[i]]

  // Connected regions of one color.
  const region = new Int32Array(n).fill(-1)
  const regions: { color: number; count: number; x0: number; y0: number; x1: number; y1: number }[] = []
  const stack = new Int32Array(n)
  for (let start = 0; start < n; start++) {
    if (ink[start] === TRANSPARENT || region[start] >= 0) continue
    const id = regions.length
    const color = ink[start]
    const r = { color, count: 0, x0: w, y0: h, x1: 0, y1: 0 }
    let top = 0
    stack[top++] = start
    region[start] = id
    while (top) {
      const i = stack[--top]
      const x = i % w, y = (i / w) | 0
      r.count++
      if (x < r.x0) r.x0 = x
      if (x > r.x1) r.x1 = x
      if (y < r.y0) r.y0 = y
      if (y > r.y1) r.y1 = y
      if (x > 0 && region[i - 1] < 0 && ink[i - 1] === color) (region[i - 1] = id), (stack[top++] = i - 1)
      if (x < w - 1 && region[i + 1] < 0 && ink[i + 1] === color) (region[i + 1] = id), (stack[top++] = i + 1)
      if (y > 0 && region[i - w] < 0 && ink[i - w] === color) (region[i - w] = id), (stack[top++] = i - w)
      if (y < h - 1 && region[i + w] < 0 && ink[i + w] === color) (region[i + w] = id), (stack[top++] = i + w)
    }
    regions.push(r)
  }

  const minArea = Math.max(24, n * MIN_PART_SHARE)
  const kept = regions
    .map((r, id) => ({ ...r, id }))
    .filter((r) => r.count >= minArea)
    .sort((a, b) => b.count - a.count || a.id - b.id)
    .slice(0, MAX_PARTS)

  const parts: ScannedPart[] = []
  for (const r of kept) {
    // Crop to the region with a one-pixel margin, then take the solid shape it encloses.
    const ox = r.x0 - 1, oy = r.y0 - 1
    const cw = r.x1 - r.x0 + 3, ch = r.y1 - r.y0 + 3
    const mask = new Uint8Array(cw * ch)
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) if (region[y * w + x] === r.id) mask[(y - oy) * cw + (x - ox)] = 1
    }
    fillEnclosed(mask, cw, ch, (cell) => {
      const x = (cell % cw) + ox, y = ((cell / cw) | 0) + oy
      return x < 0 || y < 0 || x >= w || y >= h || ink[y * w + x] === TRANSPARENT
    })
    let area = 0
    for (let i = 0; i < cw * ch; i++) area += mask[i]
    const traced = tracePath(mask, cw, ch, ox, oy, w, h)
    if (traced) parts.push({ key: `r${r.id}`, name: '', color: colors[r.color], area, ...traced })
  }
  parts.sort((a, b) => b.area - a.area)

  // "Navy shape", "Navy shape 2", ... in size order.
  const seen = new Map<string, number>()
  for (const p of parts) {
    const base = `${colorName(p.color)} shape`
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    p.name = count === 1 ? base : `${base} ${count}`
  }
  return { width: w, height: h, ink, colors, parts }
}

// ---------------------------------------------------------------- cut
export type CutKeep = 'inside' | 'outside'

/** Pixels inside a closed polygon (even-odd), by scanline. The polygon is in pixel coordinates. */
function polygonMask(polygon: readonly Point[], w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h)
  const xs: number[] = []
  for (let y = 0; y < h; y++) {
    const cy = y + 0.5
    xs.length = 0
    for (let i = 0; i < polygon.length; i++) {
      const [x1, y1] = polygon[i]
      const [x2, y2] = polygon[(i + 1) % polygon.length]
      if (y1 <= cy === y2 <= cy) continue
      xs.push(x1 + ((cy - y1) / (y2 - y1)) * (x2 - x1))
    }
    xs.sort((a, b) => a - b)
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const from = Math.max(0, Math.ceil(xs[i] - 0.5))
      const to = Math.min(w - 1, Math.ceil(xs[i + 1] - 0.5) - 1)
      for (let x = from; x <= to; x++) mask[y * w + x] = 1
    }
  }
  return mask
}

/**
 * Cut a piece out of a logo along a hand-drawn loop (points in stage units; the loop closes itself).
 * The piece is all the artwork inside the loop, or all of it outside, as one flat shape in the color
 * that covers most of it. Null when the loop is not a loop yet or holds no artwork.
 */
export function cutPiece(scan: PartsScan, loop: readonly Point[], keep: CutKeep = 'inside'): ScannedPart | null {
  if (loop.length < 3) return null
  const { width: w, height: h, ink } = scan
  const { k, tx, ty } = unitMap(w, h)
  const px = loop.map(([x, y]): Point => [(x - tx) / k, (y - ty) / k])
  const inside = polygonMask(px, w, h)
  const wantInside = keep === 'inside' ? 1 : 0
  // Keeping the inside, only the loop's own rows and columns can hold the piece.
  const span = (axis: 0 | 1, size: number): [number, number] =>
    wantInside
      ? [Math.max(0, Math.floor(Math.min(...px.map((p) => p[axis])))), Math.min(size - 1, Math.ceil(Math.max(...px.map((p) => p[axis]))))]
      : [0, size - 1]
  const [sx0, sx1] = span(0, w)
  const [sy0, sy1] = span(1, h)
  let x0 = w, y0 = h, x1 = -1, y1 = -1, area = 0
  const votes = new Float64Array(scan.colors.length)
  for (let y = sy0; y <= sy1; y++) {
    for (let x = sx0; x <= sx1; x++) {
      const i = y * w + x
      if (ink[i] === TRANSPARENT || inside[i] !== wantInside) continue
      area++
      votes[ink[i]]++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  if (!area) return null
  const ox = x0 - 1, oy = y0 - 1
  const cw = x1 - x0 + 3, ch = y1 - y0 + 3
  const mask = new Uint8Array(cw * ch)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * w + x
      if (ink[i] !== TRANSPARENT && inside[i] === wantInside) mask[(y - oy) * cw + (x - ox)] = 1
    }
  }
  const traced = tracePath(mask, cw, ch, ox, oy, w, h)
  if (!traced) return null
  let color = 0
  for (let c = 1; c < votes.length; c++) if (votes[c] > votes[color]) color = c
  return { key: 'cut', name: 'Cut piece', color: scan.colors[color], area, ...traced }
}
