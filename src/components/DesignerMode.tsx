import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  BACKGROUND_PRESETS,
  CUSTOM_BACKGROUND_DEFAULT,
  DEFAULT_EXPORT_FORMAT,
  DEFAULT_EXPORT_SIZE,
  EXPORT_SIZES,
  designFileName,
  rotateColors,
  sameColors,
  seedColors,
  slotRoles,
  sourceColors,
  type DesignColors,
  type ExportFormat,
  type ExportSize,
} from '../lib/designer'
import { buildFileName, buildSvg, emptyBuild, placePart, removePart, seedBuildColors, type BuildState } from '../lib/build'
import { canExportSvg, canSaveToPhotos, designPngBlob, designSvgBlob, downloadBlob, shareImage, svgBlob, svgPngBlob } from '../lib/exportLogo'
import type { LogoPart } from '../lib/parts'
import { TRACE_COLOR_OPTIONS, TraceError, DEFAULT_TRACE_OPTIONS, type TraceColors, type TraceOptions } from '../lib/trace'
import { UPLOAD_ACCEPT, fileStem, readRaster, traceUpload, uploadTeam, type UploadedLogo } from '../lib/traceUpload'
import { DESIGNER_PALETTE_LEAGUES, DESIGNER_PALETTE_NOTE, findTeam, fullName, nextLogoVariant, withLogoVariant, type Team } from '../lib/teams'
import { BuildCanvas } from './BuildCanvas'
import { ColorPicker } from './ColorPicker'
import { Logo, svgToDataUrl } from './Logo'
import { PartsCanvas, type TakenPart } from './PartsCanvas'
import { PartsTray, PartsTrayBar } from './PartsTray'
import { TeamBrowser, type BrowserState } from './TeamBrowser'

/** What the Designer is doing: recoloring one logo, taking parts out of logos, or building a logo from those parts. */
export type DesignerTool = 'recolor' | 'parts' | 'build'

export interface DesignerState {
  tool: DesignerTool
  /** Parts taken so far, from any logo. */
  tray: LogoPart[]
  /** Parts ever taken, for ids. */
  partSerial: number
  /** The logo being built from parts. */
  build: BuildState
  buildName: string
  /** Build: the palette browser is open to start the logo's colors from a team. */
  palettePick?: boolean
  /** Logo being designed. */
  oId: string | null
  /** A logo the user uploaded and traced; replaces `oId` while set. */
  upload: UploadedLogo | null
  /** Team whose palette seeded the colors; cleared once a slot is edited by hand. */
  cId: string | null
  logoVariant?: string
  /** Exact color per source slot; null shows the artwork as drawn. */
  colors: DesignColors | null
  /** Export background; null keeps it transparent. */
  background: string | null
  format: ExportFormat
  size: ExportSize
  step: 1 | 2 | 3
  browserO: BrowserState
  browserC: BrowserState
  /** Landscape: show the Logo and Palette columns at full width; they start skinny to leave room for the design. */
  wideSides?: boolean
}

export const initialDesignerState: DesignerState = {
  tool: 'recolor',
  tray: [],
  partSerial: 0,
  build: emptyBuild,
  buildName: '',
  oId: null,
  upload: null,
  cId: null,
  colors: null,
  background: null,
  format: DEFAULT_EXPORT_FORMAT,
  size: DEFAULT_EXPORT_SIZE,
  step: 1,
  browserO: { league: 'PRO', conference: 'All' },
  browserC: { league: 'PRO', conference: 'All' },
}

interface Props {
  state: DesignerState
  setState: (fn: (s: DesignerState) => DesignerState) => void
  portrait: boolean
  hidden?: boolean
}

const panelProps = {
  id: 'panel-designer',
  role: 'tabpanel' as const,
  'aria-labelledby': 'tab-designer',
}

/** The logo a design starts from: the traced upload, else the picked team. */
const logoTeam = (s: DesignerState): Team | null => (s.upload ? uploadTeam(s.upload) : s.oId ? findTeam(s.oId) ?? null : null)

const colorCountLabel = (c: TraceColors) => (c === 'auto' ? 'Auto' : c === 1 ? '1 color' : `${c} colors`)

