/**
 * Designer mode's logo tracer: turn any bitmap logo (a JPG, a PNG, a rasterized SVG) into flat-color
 * SVG outlines, entirely in the browser.
 *
 * 1. Colors. A logo is a few flat fills; JPEG noise and anti-aliased edges smear them into thousands of
 *    shades. Flat fills form tall peaks in a coarse color histogram while edge blends spread thinly
 *    between them, so the fills are the histogram's peaks (at most three, the Designer's slots).
 * 2. Background. Transparent pixels are background. On an opaque image, the color that dominates the
 *    border is the background, but only where it connects to the border: white enclosed by the logo
 *    (eyes, teeth, stripes) stays a color of its own.
 * 3. Outlines. Every pixel takes its nearest color; specks are absorbed by their surroundings. Each
 *    color's region is followed along pixel edges, straightened (Ramer-Douglas-Peucker) and smoothed
 *    with potrace's rule: a vertex whose corner is too sharp stays a corner, the rest become Beziers.
 * 4. Stacking. Colors are drawn largest first, and each layer also covers the layers drawn above it,
 *    so smoothing never opens hairline gaps between neighboring colors.
 *
 * Pure (no DOM): the browser reads the file into RGBA pixels (see traceUpload.ts) and calls traceImage.
 */

export interface RasterImage {
  width: number
  height: number
  /** RGBA, row by row, as in ImageData. */
  data: ArrayLike<number>
}

export type TraceColors = 'auto' | 1 | 2 | 3
export const TRACE_COLOR_OPTIONS: readonly TraceColors[] = ['auto', 1, 2, 3]

export interface TraceOptions {
  /** How many colors to keep; 'auto' keeps every flat color up to three. */
  colors: TraceColors
  /** Drop the background around an opaque logo (transparent pixels are always background). */
  removeBackground: boolean
}

export const DEFAULT_TRACE_OPTIONS: TraceOptions = { colors: 'auto', removeBackground: true }
/** Longest side, in pixels, the browser scales an upload to before tracing. */
export const TRACE_SIZE = 768

export interface TraceResult {
  /** Standalone SVG: one even-odd path per color, cropped to the artwork. */
  svg: string
  /** Fill per source slot, largest area first; slots past `colorCount` hold placeholder colors. */
  palette: [string, string, string]
  /** Slots the artwork does not paint (the Designer puts them on the backdrop tile and frame). */
  unusedSlots: number[]
  colorCount: number
}

export class TraceError extends Error {}

type RGB = [number, number, number]

const ALPHA_CUTOFF = 128
/** Share of transparent pixels that makes the alpha channel the background. */
const TRANSPARENT_SHARE = 0.005
/** Share of border pixels one color needs to count as an opaque image's background. */
const BORDER_SHARE = 0.5
/** Fill colors closer than this (RGB distance) are one color. */
const MERGE_DIST = 56
/** A fill only needs to clear the background by this much: a dark logo on a dark field is still a logo. */
const BACKGROUND_DIST = 24
/** Minimum share of the logo a color needs: 'auto' ignores small blends, an explicit count takes smaller details. */
const AUTO_MIN_SHARE = 0.015
const EXPLICIT_MIN_SHARE = 0.002
/** Buckets within this distance of a color refine its exact value. */
const REFINE_DIST = 40
/** Straightening tolerance in pixels. */
const RDP_EPSILON = 0.9
/** potrace's corner threshold: larger alphas stay sharp corners. */
const ALPHAMAX = 1
const CROP_PADDING = 0.02
/** 'auto' treats a color as an edge blend when it forms bands narrower than this (pixels, at TRACE_SIZE)... */
const BLEND_WIDTH = 3.3
/** ...and it lies this close to the line between two other colors. */
const BLEND_DIST = 28
const PLACEHOLDERS = ['#FFFFFF', '#000000', '#808080', '#FF0000', '#0000FF', '#00FF00']
/** Placeholder slots must stay farther than Logo.tsx's recolor tolerance from every traced color. */
const PLACEHOLDER_DIST = 90

const TRANSPARENT = 255

const dist2 = (a: RGB, b: RGB) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
const hex = (c: RGB) => '#' + c.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('').toUpperCase()
const hexRgb = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const num = (n: number) => String(Math.round(n * 100) / 100)

// ---------------------------------------------------------------- colors
interface Histogram {
  count: Float64Array
  sum: Float64Array
}

/** 16 levels per channel: coarse enough that JPEG noise stays inside one fill's neighborhood. */
const bucketOf = (r: number, g: number, b: number) => ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)

