import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BACKGROUND_PRESETS,
  composeSvg,
  designFileName,
  designLayout,
  ensureSvgSize,
  framedTileImage,
  framedTileSvg,
  normalizeHex,
  parseViewBox,
  rotateColors,
  sameColors,
  seedColors,
  slotRoles,
  sourceColors,
  svgIntrinsicSize,
} from '../src/lib/designer'
import { LS, TEAMS, backdropSlot, contrastSafePermutations, findTeam, frameSlot, loadDesigner, saveDesigner, withLogoVariant } from '../src/lib/teams'

const root = join(import.meta.dir, '..')
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const stored = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => stored.get(k) ?? null,
    setItem: (k: string, v: string) => void stored.set(k, String(v)),
  },
})
beforeEach(() => stored.clear())
afterAll(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else delete (globalThis as { localStorage?: Storage }).localStorage
})

describe('designer mode setting', () => {
  test('is off until switched on and persists under its own key', () => {
    expect(LS.designer).toBe('lrx-designer')
    expect(loadDesigner()).toBe(false)
    saveDesigner(true)
    expect(stored.get(LS.designer)).toBe('1')
    expect(loadDesigner()).toBe(true)
    saveDesigner(false)
    expect(loadDesigner()).toBe(false)
  })

  test('is buried under a folded Advanced section of the settings dialog', () => {
    const settings = read('src/components/SettingsModal.tsx')
    expect(settings).toMatch(/<details\s+className="settings-advanced"/)
    expect(settings).toContain('<summary className="rail-label">ADVANCED</summary>')
    expect(settings).toContain('id="settings-designer-label"')
    expect(settings).toContain('aria-pressed={designer}')
    // The fold's summary must take part in the dialog's Tab cycle.
    expect(settings).toContain('summary, [tabindex]')
    expect(settings.indexOf('settings-theme-label')).toBeLessThan(settings.indexOf('settings-designer-label'))
  })

  test('adds a Designer tab and panel only while on', () => {
    const header = read('src/components/Header.tsx')
    expect(header).toContain("{ id: 'tab-designer', panel: 'panel-designer', mode: 'designer' as const }")
    expect(header).toContain("designer ? TABS : TABS.filter((t) => t.mode !== 'designer')")
    const designer = read('src/components/DesignerMode.tsx')
    expect(designer).toContain("id: 'panel-designer'")
    expect(designer).toContain("'aria-labelledby': 'tab-designer'")
    expect(designer).toContain('role="status" aria-live="polite"')
    const app = read('src/App.tsx')
    expect(app).toContain("{designer && <DesignerMode")
    expect(app).toContain("hidden={mode !== 'designer'}")
    expect(app).toContain("if (!on && mode === 'designer') setMode('create')")
  })
})

