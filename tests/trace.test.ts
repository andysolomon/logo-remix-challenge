import { describe, expect, test } from 'bun:test'
import { hexToRgb, isSvg, recolorSvg } from '../src/components/Logo'
import { TraceError, traceImage, type RasterImage } from '../src/lib/trace'
import { uploadTeam, traceUpload, fileStem } from '../src/lib/traceUpload'
import { remixLayout } from '../src/lib/teams'

type RGBA = [number, number, number, number]

/** A blank RGBA image and a few painters: shapes are anti-aliased by 4x4 supersampling, like real artwork. */
function image(w: number, h: number, fill: RGBA): RasterImage & { data: Uint8ClampedArray } {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) data.set(fill, i * 4)
  return { width: w, height: h, data }
}

function paint(img: RasterImage & { data: Uint8ClampedArray }, color: RGBA, inside: (x: number, y: number) => boolean) {
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      let hits = 0
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) if (inside(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4)) hits++
      if (!hits) continue
      const a = hits / 16
      const i = (y * img.width + x) * 4
      for (let c = 0; c < 4; c++) img.data[i + c] = Math.round(img.data[i + c] * (1 - a) + color[c] * a)
    }
  }
}

const disk = (cx: number, cy: number, r: number) => (x: number, y: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r
const rect = (x0: number, y0: number, x1: number, y1: number) => (x: number, y: number) => x >= x0 && x < x1 && y >= y0 && y < y1

/** Deterministic JPEG-ish noise. */
function noise(img: RasterImage & { data: Uint8ClampedArray }, amount: number) {
  let seed = 7
  for (let i = 0; i < img.data.length; i++) {
    if (i % 4 === 3) continue
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    img.data[i] = img.data[i] + ((seed % (2 * amount + 1)) - amount)
  }
}

const near = (hex: string, rgb: number[], tolerance = 14) => {
  const c = hexToRgb(hex)
  return Math.hypot(c[0] - rgb[0], c[1] - rgb[1], c[2] - rgb[2]) <= tolerance
}
const paths = (svg: string) => [...svg.matchAll(/<path fill="(#[0-9A-F]{6})" fill-rule="evenodd" d="([^"]*)"\/>/g)].map((m) => ({ fill: m[1], d: m[2] }))

const WHITE: RGBA = [255, 255, 255, 255]
const CLEAR: RGBA = [0, 0, 0, 0]

describe('logo tracer', () => {
  test('a one-color mark on transparency becomes one even-odd path that keeps its hole and its square corners', () => {
    const img = image(120, 100, CLEAR)
    paint(img, [0, 70, 33, 255], rect(20, 10, 100, 90))
    paint(img, [0, 0, 0, 0], rect(45, 35, 75, 65))
    // The painter blends toward transparent black; restore a true hole.
    for (let i = 0; i < 120 * 100; i++) if (img.data[i * 4 + 3] < 128) img.data.set(CLEAR, i * 4)
    const result = traceImage(img, { colors: 'auto', removeBackground: true })
    expect(result.colorCount).toBe(1)
    expect(result.palette[0]).toBe('#004621')
    expect(result.unusedSlots).toEqual([1, 2])
    const [layer] = paths(result.svg)
    expect(paths(result.svg)).toHaveLength(1)
    expect(layer.d.match(/M/g)).toHaveLength(2)
    // Rectangles keep their corners: straight segments only.
    expect(layer.d).not.toContain('C')
    // Cropped to the artwork plus a small margin.
    const box = /viewBox="([^"]+)"/.exec(result.svg)![1].split(' ').map(Number)
    expect(box[0]).toBeGreaterThan(17)
    expect(box[0]).toBeLessThan(20)
    expect(box[2]).toBeGreaterThan(80)
    expect(box[2]).toBeLessThan(84)
  })

  test('noisy, anti-aliased artwork on white keeps only its real fills and drops the white page', () => {
    const img = image(200, 160, WHITE)
    paint(img, [200, 30, 40, 255], disk(60, 80, 45))
    paint(img, [20, 50, 160, 255], disk(140, 80, 45))
    noise(img, 6)
    const result = traceImage(img, { colors: 'auto', removeBackground: true })
    expect(result.colorCount).toBe(2)
    expect(result.unusedSlots).toEqual([2])
    const fills = result.palette.slice(0, 2)
    expect(fills.some((f) => near(f, [200, 30, 40]))).toBe(true)
    expect(fills.some((f) => near(f, [20, 50, 160]))).toBe(true)
    // Circles come out as curves.
    for (const layer of paths(result.svg)) expect(layer.d).toContain('C')
  })

  test('white enclosed by the logo stays a color, while the white page around it is removed', () => {
    const img = image(160, 160, WHITE)
    paint(img, [10, 30, 70, 255], disk(80, 80, 60))
    paint(img, [255, 255, 255, 255], disk(80, 80, 30))
    const kept = traceImage(img, { colors: 'auto', removeBackground: true })
    expect(kept.colorCount).toBe(2)
    expect(near(kept.palette[0], [10, 30, 70])).toBe(true)
    expect(near(kept.palette[1], [255, 255, 255], 4)).toBe(true)
    // Without background removal the page itself is the largest color.
    const page = traceImage(img, { colors: 'auto', removeBackground: false })
    expect(near(page.palette[0], [255, 255, 255], 4)).toBe(true)
  })

  test("'auto' drops a thin anti-aliasing halo but keeps a wide in-between fill", () => {
    // Dark green letter block with a white outline on a dark field, with a light blur ring around the outline.
    const halo = image(200, 200, [35, 39, 42, 255])
    paint(halo, [201, 209, 204, 255], rect(28, 28, 172, 172))
    paint(halo, [251, 252, 252, 255], rect(30, 30, 170, 170))
    paint(halo, [30, 75, 36, 255], rect(40, 40, 160, 160))
    const auto = traceImage(halo, { colors: 'auto', removeBackground: true })
    expect(auto.colorCount).toBe(2)
    expect(near(auto.palette[0], [30, 75, 36])).toBe(true)
    // Asking for three colors explicitly keeps the ring.
    expect(traceImage(halo, { colors: 3, removeBackground: true }).colorCount).toBe(3)

    // A wide gray band between black and white is a real color.
    const stripes = image(240, 160, WHITE)
    paint(stripes, [0, 0, 0, 255], rect(20, 20, 80, 140))
    paint(stripes, [128, 128, 128, 255], rect(80, 20, 140, 140))
    paint(stripes, [0, 0, 0, 255], rect(140, 20, 220, 140))
    const gray = traceImage(stripes, { colors: 'auto', removeBackground: true })
    expect(gray.colorCount).toBe(2)
    expect(gray.palette.slice(0, 2).some((f) => near(f, [128, 128, 128]))).toBe(true)
  })

  test('an explicit color count merges the rest into the nearest kept color', () => {
    const img = image(200, 160, WHITE)
    paint(img, [200, 30, 40, 255], disk(60, 80, 45))
    paint(img, [20, 50, 160, 255], disk(140, 80, 30))
    const one = traceImage(img, { colors: 1, removeBackground: true })
    expect(one.colorCount).toBe(1)
    expect(paths(one.svg)).toHaveLength(1)
    expect(one.unusedSlots).toEqual([1, 2])
  })

  test('placeholder slots stay clear of every traced color, and the result is deterministic', () => {
    const img = image(120, 120, WHITE)
    paint(img, [0, 0, 0, 255], disk(60, 60, 40))
    const a = traceImage(img, { colors: 'auto', removeBackground: true })
    expect(a.palette[0]).toBe('#000000')
    for (const slot of a.unusedSlots) {
      const p = hexToRgb(a.palette[slot])
      expect(Math.hypot(p[0], p[1], p[2])).toBeGreaterThan(90)
    }
    expect(new Set(a.palette).size).toBe(3)
    expect(traceImage(img, { colors: 'auto', removeBackground: true })).toEqual(a)
  })

  test('an image with nothing but background is refused with a readable error', () => {
    expect(() => traceImage(image(50, 50, WHITE), { colors: 'auto', removeBackground: true })).toThrow(TraceError)
    expect(() => traceImage(image(50, 50, CLEAR), { colors: 'auto', removeBackground: true })).toThrow(TraceError)
    expect(() => traceImage({ width: 0, height: 0, data: [] })).toThrow(TraceError)
  })
})

