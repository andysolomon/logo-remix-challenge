import { useCallback, useEffect, useRef, useState } from 'react'
import { CreateMode, initialCreateState, type CreateState } from './components/CreateMode'
import { DeckMode } from './components/DeckMode'
import { DesignerMode, initialDesignerState, type DesignerState } from './components/DesignerMode'
import { Header } from './components/Header'
import { PlayMode } from './components/PlayMode'
import { SettingsModal } from './components/SettingsModal'
import {
  findPlayer,
  findTeam,
  JERSEYS_FILTER,
  loadDeck,
  loadDesigner,
  loadGameMode,
  loadGuessTarget,
  loadVoice,
  loadHighScores,
  loadSkinSetting,
  loadTheme,
  loadTimer,
  MAX_DECK_ROUNDS,
  normalizeDeck,
  normalizeRound,
  replaceRound,
  saveDeck,
  saveDesigner,
  saveGameMode,
  saveGuessTarget,
  saveVoice,
  saveHighScores,
  saveActiveSkin,
  saveSkinSetting,
  saveTheme,
  saveTimer,
  type GameMode,
  type HighScore,
  type GuessTarget,
  type Round,
  type Theme,
  type TimerSeconds,
} from './lib/teams'
import { type SkinSetting } from './lib/skins'
import { useActiveSkin } from './lib/useActiveSkin'
import { usePrefersDark } from './lib/useColorScheme'
import { useIsPortrait } from './lib/useOrientation'
import { useVisualViewport } from './lib/useVisualViewport'

type Mode = 'create' | 'deck' | 'designer' | 'play'

export default function App() {
  const portrait = useIsPortrait()
  const prefersDark = usePrefersDark()
  useVisualViewport()
  const [mode, setMode] = useState<Mode>('create')
  const [deck, setDeckState] = useState<Round[]>(loadDeck)
  const [timer, setTimerState] = useState<TimerSeconds>(loadTimer)
  const [gameMode, setGameModeState] = useState<GameMode>(loadGameMode)
  const [guessTarget, setGuessTargetState] = useState<GuessTarget>(loadGuessTarget)
  const [voice, setVoiceState] = useState<boolean>(loadVoice)
  const [theme, setThemeState] = useState<Theme>(loadTheme)
  const [skinSetting, setSkinSettingState] = useState<SkinSetting>(loadSkinSetting)
  const activeSkin = useActiveSkin(skinSetting)
  const [highScores, setHighScoresState] = useState<HighScore[]>(loadHighScores)
  const [create, setCreate] = useState<CreateState>(initialCreateState)
  const [designer, setDesignerState] = useState<boolean>(loadDesigner)
  const [design, setDesign] = useState<DesignerState>(initialDesignerState)
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
  const setSkinSetting = (s: SkinSetting) => {
    saveSkinSetting(s)
    setSkinSettingState(s)
  }
  const setDesigner = (on: boolean) => {
    saveDesigner(on)
    setDesignerState(on)
    // Turning Designer off removes its tab; leave the screen with it. The design itself is kept for next time.
    if (!on && mode === 'designer') setMode('create')
  }
  const setHighScores = useCallback((list: HighScore[]) => {
    saveHighScores(list)
    setHighScoresState(list)
  }, [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  const prevModeRef = useRef<Mode>('create')

  useEffect(() => {
    if ((prevModeRef.current === 'deck' || prevModeRef.current === 'designer') && mode === 'create') {
      document.getElementById('tab-create')?.focus()
    }
    prevModeRef.current = mode
  }, [mode])

  // Apply the color theme and holiday skin, then match the browser chrome (iOS status bar / toolbar tint) to the active screen.
  const themeDark = theme === 'dark' || (theme === 'system' && prefersDark)
  const skinId = activeSkin?.id ?? null
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = themeDark ? 'dark' : 'light'
    if (skinId) root.dataset.skin = skinId
    else delete root.dataset.skin
    saveActiveSkin(skinId)
    const dark = themeDark || mode === 'play'
    root.classList.toggle('dark', dark)
    // The skin may have recolored the page background, so read the token back rather than assuming the base palette.
    const bg = getComputedStyle(root).getPropertyValue(dark ? '--dark-bg' : '--bg').trim() || (dark ? '#12100D' : '#F7F5F1')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
  }, [mode, themeDark, skinId])

  const addRound =(round: Round, editIdx: number | null) => {
    const d = [...deck]
    if (editIdx != null && d[editIdx]) d[editIdx] = replaceRound(d[editIdx], round)
    else {
      if (d.length >= MAX_DECK_ROUNDS) return false
      d.push(normalizeRound({ ...round, h: round.h ?? true }))
    }
    setDeck(d)
    return true
  }

  const editRound = (i: number) => {
    const r = deck[i]
    const player = r.p === undefined ? undefined : findPlayer(r.p)
    if (player) {
      setCreate((s) => ({
        ...s,
        pId: player.id,
        oId: null,
        cId: null,
        perm: 0,
        logoVariant: undefined,
        editIdx: i,
        step: 3,
        browserO: { league: player.league, conference: JERSEYS_FILTER },
      }))
      setMode('create')
      return
    }
    const o = findTeam(r.o)!
    const c = r.c === undefined ? null : findTeam(r.c)!
    setCreate((s) => ({
      ...s,
      oId: r.o,
      pId: null,
      cId: r.c ?? null,
      perm: r.v,
      logoVariant: r.l,
      editIdx: i,
      step: 3,
      browserO: { league: o.league, conference: 'All' },
      browserC: c ? { league: c.league, conference: 'All' } : s.browserC,
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
      <Header
        mode={mode}
        deckCount={deck.length}
        designer={designer}
        onCreate={() => setMode('create')}
        onDeck={() => setMode('deck')}
        onDesigner={() => setMode('designer')}
        onPlay={startGame}
        onSettings={() => setSettingsOpen(true)}
      />
      {settingsOpen && (
        <SettingsModal
          timer={timer}
          gameMode={gameMode}
          guessTarget={guessTarget}
          voice={voice}
          theme={theme}
          skin={skinSetting}
          activeSkin={activeSkin}
          designer={designer}
          onTimer={setTimer}
          onGameMode={setGameMode}
          onGuessTarget={setGuessTarget}
          onVoice={setVoice}
          onTheme={setTheme}
          onSkin={setSkinSetting}
          onDesigner={setDesigner}
          onClose={closeSettings}
        />
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
      {designer && <DesignerMode state={design} setState={setDesign} portrait={portrait} hidden={mode !== 'designer'} />}
    </div>
  )
}