describe('colors', () => {
  test('normalizes short, long and bare hex codes and rejects the rest', () => {
    expect(normalizeHex('#abc')).toBe('#AABBCC')
    expect(normalizeHex('abc')).toBe('#AABBCC')
    expect(normalizeHex(' #ff00aa ')).toBe('#FF00AA')
    expect(normalizeHex('ff00aa')).toBe('#FF00AA')
    for (const bad of ['', '#', '#ab', '#abcd', '#12345', '#ggg', 'red', '#ff00aa00']) expect(normalizeHex(bad)).toBeNull()
  })

  test('source colors are the artwork colors, normalized', () => {
    const bal = findTeam('PRO-BAL')!
    expect(sourceColors(bal)).toEqual(['#24135F', '#000000', '#9A7611'])
    const kc = findTeam('PRO-KC')!
    expect(sourceColors(kc)).toEqual(kc.palette)
    expect(sourceColors(withLogoVariant(bal, 'alternate'))).toEqual(['#353785', '#000000', '#FFFFFF'])
  })

  test('labels every slot by what it paints', () => {
    expect(slotRoles(findTeam('PRO-BAL')!)).toEqual([
      { label: 'Color 1', editable: true },
      { label: 'Color 2', editable: true },
      { label: 'Color 3', editable: true },
    ])
    // The Chiefs arrowhead paints red and white, so gold goes on the tile behind it.
    expect(slotRoles(findTeam('PRO-KC')!)).toEqual([
      { label: 'Color 1', editable: true },
      { label: 'Backdrop', editable: true },
      { label: 'Color 2', editable: true },
    ])
    // Wordmark: one color, so a Logo slot, a Backdrop slot for the tile and a Frame slot around it.
    const wordmark = withLogoVariant(findTeam('PRO-KC')!, 'alternate')
    expect(backdropSlot(wordmark)).toBe(1)
    expect(frameSlot(wordmark)).toBe(2)
    expect(slotRoles(wordmark)).toEqual([
      { label: 'Logo', editable: true },
      { label: 'Backdrop', editable: true },
      { label: 'Frame', editable: true },
    ])
    // Two colors: the slot the artwork leaves out paints the tile behind it.
    const twoColor = withLogoVariant(findTeam('PRO-CLE')!, 'alternate')
    expect(slotRoles(twoColor)).toEqual([
      { label: 'Color 1', editable: true },
      { label: 'Color 2', editable: true },
      { label: 'Backdrop', editable: true },
    ])
    // Every slot shows somewhere in every design, so every slot can be edited, except the artwork slot of a
    // photo that keeps its own colors (the planets): it shows the photo, on an editable tile and frame.
    for (const team of TEAMS.filter((t) => !t.keepsColors)) expect(slotRoles(team).every((r) => r.editable)).toBe(true)
    expect(slotRoles(findTeam('FLAG-MARS')!)).toEqual([
      { label: 'Artwork', editable: false },
      { label: 'Backdrop', editable: true },
      { label: 'Frame', editable: true },
    ])
  })

  test('rotates only the editable slots', () => {
    const all = slotRoles(findTeam('PRO-KC')!)
    expect(rotateColors(['#111111', '#222222', '#333333'], all)).toEqual(['#222222', '#333333', '#111111'])
    const twoColor = slotRoles(withLogoVariant(findTeam('PRO-CLE')!, 'alternate'))
    expect(rotateColors(['#111111', '#222222', '#333333'], twoColor)).toEqual(['#222222', '#333333', '#111111'])
    const twoEditable = [{ label: 'Color 1', editable: true }, { label: 'Color 2', editable: true }, { label: 'Unused', editable: false }]
    expect(rotateColors(['#111111', '#222222', '#333333'], twoEditable)).toEqual(['#222222', '#111111', '#333333'])
    const oneSlot = [{ label: 'Logo', editable: true }, { label: 'Unused', editable: false }, { label: 'Unused', editable: false }]
    expect(rotateColors(['#111111', '#222222', '#333333'], oneSlot)).toEqual(['#111111', '#222222', '#333333'])
  })

  test('seeds from another palette with exact colors in a contrast-safe assignment', () => {
    const chiefs = findTeam('PRO-KC')!
    const bills = findTeam('PRO-BUF')!
    const seeded = seedColors(chiefs, bills.palette)
    expect(seeded.sort()).toEqual([...bills.palette].sort())
    // One-color artwork keeps its logo readable on the backdrop, so the seeded logo and backdrop colors differ.
    const wordmark = withLogoVariant(chiefs, 'alternate')
    const safe = contrastSafePermutations(wordmark, bills.palette)
    expect(safe.length).toBeGreaterThan(0)
    const seededWordmark = seedColors(wordmark, bills.palette)
    expect(seededWordmark[0]).not.toBe(seededWordmark[1])
    expect(seededWordmark[1]).not.toBe(seededWordmark[2])
    // All three Bills colors land on the logo, its backdrop and its frame.
    expect([...seededWordmark].sort()).toEqual([...bills.palette].sort())
  })

  test('compares colors case-insensitively', () => {
    expect(sameColors(['#abcdef', '#000000', '#ffffff'], ['#ABCDEF', '#000000', '#FFFFFF'])).toBe(true)
    expect(sameColors(['#abcdef', '#000000', '#ffffff'], ['#ABCDEF', '#000000', '#FFFFFE'])).toBe(false)
    expect(sameColors(null, null)).toBe(true)
    expect(sameColors(null, ['#000000', '#000000', '#000000'])).toBe(false)
  })

  test('background presets include a transparent default', () => {
    expect(BACKGROUND_PRESETS[0]).toEqual({ id: 'none', label: 'None', color: null })
    expect(BACKGROUND_PRESETS.map((p) => p.color)).toContain('#FFFFFF')
  })
})

