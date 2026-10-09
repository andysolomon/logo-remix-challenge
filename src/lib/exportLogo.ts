import { hasEmbeddedRaster, hexToRgb, isSvg, loadSvg, recolorRaster, recolorSvg, svgToDataUrl } from '../components/Logo'
import { composeSvg, designLayout, ensureSvgSize, sourceColors, type DesignColors, type ExportSize } from './designer'
import { backdropSlot, type Team } from './teams'

/** A Designer-mode design: the artwork (variant already applied), its slot colors (null = as drawn) and an export background. */
export interface Design {
  team: Team
  colors: DesignColors | null
  background: string | null
}

const backdropOf = (d: Design) => {
  const slot = backdropSlot(d.team)
  return d.colors && slot !== undefined ? d.colors[slot] : undefined
}

/** Recolored vector markup (no canvas composition), or null for bitmap artwork. */
async function coloredSvg(d: Design): Promise<string | null> {
  if (!isSvg(d.team.logo)) return null
  const markup = await loadSvg(d.team.logo)
  if (!markup || hasEmbeddedRaster(markup)) return null
  return d.colors ? recolorSvg(markup, sourceColors(d.team).map(hexToRgb), d.colors.map(hexToRgb)) : markup
}

/** Whether this artwork can leave as an SVG file (vector, with no embedded bitmap). */
export async function canExportSvg(logo: string): Promise<boolean> {
  if (!isSvg(logo)) return false
  const markup = await loadSvg(logo)
  return !!markup && !hasEmbeddedRaster(markup)
}

/** Standalone SVG document of the design, or null when the artwork is a bitmap. */
export async function designSvg(d: Design): Promise<string | null> {
  const colored = await coloredSvg(d)
  if (!colored) return null
  const backdrop = backdropOf(d)
  return backdrop || d.background ? composeSvg(colored, { backdrop, background: d.background }) : ensureSvgSize(colored)
}

export async function designSvgBlob(d: Design): Promise<Blob | null> {
  const markup = await designSvg(d)
  return markup ? new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }) : null
}

/** Image URL of the recolored artwork alone: vector as a sized data URL, bitmaps through the canvas recolor. */
async function designImageUrl(d: Design): Promise<string | null> {
  const colored = await coloredSvg(d)
  if (colored) return svgToDataUrl(ensureSvgSize(colored))
  if (!d.colors) return d.team.logo
  return recolorRaster(d.team.logo, sourceColors(d.team).map(hexToRgb), d.colors.map(hexToRgb))
}

const loadImageElement = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + size, y, x + size, y + size, r)
  ctx.arcTo(x + size, y + size, x, y + size, r)
  ctx.arcTo(x, y + size, x, y, r)
  ctx.arcTo(x, y, x + size, y, r)
  ctx.closePath()
}

/** Square PNG of the design at `size` px: optional background, backdrop tile, artwork fitted and centered. */
export async function designPngBlob(d: Design, size: ExportSize): Promise<Blob | null> {
  const url = await designImageUrl(d)
  if (!url) return null
  const img = await loadImageElement(url)
  if (!img) return null
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const backdrop = backdropOf(d)
  const layout = designLayout(size, !!backdrop, !!d.background)
  if (d.background) {
    ctx.fillStyle = d.background
    ctx.fillRect(0, 0, size, size)
  }
  if (layout.tile && backdrop) {
    ctx.fillStyle = backdrop
    roundedRect(ctx, layout.tile.x, layout.tile.y, layout.tile.size, layout.tile.radius)
    ctx.fill()
  }
  const iw = img.naturalWidth || layout.logo.size
  const ih = img.naturalHeight || layout.logo.size
  const scale = Math.min(layout.logo.size / iw, layout.logo.size / ih)
  const dw = iw * scale
  const dh = ih * scale
  ctx.drawImage(img, layout.logo.x + (layout.logo.size - dw) / 2, layout.logo.y + (layout.logo.size - dh) / 2, dw, dh)
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    } catch {
      resolve(null)
    }
  })
}

/** Save a blob through a temporary download link. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
