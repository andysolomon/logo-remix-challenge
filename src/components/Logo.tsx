import { useEffect, useState } from 'react'
import { PERMS, type Team } from '../lib/teams'

interface Props {
  team: Team
  palette?: readonly string[]
  perm?: number
}

type RGB = readonly [number, number, number]

/**
 * Max Euclidean RGB distance for an artwork color to count as one of the three
 * source palette colors. Large enough to absorb small hex drift between the
 * palette and the SVG's actual fills (and compression drift in PNG fallbacks),
 * small enough that unrelated artwork colors are left unchanged.
 */
const MATCH_TOLERANCE = 90
const MATCH_TOLERANCE_SQ = MATCH_TOLERANCE * MATCH_TOLERANCE
const MAX_CANVAS_DIMENSION = 1024
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='

const NAMED_COLORS: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  red: '#ff0000',
  blue: '#0000ff',
  green: '#008000',
  yellow: '#ffff00',
  gold: '#ffd700',
  orange: '#ffa500',
  purple: '#800080',
  navy: '#000080',
  silver: '#c0c0c0',
  gray: '#808080',
  grey: '#808080',
}

/** Normalize `#abc`, `#aabbcc`, `#aabbccdd`, `rgb(...)` or a named color to lowercase `#rrggbb`; null if unparsable. */
function normalizeColor(raw: string): string | null {
  const v = raw.trim().toLowerCase()
  if (v.startsWith('#')) {
    if (v.length === 4 || v.length === 5) return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]
    if (v.length === 7 || v.length === 9) return v.slice(0, 7)
    return null
  }
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(v)
  if (m) return '#' + [m[1], m[2], m[3]].map((n) => Math.min(255, +n).toString(16).padStart(2, '0')).join('')
  return NAMED_COLORS[v] ?? null
}

const hexToRgb = (hex: string): RGB => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]

const rgbToHex = (c: RGB) => '#' + c.map((n) => n.toString(16).padStart(2, '0')).join('')

/** Index of the nearest `from` slot within tolerance, or -1. */
function nearestSlot(color: RGB, from: RGB[]): number {
  let slot = -1
  let best = MATCH_TOLERANCE_SQ
  for (let s = 0; s < from.length; s++) {
    const dr = color[0] - from[s][0]
    const dg = color[1] - from[s][1]
    const db = color[2] - from[s][2]
    const dist = dr * dr + dg * dg + db * db
    if (dist <= best) {
      best = dist
      slot = s
    }
  }
  return slot
}

// ---------------------------------------------------------------- caches
/** Raw SVG markup by URL. */
const svgCache = new Map<string, Promise<string | null>>()
/** Decoded raster images by URL (PNG fallback path). */
const imageCache = new Map<string, Promise<HTMLImageElement | null>>()
/** Finished recolors: `${logo}|${sourceHexes}|${targetHexes}` -> URL (data: or blob:). */
const urlCache = new Map<string, string>()
/** In-flight recolors so concurrent <Logo> instances share one pass. */
const pendingCache = new Map<string, Promise<string | null>>()

function loadSvg(src: string): Promise<string | null> {
  let p = svgCache.get(src)
  if (!p) {
    p = fetch(src)
      .then((r) => (r.ok ? r.text() : null))
      .then((text) => (text && /<svg[\s>]/i.test(text) ? text : null))
      .catch(() => null)
    svgCache.set(src, p)
  }
  return p
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  let p = imageCache.get(src)
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = src
    })
    imageCache.set(src, p)
  }
  return p
}

// ---------------------------------------------------------------- SVG recolor
/**
 * Matches every place a color can appear in SVG markup: presentation
 * attributes (`fill="#fff"`, `stroke='red'`, `stop-color="#..."`), inline
 * styles and <style> rules (`fill:#fff;`). Group 1 is the property + separator,
 * group 2 the color token.
 */