describe('file names', () => {
  test('are slugged from the full name and the artwork variant', () => {
    expect(designFileName(findTeam('PRO-KC')!, undefined, 'svg')).toBe('logo-remix-kansas-city-chiefs.svg')
    expect(designFileName(findTeam('PRO-CLE')!, 'dawg-2023', 'png')).toBe('logo-remix-cleveland-browns-dawg-2023.png')
    for (const team of TEAMS) expect(designFileName(team, undefined, 'png')).toMatch(/^logo-remix-[a-z0-9-]+\.png$/)
  })
})

describe('svg sizing', () => {
  test('reads the viewBox, else absolute width and height', () => {
    expect(parseViewBox('<svg viewBox="0 0 120 80"></svg>')).toEqual({ x: 0, y: 0, width: 120, height: 80 })
    expect(parseViewBox("<svg viewBox='10,20,30,40'/>")).toEqual({ x: 10, y: 20, width: 30, height: 40 })
    expect(parseViewBox('<svg viewBox="0 0 0 80"></svg>')).toBeUndefined()
    expect(svgIntrinsicSize('<svg width="200px" height="100"></svg>')).toEqual({ width: 200, height: 100 })
    expect(svgIntrinsicSize('<svg width="100%" height="100%"></svg>')).toBeUndefined()
    expect(svgIntrinsicSize('<svg width="100%" viewBox="0 0 5 7"></svg>')).toEqual({ width: 5, height: 7 })
  })

  test('adds width and height from the viewBox, or a viewBox from width and height', () => {
    expect(ensureSvgSize('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><g/></svg>')).toBe(
      '<svg width="120" height="80" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><g/></svg>',
    )
    expect(ensureSvgSize('<svg width="100%" height="100%" viewBox="0 0 120 80"/>')).toBe('<svg width="120" height="80" viewBox="0 0 120 80"/>')
    expect(ensureSvgSize('<svg width="30" height="40"/>')).toBe('<svg viewBox="0 0 30 40" width="30" height="40"/>')
    const complete = '<svg width="30" height="40" viewBox="0 0 30 40"/>'
    expect(ensureSvgSize(complete)).toBe(complete)
    expect(ensureSvgSize('<svg/>')).toBe('<svg/>')
    expect(ensureSvgSize('not svg')).toBe('not svg')
  })

  test('every checked-in SVG logo gets an intrinsic size for canvas drawing', () => {
    const logos = TEAMS.flatMap((t) => [t.logo, ...(t.alternateLogos ?? []).map((v) => v.logo)]).filter((l) => l.endsWith('.svg'))
    expect(logos.length).toBeGreaterThan(100)
    for (const logo of logos) {
      const markup = read(join('public', logo))
      const sized = ensureSvgSize(markup)
      expect(svgIntrinsicSize(sized)).toBeDefined()
      expect(/<svg\b[^>]*\swidth=/i.test(sized) && /<svg\b[^>]*\sheight=/i.test(sized)).toBe(true)
      expect(parseViewBox(sized)).toBeDefined()
    }
  })
})

