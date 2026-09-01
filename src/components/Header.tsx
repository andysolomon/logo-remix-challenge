import type { KeyboardEvent } from 'react'

interface Props {
  mode: 'create' | 'deck'
  deckCount: number
  onCreate: () => void
  onDeck: () => void
  onPlay: () => void
  onSettings: () => void
}

const TABS = [
  { id: 'tab-create', panel: 'panel-create', mode: 'create' as const },
  { id: 'tab-deck', panel: 'panel-deck', mode: 'deck' as const },
]

export function Header({ mode, deckCount, onCreate, onDeck, onPlay, onSettings }: Props) {
  const playLabel = deckCount > 0 ? `Play game, ${deckCount} round${deckCount === 1 ? '' : 's'}` : 'Play game, add rounds to deck first'
  const handlers = { create: onCreate, deck: onDeck } as const

  const onTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = TABS.findIndex((t) => t.mode === mode)
    if (idx < 0) return
    let next = idx
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % TABS.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    else return
    e.preventDefault()
    const tab = TABS[next]
    handlers[tab.mode]()
    document.getElementById(tab.id)?.focus()
  }

  return (
    <header className="header">
      <div className="wordmark" aria-hidden="true">
        LOGO <span>REMIX</span>
      </div>
      <div className="tabs" role="tablist" aria-label="Main navigation" onKeyDown={onTabKeyDown}>
        <button
          type="button"
          role="tab"
          id="tab-create"
          aria-selected={mode === 'create'}
          aria-controls="panel-create"
          tabIndex={mode === 'create' ? 0 : -1}
          className={`tab${mode === 'create' ? ' active' : ''}`}
          onClick={onCreate}
        >
          Create
        </button>
        <button
          type="button"
          role="tab"
          id="tab-deck"
          aria-selected={mode === 'deck'}
          aria-controls="panel-deck"
          tabIndex={mode === 'deck' ? 0 : -1}
          className={`tab${mode === 'deck' ? ' active' : ''}`}
          onClick={onDeck}
        >
          Deck · {deckCount}
        </button>
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
