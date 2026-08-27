import { useCallback, useState } from 'react'
import { CreateMode, initialCreateState, type CreateState } from './components/CreateMode'
import { DeckMode } from './components/DeckMode'
import { Header } from './components/Header'
import { PlayMode } from './components/PlayMode'
import { SettingsModal } from './components/SettingsModal'
import {
  findTeam,
  loadDeck,
  loadGameMode,
  loadHighScore,
  loadTimer,
  saveDeck,
  saveGameMode,
  saveHighScore,
  saveTimer,
  type GameMode,
  type Round,
  type TimerSeconds,
} from './lib/teams'
import { useIsPortrait } from './lib/useOrientation'

type Mode = 'create' | 'deck' | 'play'

export default function App() {
  const portrait = useIsPortrait()
  const [mode, setMode] = useState<Mode>('create')
  const [deck, setDeckState] = useState<Round[]>(loadDeck)
  const [timer, setTimerState] = useState<TimerSeconds>(loadTimer)
  const [gameMode, setGameModeState] = useState<GameMode>(loadGameMode)
  const [highScore, setHighScoreState] = useState<number>(loadHighScore)
  const [create, setCreate] = useState<CreateState>(initialCreateState)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const setDeck = useCallback((d: Round[]) => {
    saveDeck(d)
    setDeckState(d)
  }, [])
  const setTimer = (t: TimerSeconds) => {
    saveTimer(t)
    setTimerState(t)
  }
  const setGameMode = (m: GameMode) => {
    saveGameMode(m)
    setGameModeState(m)
  }
  const setHighScore = useCallback((h: number) => {
    saveHighScore(h)
    setHighScoreState(h)
  }, [])

  const addRound = (round: Round, editIdx: number | null) => {
    const d = [...deck]
    if (editIdx != null && d[editIdx]) d[editIdx] = round
    else d.push(round)
    setDeck(d)
  }

  const editRound = (i: number) => {
    const r = deck[i]
    const o = findTeam(r.o)!
    const c = findTeam(r.c)!
    setCreate((s) => ({
      ...s,
      oId: r.o,
      cId: r.c,
      perm: r.v,
      editIdx: i,
      step: 3,
      browserO: { league: o.league, conference: 'All', query: '' },
      browserC: { league: c.league, conference: 'All', query: '' },
    }))
    setMode('create')
  }

  const startGame = () => setMode(deck.length ? 'play' : 'deck')

  if (mode === 'play') {
    return (
      <div className="app dark">
        <PlayMode deck={deck} timer={timer} gameMode={gameMode} highScore={highScore} onHighScore={setHighScore} onQuit={() => setMode('deck')} />
      </div>
    )
  }

  return (
    <div className="app">
      <Header mode={mode} deckCount={deck.length} onCreate={() => setMode('create')} onDeck={() => setMode('deck')} onPlay={startGame} onSettings={() => setSettingsOpen(true)} />
      {settingsOpen && (
        <SettingsModal timer={timer} gameMode={gameMode} onTimer={setTimer} onGameMode={setGameMode} onClose={() => setSettingsOpen(false)} />
      )}
      {mode === 'create' ? (
        <CreateMode state={create} setState={setCreate} portrait={portrait} onAddRound={addRound} />
      ) : (
        <DeckMode
          deck={deck}
          portrait={portrait}
          timer={timer}
          gameMode={gameMode}
          highScore={highScore}
          onDeck={setDeck}
          onEdit={editRound}
          onTimer={setTimer}
          onGameMode={setGameMode}
          onStart={startGame}
          onCreate={() => setMode('create')}
        />
      )}
    </div>
  )
}