describe('export composition', () => {
  test('layout fits the artwork, the backdrop tile and the background padding inside a square', () => {
    expect(designLayout(1000, false, false)).toEqual({ size: 1000, logo: { x: 0, y: 0, size: 1000 } })
    expect(designLayout(1000, false, true)).toEqual({ size: 1000, logo: { x: 80, y: 80, size: 840 } })
    expect(designLayout(1000, true, false)).toEqual({ size: 1000, tile: { x: 0, y: 0, size: 1000, radius: 220 }, logo: { x: 120, y: 120, size: 760 } })
    const both = designLayout(1000, true, true)
    expect(both.tile).toEqual({ x: 80, y: 80, size: 840, radius: 184.8 })
    expect(both.logo.x).toBeCloseTo(180.8)
    expect(both.logo.size).toBeCloseTo(638.4)
    // A framed tile (one-color artwork) records its frame width and keeps the artwork clear of the frame.
    expect(designLayout(1000, true, false, true)).toEqual({ size: 1000, tile: { x: 0, y: 0, size: 1000, radius: 220, frame: 50 }, logo: { x: 160, y: 160, size: 680 } })
    const framedBg = designLayout(1000, true, true, true)
    expect(framedBg.tile).toEqual({ x: 80, y: 80, size: 840, radius: 184.8, frame: 42 })
    expect(framedBg.logo.x).toBeCloseTo(214.4)
    expect(framedBg.logo.size).toBeCloseTo(571.2)
    // No frame without a tile.
    expect(designLayout(1000, false, false, true).tile).toBeUndefined()
  })

  test('a framed tile is a frame-colored square with a concentric backdrop inset, on screen and in exports', () => {
    const svg = framedTileSvg('#ABCDEF', '#123456')
    expect(svg).toContain('<rect width="100" height="100" rx="22" fill="#123456"/>')
    expect(svg).toContain('<rect x="5" y="5" width="90" height="90" rx="17" fill="#ABCDEF"/>')
    expect(svg).toContain('preserveAspectRatio="none"')
    expect(framedTileImage('#ABCDEF', '#123456')).toBe(`url("data:image/svg+xml,${encodeURIComponent(svg)}")`)

    const out = composeSvg('<svg viewBox="0 0 10 10"/>', { backdrop: '#ABCDEF', frame: '#123456', size: 1000 })
    const frame = out.indexOf('<rect x="0" y="0" width="1000" height="1000" rx="220" fill="#123456"/>')
    const tile = out.indexOf('<rect x="50" y="50" width="900" height="900" rx="170" fill="#ABCDEF"/>')
    const nested = out.indexOf('<svg x="160" y="160" width="680" height="680" viewBox="0 0 10 10"')
    expect(frame).toBeGreaterThan(0)
    expect(tile).toBeGreaterThan(frame)
    expect(nested).toBeGreaterThan(tile)
    // A frame color without a backdrop draws nothing extra.
    expect(composeSvg('<svg viewBox="0 0 10 10"/>', { frame: '#123456', size: 100 })).not.toContain('<rect')
  })

  test('wraps artwork in a sized canvas with background and backdrop layers in order', () => {
    const inner = '<?xml version="1.0"?><!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"><path d="M0 0h1"/></svg>'
    const out = composeSvg(inner, { backdrop: '#123456', background: '#FFFFFF', size: 1000 })
    expect(out.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">')).toBe(true)
    expect(out).not.toContain('<?xml')
    expect(out).not.toContain('DOCTYPE')
    const bg = out.indexOf('<rect width="1000" height="1000" fill="#FFFFFF"/>')
    const tile = out.indexOf('<rect x="80" y="80" width="840" height="840" rx="184.8" fill="#123456"/>')
    const nested = out.indexOf('<svg x="180.8" y="180.8" width="638.4" height="638.4" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid meet"')
    expect(bg).toBeGreaterThan(0)
    expect(tile).toBeGreaterThan(bg)
    expect(nested).toBeGreaterThan(tile)
    expect(out).toContain('<path d="M0 0h1"/></svg></svg>')
    // The nested root keeps none of its original sizing attributes.
    const nestedTag = /<svg x=[^>]*>/.exec(out)![0]
    expect(nestedTag.match(/\swidth=/g)).toHaveLength(1)
    expect(nestedTag.match(/\sheight=/g)).toHaveLength(1)
    expect(nestedTag.match(/viewBox=/g)).toHaveLength(1)
  })

  test('omits layers it was not given and infers a viewBox for unsized artwork', () => {
    const out = composeSvg('<svg width="50" height="50"><circle r="1"/></svg>', { size: 400 })
    expect(out).not.toContain('<rect')
    expect(out).toContain('<svg x="0" y="0" width="400" height="400" viewBox="0 0 50 50" preserveAspectRatio="xMidYMid meet"><circle r="1"/></svg>')
    const tileOnly = composeSvg('<svg viewBox="0 0 10 10"/>', { backdrop: '#000000', size: 100 })
    expect(tileOnly).toContain('<rect x="0" y="0" width="100" height="100" rx="22" fill="#000000"/>')
    expect(tileOnly).toContain('<svg x="12" y="12" width="76" height="76" viewBox="0 0 10 10"')
  })
})