function histogram(img: RasterImage, include: (i: number) => boolean): Histogram {
  const count = new Float64Array(4096)
  const sum = new Float64Array(4096 * 3)
  const d = img.data
  for (let i = 0, n = img.width * img.height; i < n; i++) {
    if (!include(i)) continue
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]
    const k = bucketOf(r, g, b)
    count[k]++
    sum[k * 3] += r
    sum[k * 3 + 1] += g
    sum[k * 3 + 2] += b
  }
  return { count, sum }
}

/** Count and mean color of a bucket's 3x3x3 neighborhood, so a fill split across a bucket edge still forms one peak. */
function neighborhood(h: Histogram, k: number): { count: number; color: RGB } {
  const r = k >> 8, g = (k >> 4) & 15, b = k & 15
  let count = 0, sr = 0, sg = 0, sb = 0
  for (let dr = -1; dr <= 1; dr++) {
    for (let dg = -1; dg <= 1; dg++) {
      for (let db = -1; db <= 1; db++) {
        const rr = r + dr, gg = g + dg, bb = b + db
        if (rr < 0 || gg < 0 || bb < 0 || rr > 15 || gg > 15 || bb > 15) continue
        const j = (rr << 8) | (gg << 4) | bb
        count += h.count[j]
        sr += h.sum[j * 3]
        sg += h.sum[j * 3 + 1]
        sb += h.sum[j * 3 + 2]
      }
    }
  }
  return { count, color: count ? [sr / count, sg / count, sb / count] : [0, 0, 0] }
}

/** The color that dominates an opaque image's border, if one does. */
function borderBackground(img: RasterImage): RGB | null {
  const { width: w, height: h } = img
  const onBorder = (i: number) => {
    const x = i % w, y = (i / w) | 0
    return x === 0 || y === 0 || x === w - 1 || y === h - 1
  }
  const hist = histogram(img, onBorder)
  const total = 2 * (w + h) - 4
  let best: { count: number; color: RGB } | null = null
  for (let k = 0; k < 4096; k++) {
    if (!hist.count[k]) continue
    const n = neighborhood(hist, k)
    if (!best || n.count > best.count) best = n
  }
  return best && best.count / total >= BORDER_SHARE ? best.color : null
}

/** Flat fill colors: histogram peaks, biggest first, each distinct from the background and from each other. */
function pickColors(img: RasterImage, opaque: (i: number) => boolean, background: RGB | null, wanted: number, minShare: number): RGB[] {
  const hist = histogram(img, opaque)
  const ink = histogram(img, (i) => opaque(i) && (!background || dist2(pixel(img, i), background) > BACKGROUND_DIST ** 2))
  let inkTotal = 0
  for (let k = 0; k < 4096; k++) inkTotal += ink.count[k]
  if (!inkTotal) return []
  const peaks: { count: number; color: RGB }[] = []
  for (let k = 0; k < 4096; k++) if (ink.count[k]) peaks.push(neighborhood(ink, k))
  peaks.sort((a, b) => b.count - a.count || a.color[0] - b.color[0] || a.color[1] - b.color[1] || a.color[2] - b.color[2])
  const picked: RGB[] = []
  for (const peak of peaks) {
    if (picked.length === wanted || peak.count / inkTotal < minShare) break
    if (background && dist2(peak.color, background) < BACKGROUND_DIST ** 2) continue
    if (picked.some((c) => dist2(c, peak.color) < MERGE_DIST ** 2)) continue
    picked.push(peak.color)
  }
  // Refine each color to the mean of the nearby buckets that are closest to it.
  const centers = background ? [...picked, background] : picked
  return picked.map((color, i) => {
    let n = 0, sr = 0, sg = 0, sb = 0
    for (let k = 0; k < 4096; k++) {
      if (!hist.count[k]) continue
      const c: RGB = [hist.sum[k * 3] / hist.count[k], hist.sum[k * 3 + 1] / hist.count[k], hist.sum[k * 3 + 2] / hist.count[k]]
      if (dist2(c, color) > REFINE_DIST ** 2 || nearest(c, centers) !== i) continue
      n += hist.count[k]
      sr += hist.sum[k * 3]
      sg += hist.sum[k * 3 + 1]
      sb += hist.sum[k * 3 + 2]
    }
    return n ? [sr / n, sg / n, sb / n] : color
  })
}

const pixel = (img: RasterImage, i: number): RGB => [img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]]