const reseed = (s: DesignerState, team: Team): DesignColors | null => {
  const seed = s.cId ? findTeam(s.cId) : undefined
  return seed ? seedColors(team, seed.palette) : s.colors
}

export function DesignerMode({ state, setState, portrait, hidden }: Props) {
  const baseTeam = useMemo(() => logoTeam(state), [state.upload, state.oId])
  const team = baseTeam ? withLogoVariant(baseTeam, state.logoVariant) : null
  const seed = state.cId ? findTeam(state.cId) ?? null : null
  const source = team ? sourceColors(team) : null
  const roles = team ? slotRoles(team) : null
  const shown = state.colors ?? source
  const alternates = baseTeam?.alternateLogos ?? []
  const variantIndex = alternates.findIndex((v) => v.id === state.logoVariant)
  const variantLabel = variantIndex < 0 ? 'Primary' : alternates[variantIndex].label
  const editableSlots = roles?.filter((r) => r.editable).length ?? 0
  const isOriginal = !state.colors || sameColors(state.colors, source)
  // Parts and Build work on the logo being built; Recolor on the picked logo.
  const building = state.tool !== 'recolor'
  const buildMarkup = useMemo(
    () => (building ? buildSvg(state.build, state.tray, { background: state.background }) : null),
    [building, state.build.layers, state.build.colors, state.tray, state.background],
  )

  // Bitmap artwork (PNG, or an SVG wrapping a bitmap) can only leave as a PNG.
  const [svgOk, setSvgOk] = useState<boolean | null>(null)
  useEffect(() => {
    const logo = team?.logo
    if (!logo) return
    let alive = true
    setSvgOk(null)
    canExportSvg(logo).then((ok) => alive && setSvgOk(ok))
    return () => {
      alive = false
    }
  }, [team?.logo])
  const format: ExportFormat = !building && svgOk === false ? 'png' : state.format

  const [exporting, setExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState('')
  useEffect(() => setExportStatus(''), [state.oId, state.upload, state.logoVariant, state.tool])
  // The status floats over the canvas, so finished messages clear themselves.
  useEffect(() => {
    if (!exportStatus || exportStatus.endsWith('…')) return
    const id = window.setTimeout(() => setExportStatus(''), 6000)
    return () => window.clearTimeout(id)
  }, [exportStatus])

  // iPhone/iPad: PNGs can go straight to Photos through the share sheet ("Save Image").
  const [photosOk] = useState(canSaveToPhotos)
  const exportColors = isOriginal ? null : state.colors
  // What the corner icons save: the logo built from parts, or the recolored logo.
  const job = building
    ? buildMarkup
      ? {
          key: `${buildMarkup}|${state.size}`,
          png: (size: ExportSize) => svgPngBlob(buildMarkup, size),
          svg: async (): Promise<Blob | null> => svgBlob(buildMarkup),
          name: (f: ExportFormat) => buildFileName(state.buildName, f),
        }
      : null
    : team
    ? {
        key: JSON.stringify([team.logo, exportColors, state.background, state.size]),
        png: (size: ExportSize) => designPngBlob({ team, colors: exportColors, background: state.background }, size),
        svg: () => designSvgBlob({ team, colors: exportColors, background: state.background }),
        name: (f: ExportFormat) => designFileName(team, state.logoVariant, f),
      }
    : null
  const pngKey = job?.key ?? ''
  const nothingYet = building ? 'Place a part' : 'Pick a logo'
  // Safari only opens the share sheet close to the tap, so render the PNG ahead of time.
  const prepared = useRef<{ key: string; blob: Blob } | null>(null)
  useEffect(() => {
    if (!photosOk || format !== 'png' || !job) return
    if (prepared.current?.key === pngKey) return
    let alive = true
    const id = window.setTimeout(() => {
      job.png(state.size).then((blob) => {
        if (alive && blob) prepared.current = { key: pngKey, blob }
      })
    }, 250)
    return () => {
      alive = false
      window.clearTimeout(id)
    }
  }, [photosOk, format, pngKey])

  // Upload: decode the file, trace it, and design the result like any other logo.
  const fileRef = useRef<HTMLInputElement>(null)
  const [tracing, setTracing] = useState(false)
  const [traceStatus, setTraceStatus] = useState('')
  const applyUpload = (upload: UploadedLogo) =>
    setState((s) => ({ ...s, upload, oId: null, logoVariant: undefined, colors: reseed({ ...s, colors: null }, uploadTeam(upload)), step: 3 }))
  const traceFailed = (err: unknown) =>
    setTraceStatus(err instanceof TraceError ? err.message : 'That image could not be traced. Try another file.')
  const uploadFile = async (file: File | undefined) => {
    if (!file || tracing) return
    setTracing(true)
    setTraceStatus('Tracing your logo…')
    try {
      const raster = await readRaster(file)
      // Let the status paint before the synchronous trace runs.
      await new Promise((r) => setTimeout(r, 0))
      const upload = traceUpload(fileStem(file.name), raster, state.upload?.options ?? DEFAULT_TRACE_OPTIONS)
      applyUpload(upload)
      setTraceStatus(`Traced ${upload.result.colorCount} color${upload.result.colorCount === 1 ? '' : 's'} into vector outlines.`)
    } catch (err) {
      traceFailed(err)
    } finally {
      setTracing(false)
    }
  }
  const retrace = (options: TraceOptions) => {
    const upload = state.upload
    if (!upload) return
    try {
      const next = traceUpload(upload.name, upload.raster, options)
      applyUpload(next)
      setTraceStatus(`Traced ${next.result.colorCount} color${next.result.colorCount === 1 ? '' : 's'}.`)
    } catch (err) {
      traceFailed(err)
    }
  }

  const selectLogo = (t: Team) =>
    setState((s) =>
      s.oId === t.id && !s.upload
        ? { ...s, oId: null, logoVariant: undefined, colors: null, step: 1 }
        : // A logo picked while building is one to take parts from.
          { ...s, oId: t.id, upload: null, logoVariant: undefined, colors: reseed({ ...s, colors: null }, t), step: 2, tool: s.tool === 'build' ? 'parts' : s.tool, palettePick: false },
    )
  const selectColors = (t: Team) =>
    setState((s) => {
      if (s.cId === t.id) return { ...s, cId: null, colors: null, step: 2 }
      const logo = logoTeam(s)
      return { ...s, cId: t.id, colors: logo ? seedColors(withLogoVariant(logo, s.logoVariant), t.palette) : null, step: 3 }
    })
  const clearLogo = () => {
    setTraceStatus('')
    setState((s) => ({ ...s, oId: null, upload: null, logoVariant: undefined, colors: null, step: 1 }))
  }
  const resetColors = () => setState((s) => ({ ...s, cId: null, colors: null }))
  const shuffleLogo = () => {
    if (!baseTeam) return
    setState((s) => {
      const logoVariant = nextLogoVariant(baseTeam, s.logoVariant)
      return { ...s, logoVariant, colors: reseed(s, withLogoVariant(baseTeam, logoVariant)) }
    })
  }
  const rotate = () => {
    if (!shown || !roles) return
    setState((s) => ({ ...s, colors: rotateColors(s.colors ?? shown, roles) }))
  }
  // Parts and Build.
  const setTool = (tool: DesignerTool) => setState((s) => ({ ...s, tool, step: tool === 'parts' ? 2 : 3, palettePick: false }))
  const setBuild = (fn: (b: BuildState) => BuildState) => setState((s) => ({ ...s, build: fn(s.build) }))
  const sourceId = state.upload ? `UPLOAD:${state.upload.name}` : baseTeam?.id ?? null
  const addParts = (taken: TakenPart[]) =>
    setState((s) => {
      if (!baseTeam || !sourceId) return s
      const have = new Set(s.tray.map((p) => p.origin))
      let serial = s.partSerial
      const added: LogoPart[] = taken.filter((t) => !t.origin || !have.has(t.origin)).map((t) => ({ ...t, id: `P${++serial}`, source: fullName(baseTeam), sourceId }))
      return added.length ? { ...s, tray: [...s.tray, ...added], partSerial: serial } : s
    })
  // Start over: the tray empties, and the logo with it. Layer ids keep counting, so nothing old can be mistaken for new.
  const clearParts = () => setState((s) => ({ ...s, tray: [], build: { ...emptyBuild, serial: s.build.serial }, palettePick: false }))
  const dropPart = (id: string) => setState((s) => ({ ...s, tray: s.tray.filter((p) => p.id !== id), build: removePart(s.build, id) }))
  const placeTrayPart = (id: string) =>
    setState((s) => {
      const part = s.tray.find((p) => p.id === id)
      return part ? { ...s, build: placePart(s.build, part) } : s
    })
  const selectBuildPalette = (t: Team) =>
    setState((s) => ({ ...s, palettePick: false, build: s.build.paletteId === t.id ? { ...s.build, paletteId: null } : seedBuildColors(s.build, t.id, t.palette) }))
  const buildPalette = state.build.paletteId ? findTeam(state.build.paletteId) ?? null : null

  // Which color the in-page picker is editing: a slot index, the custom background, or none.
  const [picker, setPicker] = useState<number | 'bg' | null>(null)
  const togglePicker = (which: number | 'bg') => setPicker((p) => (p === which ? null : which))
  useEffect(() => setPicker(null), [state.oId, state.upload, state.logoVariant])
  // Colors the picker set: the logo recolors in place while dragging instead of re-popping every frame.
  const pickedColors = useRef<DesignColors | null>(null)
  const setSlot = (slot: number, hex: string, fromPicker = false) => {
    if (!shown) return
    setState((s) => {
      const colors: DesignColors = [...(s.colors ?? shown)]
      colors[slot] = hex
      if (fromPicker) pickedColors.current = colors
      return { ...s, cId: null, colors }
    })
  }
  const setBackground = (background: string | null) => setState((s) => ({ ...s, background }))
  const setFormat = (format: ExportFormat) => setState((s) => ({ ...s, format }))
  const setFile = (size: ExportSize) => setState((s) => ({ ...s, format: 'png', size }))

  const saveToPhotos = async () => {
    if (!job || exporting) return
    const name = job.name('png')
    let blob = prepared.current?.key === pngKey ? prepared.current.blob : null
    setExporting(true)
    try {
      if (!blob) {
        setExportStatus('Preparing your image…')
        blob = await job.png(state.size)
        if (!blob) {
          setExportStatus('Export failed. Try again or pick another logo.')
          return
        }
        prepared.current = { key: pngKey, blob }
      }
      const result = await shareImage(blob, name)
      setExportStatus(
        result === 'shared'
          ? 'Done. If you tapped “Save Image”, it’s in your Photos.'
          : result === 'cancelled'
          ? ''
          : result === 'blocked'
          ? 'Your image is ready. Tap Save to Photos again.'
          : 'Could not open the share sheet. Use the download button instead.',
      )
    } finally {
      setExporting(false)
    }
  }

  // Export options open from a corner icon so they never take room from the logo and color wheel.
  const [exportOpen, setExportOpen] = useState(false)
  const exportPanel = useRef<HTMLDivElement>(null)
  const exportToggle = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!exportOpen) return
    const onDown = (e: globalThis.PointerEvent) => {
      const t = e.target as Node
      if (!exportPanel.current?.contains(t) && !exportToggle.current?.contains(t)) setExportOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      // A color picker inside the panel handles its own Escape first.
      if (e.key !== 'Escape' || e.defaultPrevented) return
      setExportOpen(false)
      exportToggle.current?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [exportOpen])
  const fileLabel = format === 'svg' ? 'SVG' : `PNG, ${state.size}px`

  const doExport = async () => {
    if (!job || exporting) return
    setExporting(true)
    setExportStatus('Preparing your file…')
    try {
      const blob = format === 'svg' ? await job.svg() : await job.png(state.size)
      if (!blob) {
        setExportStatus(format === 'svg' ? 'This artwork cannot be exported as SVG. Try PNG.' : 'Export failed. Try again or pick another logo.')
        return
      }
      const name = job.name(format)
      downloadBlob(blob, name)
      setExportStatus(`Saved ${name}`)
    } finally {
      setExporting(false)
    }
  }

  const customBackground = state.background !== null && !BACKGROUND_PRESETS.some((p) => p.color === state.background)
  const colorText = seed ? `${fullName(seed)} colors` : isOriginal ? 'Original colors' : 'Custom colors'
  const heroBase = `${state.upload ? `upload-${state.upload.serial}` : team?.logo}`
  const lastHeroKey = useRef('')
  const heroKey =
    state.colors && state.colors === pickedColors.current && lastHeroKey.current.startsWith(`${heroBase}-`)
      ? lastHeroKey.current
      : `${heroBase}-${(isOriginal ? source : state.colors)?.join('|')}`
  lastHeroKey.current = heroKey
  const upload = state.upload
  const pickerPreview = building
    ? buildMarkup && (
        <div className="cp-stage">
          <img className="logo" src={svgToDataUrl(buildMarkup)} alt="" />
        </div>
      )
    : team && (
        <div className={`cp-stage${state.background ? ' bg' : ''}`} style={state.background ? { background: state.background } : undefined}>
          {isOriginal ? <Logo team={team} /> : <Logo team={team} targetColors={state.colors!} />}
        </div>
      )

  const uploadButton = (
    <button type="button" className="btn-shuffle" onClick={() => fileRef.current?.click()} disabled={tracing} aria-label="Upload a logo to trace">
      {tracing ? 'Tracing…' : 'Upload Logo'}
    </button>
  )

  const TOOLS: [DesignerTool, string][] = [
    ['recolor', 'Recolor'],
    ['parts', 'Parts'],
    ['build', 'Build'],
  ]
  const canvas = (
    <section
      className={`canvas designer tool-${state.tool}`}
      aria-label={state.tool === 'parts' ? 'Take parts from a logo' : state.tool === 'build' ? 'Build your logo' : 'Logo designer'}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault()
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return
        e.preventDefault()
        uploadFile(e.dataTransfer.files[0])
      }}
    >
      <input
        ref={fileRef}
        type="file"
        accept={UPLOAD_ACCEPT}
        hidden
        onChange={(e) => {
          uploadFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <div className="design-corner left">
        <button
          ref={exportToggle}
          type="button"
          className={`icon-btn${exportOpen ? ' active' : ''}`}
          aria-label={`Export options, ${fileLabel}`}
          title="Export options"
          aria-expanded={exportOpen}
          aria-controls="design-export-panel"
          onClick={() => setExportOpen((o) => !o)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="10" cy="17" r="2" />
          </svg>
          <span className="icon-btn-tag">{format === 'svg' ? 'SVG' : 'PNG'}</span>
        </button>
      </div>
      <div className="design-corner right">
        {photosOk && format === 'png' && (
          <button type="button" className="icon-btn" onClick={saveToPhotos} disabled={!job || exporting} aria-busy={exporting} aria-label={job ? 'Save PNG to Photos' : `${nothingYet} before saving`} title="Save to Photos">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v12M8 7l4-4 4 4" />
              <path d="M7 10H5v10h14V10h-2" />
            </svg>
          </button>
        )}
        <button
          type="button"
          className="icon-btn accent"
          onClick={doExport}
          disabled={!job || exporting}
          aria-busy={exporting}
          aria-label={job ? `Download ${fileLabel}` : `${nothingYet} before downloading`}
          title={`Download ${fileLabel}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4v11M7 10l5 5 5-5" />
            <path d="M5 19h14" />
          </svg>
        </button>
      </div>
      {exportOpen && (
        <div ref={exportPanel} id="design-export-panel" className="design-export" role="dialog" aria-label="Export options">
          <div className="micro">EXPORT</div>
          <div className="design-opts" role="group" aria-label="File">
            {[...EXPORT_SIZES].reverse().map((px) => {
              const active = format === 'png' && state.size === px
              return (
                <button key={px} type="button" className={`design-opt${active ? ' active' : ''}`} aria-pressed={active} onClick={() => setFile(px)}>
                  PNG · {px}
                </button>
              )
            })}
            <button type="button" className={`design-opt${format === 'svg' ? ' active' : ''}`} aria-pressed={format === 'svg'} disabled={!building && svgOk === false} onClick={() => setFormat('svg')}>
              SVG
            </button>
          </div>
          <div className="design-opts" role="group" aria-label="Background">
            {BACKGROUND_PRESETS.map((p) => (
              <button key={p.id} type="button" className={`design-opt${state.background === p.color ? ' active' : ''}`} aria-pressed={state.background === p.color} onClick={() => setBackground(p.color)}>
                {p.label}
              </button>
            ))}
            <button type="button" className={`design-opt${customBackground ? ' active' : ''}`} aria-pressed={customBackground} onClick={() => setBackground(CUSTOM_BACKGROUND_DEFAULT)}>
              Custom
            </button>
            {customBackground && (
              <button
                type="button"
                className={`color-input${picker === 'bg' ? ' open' : ''}`}
                style={{ '--swatch': state.background! } as CSSProperties}
                aria-label={`Custom background color, ${state.background}`}
                aria-expanded={picker === 'bg'}
                onClick={() => togglePicker('bg')}
              />
            )}
          </div>
          {customBackground && picker === 'bg' && (
            <ColorPicker value={state.background!} label="Background" onChange={setBackground} onClose={() => setPicker(null)} preview={pickerPreview} />
          )}
          <div className="mode-hint">
            {!building && upload && format === 'svg'
              ? 'Traced vector outlines, one shape per color; sharp at any size.'
              : !building && svgOk === false
              ? 'This artwork is a bitmap, so it exports as PNG only.'
              : format === 'svg'
                ? 'Vector file that stays sharp at any size; opens in Illustrator, Figma or a browser.'
                : `Square ${state.size}px image${state.background ? '' : ' with a transparent background'}.${photosOk ? ' Save to Photos opens the share sheet; tap “Save Image”.' : ''}`}
          </div>
        </div>
      )}
      {exportStatus && (
        <div className="design-toast" role="status" aria-live="polite" aria-atomic="true">
          {exportStatus}
        </div>
      )}
      {!portrait && (
        <div className="tool-tabs" role="group" aria-label="Designer tool">
          {TOOLS.map(([tool, label]) => (
            <button key={tool} type="button" className={`tool-tab${state.tool === tool ? ' active' : ''}`} aria-pressed={state.tool === tool} onClick={() => setTool(tool)}>
              {label}
            </button>
          ))}
        </div>
      )}
      {state.tool === 'parts' && (
        <PartsCanvas team={team} name={baseTeam ? fullName(baseTeam) : ''} tray={state.tray} onAdd={addParts} canShuffle={alternates.length > 0} onShuffle={shuffleLogo} portrait={portrait} />
      )}
      {state.tool === 'build' && (
        <BuildCanvas
          parts={state.tray}
          build={state.build}
          onBuild={setBuild}
          name={state.buildName}
          onName={(buildName) => setState((s) => ({ ...s, buildName }))}
          background={state.background}
          paletteName={buildPalette ? fullName(buildPalette) : null}
          onPalette={() => setState((s) => ({ ...s, palettePick: true }))}
          onTakeParts={() => setTool('parts')}
          onClearParts={clearParts}
          portrait={portrait}
        />
      )}
      {state.tool === 'recolor' && (
        <>
          <div className={`micro-row design-top${photosOk && format === 'png' ? ' two-icons' : ''}`}>
            <div className="micro-row">
              <div className="micro">LOGO</div>
              {team && (
                <button type="button" className="btn-clear" onClick={clearLogo} aria-label="Clear logo">
                  clear
                </button>
              )}
            </div>
            <div className="micro-row">
              <div className="micro">COLORS</div>
              {team && !isOriginal && (
                <button type="button" className="btn-clear" onClick={resetColors} aria-label="Reset to the original colors">
                  reset
                </button>
              )}
            </div>
          </div>
          <div className={`canvas-name${baseTeam ? '' : ' placeholder'}`}>{baseTeam ? fullName(baseTeam) : 'Pick a logo to design'}</div>
          {alternates.length > 0 && (
            <div className="logo-variant-label" role="status" aria-live="polite">
              {variantLabel} · {variantIndex + 2} of {alternates.length + 1}
            </div>
          )}
          {upload && <div className="logo-variant-label">Traced from your upload</div>}
          <div className="canvas-hero">
            {team ? (
              <div className={`design-stage${state.background ? ' bg' : ''}`} style={state.background ? { background: state.background } : undefined}>
                <div key={heroKey} className="hero-logo pop">
                  {isOriginal ? <Logo team={team} /> : <Logo team={team} targetColors={state.colors!} />}
                </div>
              </div>
            ) : (
              <div className="empty-circle">
                {portrait ? 'Pick a logo in step 1, or upload your own' : 'Pick a logo on the left or upload your own, then recolor it slot by slot'}
              </div>
            )}
          </div>

          {upload && (
            <div className="design-trace">
              <div className="micro">TRACE</div>
              <div className="design-opts" role="group" aria-label="Colors to trace">
                {TRACE_COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`design-opt${upload.options.colors === c ? ' active' : ''}`}
                    aria-pressed={upload.options.colors === c}
                    onClick={() => retrace({ ...upload.options, colors: c })}
                  >
                    {colorCountLabel(c)}
                  </button>
                ))}
              </div>
              <div className="design-opts" role="group" aria-label="Background">
                <button
                  type="button"
                  className={`design-opt${upload.options.removeBackground ? ' active' : ''}`}
                  aria-pressed={upload.options.removeBackground}
                  onClick={() => retrace({ ...upload.options, removeBackground: !upload.options.removeBackground })}
                >
                  Remove background
                </button>
              </div>
            </div>
          )}
          {traceStatus && (
            <div className="mode-hint design-status" role="status" aria-live="polite" aria-atomic="true">
              {traceStatus}
            </div>
          )}

          {!team && <div className="color-caption placeholder">Each slot gets its own color</div>}
          {team && shown && roles && source && (
            <div className="design-slots" role="group" aria-label="Logo colors by slot">
              <div className="design-chips">
                {roles.map((role, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`design-chip${picker === i ? ' open' : ''}`}
                    style={{ background: shown[i] }}
                    disabled={!role.editable}
                    title={role.label}
                    aria-label={`${role.label} color, ${shown[i]}`}
                    aria-expanded={picker === i}
                    onClick={() => togglePicker(i)}
                  />
                ))}
              </div>
              <div className="color-caption">{colorText}</div>
              {typeof picker === 'number' && roles[picker] && (
                <ColorPicker
                  key={picker}
                  value={shown[picker]}
                  label={roles[picker].label}
                  onChange={(hex) => setSlot(picker, hex, true)}
                  onClose={() => setPicker(null)}
                  preview={pickerPreview}
                />
              )}
            </div>
          )}

          <div className="action-row design-actions">
            {uploadButton}
            <button type="button" className="btn-shuffle" onClick={shuffleLogo} disabled={!alternates.length} aria-label="Shuffle logo alternate">
              Shuffle Logo
            </button>
            <button type="button" className="btn-shuffle" onClick={rotate} disabled={!team || editableSlots < 2} aria-label="Rotate the slot colors">
              Rotate Colors
            </button>
          </div>
        </>
      )}
    </section>
  )

  const tray = (
    <PartsTray
      parts={state.tray}
      build={state.build}
      tool={state.tool === 'build' ? 'build' : 'parts'}
      sourceId={sourceId}
      onRemove={dropPart}
      onPlace={placeTrayPart}
      onSelectLayer={(id) => setBuild((b) => ({ ...b, selected: id }))}
      onBuild={() => setTool('build')}
      onTakeParts={() => setTool('parts')}
      onClear={clearParts}
    />
  )
  // Build borrows the palette browser to start its colors from a team; this closes it again.
  const closePalette = (
    <button type="button" className="btn-clear" onClick={() => setState((s) => ({ ...s, palettePick: false }))} aria-label="Back to your logo">
      back
    </button>
  )

  if (portrait) {
    const steps: [1 | 2 | 3, string][] = building
      ? [
          [1, '1 · Logos'],
          [2, '2 · Parts'],
          [3, '3 · Build'],
        ]
      : [
          [1, '1 · Logo'],
          [2, '2 · Colors'],
          [3, '3 · Design'],
        ]
    // Building: step 2 is the Parts tool and step 3 the Build tool.
    const step = !building || state.step === 1 ? state.step : state.tool === 'build' ? 3 : 2
    const goStep = (n: 1 | 2 | 3) =>
      setState((s) => (s.tool === 'recolor' ? { ...s, step: n } : { ...s, step: n, tool: n === 3 ? 'build' : n === 2 ? 'parts' : s.tool, palettePick: false }))
    const picking = building ? step !== 1 && !!state.palettePick : step === 2
    return (
      <div className="create-port portrait" {...panelProps} hidden={hidden}>
        <div className="steps" role="group" aria-label="Designer steps">
          {steps.map(([n, lb]) => (
            <button key={n} type="button" className={`step${step === n ? ' active' : ''}`} aria-current={step === n ? 'step' : undefined} onClick={() => goStep(n)}>
              {lb}
            </button>
          ))}
        </div>
        {step === 1 && (
          <div className="tool-tabs flow" role="group" aria-label="Designer tool">
            <button type="button" className={`tool-tab${building ? '' : ' active'}`} aria-pressed={!building} onClick={() => setState((s) => ({ ...s, tool: 'recolor', palettePick: false }))}>
              Recolor a logo
            </button>
            <button type="button" className={`tool-tab${building ? ' active' : ''}`} aria-pressed={building} onClick={() => setState((s) => (s.tool === 'recolor' ? { ...s, tool: 'parts', palettePick: false } : s))}>
              Build from parts
            </button>
          </div>
        )}
        {step === 1 && (
          <TeamBrowser
            title="CHOOSE A LOGO"
            state={state.browserO}
            onState={(b) => setState((s) => ({ ...s, browserO: b }))}
            selectedId={state.oId}
            onSelect={selectLogo}
            portrait
          />
        )}
        {picking && (
          <TeamBrowser
            title="START FROM A PALETTE"
            state={state.browserC}
            onState={(b) => setState((s) => ({ ...s, browserC: b }))}
            selectedId={building ? state.build.paletteId : state.cId}
            onSelect={building ? selectBuildPalette : selectColors}
            showSwatches
            leagues={DESIGNER_PALETTE_LEAGUES}
            note={DESIGNER_PALETTE_NOTE}
            headAction={building ? closePalette : undefined}
            portrait
          />
        )}
        {step !== 1 && !picking && canvas}
        {building && step === 2 && <PartsTrayBar parts={state.tray} build={state.build} onRemove={dropPart} onBuild={() => setTool('build')} />}
      </div>
    )
  }

  const wide = !!state.wideSides
  const sidesToggle = (
    <button
      type="button"
      className="icon-btn small"
      onClick={() => setState((s) => ({ ...s, wideSides: !s.wideSides }))}
      aria-pressed={wide}
      aria-label={wide ? 'Make the side columns skinny' : 'Widen the side columns'}
      title={wide ? 'Skinny columns' : 'Wide columns'}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {wide ? <path d="M4 12h6M7 9l3 3-3 3M20 12h-6M17 9l-3 3 3 3" /> : <path d="M3 12h7M6 9l-3 3 3 3M21 12h-7M18 9l3 3-3 3" />}
      </svg>
    </button>
  )
  return (
    <div className={`create-land${wide ? '' : ' slim-sides'}${building ? ' with-tray' : ''}`} {...panelProps} hidden={hidden}>
      <TeamBrowser
        title="LOGO"
        state={state.browserO}
        onState={(b) => setState((s) => ({ ...s, browserO: b }))}
        selectedId={state.oId}
        onSelect={selectLogo}
        compact={!wide}
        headAction={sidesToggle}
      />
      {canvas}
      {building && !state.palettePick ? (
        tray
      ) : (
        <TeamBrowser
          title="PALETTE"
          state={state.browserC}
          onState={(b) => setState((s) => ({ ...s, browserC: b }))}
          selectedId={building ? state.build.paletteId : state.cId}
          onSelect={building ? selectBuildPalette : selectColors}
          showSwatches
          leagues={DESIGNER_PALETTE_LEAGUES}
          note={DESIGNER_PALETTE_NOTE}
          compact={!wide && !building}
          headAction={building ? closePalette : sidesToggle}
        />
      )}
    </div>
  )
}