describe('designing an uploaded logo', () => {
  test('a traced upload behaves like any SVG logo: its slots recolor, and unused slots become the tile', () => {
    const img = image(160, 160, WHITE)
    paint(img, [10, 30, 70, 255], disk(80, 80, 60))
    paint(img, [255, 255, 255, 255], disk(80, 80, 30))
    const upload = traceUpload(fileStem('Wolfpack Logo.final.JPG'), img, { colors: 'auto', removeBackground: true })
    expect(upload.name).toBe('Wolfpack Logo.final')
    expect(isSvg(upload.logo)).toBe(true)
    expect(decodeURIComponent(upload.logo.split(',')[1])).toBe(upload.result.svg)
    const team = uploadTeam(upload)
    expect(team.sourcePalette).toEqual(upload.result.palette)
    expect(remixLayout(team)).toEqual({ artwork: [0, 1], backdrop: 2 })

    const targets = ['#E31837', '#FFB612', '#FFFFFF']
    const recolored = recolorSvg(upload.result.svg, team.sourcePalette!.map(hexToRgb), targets.map(hexToRgb))
    const fills = [...recolored.matchAll(/<path fill="(#[0-9a-fA-F]{6})"/g)].map((m) => m[1].toUpperCase())
    expect(fills).toEqual(['#E31837', '#FFB612'])
    expect(traceUpload('x', img, upload.options).serial).toBeGreaterThan(upload.serial)
  })

  test('file names lose their extension, and a nameless file still gets a name', () => {
    expect(fileStem('km.jpg')).toBe('km')
    expect(fileStem('.png')).toBe('My logo')
    expect(fileStem('no-extension')).toBe('no-extension')
  })
})