function nearest(c: RGB, centers: readonly RGB[]): number {
  let best = 0, bestD = Infinity
  for (let i = 0; i < centers.length; i++) {
    const d = dist2(c, centers[i])
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

// ---------------------------------------------------------------- regions
const neighbors4 = (i: number, w: number, h: number, out: number[]) => {
  out.length = 0
  const x = i % w
  if (x > 0) out.push(i - 1)
  if (x < w - 1) out.push(i + 1)
  if (i >= w) out.push(i - w)
  if (i < w * (h - 1)) out.push(i + w)
  return out
}

/** Turn background-colored pixels connected to the border transparent. */
function clearOuterBackground(labels: Uint8Array, w: number, h: number, bgLabel: number) {
  const stack: number[] = []
  const push = (i: number) => {
    if (labels[i] === bgLabel) {
      labels[i] = TRANSPARENT
      stack.push(i)
    }
  }
  for (let x = 0; x < w; x++) {
    push(x)
    push((h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    push(y * w)
    push(y * w + w - 1)
  }
  const around: number[] = []
  while (stack.length) {
    const i = stack.pop()!
    for (const j of neighbors4(i, w, h, around)) push(j)
  }
}

/** Absorb connected specks smaller than `minArea` into their most common neighbor. */
function despeckle(labels: Uint8Array, w: number, h: number, minArea: number) {
  const seen = new Uint8Array(w * h)
  const component: number[] = []
  const stack: number[] = []
  const around: number[] = []
  for (let start = 0; start < w * h; start++) {
    if (seen[start]) continue
    const label = labels[start]
    component.length = 0
    stack.push(start)
    seen[start] = 1
    while (stack.length) {
      const i = stack.pop()!
      component.push(i)
      for (const j of neighbors4(i, w, h, around)) {
        if (!seen[j] && labels[j] === label) {
          seen[j] = 1
          stack.push(j)
        }
      }
    }
    if (component.length >= minArea) continue
    const votes = new Map<number, number>()
    for (const i of component) {
      for (const j of neighbors4(i, w, h, around)) {
        if (labels[j] !== label) votes.set(labels[j], (votes.get(labels[j]) ?? 0) + 1)
      }
    }
    let winner = -1, most = 0
    for (const [l, n] of votes) {
      if (n > most || (n === most && l < winner)) {
        most = n
        winner = l
      }
    }
    if (winner >= 0) for (const i of component) labels[i] = winner
  }
}

/** Whether `c` sits on the line between two of `others`, as an anti-aliased blend of them would. */
function isBlend(c: RGB, others: readonly RGB[]): boolean {
  for (let a = 0; a < others.length; a++) {
    for (let b = a + 1; b < others.length; b++) {
      const A = others[a], B = others[b]
      const seg: RGB = [B[0] - A[0], B[1] - A[1], B[2] - A[2]]
      const len2 = seg[0] ** 2 + seg[1] ** 2 + seg[2] ** 2
      if (!len2) continue
      const t = ((c[0] - A[0]) * seg[0] + (c[1] - A[1]) * seg[1] + (c[2] - A[2]) * seg[2]) / len2
      if (t <= 0.1 || t >= 0.9) continue
      if (dist2(c, [A[0] + seg[0] * t, A[1] + seg[1] * t, A[2] + seg[2] * t]) < BLEND_DIST ** 2) return true
    }
  }
  return false
}

/**
 * Drop colors that are only edge blends: thin bands whose color lies between two other colors, like
 * the halo a JPEG leaves between an outline and its background (wider once a small image is scaled
 * up, so width is measured, not adjacency). A real fill of an in-between color (a gray stripe between
 * black and white) is wider, so it stays.
 */
function dropBlends(labels: Uint8Array, w: number, h: number, centers: RGB[], bgLabel: number) {
  const count = new Float64Array(centers.length)
  const edges = new Float64Array(centers.length)
  const around: number[] = []
  for (let i = 0; i < w * h; i++) {
    const l = labels[i]
    if (l === TRANSPARENT) continue
    count[l]++
    for (const j of neighbors4(i, w, h, around)) if (labels[j] !== l) edges[l]++
  }
  const blends = new Set<number>()
  centers.forEach((c, l) => {
    // A band's mean width is twice its area over its boundary length.
    if (l === bgLabel || !count[l] || !edges[l] || (2 * count[l]) / edges[l] >= BLEND_WIDTH) return
    if (isBlend(c, centers.filter((_, o) => o !== l))) blends.add(l)
  })
  if (!blends.size) return
  const keep = centers.map((_, l) => l).filter((l) => !blends.has(l))
  for (let i = 0; i < w * h; i++) {
    if (!blends.has(labels[i])) continue
    const to = keep[nearest(centers[labels[i]], keep.map((l) => centers[l]))]
    labels[i] = to === bgLabel ? TRANSPARENT : to
  }
}

// ---------------------------------------------------------------- outlines
type Point = [number, number]
// Directions: east, south, west, north (y grows downward).
const DX = [1, 0, -1, 0]
const DY = [0, 1, 0, -1]

/**
 * Closed outlines of a mask along pixel edges, ink on the right of travel. At a vertex where two
 * pixels touch only diagonally, the walk turns right, keeping them separate. Returns the corners.
 */
function outlines(mask: Uint8Array, w: number, h: number): Point[][] {
  const vw = w + 1
  const out = new Uint8Array(vw * (h + 1))
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue
      if (!at(x, y - 1)) out[y * vw + x] |= 1 << 0
      if (!at(x + 1, y)) out[y * vw + x + 1] |= 1 << 1
      if (!at(x, y + 1)) out[(y + 1) * vw + x + 1] |= 1 << 2
      if (!at(x - 1, y)) out[(y + 1) * vw + x] |= 1 << 3
    }
  }
  const used = new Uint8Array(out.length)
  const loops: Point[][] = []
  for (let v0 = 0; v0 < out.length; v0++) {
    for (let d0 = 0; d0 < 4; d0++) {
      if (!(out[v0] & (1 << d0)) || used[v0] & (1 << d0)) continue
      const loop: Point[] = []
      let v = v0, d = d0
      for (;;) {
        used[v] |= 1 << d
        const x = (v % vw) + DX[d], y = ((v / vw) | 0) + DY[d]
        v = y * vw + x
        const next = [(d + 1) % 4, d, (d + 3) % 4].find((n) => out[v] & (1 << n))!
        if (next !== d) loop.push([x, y])
        if (v === v0 && next === d0) break
        d = next
      }
      loops.push(loop)
    }
  }
  return loops
}

const area = (p: Point[]) => {
  let a = 0
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]
    a += x1 * y2 - x2 * y1
  }
  return a / 2
}

