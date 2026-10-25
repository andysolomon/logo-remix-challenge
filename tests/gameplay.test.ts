import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')

function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('gameplay polish scaffolding', () => {
  test('the app shell tracks the visual viewport so the logo stays in view above a phone keyboard', () => {
    const hook = read('src/lib/useVisualViewport.ts')
    expect(hook).toContain('window.visualViewport')
    expect(hook).toContain("addEventListener('resize', apply)")
    expect(hook).toContain("addEventListener('scroll', apply)")
    expect(hook).toContain("setProperty('--vvh'")
    expect(hook).toContain("classList.toggle('kb-open'")
    expect(hook).toContain('window.scrollTo(0, 0)')
    expect(hook).toContain('vv.scale > 1.01')
    // iOS 26 shrinks innerHeight with the keyboard, so the keyboard is measured against the tallest view at this width.
    expect(hook).toContain('tallest = Math.max(tallest, window.innerHeight, h)')
    expect(hook).toContain('tallest - h >= KEYBOARD_MIN_PX || typingOnTouch()')
    expect(hook).not.toContain('window.innerHeight - h')
    expect(read('src/App.tsx')).toContain('useVisualViewport()')
    const css = read('src/styles.css')
    expect(css).toContain('height: var(--vvh, 100dvh)')
    expect(css).toContain('html.kb-open .question { display: grid;')
    expect(css).toContain('grid-template-rows: auto auto minmax(120px, 1fr)')
    expect(css).toContain('html.kb-open .q-top, html.kb-open .timer { display: contents; }')
    expect(css).toContain('html.kb-open .timer-num { grid-area: 1 / 2;')
  })

  test('with the keyboard up, suggestions sit in the prompt slot as one row of chips instead of over the logo', () => {
    const css = read('src/styles.css')
    expect(css).toContain('html.kb-open .q-ask { min-height: 44px;')
    expect(css).toContain('html.kb-open .guess-form { position: relative;')
    expect(css).toContain('html.kb-open .guess-ac { position: static; }')
    expect(css).toContain('html.kb-open .guess-suggest { bottom: calc(100% + 6px); display: flex;')
    expect(css).toContain('html.kb-open .guess-suggest-item { flex: none; min-height: 44px;')
    expect(css).toContain('html.kb-open .guess-form.both .btn-submit { grid-area: 1 / 2 / 3 / 3;')

    // A swipe across the chip row scrolls it; only a tap (click) picks a suggestion. Mouse-down holds focus;
    // preventing pointer-down instead makes iOS Safari drop the click, so a tapped suggestion never filled the field.
    const gi = read('src/components/GuessInput.tsx')
    expect(gi).toContain('onMouseDown={(e) => e.preventDefault()}')
    expect(gi).not.toContain('onPointerDown')
    expect(gi).toContain('onClick={() => pick(t)}')
  })

  test('PlayMode exposes live round and reveal status plus phaseRef submit guards', () => {
    const play = read('src/components/PlayMode.tsx')
    expect(play).toContain('aria-live="polite"')
    expect(play).toContain('role="status"')
    expect(play).toContain('Round ${rIdx + 1} of ${deck.length}')
    expect(play).toContain("Time's up")
    expect(play).toContain('if (phaseRef.current !== \'question\') return')
    expect(play).toContain('if (phaseRef.current !== \'intro\') return')
    expect(play).toContain('if (phaseRef.current !== \'reveal\') return')
    expect(play).toContain('disabled={questionLocked}')
  })

  test('Logo keeps remix pending/error non-leaky and announces status without team names', () => {
    const logo = read('src/components/Logo.tsx')
    expect(logo).toContain('Loading remix logo.')
    expect(logo).toContain('Remix logo unavailable.')
    expect(logo).toContain('remixStatus === \'ready\'')
    expect(logo).toContain('TRANSPARENT_PIXEL')
    expect(logo).not.toContain('fullName')
    expect(logo).not.toContain('speechSynthesis')
    expect(logo).toContain("!hasTargetPalette ? team.logo : key && remixStatus === 'ready'")
  })

  test('both rounds award half credit, including a half locked in before time runs out', () => {
    const play = read('src/components/PlayMode.tsx')
    expect(play).toContain("roundCredit('both', logoOk, colorsOk)")
    expect(play).toContain("half: 'Half right'")
    expect(play).toContain('timeUpRef.current()')
    expect(play).toContain("(gameMode === 'host' ? hostParts[0] : logoChecked) === true")
    expect(play).toContain('{formatScore(score)} / {deck.length}')
    expect(play).not.toContain('Both right scores the point')
  })

  test('host-mode both verdict rows expose labeled groups for assistive technology', () => {
    const play = read('src/components/PlayMode.tsx')
    expect(play).toContain('host-both-logo-label')
    expect(play).toContain('host-both-colors-label')
    expect(play).toContain('className="host-part" role="group"')
    expect(play).toContain('aria-labelledby={labelId}')
    expect(play).toContain('id={labelId}')
    expect(play).toContain('setHostPart')
    expect(play).toContain('lockHostVerdict')
  })

  test('Logo recolor effect settles failures on stable key identity without retry loop', () => {
    const logo = read('src/components/Logo.tsx')
    expect(logo).toContain('failedCache')
    expect(logo).toContain('failedCache.has(key)')
    expect(logo).toContain('failedCache.add(key)')
    expect(logo).toContain('}, [key, team.logo])')
    expect(logo).not.toContain('[key, target, team.logo, source]')
  })

  test('guess fields autocomplete team names and leave native keyboard suggestions on', () => {
    const gi = read('src/components/GuessInput.tsx')
    expect(gi).toContain('suggestTeams')
    expect(gi).toContain('role="combobox"')
    expect(gi).toContain('role="listbox"')
    expect(gi).toContain('role="option"')
    expect(gi).toContain('aria-activedescendant')
    expect(gi).toContain('autoCorrect="on"')
    expect(gi).toContain('autoCapitalize="words"')
    expect(gi).not.toContain('spellCheck={false}')

    const play = read('src/components/PlayMode.tsx')
    expect(play).toContain('<GuessInput')
    expect(play).not.toContain('className="guess-input"')
  })

  test('type mode only steals focus on pointer devices, so touch keyboards stay down', () => {
    const play = read('src/components/PlayMode.tsx')
    expect(play).toContain("window.matchMedia('(hover: hover) and (pointer: fine)')")
    expect(play).toContain("gameMode === 'type' && prefersAutoFocus()")
  })
})
