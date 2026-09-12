import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')

function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('gameplay polish scaffolding', () => {
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

  test('rounds resize to the visual viewport so the keyboard cannot bury the logo', () => {
    const hook = read('src/lib/useKeyboardInset.ts')
    expect(hook).toContain('window.visualViewport')
    expect(hook).toContain("vv?.addEventListener('resize', sync)")
    expect(hook).toContain("vv?.addEventListener('scroll', sync)")
    expect(hook).toContain('window.innerHeight - height - top')

    const play = read('src/components/PlayMode.tsx')
    expect(play).toContain('useKeyboardInset')
    expect(play).toContain('keyboard.open || keyboard.height < COMPACT_MAX_HEIGHT')
    expect(play).toContain("'--vv-h'")
    expect(play).toContain("'--vv-top'")
    expect(play).toContain("`play${tight ? ' tight' : ''}`")
  })

  test('compact rounds shrink the logo and lay suggestions out as one strip', () => {
    const css = read('src/styles.css')
    expect(css).toContain('.play.tight { flex: none; height: var(--vv-h);')
    expect(css).toContain('.play.tight .q-logo')
    expect(css).toContain('.play.tight .guess-suggest {')
    expect(css).toContain('.play.tight:has(.guess-suggest) .guess-form { margin-top:')
    // The full-size logo has to give way when the hero is squeezed.
    expect(css).toContain('max-height: 100%')
    // Both-mode suggestions anchor above the pair, never over the other answer.
    expect(css).toContain('.guess-form.both .guess-ac { position: static; }')

    const html = read('index.html')
    expect(html).toContain('interactive-widget=resizes-content')
  })
})
