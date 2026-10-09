import { useCallback, useEffect, useRef, useState } from 'react'
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
  loadTheme,
  loadTimer,
  MAX_DECK_ROUNDS,
  normalizeDeck,
  normalizeRound,
  saveDeck,
  saveGameMode,
  saveGuessTarget,
  saveVoice,
  saveHighScores,
  saveTheme,
  saveTimer,
  type GameMode,
  type HighScore,
  type GuessTarget,
  type Round,
  type Theme,
  type TimerSeconds,
} from './lib/teams'
import { usePrefersDark } from './lib/useColorScheme'
import { useIsPortrait } from './lib/useOrientation'

type Mode = 'create' | 'deck' | 'play'

export default function App() {
  const portrait = useIsPortrait()
  const prefersDark = usePrefersDark()
  const [mode, setMode] = useState<Mode>('create')
  const [deck, setDeckState] = useState<Round[]>(loadDeck)
  const [timer, setTimerState] = useState<TimerSeconds>(loadTimer)
  const [gameMode, setGameModeState] = useState<GameMode>(loadGameMode)
  const [guessTarget, setGuessTargetState] = useState<GuessTarget>(loadGuessTarget)
  const [voice, setVoiceState] = useState<boolean>(loadVoice)
  const [theme, setThemeState] = useState<Theme>(loadTheme)
  const [highScores, setHighScoresState] = useState<HighScore[]>(loadHighScores)
  const [create, setCreate] = useState<CreateState>(initialCreateState)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [deckWideMutationVersion, setDeckWideMutationVersion] = useState(0)

  const setDeck = useCallback((d: Round[]) => {
    const normalized = normalizeDeck(d)
    saveDeck(normalized)
    setDeckState(normalized)
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
    setDeckWideMutationVersion((version) => version + 1)
  }
  const setVoice = (on: boolean) => {
    saveVoice(on)
    setVoiceState(on)
  }
  const setTheme = (t: Theme) => {
    saveTheme(t)
    setThemeState(t)
  }
  const setHighScores = useCallback((list: HighScore[]) => {
    saveHighScores(list)
    setHighScoresState(list)
  }, [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  const prevModeRef = useRef<Mode>('create')

  useEffect(() => {
    if (prevModeRef.current === 'deck' && mode === 'create') {
      document.getElementById('tab-create')?.focus()
    }
    prevModeRef.current = mode
  }, [mode])

  // Apply the color theme and match the browser chrome (iOS status bar / toolbar tint) to the active screen.
  const themeDark = theme === 'dark' || (theme === 'system' && prefersDark)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = themeDark ? 'dark' : 'light'
    const dark = themeDark || mode === 'play'
    root.classList.toggle('dark', dark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#12100D' : '#F7F5F1')
  }, [mode, themeDark])

  const addRound =(round: Round, editIdx: number | null) => {
    const d = [...deck]
    if (editIdx != null && d[editIdx]) d[editIdx] = normalizeRound({ ...d[editIdx], ...round })
    else {
      if (d.length >= MAX_DECK_ROUNDS) return false
      d.push(normalizeRound({ ...round, h: round.h ?? true }))
    }
    setDeck(d)
    return true
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
      logoVariant: r.l,
      editIdx: i,
      step: 3,
      browserO: { league: o.league, conference: 'All' },
      browserC: { league: c.league, conference: 'All' },
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
        <SettingsModal timer={timer} gameMode={gameMode} guessTarget={guessTarget} voice={voice} theme={theme} onTimer={setTimer} onGameMode={setGameMode} onGuessTarget={setGuessTarget} onVoice={setVoice} onTheme={setTheme} onClose={closeSettings} />
      )}
      <CreateMode state={create} setState={setCreate} portrait={portrait} deckCount={deck.length} onAddRound={addRound} hidden={mode !== 'create'} />
      <DeckMode
        deck={deck}
        portrait={portrait}
        timer={timer}
        gameMode={gameMode}
        guessTarget={guessTarget}
        voice={voice}
        highScores={highScores}
        deckWideMutationVersion={deckWideMutationVersion}
        onDeck={setDeck}
        onEdit={editRound}
        onTimer={setTimer}
        onGameMode={setGameMode}
        onGuessTarget={setGuessTarget}
        onVoice={setVoice}
        onStart={startGame}
        onCreate={() => setMode('create')}
        hidden={mode !== 'deck'}
      />
    </div>
  )
}
