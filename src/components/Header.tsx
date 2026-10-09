import type { KeyboardEvent } from 'react'

export type HeaderMode = 'create' | 'deck' | 'designer'

interface Props {
  mode: HeaderMode
  deckCount: number
  /** Designer mode is opt-in (Settings → Advanced); its tab only shows while it is on. */
  designer?: boolean
  onCreate: () => void
  onDeck: () => void
  onDesigner?: () => void
  onPlay: () => void
  onSettings: () => void
}

const TABS = [
  { id: 'tab-create', panel: 'panel-create', mode: 'create' as const },
  { id: 'tab-deck', panel: 'panel-deck', mode: 'deck' as const },
  { id: 'tab-designer', panel: 'panel-designer', mode: 'designer' as const },
]

export function Header({ mode, deckCount, designer, onCreate, onDeck, onDesigner, onPlay, onSettings }: Props) {
  const playLabel = deckCount > 0 ? `Play game, ${deckCount} round${deckCount === 1 ? '' : 's'}` : 'Play game, add rounds to deck first'
  const handlers = { create: onCreate, deck: onDeck, designer: onDesigner ?? onCreate } as const
  const tabs = designer ? TABS : TABS.filter((t) => t.mode !== 'designer')
  const labels: Record<HeaderMode, string> = { create: 'Create', deck: `Deck · ${deckCount}`, designer: 'Designer' }

  const onTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = tabs.findIndex((t) => t.mode === mode)
    if (idx < 0) return
    let next = idx
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % tabs.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    else return
    e.preventDefault()
    const tab = tabs[next]
    handlers[tab.mode]()
    document.getElementById(tab.id)?.focus()
  }

  return (
    <header className="header">
      <div className="wordmark" aria-hidden="true">
        LOGO <span>REMIX</span>
      </div>
      <div className={`tabs${designer ? ' three' : ''}`} role="tablist" aria-label="Main navigation" onKeyDown={onTabKeyDown}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={t.id}
            aria-selected={mode === t.mode}
            aria-controls={t.panel}
            tabIndex={mode === t.mode ? 0 : -1}
            className={`tab${mode === t.mode ? ' active' : ''}`}
            onClick={handlers[t.mode]}
          >
            {labels[t.mode]}
          </button>
        ))}
      </div>
      <button type="button" className="settings-btn" onClick={onSettings} aria-label="Open settings">
        <span aria-hidden="true">⚙</span>
      </button>
      <button type="button" className="play-btn" onClick={onPlay} aria-label={playLabel}>
        <span className="play-txt">PLAY </span>
        <span aria-hidden="true">▶</span>
      </button>
    </header>
  )
}
