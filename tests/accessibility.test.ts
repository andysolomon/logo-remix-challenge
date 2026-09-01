import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')

function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('accessibility scaffolding', () => {
  test('styles define focus-visible and coarse-pointer targets', () => {
    const css = read('src/styles.css')
    expect(css).toContain(':focus-visible')
    expect(css).toContain('.sr-only')
    expect(css).toContain('@media (pointer: coarse)')
    expect(css).toContain('min-height: 44px')
    expect(css).toContain('.tool-btn { min-height: 44px')
    expect(css).toContain('.seg-group .seg { min-height: 44px')
    expect(css).toContain('.hint-toggle { min-height: 44px')
    expect(css).toContain('.play-btn { min-width: 44px; min-height: 44px')
    expect(css).toContain('.undo-bar button { min-height: 44px')
  })

  test('dialogs trap Tab focus and skip restore into hidden panels', () => {
    const settings = read('src/components/SettingsModal.tsx')
    expect(settings).toContain('useDialogA11y')
    expect(settings).toContain('e.key !== \'Tab\'')
    expect(settings).toContain('closest(\'[hidden]\')')

    const random = read('src/components/RandomDeckModal.tsx')
    expect(random).toContain('useDialogA11y')

    const deck = read('src/components/DeckMode.tsx')
    expect(deck).toContain('useDialogA11y')
  })

  test('create flow components expose live status and dialog focus hooks', () => {
    const remix = read('src/components/RemixCanvas.tsx')
    expect(remix).toContain('aria-live="polite"')
    expect(remix).toContain('role="status"')

    const settings = read('src/components/SettingsModal.tsx')
    expect(settings).toContain('closeRef')
    expect(settings).toContain('dialogRef')

    const random = read('src/components/RandomDeckModal.tsx')
    expect(random).toContain('dialogRef')
    expect(random).toContain('useDialogA11y')

    const deck = read('src/components/DeckMode.tsx')
    expect(deck).toContain('dialogRef')
    expect(deck).toContain('useDialogA11y')
  })

  test('team browser and header use pressed states and group labels', () => {
    const browser = read('src/components/TeamBrowser.tsx')
    expect(browser).toContain('aria-pressed')
    expect(browser).toContain('role="group"')
    expect(browser).toContain('role="listitem"')

    const header = read('src/components/Header.tsx')
    expect(header).toContain('aria-label="Main navigation"')
    expect(header).toContain('tabIndex={mode ===')
    expect(header).toContain('onKeyDown={onTabKeyDown}')
    expect(header).toContain('ArrowRight')
  })

  test('tab panels wire create and deck roots to header tabs', () => {
    const create = read('src/components/CreateMode.tsx')
    expect(create).toContain('id: \'panel-create\'')
    expect(create).toContain('role: \'tabpanel\'')
    expect(create).toContain("'aria-labelledby': 'tab-create'")

    const deck = read('src/components/DeckMode.tsx')
    expect(deck).toContain('id="panel-deck"')
    expect(deck).toContain('role="tabpanel"')
    expect(deck).toContain('aria-labelledby="tab-deck"')

    const app = read('src/App.tsx')
    expect(app).toContain('hidden={mode !== \'create\'}')
    expect(app).toContain('hidden={mode !== \'deck\'}')
    expect(app).toContain('tab-create')
    expect(app).toContain('prevModeRef')
  })

  test('deck panel clears overlays when hidden', () => {
    const deck = read('src/components/DeckMode.tsx')
    expect(deck).toContain('if (!hidden) return')
    expect(deck).toContain('setHsOpen(false)')
    expect(deck).toContain('setRndOpen(false)')
    expect(deck).toContain('setConfirmClear(false)')
  })

  test('deck setup groups expose labels and pressed state', () => {
    const deck = read('src/components/DeckMode.tsx')
    expect(deck).toContain('id="deck-timer-label"')
    expect(deck).toContain('aria-labelledby="deck-timer-label"')
    expect(deck).toContain('aria-pressed={timer === t}')
    expect(deck).toContain('aria-pressed={guessTarget === t}')
    expect(deck).toContain('aria-pressed={gameMode === m}')
    expect(deck).toContain('aria-pressed={voice}')
  })

  test('portrait create steps expose labeled group and current step', () => {
    const create = read('src/components/CreateMode.tsx')
    expect(create).toContain('className="steps" role="group" aria-label="Create remix steps"')
    expect(create).toContain('type="button"')
    expect(create).toContain("aria-current={state.step === n ? 'step' : undefined}")
  })
})
