import { useEffect, useState } from 'react'
import {
  BACKGROUND_PRESETS,
  CUSTOM_BACKGROUND_DEFAULT,
  DEFAULT_EXPORT_SIZE,
  EXPORT_SIZES,
  designFileName,
  normalizeHex,
  rotateColors,
  sameColors,
  seedColors,
  slotRoles,
  sourceColors,
  type DesignColors,
  type ExportFormat,
  type ExportSize,
} from '../lib/designer'
import { canExportSvg, designPngBlob, designSvgBlob, downloadBlob } from '../lib/exportLogo'
import { findTeam, fullName, nextLogoVariant, withLogoVariant, type Team } from '../lib/teams'
import { Logo } from './Logo'
import { TeamBrowser, type BrowserState } from './TeamBrowser'

export interface DesignerState {
  /** Logo being designed. */
  oId: string | null
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
}

export const initialDesignerState: DesignerState = {
  oId: null,
  cId: null,
  colors: null,
  background: null,
  format: 'svg',
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

const reseed = (s: DesignerState, team: Team): DesignColors | null => {
  const seed = s.cId ? findTeam(s.cId) : undefined
  return seed ? seedColors(team, seed.palette) : s.colors
}

/** Hex text field that commits valid colors on blur or Enter and reverts anything else. */
function HexField({ value, label, disabled, onChange }: { value: string; label: string; disabled?: boolean; onChange: (hex: string) => void }) {
  const [text, setText] = useState(value)
  const [lastValue, setLastValue] = useState(value)
  // Follow the committed color immediately (during render, not in an effect) so the field never shows stale text.
  if (value !== lastValue) {
    setLastValue(value)
    setText(value)
  }
  const commit = () => {
    const hex = normalizeHex(text)
    setText(hex ?? value)
    if (hex && hex !== value) onChange(hex)
  }
  return (
    <input
      className="hex-input"
      value={text}
      disabled={disabled}
      spellCheck={false}
      autoCapitalize="characters"
      maxLength={7}
      aria-label={`${label} hex code`}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  )
}

export function DesignerMode({ state, setState, portrait, hidden }: Props) {
  const baseTeam = state.oId ? findTeam(state.oId) ?? null : null
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
  const format: ExportFormat = svgOk === false ? 'png' : state.format

  const [exporting, setExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState('')
  useEffect(() => setExportStatus(''), [state.oId, state.logoVariant])

  const selectLogo = (t: Team) =>
    setState((s) =>
      s.oId === t.id
        ? { ...s, oId: null, logoVariant: undefined, colors: null, step: 1 }
        : { ...s, oId: t.id, logoVariant: undefined, colors: reseed({ ...s, colors: null }, t), step: 2 },
    )
  const selectColors = (t: Team) =>
    setState((s) => {
      if (s.cId === t.id) return { ...s, cId: null, colors: null, step: 2 }
      const logo = s.oId ? findTeam(s.oId) : undefined
      return { ...s, cId: t.id, colors: logo ? seedColors(withLogoVariant(logo, s.logoVariant), t.palette) : null, step: 3 }
    })
  const clearLogo = () => setState((s) => ({ ...s, oId: null, logoVariant: undefined, colors: null, step: 1 }))
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
  const setSlot = (slot: number, hex: string) => {
    if (!shown) return
    setState((s) => {
      const colors: DesignColors = [...(s.colors ?? shown)]
      colors[slot] = hex
      return { ...s, cId: null, colors }
    })
  }
  const setBackground = (background: string | null) => setState((s) => ({ ...s, background }))
  const setFormat = (format: ExportFormat) => setState((s) => ({ ...s, format }))
  const setFile = (size: ExportSize) => setState((s) => ({ ...s, format: 'png', size }))

  const doExport = async () => {
    if (!team || exporting) return
    setExporting(true)
    setExportStatus('Preparing your file…')
    try {
      const design = { team, colors: isOriginal ? null : state.colors, background: state.background }
      const blob = format === 'svg' ? await designSvgBlob(design) : await designPngBlob(design, state.size)
      if (!blob) {
        setExportStatus(format === 'svg' ? 'This artwork cannot be exported as SVG. Try PNG.' : 'Export failed. Try again or pick another logo.')
        return
      }
      const name = designFileName(team, state.logoVariant, format)
      downloadBlob(blob, name)
      setExportStatus(`Saved ${name}`)
    } finally {
      setExporting(false)
    }
  }

  const customBackground = state.background !== null && !BACKGROUND_PRESETS.some((p) => p.color === state.background)
  const colorText = seed ? `${fullName(seed)} colors` : isOriginal ? 'Original colors' : 'Custom colors'
  const heroKey = `${team?.logo}-${(isOriginal ? source : state.colors)?.join('|')}`

  const canvas = (
    <section className="canvas designer" aria-label="Logo designer">
      <div className="micro-row">
        <div className="micro">LOGO</div>
        {team && (
          <button type="button" className="btn-clear" onClick={clearLogo} aria-label="Clear logo">
            clear
          </button>
        )}
      </div>
      <div className={`canvas-name${baseTeam ? '' : ' placeholder'}`}>{baseTeam ? fullName(baseTeam) : 'Pick a logo to design'}</div>
      {alternates.length > 0 && (
        <div className="logo-variant-label" role="status" aria-live="polite">
          {variantLabel} · {variantIndex + 2} of {alternates.length + 1}
        </div>
      )}
      <div className="canvas-hero">
        {team ? (
          <div className={`design-stage${state.background ? ' bg' : ''}`} style={state.background ? { background: state.background } : undefined}>
            <div key={heroKey} className="hero-logo pop">
              {isOriginal ? <Logo team={team} /> : <Logo team={team} targetColors={state.colors!} />}
            </div>
          </div>
        ) : (
          <div className="empty-circle">{portrait ? 'Pick a logo in step 1' : 'Pick a logo on the left, then recolor it slot by slot'}</div>
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
      <div className={`color-name${team ? '' : ' placeholder'}`}>{team ? colorText : 'Each slot gets its own color'}</div>
      {team && shown && roles && source && (
        <div className="design-slots" role="group" aria-label="Logo colors by slot">
          {roles.map((role, i) => (
            <div key={i} className={`design-slot${role.editable ? '' : ' unused'}`}>
              <span className="design-slot-label">{role.label}</span>
              <span className="swatch s16" style={{ background: source[i] }} title={`Original ${source[i]}`} aria-hidden="true" />
              <input
                type="color"
                className="color-input"
                value={shown[i].toLowerCase()}
                disabled={!role.editable}
                aria-label={`${role.label} color`}
                onChange={(e) => {
                  const hex = normalizeHex(e.target.value)
                  if (hex) setSlot(i, hex)
                }}
              />
              <HexField value={shown[i]} label={role.label} disabled={!role.editable} onChange={(hex) => setSlot(i, hex)} />
            </div>
          ))}
        </div>
      )}

      <div className="action-row design-actions">
        <button type="button" className="btn-shuffle" onClick={shuffleLogo} disabled={!alternates.length} aria-label="Shuffle logo alternate">
          Shuffle Logo
        </button>
        <button type="button" className="btn-shuffle" onClick={rotate} disabled={!team || editableSlots < 2} aria-label="Rotate the slot colors">
          Rotate Colors
        </button>
      </div>

      <div className="design-export">
        <div className="micro">EXPORT</div>
        <div className="design-opts" role="group" aria-label="File">
          <button type="button" className={`design-opt${format === 'svg' ? ' active' : ''}`} aria-pressed={format === 'svg'} disabled={svgOk === false} onClick={() => setFormat('svg')}>
            SVG
          </button>
          {EXPORT_SIZES.map((px) => {
            const active = format === 'png' && state.size === px
            return (
              <button key={px} type="button" className={`design-opt${active ? ' active' : ''}`} aria-pressed={active} onClick={() => setFile(px)}>
                PNG · {px}
              </button>
            )
          })}
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
            <input
              type="color"
              className="color-input"
              value={state.background!.toLowerCase()}
              aria-label="Custom background color"
              onChange={(e) => {
                const hex = normalizeHex(e.target.value)
                if (hex) setBackground(hex)
              }}
            />
          )}
        </div>
        <div className="mode-hint">
          {svgOk === false
            ? 'This artwork is a bitmap, so it exports as PNG only.'
            : format === 'svg'
              ? 'Vector file that stays sharp at any size; opens in Illustrator, Figma or a browser.'
              : `Square ${state.size}px image${state.background ? '' : ' with a transparent background'}.`}
        </div>
      </div>
      <div className="canvas-footer design-footer">
        <button type="button" className="btn-add design-download" onClick={doExport} disabled={!team || exporting} aria-label={team ? `Download ${format.toUpperCase()}` : 'Pick a logo before downloading'}>
          {exporting ? 'EXPORTING…' : `⬇ DOWNLOAD ${format.toUpperCase()}`}
        </button>
        <div className="mode-hint design-status" role="status" aria-live="polite" aria-atomic="true">
          {exportStatus}
        </div>
      </div>
    </section>
  )

  if (portrait) {
    const steps: [1 | 2 | 3, string][] = [
      [1, '1 · Logo'],
      [2, '2 · Colors'],
      [3, '3 · Design'],
    ]
    return (
      <div className="create-port portrait" {...panelProps} hidden={hidden}>
        <div className="steps" role="group" aria-label="Designer steps">
          {steps.map(([n, lb]) => (
            <button
              key={n}
              type="button"
              className={`step${state.step === n ? ' active' : ''}`}
              aria-current={state.step === n ? 'step' : undefined}
              onClick={() => setState((s) => ({ ...s, step: n }))}
            >
              {lb}
            </button>
          ))}
        </div>
        {state.step === 1 && (
          <TeamBrowser
            title="CHOOSE A LOGO"
            state={state.browserO}
            onState={(b) => setState((s) => ({ ...s, browserO: b }))}
            selectedId={state.oId}
            onSelect={selectLogo}
            portrait
          />
        )}
        {state.step === 2 && (
          <TeamBrowser
            title="START FROM A PALETTE"
            state={state.browserC}
            onState={(b) => setState((s) => ({ ...s, browserC: b }))}
            selectedId={state.cId}
            onSelect={selectColors}
            showSwatches
            portrait
          />
        )}
        {state.step === 3 && canvas}
      </div>
    )
  }

  return (
    <div className="create-land" {...panelProps} hidden={hidden}>
      <TeamBrowser
        title="LOGO"
        state={state.browserO}
        onState={(b) => setState((s) => ({ ...s, browserO: b }))}
        selectedId={state.oId}
        onSelect={selectLogo}
      />
      {canvas}
      <TeamBrowser
        title="PALETTE"
        state={state.browserC}
        onState={(b) => setState((s) => ({ ...s, browserC: b }))}
        selectedId={state.cId}
        onSelect={selectColors}
        showSwatches
      />
    </div>
  )
}
