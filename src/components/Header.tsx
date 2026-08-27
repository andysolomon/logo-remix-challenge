interface Props {
  mode: 'create' | 'deck'
  deckCount: number
  onCreate: () => void
  onDeck: () => void
  onPlay: () => void
  onSettings: () => void
}

export function Header({ mode, deckCount, onCreate, onDeck, onPlay, onSettings }: Props) {
  return (
    <header className="header">
      <div className="wordmark">
        LOGO <span>REMIX</span>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'create'} className={`tab${mode === 'create' ? ' active' : ''}`} onClick={onCreate}>
          Create
        </button>
        <button role="tab" aria-selected={mode === 'deck'} className={`tab${mode === 'deck' ? ' active' : ''}`} onClick={onDeck}>
          Deck · {deckCount}
        </button>
      </div>
      <button className="settings-btn" onClick={onSettings} aria-label="Settings">
        ⚙
      </button>
      <button className="play-btn" onClick={onPlay} aria-label="Play">
        <span className="play-txt">PLAY </span>▶
      </button>
    </header>
  )
}