/** Ramer-Douglas-Peucker on a closed polygon, anchored at its first point and the point farthest from it. */
function straighten(p: Point[], epsilon: number): Point[] {
  if (p.length <= 4) return p
  let far = 0, farD = -1
  for (let i = 1; i < p.length; i++) {
    const d = (p[i][0] - p[0][0]) ** 2 + (p[i][1] - p[0][1]) ** 2
    if (d > farD) {
      farD = d
      far = i
    }
  }
  const keep = new Uint8Array(p.length)
  keep[0] = keep[far] = 1
  const n = p.length
  const stack: [number, number][] = [[0, far], [far, n]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    const pa = p[a % n], pb = p[b % n]
    const dx = pb[0] - pa[0], dy = pb[1] - pa[1]
    const len = Math.hypot(dx, dy) || 1
    let worst = -1, worstD = epsilon
    for (let i = a + 1; i < b; i++) {
      const q = p[i % n]
      const d = Math.abs(dy * (q[0] - pa[0]) - dx * (q[1] - pa[1])) / len
      if (d > worstD) {
        worstD = d
        worst = i
      }
    }
    if (worst >= 0) {
      keep[worst % n] = 1
      stack.push([a, worst], [worst, b])
    }
  }
  return p.filter((_, i) => keep[i])
}

const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
const toward = (from: Point, to: Point, t: number): Point => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]

/**
 * potrace's smoothing: each vertex becomes a curve from the midpoint of its incoming edge to the
 * midpoint of its outgoing edge, unless the corner is sharp enough (alpha >= ALPHAMAX) to stay a corner.
 */
function smoothPath(p: Point[]): string {
  const n = p.length
  if (n < 3) return ''
  let d = `M${num(mid(p[n - 1], p[0])[0])} ${num(mid(p[n - 1], p[0])[1])}`
  for (let j = 0; j < n; j++) {
    const i = p[(j + n - 1) % n], v = p[j], k = p[(j + 1) % n]
    const end = mid(v, k)
    // dpara / ddenom: twice the triangle's area over the L1 length of its base.
    const denom = Math.abs(k[0] - i[0]) + Math.abs(k[1] - i[1])
    let alpha = 4 / 3
    if (denom) {
      const dd = Math.abs((v[0] - i[0]) * (k[1] - i[1]) - (v[1] - i[1]) * (k[0] - i[0])) / denom
      alpha = (dd > 1 ? 1 - 1 / dd : 0) / 0.75
    }
    if (alpha >= ALPHAMAX) {
      d += `L${num(v[0])} ${num(v[1])}L${num(end[0])} ${num(end[1])}`
    } else {
      const a = Math.min(1, Math.max(0.55, alpha))
      const c1 = toward(i, v, 0.5 + 0.5 * a)
      const c2 = toward(k, v, 0.5 + 0.5 * a)
      d += `C${num(c1[0])} ${num(c1[1])} ${num(c2[0])} ${num(c2[1])} ${num(end[0])} ${num(end[1])}`
    }
  }
  return d + 'Z'
}

