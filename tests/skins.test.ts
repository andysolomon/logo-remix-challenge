import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SKINS, SKIN_SETTINGS, SKIN_SETTING_LABEL, findSkin, isSkinSetting, resolveSkin, skinInSeason, type Skin } from '../src/lib/skins'
import { LS, loadSkinSetting, saveActiveSkin, saveSkinSetting } from '../src/lib/teams'

const root = join(import.meta.dir, '..')
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const stored = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    get length() {
      return stored.size
    },
    clear: () => stored.clear(),
    getItem: (key: string) => stored.get(key) ?? null,
    key: (index: number) => [...stored.keys()][index] ?? null,
    removeItem: (key: string) => stored.delete(key),
    setItem: (key: string, value: string) => stored.set(key, String(value)),
  },
})
beforeEach(() => stored.clear())
afterAll(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else delete (globalThis as { localStorage?: unknown }).localStorage
})

const halloween = findSkin('halloween') as Skin
const on = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12)

describe('skin registry', () => {
  test('every skin has a unique id, a label, a hint and a season', () => {
    const ids = SKINS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of SKINS) {
      expect(s.label.trim().length).toBeGreaterThan(0)
      expect(s.hint.trim().length).toBeGreaterThan(0)
      for (const [m, d] of [s.season.from, s.season.to]) {
        expect(m).toBeGreaterThanOrEqual(1)
        expect(m).toBeLessThanOrEqual(12)
        expect(d).toBeGreaterThanOrEqual(1)
        expect(d).toBeLessThanOrEqual(31)
      }
    }
  })

  test('the Settings choices are Auto, Off and one entry per skin, each labelled', () => {
    expect(SKIN_SETTINGS).toEqual(['auto', 'off', ...SKINS.map((s) => s.id)])
    for (const s of SKIN_SETTINGS) expect(SKIN_SETTING_LABEL[s].trim().length).toBeGreaterThan(0)
    expect(isSkinSetting('halloween')).toBe(true)
    expect(isSkinSetting('sepia')).toBe(false)
  })

  test('seasons do not overlap, so Auto always has one answer', () => {
    for (let month = 1; month <= 12; month++) {
      for (let day = 1; day <= 28; day++) {
        const matches = SKINS.filter((s) => skinInSeason(s, on(2026, month, day)))
        expect(matches.length).toBeLessThanOrEqual(1)
      }
    }
  })

  test('every skin has a light and a dark token block in the stylesheet and a pre-paint hook in index.html', () => {
    const css = read('src/styles.css')
    for (const s of SKINS) {
      expect(css).toContain(`:root[data-skin="${s.id}"] {`)
      expect(css).toContain(`:root[data-skin="${s.id}"][data-theme="dark"] {`)
    }
    const html = read('index.html')
    expect(html).toContain(`localStorage.getItem('${LS.skin}')`)
    expect(html).toContain(`localStorage.getItem('${LS.skinActive}')`)
    expect(html).toContain('document.documentElement.dataset.skin = s')
  })

  test('the Halloween skin recolors the accent and the Play screen background', () => {
    const css = read('src/styles.css')
    const light = css.slice(css.indexOf(':root[data-skin="halloween"] {'), css.indexOf(':root[data-skin="halloween"][data-theme="dark"] {'))
    expect(light).toMatch(/--accent: #[0-9A-F]{6};/)
    expect(light).toMatch(/--dark-bg: #[0-9A-F]{6};/)
    expect(light).not.toContain('--accent: #D8442B')
  })
})

describe('Auto follows the calendar', () => {
  test('Halloween runs the week up to and including the holiday', () => {
    expect(skinInSeason(halloween, on(2026, 10, 24))).toBe(true)
    expect(skinInSeason(halloween, on(2026, 10, 31))).toBe(true)
    expect(skinInSeason(halloween, on(2026, 11, 1))).toBe(true)
    expect(skinInSeason(halloween, on(2026, 10, 23))).toBe(false)
    expect(skinInSeason(halloween, on(2026, 11, 2))).toBe(false)
    expect(skinInSeason(halloween, on(2026, 4, 1))).toBe(false)
  })

  test('a window that wraps over New Year covers both ends', () => {
    const yule: Skin = { id: 'halloween', label: 'Yule', hint: '', season: { from: [12, 20], to: [1, 2] } }
    expect(skinInSeason(yule, on(2026, 12, 25))).toBe(true)
    expect(skinInSeason(yule, on(2027, 1, 1))).toBe(true)
    expect(skinInSeason(yule, on(2027, 1, 3))).toBe(false)
    expect(skinInSeason(yule, on(2026, 12, 19))).toBe(false)
  })

  test('resolveSkin honours the setting', () => {
    expect(resolveSkin('auto', on(2026, 10, 31))?.id).toBe('halloween')
    expect(resolveSkin('auto', on(2026, 7, 4))).toBeNull()
    expect(resolveSkin('off', on(2026, 10, 31))).toBeNull()
    expect(resolveSkin('halloween', on(2026, 7, 4))?.id).toBe('halloween')
  })
})

describe('skin persistence', () => {
  test('defaults to Auto and ignores unknown values', () => {
    expect(loadSkinSetting()).toBe('auto')
    stored.set(LS.skin, 'sepia')
    expect(loadSkinSetting()).toBe('auto')
  })

  test('round-trips the choice and caches the active skin for index.html', () => {
    saveSkinSetting('halloween')
    expect(stored.get(LS.skin)).toBe('halloween')
    expect(loadSkinSetting()).toBe('halloween')
    saveSkinSetting('off')
    expect(loadSkinSetting()).toBe('off')
    saveActiveSkin('halloween')
    expect(stored.get(LS.skinActive)).toBe('halloween')
    saveActiveSkin(null)
    expect(stored.get(LS.skinActive)).toBe('')
  })
})
