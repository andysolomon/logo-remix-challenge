import { isSvg, loadSvg, svgToDataUrl } from '../components/Logo'
import { ensureSvgSize } from './designer'
import { scanParts, type PartsScan } from './parts'

/** Browser half of Designer mode's parts: render a logo to pixels, then split it into parts (see parts.ts). */

/** A logo's parts, plus the exact picture they were found in so the stage lines up with them. */
export interface LogoScan extends PartsScan {
  /** PNG data URL of the rendered logo, square, the parts' 100-unit stage. */
  preview: string
}

/**
 * Side of the square a logo is rendered into. Twice the upload tracer's size: parts are enlarged on the
 * stage and exported at up to 2048 px, where a coarser trace shows as ripples along straight edges.
 */
export const SCAN_SIZE = 1536
/** Share of the square left empty around the logo, so outlines never run into the edge. */
const MARGIN = 0.04
/** Scans kept: each holds a pixel map and a preview image. */
const CACHE_LIMIT = 8
const cache = new Map<string, Promise<LogoScan | null>>()

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })

async function scan(logo: string): Promise<LogoScan | null> {
  let src = logo
  if (isSvg(logo)) {
    const markup = await loadSvg(logo)
    // A sized SVG reports a natural size, so it can be fitted into the square.
    if (markup) src = svgToDataUrl(ensureSvgSize(markup))
  }
  const img = await loadImage(src)
  if (!img) return null
  const size = SCAN_SIZE
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  const iw = img.naturalWidth || size
  const ih = img.naturalHeight || size
  const room = size * (1 - MARGIN * 2)
  const scale = Math.min(room / iw, room / ih)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, (size - iw * scale) / 2, (size - ih * scale) / 2, iw * scale, ih * scale)
  try {
    const { data } = ctx.getImageData(0, 0, size, size)
    const preview = canvas.toDataURL('image/png')
    // Let the "finding parts" status paint before the synchronous scan runs.
    await new Promise((r) => setTimeout(r, 0))
    return { ...scanParts({ width: size, height: size, data }), preview }
  } catch {
    // No artwork found, or a canvas the browser will not read back.
    return null
  }
}

/** The parts of a logo (an asset path or an inline SVG data URL); null when it cannot be read. Cached per logo. */
export function scanLogo(logo: string): Promise<LogoScan | null> {
  let hit = cache.get(logo)
  if (hit) {
    // Most recently used last.
    cache.delete(logo)
    cache.set(logo, hit)
    return hit
  }
  hit = scan(logo).catch(() => null)
  cache.set(logo, hit)
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!)
  return hit
}
