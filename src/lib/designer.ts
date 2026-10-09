import { backdropSlot, contrastSafePermutation, fullName, PERMS, type Team } from './teams'

/**
 * Designer mode: recolor any logo slot by slot with exact colors and export the result.
 * Everything here is pure (no DOM) so it can be unit tested; the browser-only export
 * pipeline (fetching artwork, canvas rasterizing, downloads) lives in exportLogo.ts.
 */

export type DesignColors = [string, string, string]
export type ExportFormat = 'svg' | 'png'
export const EXPORT_FORMATS: readonly ExportFormat[] = ['svg', 'png']
export const EXPORT_SIZES = [512, 1024, 2048] as const
export type ExportSize = (typeof EXPORT_SIZES)[number]
export const DEFAULT_EXPORT_SIZE: ExportSize = 1024
/** Canvas size of a composed SVG export (backdrop tile and/or background); plain exports keep the artwork's own viewBox. */
export const SVG_EXPORT_SIZE = 1024
/** Fraction of the canvas left around the logo when it sits on a solid background. */
const BACKGROUND_PADDING = 0.08
/** Match the on-screen backdrop tile: 12% padding inside a 22% rounded square (see `.logo.backdrop`). */
const TILE_PADDING = 0.12
const TILE_RADIUS = 0.22

/** Background presets for export; `null` keeps the PNG transparent. */
export const BACKGROUND_PRESETS = [
  { id: 'none', label: 'None', color: null },
  { id: 'white', label: 'White', color: '#FFFFFF' },
  { id: 'black', label: 'Black', color: '#000000' },
] as const
export const CUSTOM_BACKGROUND_DEFAULT = '#F2B72E'

/** `#abc`, `abc`, `#aabbcc` or `aabbcc` → `#AABBCC`; null for anything else. */
export function normalizeHex(raw: string): string | null {
  const v = raw.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(v)) return ('#' + v[0] + v[0] + v[1] + v[1] + v[2] + v[2]).toUpperCase()
  if (/^[0-9a-f]{6}$/i.test(v)) return ('#' + v).toUpperCase()
  return null
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** Download name for a design, e.g. `logo-remix-kansas-city-chiefs-alternate.svg`. */
export const designFileName = (team: Team, variantId: string | undefined, format: ExportFormat) =>
  `logo-remix-${slug(fullName(team)) || slug(team.id) || 'logo'}${variantId ? '-' + slug(variantId) : ''}.${format}`

/** The colors the artwork actually uses, normalized so they round-trip through the color inputs. */
export const sourceColors = (team: Team): DesignColors =>
  (team.sourcePalette ?? team.palette).map((c) => normalizeHex(c) ?? c.toUpperCase()) as DesignColors

export interface SlotRole {
  /** Short label shown next to the slot's color input. */
  label: string
  /** False for slots the artwork never paints; their color has no visible effect. */
  editable: boolean
}

/**
 * What each of the three source slots does for this artwork. One-color logos (two unused
 * slots) paint one slot and sit on a backdrop tile in another, so that slot is editable too.
 */
export function slotRoles(team: Team): [SlotRole, SlotRole, SlotRole] {
  const unused = team.unusedSourceSlots ?? []
  const backdrop = backdropSlot(team)
  let n = 0
  return [0, 1, 2].map((slot) => {
    if (slot === backdrop) return { label: 'Backdrop', editable: true }
    if (unused.includes(slot)) return { label: 'Unused', editable: false }
    n += 1
    return { label: backdrop !== undefined ? 'Logo' : `Color ${n}`, editable: true }
  }) as [SlotRole, SlotRole, SlotRole]
}

/** Cycle the colors of the editable slots (unused slots stay put); identity when fewer than two are editable. */
export function rotateColors(colors: DesignColors, roles: readonly SlotRole[]): DesignColors {
  const slots = roles.map((r, i) => (r.editable ? i : -1)).filter((i) => i >= 0)
  if (slots.length < 2) return colors
  const out: DesignColors = [...colors]
  slots.forEach((slot, i) => {
    out[slot] = colors[slots[(i + 1) % slots.length]]
  })
  return out
}

/**
 * Start a design from another team's palette: the same contrast-safe slot assignment a remix
 * would use, but with the palette's exact colors (no darkening) so the inputs show real hexes.
 */
export function seedColors(team: Team, palette: readonly string[]): DesignColors {
  const p = PERMS[contrastSafePermutation(team, palette, 0)]
  const own = sourceColors(team)
  return [0, 1, 2].map((slot) => normalizeHex(palette[p[slot]] ?? own[slot]) ?? own[slot]) as DesignColors
}

export const sameColors = (a: readonly string[] | null, b: readonly string[] | null) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((c, i) => c.toUpperCase() === b[i].toUpperCase()))

// ---------------------------------------------------------------- SVG markup helpers
const ROOT_TAG = /<svg\b[^>]*>/i
const attr = (tag: string, name: string) => new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)
const attrValue = (tag: string, name: string) => {
  const m = attr(tag, name)
  return m ? (m[1] ?? m[2] ?? '') : undefined
}
const stripAttrs = (tag: string, names: string[]) =>
  tag.replace(new RegExp(`\\s(?:${names.join('|')})\\s*=\\s*(?:"[^"]*"|'[^']*')`, 'gi'), '')
