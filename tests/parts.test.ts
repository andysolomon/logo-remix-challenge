import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BUILD_COLORS,
  buildBounds,
  buildFileName,
  buildSvg,
  duplicateLayer,
  emptyBuild,
  layerTransform,
  normalizeRotation,
  partsSummary,
  placePart,
  placedParts,
  removeLayer,
  removePart,
  rotateBuildColors,
  seedBuildColors,
  shiftLayer,
  slotForPart,
  snapRotation,
  updateLayer,
  type BuildState,
} from '../src/lib/build'
import { MAX_PARTS, colorName, cutPiece, partViewBox, scanParts, thumbTile, type LogoPart, type PartsScan } from '../src/lib/parts'
import { TRANSPARENT, TraceError, type RasterImage } from '../src/lib/trace'

const root = join(import.meta.dir, '..')
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')

type RGBA = [number, number, number, number]
type Canvas = RasterImage & { data: Uint8ClampedArray }

function image(w: number, h: number, fill: RGBA = [0, 0, 0, 0]): Canvas {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) data.set(fill, i * 4)
  return { width: w, height: h, data }
}

/** Anti-aliased by 4x4 supersampling, like a rendered logo. */
function paint(img: Canvas, color: RGBA, inside: (x: number, y: number) => boolean) {
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      let hits = 0
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) if (inside(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4)) hits++
      if (!hits) continue
      const a = hits / 16
      const i = (y * img.width + x) * 4
      const under = img.data[i + 3] / 255
      const out = a + under * (1 - a)
      for (let c = 0; c < 3; c++) img.data[i + c] = Math.round((color[c] * a + img.data[i + c] * under * (1 - a)) / out)
      img.data[i + 3] = Math.round(out * 255)
    }
  }
}