// ---------------------------------------------------------------- trace
export function traceImage(img: RasterImage, options: TraceOptions = DEFAULT_TRACE_OPTIONS): TraceResult {
  const { width: w, height: h } = img
  if (!w || !h || img.data.length < w * h * 4) throw new TraceError('The image is empty.')
  const n = w * h
  let transparentCount = 0
  for (let i = 0; i < n; i++) if (img.data[i * 4 + 3] < ALPHA_CUTOFF) transparentCount++
  const hasAlpha = transparentCount / n >= TRANSPARENT_SHARE
  const opaque = (i: number) => img.data[i * 4 + 3] >= ALPHA_CUTOFF
  const background = !hasAlpha && options.removeBackground ? borderBackground(img) : null

  const limit = options.colors === 'auto' ? 3 : options.colors
  const minShare = options.colors === 'auto' ? AUTO_MIN_SHARE : EXPLICIT_MIN_SHARE
  const inks = pickColors(img, opaque, background, limit, minShare)
  if (!inks.length) throw new TraceError('No logo found in the image. Try a different file or turn off background removal.')

  // Label every pixel with its nearest color; the background, if any, is the last label.
  const centers = background ? [...inks, background] : inks
  const bgLabel = background ? inks.length : -1
  const labels = new Uint8Array(n)
  for (let i = 0; i < n; i++) labels[i] = opaque(i) ? nearest(pixel(img, i), centers) : TRANSPARENT
  if (background) clearOuterBackground(labels, w, h, bgLabel)
  despeckle(labels, w, h, Math.max(8, Math.round(n / 40000)))
  if (options.colors === 'auto') dropBlends(labels, w, h, centers, bgLabel)

  // Keep the largest colors, enclosed background-colored details included, up to the limit.
  const counts = new Float64Array(centers.length)
  for (let i = 0; i < n; i++) if (labels[i] !== TRANSPARENT) counts[labels[i]]++
  const layers = centers
    .map((color, label) => ({ color, label, count: counts[label] }))
    .filter((l) => l.count > 0)
    .sort((a, b) => b.count - a.count || a.label - b.label)
    .slice(0, limit)
  if (!layers.length) throw new TraceError('No logo found in the image. Try a different file or turn off background removal.')
  const rank = new Uint8Array(centers.length).fill(TRANSPARENT)
  layers.forEach((l, r) => (rank[l.label] = r))
  const kept = layers.map((l) => l.color)
  for (let i = 0; i < n; i++) {
    const l = labels[i]
    if (l === TRANSPARENT || rank[l] !== TRANSPARENT) continue
    // A dropped enclosed background becomes a hole; a dropped ink joins the nearest kept color.
    labels[i] = l === bgLabel ? TRANSPARENT : layers[nearest(centers[l], kept)].label
  }

  // Trace each layer over itself plus everything drawn above it.
  const minLoop = Math.max(4, n / 40000)
  let minX = w, minY = h, maxX = 0, maxY = 0
  const paths: string[] = []
  layers.forEach((layer, r) => {
    const mask = new Uint8Array(n)
    for (let i = 0; i < n; i++) if (labels[i] !== TRANSPARENT && rank[labels[i]] >= r) mask[i] = 1
    let d = ''
    for (const loop of outlines(mask, w, h)) {
      if (Math.abs(area(loop)) < minLoop) continue
      for (const [x, y] of loop) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
      d += smoothPath(straighten(loop, RDP_EPSILON))
    }
    if (d) paths.push(`<path fill="${hex(layer.color)}" fill-rule="evenodd" d="${d}"/>`)
  })
  if (!paths.length) throw new TraceError('No logo found in the image. Try a different file or turn off background removal.')

  const pad = Math.max(maxX - minX, maxY - minY) * CROP_PADDING
  const box = [minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2].map(num)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(' ')}" width="${box[2]}" height="${box[3]}">` +
    paths.join('') +
    `</svg>`

  const palette = layers.map((l) => hex(l.color))
  for (const p of PLACEHOLDERS) {
    if (palette.length === 3) break
    if (palette.every((c) => dist2(hexRgb(p), hexRgb(c)) > PLACEHOLDER_DIST ** 2)) palette.push(p)
  }
  const used = layers.length
  return { svg, palette: palette as [string, string, string], unusedSlots: [0, 1, 2].filter((s) => s >= used), colorCount: used }
}
