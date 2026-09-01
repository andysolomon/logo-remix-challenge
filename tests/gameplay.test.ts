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
})
