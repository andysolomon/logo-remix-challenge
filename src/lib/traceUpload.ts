import { TRACE_SIZE, TraceError, traceImage, type RasterImage, type TraceOptions, type TraceResult } from './trace'
import type { Team } from './teams'

/** Browser half of Designer mode's upload: read an image file into pixels, then trace it (see trace.ts). */

/** Uploads larger than this are refused before decoding. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
export const UPLOAD_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml'

/** An uploaded logo: its decoded pixels (kept so trace settings can change) and the traced result. */
export interface UploadedLogo {
  /** Increases with every trace, so views keyed on it refresh when the trace changes. */
  serial: number
  /** File name without its extension, shown as the logo's name and used for downloads. */
  name: string
  raster: RasterImage
  options: TraceOptions
  result: TraceResult
  /** The traced SVG as a data URL, which Logo.tsx and the exporters load like any SVG asset. */
  logo: string
}

export const UPLOAD_ID = 'UPLOAD'

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new TraceError('That file could not be opened as an image.'))
    img.src = src
  })

/** Decode any browser-readable image (SVG included) into RGBA pixels, longest side scaled to TRACE_SIZE. */
export async function readRaster(file: File): Promise<RasterImage> {
  if (file.size > MAX_UPLOAD_BYTES) throw new TraceError('That file is over 20 MB. Try a smaller image.')
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    // An SVG without its own size decodes at 0x0 (or 300x150); trace it as a square.
    const sized = img.naturalWidth > 0 && img.naturalHeight > 0
    const iw = sized ? img.naturalWidth : TRACE_SIZE
    const ih = sized ? img.naturalHeight : TRACE_SIZE
    const scale = TRACE_SIZE / Math.max(iw, ih)
    const width = Math.max(1, Math.round(iw * scale))
    const height = Math.max(1, Math.round(ih * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new TraceError('This browser cannot read images for tracing.')
    // Small images are scaled up smoothly, which gives the tracer cleaner edges to follow.
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, width, height)
    const { data } = ctx.getImageData(0, 0, width, height)
    return { width, height, data }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const fileStem = (name: string) => name.replace(/\.[^./\\]+$/, '').trim() || 'My logo'

const svgDataUrl = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)

let traces = 0

/** Trace pixels with the given settings into an uploaded logo. Throws TraceError when no logo is found. */
export function traceUpload(name: string, raster: RasterImage, options: TraceOptions): UploadedLogo {
  const result = traceImage(raster, options)
  return { serial: ++traces, name, raster, options, result, logo: svgDataUrl(result.svg) }
}

/** The upload as a Designer-mode team: its traced colors are the source slots; unused slots go on the tile. */
export const uploadTeam = (upload: UploadedLogo): Team => ({
  id: UPLOAD_ID,
  league: 'BRAND',
  conference: 'Upload',
  region: upload.name,
  name: '',
  abbr: UPLOAD_ID,
  palette: upload.result.palette,
  sourcePalette: upload.result.palette,
  unusedSourceSlots: upload.result.unusedSlots,
  logo: upload.logo,
})