const COLOR_RE = /((?:fill|stroke|stop-color|flood-color|lighting-color)\s*[:=]\s*["']?\s*)(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|[a-zA-Z]+)/g

/** Replace fills near each `from` slot with the matching `to` slot; everything else is untouched. */
function recolorSvg(markup: string, from: RGB[], to: RGB[]): string {
  let out = markup.replace(COLOR_RE, (whole, prefix: string, token: string) => {
    const hex = normalizeColor(token)
    if (!hex) return whole
    const slot = nearestSlot(hexToRgb(hex), from)
    return slot < 0 ? whole : prefix + rgbToHex(to[slot])
  })
  // Shapes with no fill of their own render black. If black maps to a slot,
  // give the root <svg> that slot's target so those shapes follow the remix
  // (explicit fills on descendants are unaffected). Skipped when the root
  // already declares a fill, which the replace above has already handled.
  const blackSlot = nearestSlot([0, 0, 0], from)
  if (blackSlot >= 0) {
    out = out.replace(/<svg\b(?![^>]*\sfill\s*=)/i, `<svg fill="${rgbToHex(to[blackSlot])}"`)
  }
  return out
}

const svgToDataUrl = (markup: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup)

// ---------------------------------------------------------------- PNG fallback
/** Remap pixels near each `from` slot to the matching `to` slot; alpha and all other pixels untouched. */
async function recolorRaster(src: string, from: RGB[], to: RGB[]): Promise<string | null> {
  const img = await loadImage(src)
  if (!img || !img.naturalWidth) return null
  const scale = Math.min(1, MAX_CANVAS_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, width, height)
  let imageData: ImageData
  try {
    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  } catch {
    return null
  }
  const d = imageData.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue
    const r = d[i]
    const g = d[i + 1]
    const b = d[i + 2]
    const slot = nearestSlot([r, g, b], from)
    if (slot >= 0) {
      d[i] = to[slot][0]
      d[i + 1] = to[slot][1]
      d[i + 2] = to[slot][2]
      continue
    }
    // Anti-aliased edge between two palette colors: project onto the segment
    // joining each slot pair and blend the two target colors by the same ratio.
    let bestPair = -1
    let bestT = 0
    let bestDist = MATCH_TOLERANCE_SQ
    for (let a = 0; a < 3; a++) {
      for (let c = a + 1; c < 3; c++) {
        const ax = from[a][0], ay = from[a][1], az = from[a][2]
        const vx = from[c][0] - ax, vy = from[c][1] - ay, vz = from[c][2] - az
        const len = vx * vx + vy * vy + vz * vz
        if (len === 0) continue
        let t = ((r - ax) * vx + (g - ay) * vy + (b - az) * vz) / len
        t = t < 0 ? 0 : t > 1 ? 1 : t
        const dr = r - (ax + vx * t), dg = g - (ay + vy * t), db = b - (az + vz * t)
        const dist = dr * dr + dg * dg + db * db
        if (dist < bestDist) {
          bestDist = dist
          bestPair = a * 3 + c
          bestT = t
        }
      }
    }
    if (bestPair >= 0) {
      const a = (bestPair / 3) | 0, c = bestPair % 3
      d[i] = Math.round(to[a][0] + (to[c][0] - to[a][0]) * bestT)
      d[i + 1] = Math.round(to[a][1] + (to[c][1] - to[a][1]) * bestT)
      d[i + 2] = Math.round(to[a][2] + (to[c][2] - to[a][2]) * bestT)
    }
  }
  ctx.putImageData(imageData, 0, 0)
  try {
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- dispatcher
const isSvg = (src: string) => /\.svg(\?|#|$)/i.test(src)

/** Some downloaded "SVGs" are just a wrapper around an embedded bitmap; fill rewriting can't touch those. */
const hasEmbeddedRaster = (markup: string) => /<image\b/i.test(markup)

async function renderRecolor(src: string, from: RGB[], to: RGB[]): Promise<string | null> {
  if (isSvg(src)) {
    const markup = await loadSvg(src)
    if (!markup) return null
    // Vector art: rewrite fills as text. Embedded bitmaps: rasterize the SVG and recolor pixels.
    if (!hasEmbeddedRaster(markup)) return svgToDataUrl(recolorSvg(markup, from, to))
  }
  return recolorRaster(src, from, to)
}

function recolor(key: string, src: string, from: RGB[], to: RGB[]): Promise<string | null> {
  const hit = urlCache.get(key)
  if (hit) return Promise.resolve(hit)
  let p = pendingCache.get(key)
  if (!p) {
    p = renderRecolor(src, from, to)
      .catch(() => null)
      .then((url) => {
        pendingCache.delete(key)
        if (url) urlCache.set(key, url)
        return url
      })
    pendingCache.set(key, p)
  }
  return p
}

/**
 * Team logo. Renders the raw asset when `palette` is omitted. With a palette,
 * the artwork's colors matching the team's source palette are swapped to the
 * target palette (SVG fills rewritten as text; PNGs recolored on a canvas) and
 * the image stays transparent until that cached recolor is ready.
 */
export function Logo({ team, palette, perm = 0 }: Props) {
  const permIndex = Number.isFinite(perm) ? Math.trunc(perm) : 0
  const normalizedPerm = ((permIndex % PERMS.length) + PERMS.length) % PERMS.length
  const p = PERMS[normalizedPerm]
  const hasTargetPalette = palette != null
  const target = hasTargetPalette ? [palette[p[0]], palette[p[1]], palette[p[2]]] : null
  const source = team.sourcePalette ?? team.palette
  const key = target ? `${team.logo}|${source.join('|')}|${target.join('|')}` : null
  const [, setTick] = useState(0)

  useEffect(() => {
    // key embeds the logo URL, source slots, and target hexes.
    if (!key || !target || urlCache.has(key)) return
    let alive = true
    recolor(key, team.logo, source.map(hexToRgb), target.map(hexToRgb)).then((url) => {
      if (alive && url) setTick((n) => n + 1)
    })
    return () => {
      alive = false
    }
  }, [key, team])

  const imageSrc = !hasTargetPalette ? team.logo : key ? urlCache.get(key) ?? TRANSPARENT_PIXEL : TRANSPARENT_PIXEL
  return <img className="logo" src={imageSrc} alt="" aria-hidden="true" draggable={false} />
}
