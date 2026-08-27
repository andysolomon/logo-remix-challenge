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
  loadGuessTarget,
  loadVoice,
  loadHighScores,
  loadTimer,
  saveDeck,
  saveGameMode,
  saveGuessTarget,
  saveVoice,
  saveHighScores,
  saveTimer,
  type GameMode,
  type HighScore,
  type GuessTarget,
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
  const [guessTarget, setGuessTargetState] = useState<GuessTarget>(loadGuessTarget)
  const [voice, setVoiceState] = useState<boolean>(loadVoice)
  const [highScores, setHighScoresState] = useState<HighScore[]>(loadHighScores)
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
  const setGuessTarget = (t: GuessTarget) => {
    saveGuessTarget(t)
    setGuessTargetState(t)
    // Changing the default re-applies to every card: drop per-round overrides so all rounds follow it.
    if (deck.some((r) => r.g !== undefined)) setDeck(deck.map(({ g: _g, ...r }) => r))
  }
  const setVoice = (on: boolean) => {
    saveVoice(on)
    setVoiceState(on)
  }
  const setHighScores = useCallback((list: HighScore[]) => {
    saveHighScores(list)
    setHighScoresState(list)
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
        <PlayMode deck={deck} timer={timer} gameMode={gameMode} guessTarget={guessTarget} voice={voice} highScores={highScores} onHighScores={setHighScores} onQuit={() => setMode('deck')} />
      </div>
    )
  }

  return (
    <div className="app">
      <Header mode={mode} deckCount={deck.length} onCreate={() => setMode('create')} onDeck={() => setMode('deck')} onPlay={startGame} onSettings={() => setSettingsOpen(true)} />
      {settingsOpen && (
        <SettingsModal timer={timer} gameMode={gameMode} guessTarget={guessTarget} voice={voice} onTimer={setTimer} onGameMode={setGameMode} onGuessTarget={setGuessTarget} onVoice={setVoice} onClose={() => setSettingsOpen(false)} />
      )}
      {mode === 'create' ? (
        <CreateMode state={create} setState={setCreate} portrait={portrait} onAddRound={addRound} />
      ) : (
        <DeckMode
          deck={deck}
          portrait={portrait}
          timer={timer}
          gameMode={gameMode}
          guessTarget={guessTarget}
          voice={voice}
          highScores={highScores}
          onDeck={setDeck}
          onEdit={editRound}
          onTimer={setTimer}
          onGameMode={setGameMode}
          onGuessTarget={setGuessTarget}
          onVoice={setVoice}
          onStart={startGame}
          onCreate={() => setMode('create')}
        />
      )}
    </div>
  )
}