const disk = (cx: number, cy: number, r: number) => (x: number, y: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r
const rect = (x0: number, y0: number, x1: number, y1: number) => (x: number, y: number) => x >= x0 && x < x1 && y >= y0 && y < y1

const NAVY: RGBA = [20, 40, 100, 255]
const GOLD: RGBA = [242, 183, 46, 255]
const RED: RGBA = [216, 68, 43, 255]

/** A navy disc with a gold square on it, and a separate red bar underneath. */
function crest(): Canvas {
  const img = image(200, 200)
  paint(img, NAVY, disk(100, 80, 60))
  paint(img, GOLD, rect(80, 60, 120, 100))
  paint(img, RED, rect(40, 160, 160, 180))
  return img
}

const near = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= tolerance

describe('finding the parts of a logo', () => {
  test('each connected region of one color is a part, largest first', () => {
    const scan = scanParts(crest())
    expect(scan.parts).toHaveLength(3)
    expect(scan.parts.map((p) => p.name)).toEqual(['Navy shape', 'Red shape', 'Gold shape'])
    expect(scan.parts.every((p, i) => i === 0 || scan.parts[i - 1].area >= p.area)).toBe(true)
    expect(new Set(scan.parts.map((p) => p.key)).size).toBe(3)
    // Colors are the artwork's own, as #RRGGBB.
    for (const p of scan.parts) expect(p.color).toMatch(/^#[0-9A-F]{6}$/)
    expect(colorName(scan.parts[0].color)).toBe('Navy')
  })

  test('parts are measured in a 100-unit square, where they sit in the logo', () => {
    const [disc, bar, square] = scanParts(crest()).parts
    // 200 px image: one unit is two pixels.
    expect(near(disc.box.x, 20, 1) && near(disc.box.y, 10, 1) && near(disc.box.w, 60, 1.5) && near(disc.box.h, 60, 1.5)).toBe(true)
    expect(near(bar.box.x, 20, 1) && near(bar.box.y, 80, 1) && near(bar.box.w, 60, 1.5) && near(bar.box.h, 10, 1.5)).toBe(true)
    expect(near(square.box.x, 40, 1) && near(square.box.y, 30, 1) && near(square.box.w, 20, 1.5) && near(square.box.h, 20, 1.5)).toBe(true)
    for (const p of [disc, bar, square]) expect(p.d).toMatch(/^M[-\d. ]+[CL]/)
  })

  test('a shape under other artwork is taken whole, but a see-through hole stays a hole', () => {
    const scan = scanParts(crest())
    const disc = scan.parts[0]
    // The gold square sits on the disc: the disc part is the full disc, one closed outline.
    expect(disc.d.match(/M/g)).toHaveLength(1)
    expect(near(disc.area, Math.PI * 60 * 60, 250)).toBe(true)

    const ring = image(200, 200)
    paint(ring, NAVY, (x, y) => disk(100, 100, 80)(x, y) && !disk(100, 100, 40)(x, y))
    const [only] = scanParts(ring).parts
    expect(only.d.match(/M/g)).toHaveLength(2)
    expect(near(only.area, Math.PI * (80 * 80 - 40 * 40), 300)).toBe(true)
  })

  test('artwork floating in a see-through hole is its own part, not filled into the ring', () => {
    const img = image(200, 200)
    paint(img, NAVY, (x, y) => disk(100, 100, 90)(x, y) && !disk(100, 100, 60)(x, y))
    paint(img, RED, disk(100, 100, 20))
    const scan = scanParts(img)
    expect(scan.parts.map((p) => p.name)).toEqual(['Navy shape', 'Red shape'])
    expect(scan.parts[0].d.match(/M/g)).toHaveLength(2)
  })

  test('a non-square image is centered in the square', () => {
    const img = image(200, 100)
    paint(img, NAVY, rect(20, 10, 180, 90))
    const [only] = scanParts(img).parts
    expect(near(only.box.x, 10, 0.6) && near(only.box.w, 80, 1)).toBe(true)
    expect(near(only.box.y, 30, 0.6) && near(only.box.h, 40, 1)).toBe(true)
  })

  test('same-colored parts are numbered, specks are skipped and the list is capped', () => {
    const img = image(400, 400)
    for (let i = 0; i < 30; i++) paint(img, NAVY, rect(10 + (i % 6) * 60, 10 + ((i / 6) | 0) * 60, 50 + (i % 6) * 60 - (i % 3) * 4, 50 + ((i / 6) | 0) * 60))
    paint(img, NAVY, rect(380, 380, 383, 383))
    const scan = scanParts(img)
    expect(scan.parts).toHaveLength(MAX_PARTS)
    expect(scan.parts[0].name).toBe('Navy shape')
    expect(scan.parts[1].name).toBe('Navy shape 2')
    expect(scan.parts.every((p) => p.box.w > 5)).toBe(true)
  })

  test('an image with no artwork is refused', () => {
    expect(() => scanParts(image(64, 64))).toThrow(TraceError)
  })

  test('the scan keeps the color of every pixel for cutting', () => {
    const scan = scanParts(crest())
    expect(scan.ink).toHaveLength(200 * 200)
    expect(scan.ink[0]).toBe(TRANSPARENT)
    expect(scan.colors[scan.ink[80 * 200 + 100]]).toBe(scan.parts[2].color)
    expect(scan.colors[scan.ink[80 * 200 + 50]]).toBe(scan.parts[0].color)
  })
})

describe('cutting a piece out of a fused shape', () => {
  const fused = (): PartsScan => {
    const img = image(200, 200)
    paint(img, NAVY, disk(130, 100, 50))
    paint(img, NAVY, rect(20, 90, 130, 110))
    return scanParts(img)
  }

  test('a fused logo is one part until a piece is cut out along a loop', () => {
    const scan = fused()
    expect(scan.parts).toHaveLength(1)
    // Loop around the bar's left half, in stage units.
    const piece = cutPiece(scan, [[5, 40], [35, 40], [35, 60], [5, 60]])!
    expect(piece.name).toBe('Cut piece')
    expect(piece.color).toBe(scan.parts[0].color)
    expect(near(piece.box.x, 10, 1) && near(piece.box.y, 45, 1)).toBe(true)
    expect(near(piece.box.w, 25, 1.5) && near(piece.box.h, 10, 1.5)).toBe(true)
    expect(near(piece.area, 50 * 20, 80)).toBe(true)
  })

  test('keep outside takes everything but the loop', () => {
    const scan = fused()
    const loop: [number, number][] = [[5, 40], [35, 40], [35, 60], [5, 60]]
    const inside = cutPiece(scan, loop, 'inside')!
    const outside = cutPiece(scan, loop, 'outside')!
    expect(near(inside.area + outside.area, scan.parts[0].area, 4)).toBe(true)
    expect(outside.box.x).toBeGreaterThan(inside.box.x + inside.box.w - 1)
  })

  test('a cut across several colors is one flat piece in the color that covers most of it', () => {
    const scan = scanParts(crest())
    const piece = cutPiece(scan, [[15, 5], [85, 5], [85, 75], [15, 75]])!
    expect(piece.color).toBe(scan.parts[0].color)
    expect(piece.d.match(/M/g)).toHaveLength(1)
  })

  test('no piece until the loop has three points, or when it holds no artwork', () => {
    const scan = fused()
    expect(cutPiece(scan, [[5, 40], [35, 40]])).toBeNull()
    expect(cutPiece(scan, [[1, 1], [6, 1], [6, 6], [1, 6]])).toBeNull()
  })
})

describe('part names and thumbnails', () => {
  test('colors get plain names', () => {
    expect(colorName('#000000')).toBe('Black')
    expect(colorName('#FFFFFF')).toBe('White')
    expect(colorName('#9B958A')).toBe('Gray')
    expect(colorName('#D8442B')).toBe('Red')
    expect(colorName('#F2B72E')).toBe('Gold')
    expect(colorName('#0E6B6B')).toBe('Teal')
    expect(colorName('#1E5AA8')).toBe('Blue')
    expect(colorName('#14285A')).toBe('Navy')
    expect(colorName('#4A2A6B')).toBe('Purple')
    expect(colorName('#2E8B3D')).toBe('Green')
    expect(colorName('#FF8A3D')).toBe('Orange')
  })

  test('near-white and near-black parts sit on a contrasting tile', () => {
    expect(thumbTile('#F5F2EC')).toBe('#2B2A27')
    expect(thumbTile('#0A0A0A')).toBe('#F5F2EC')
    expect(thumbTile('#D8442B')).toBeUndefined()
  })

  test('thumbnails frame the part in a square with a little air', () => {
    expect(partViewBox({ x: 10, y: 20, w: 40, h: 20 }, 0.1)).toBe('6 6 48 48')
    expect(partViewBox({ x: 0, y: 0, w: 0, h: 0 }, 0)).toBe('-0.5 -0.5 1 1')
  })
})

// ---------------------------------------------------------------- build
const part = (id: string, color: string, box = { x: 20, y: 30, w: 40, h: 20 }, sourceId = 'A'): LogoPart => ({
  id,
  name: `${id} shape`,
  source: `Team ${sourceId}`,
  sourceId,
  color,
  box,
  d: `M${box.x} ${box.y}L${box.x + box.w} ${box.y}L${box.x + box.w} ${box.y + box.h}L${box.x} ${box.y + box.h}Z`,
})

describe('building a logo from parts', () => {
  test('a placed part lands where it sat in its logo, in front, selected', () => {
    const shield = part('p1', '#4A2A6B')
    const build = placePart(emptyBuild, shield)
    expect(build.layers).toHaveLength(1)
    expect(build.layers[0]).toMatchObject({ partId: 'p1', x: 40, y: 40, scale: 1, rotation: 0, flip: false, slot: 0 })
    expect(build.selected).toBe(build.layers[0].id)
    expect(layerTransform(build.layers[0], shield)).toBe('translate(40 40) scale(1 1) translate(-40 -40)')
    const next = placePart(build, part('p2', '#F2B72E'))
    expect(next.layers.map((l) => l.partId)).toEqual(['p1', 'p2'])
    expect(next.selected).toBe(next.layers[1].id)
    expect(new Set(next.layers.map((l) => l.id)).size).toBe(2)
  })

  test('parts bring their colors to free slots, share a slot with a matching color, then join the nearest', () => {
    let build: BuildState = emptyBuild
    expect(build.colors).toEqual(BUILD_COLORS)
    build = placePart(build, part('p1', '#4A2A6B'))
    build = placePart(build, part('p2', '#F2B72E'))
    expect(build.colors.slice(0, 2)).toEqual(['#4A2A6B', '#F2B72E'])
    // Nearly the same gold shares gold's slot.
    build = placePart(build, part('p3', '#F0B030'))
    expect(build.layers[2].slot).toBe(1)
    build = placePart(build, part('p4', '#F5F2EC'))
    expect(build.layers[3].slot).toBe(2)
    expect(build.colors).toEqual(['#4A2A6B', '#F2B72E', '#F5F2EC'])
    // All three taken: a dark blue joins the purple, the nearest.
    expect(slotForPart(build, '#1F2A6B')).toEqual({ slot: 0, colors: build.colors })
  })

  test('a logo started from a palette keeps the palette', () => {
    const seeded = seedBuildColors(emptyBuild, 'KC', ['#e31837', '#FFB81C', '#FFFFFF'])
    expect(seeded.colors).toEqual(['#E31837', '#FFB81C', '#FFFFFF'])
    expect(seeded.paletteId).toBe('KC')
    const one = placePart(seeded, part('p1', '#F2B72E'))
    expect(one.colors).toEqual(seeded.colors)
    expect(one.layers[0].slot).toBe(1)
    // The next part takes a slot nothing uses yet, even if gold is nearer.
    const two = placePart(one, part('p2', '#F0B030'))
    expect(two.layers[1].slot).not.toBe(1)
    expect(two.colors).toEqual(seeded.colors)
  })

  test('layers move, resize, turn and flip within limits', () => {
    const p = part('p1', '#4A2A6B')
    let build = placePart(emptyBuild, p)
    const id = build.layers[0].id
    build = updateLayer(build, id, { x: 140, y: -20, scale: 100, rotation: 270 })
    expect(build.layers[0]).toMatchObject({ x: 100, y: 0, scale: 8, rotation: -90 })
    build = updateLayer(build, id, { x: 50, y: 50, scale: 2, rotation: 90, flip: true, slot: 4 })
    expect(build.layers[0].slot).toBe(1)
    expect(layerTransform(build.layers[0], p)).toBe('translate(50 50) rotate(90) scale(-2 2) translate(-40 -40)')
    expect(updateLayer(build, id, { scale: 0 }).layers[0].scale).toBe(0.1)
    expect(updateLayer(build, 'nope', { x: 1 })).toEqual(build)
  })

  test('rotation normalizes and snaps to 45 degrees when close', () => {
    expect(normalizeRotation(450)).toBe(90)
    expect(normalizeRotation(-190)).toBe(170)
    expect(snapRotation(43)).toBe(45)
    expect(snapRotation(-2)).toBe(0)
    expect(snapRotation(178)).toBe(180)
    expect(snapRotation(20)).toBe(20)
  })

  test('copy, reorder and delete', () => {
    let build = placePart(placePart(emptyBuild, part('p1', '#4A2A6B')), part('p2', '#F2B72E'))
    const [back, front] = build.layers.map((l) => l.id)
    build = duplicateLayer(build, back)
    expect(build.layers.map((l) => l.partId)).toEqual(['p1', 'p1', 'p2'])
    const copy = build.layers[1]
    expect(build.selected).toBe(copy.id)
    expect(copy.x).toBe(build.layers[0].x + 5)
    expect(shiftLayer(build, front, 1)).toBe(build)
    expect(shiftLayer(build, back, -1)).toBe(build)
    expect(shiftLayer(build, front, -1).layers.map((l) => l.id)).toEqual([back, front, copy.id])
    expect(removeLayer(build, copy.id).selected).toBeNull()
    expect(removeLayer(build, front).selected).toBe(copy.id)
    // Dropping a part from the tray takes every copy off the logo.
    const dropped = removePart(build, 'p1')
    expect(dropped.layers.map((l) => l.partId)).toEqual(['p2'])
    expect(dropped.selected).toBeNull()
  })

  test('colors rotate through the slots', () => {
    expect(rotateBuildColors({ ...emptyBuild, colors: ['#111111', '#222222', '#333333'] }).colors).toEqual(['#222222', '#333333', '#111111'])
  })

  test('the export is a square trimmed to the artwork, with every layer in its slot color', () => {
    const a = part('p1', '#4A2A6B', { x: 10, y: 10, w: 40, h: 20 })
    const b = part('p2', '#F2B72E', { x: 60, y: 40, w: 20, h: 40 })
    const build = placePart(placePart(emptyBuild, a), b)
    expect(buildBounds(build.layers, [a, b])).toEqual({ x: 10, y: 10, w: 70, h: 70 })
    const svg = buildSvg(build, [a, b])!
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="7.9 7.9 74.2 74.2">')).toBe(true)
    expect(svg.match(/<path /g)).toHaveLength(2)
    expect(svg.indexOf('#4A2A6B')).toBeLessThan(svg.indexOf('#F2B72E'))
    expect(svg).toContain('fill-rule="evenodd"')
    expect(svg).not.toContain('<rect')
    const onWhite = buildSvg(build, [a, b], { background: '#FFFFFF', size: 512 })!
    expect(onWhite).toContain('width="512"')
    expect(onWhite).toContain('viewBox="4.4 4.4 81.2 81.2"')
    expect(onWhite).toContain('<rect x="4.4" y="4.4" width="81.2" height="81.2" fill="#FFFFFF"/>')
    expect(buildSvg(emptyBuild, [])).toBeNull()
  })

  test('a turned layer widens the bounds', () => {
    const a = part('p1', '#4A2A6B', { x: 30, y: 40, w: 40, h: 20 })
    const build = updateLayer(placePart(emptyBuild, a), 'L1', { rotation: 90 })
    const bounds = buildBounds(build.layers, [a])!
    expect(near(bounds.w, 20, 0.001) && near(bounds.h, 40, 0.001)).toBe(true)
  })

  test('summaries and file names', () => {
    const parts = [part('p1', '#111111', undefined, 'A'), part('p2', '#222222', undefined, 'A'), part('p3', '#333333', undefined, 'B')]
    expect(partsSummary(parts)).toBe('3 parts from 2 logos')
    expect(partsSummary(parts.slice(0, 1))).toBe('1 part from 1 logo')
    expect(partsSummary([])).toBe('No parts yet')
    const build = placePart(placePart(emptyBuild, parts[2]), parts[0])
    expect(placedParts(build.layers, parts).map((p) => p.id)).toEqual(['p3', 'p1'])
    expect(buildFileName('River Hawks', 'png')).toBe('logo-remix-river-hawks.png')
    expect(buildFileName('  ', 'svg')).toBe('logo-remix-custom-logo.svg')
  })
})

describe('designer tools', () => {
  test('Recolor, Parts and Build share the designer canvas and its export', () => {
    const designer = read('src/components/DesignerMode.tsx')
    expect(designer).toContain("tool: 'recolor'")
    expect(designer).toContain('<PartsCanvas')
    expect(designer).toContain('<BuildCanvas')
    expect(designer).toContain('<PartsTray')
    expect(designer).toContain('aria-label="Designer tool"')
    // Parts flow on a phone: its own three steps.
    expect(designer).toContain("'1 · Logos'")
    expect(designer).toContain("'2 · Parts'")
    expect(designer).toContain("'3 · Build'")
  })

  test('the stage takes drags without scrolling the page, and controls keep 44px targets on touch', () => {
    const css = read('src/styles.css')
    expect(css).toMatch(/\.build-stage \{[^}]*touch-action: none/)
    expect(css).toMatch(/\.cut-stage \{[^}]*touch-action: none/)
    expect(css).toContain('.part-tool { min-height: 44px')
  })
})