/** Absolute length in px (unitless or `px`), else undefined (percentages, em, missing). */
const absoluteLength = (v: string | undefined) => {
  if (v === undefined) return undefined
  const m = /^\s*([0-9.]+)\s*(px)?\s*$/i.exec(v)
  const n = m ? Number(m[1]) : NaN
  return Number.isFinite(n) && n > 0 ? n : undefined
}
const fmt = (n: number) => String(Math.round(n * 1000) / 1000)

export function parseViewBox(markup: string): { x: number; y: number; width: number; height: number } | undefined {
  const tag = ROOT_TAG.exec(markup)?.[0]
  const vb = tag ? attrValue(tag, 'viewBox') : undefined
  const parts = vb?.trim().split(/[\s,]+/).map(Number)
  if (!parts || parts.length !== 4 || parts.some((n) => !Number.isFinite(n)) || parts[2] <= 0 || parts[3] <= 0) return undefined
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] }
}

/** Intrinsic size from the viewBox, else absolute width/height attributes; undefined when neither is usable. */
export function svgIntrinsicSize(markup: string): { width: number; height: number } | undefined {
  const vb = parseViewBox(markup)
  if (vb) return { width: vb.width, height: vb.height }
  const tag = ROOT_TAG.exec(markup)?.[0]
  if (!tag) return undefined
  const width = absoluteLength(attrValue(tag, 'width'))
  const height = absoluteLength(attrValue(tag, 'height'))
  return width && height ? { width, height } : undefined
}

/**
 * Give the root `<svg>` both a viewBox and absolute width/height so browsers report a natural
 * size when the markup is drawn onto a canvas and so the file opens at a sensible size.
 */
export function ensureSvgSize(markup: string): string {
  const m = ROOT_TAG.exec(markup)
  if (!m) return markup
  const tag = m[0]
  const vb = parseViewBox(markup)
  const width = absoluteLength(attrValue(tag, 'width'))
  const height = absoluteLength(attrValue(tag, 'height'))
  if (vb && width && height) return markup
  let next = tag
  if (vb) next = stripAttrs(next, ['width', 'height']).replace(/<svg\b/i, `<svg width="${fmt(vb.width)}" height="${fmt(vb.height)}"`)
  else if (width && height) next = next.replace(/<svg\b/i, `<svg viewBox="0 0 ${fmt(width)} ${fmt(height)}"`)
  else return markup
  return markup.slice(0, m.index) + next + markup.slice(m.index + tag.length)
}

export interface DesignLayout {
  size: number
  /** Rounded backdrop tile behind one-color artwork, when the design has one. */
  tile?: { x: number; y: number; size: number; radius: number }
  /** Square the artwork is fitted into (centered, aspect preserved). */
  logo: { x: number; y: number; size: number }
}

/** Square canvas geometry shared by the SVG and PNG exporters so both formats match. */
export function designLayout(size: number, hasBackdrop: boolean, hasBackground: boolean): DesignLayout {
  if (hasBackdrop) {
    const inset = hasBackground ? size * BACKGROUND_PADDING : 0
    const tileSize = size - inset * 2
    const pad = tileSize * TILE_PADDING
    return {
      size,
      tile: { x: inset, y: inset, size: tileSize, radius: tileSize * TILE_RADIUS },
      logo: { x: inset + pad, y: inset + pad, size: tileSize - pad * 2 },
    }
  }
  const pad = hasBackground ? size * BACKGROUND_PADDING : 0
  return { size, logo: { x: pad, y: pad, size: size - pad * 2 } }
}

/**
 * Wrap recolored artwork in a square canvas with an optional solid background and the
 * backdrop tile one-color logos sit on. Returns a standalone SVG document.
 */
export function composeSvg(inner: string, opts: { backdrop?: string; background?: string | null; size?: number }): string {
  const size = opts.size ?? SVG_EXPORT_SIZE
  const body = inner.replace(/<\?xml[\s\S]*?\?>/gi, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '').trim()
  const m = ROOT_TAG.exec(body)
  if (!m) return body
  const tag = m[0]
  const intrinsic = svgIntrinsicSize(body) ?? { width: size, height: size }
  const vb = parseViewBox(body)
  const viewBox = vb ? `${fmt(vb.x)} ${fmt(vb.y)} ${fmt(vb.width)} ${fmt(vb.height)}` : `0 0 ${fmt(intrinsic.width)} ${fmt(intrinsic.height)}`
  const layout = designLayout(size, !!opts.backdrop, !!opts.background)
  const { x, y, size: box } = layout.logo
  const nested =
    stripAttrs(tag, ['width', 'height', 'x', 'y', 'viewBox', 'preserveAspectRatio', 'xmlns']).replace(
      /<svg\b/i,
      `<svg x="${fmt(x)}" y="${fmt(y)}" width="${fmt(box)}" height="${fmt(box)}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet"`,
    ) + body.slice(m.index + tag.length)
  const layers: string[] = []
  if (opts.background) layers.push(`<rect width="${size}" height="${size}" fill="${opts.background}"/>`)
  if (layout.tile && opts.backdrop) {
    const t = layout.tile
    layers.push(`<rect x="${fmt(t.x)}" y="${fmt(t.y)}" width="${fmt(t.size)}" height="${fmt(t.size)}" rx="${fmt(t.radius)}" fill="${opts.backdrop}"/>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${layers.join('')}${nested}</svg>`
}
