import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { hexToHsv, hsvToHex, normalizeHex, wheelColor, wheelPosition, type HSV } from '../lib/designer'

interface Props {
  value: string
  label: string
  onChange: (hex: string) => void
  onClose: () => void
  /** Live preview of the design, so the result stays in view while the canvas is scrolled down to the picker. */
  preview?: ReactNode
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Hex text field that commits valid colors on blur or Enter and reverts anything else. */
export function HexField({ value, label, disabled, onChange }: { value: string; label: string; disabled?: boolean; onChange: (hex: string) => void }) {
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

/**
 * In-page color picker for Designer mode: a hue/saturation wheel, a brightness slider and a hex field.
 * It sits in the canvas column, in normal flow, instead of the browser's native picker: on iPad that one
 * is a system popover the page cannot place, and it opens over the logo being recolored.
 */
export function ColorPicker({ value, label, onChange, onClose, preview }: Props) {
  // Hue and saturation live here so dragging through black or gray does not lose them.
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(value))
  const emitted = useRef(value)
  useEffect(() => {
    // An outside change (hex field, rotate, reset) re-seeds the picker; our own echoes do not.
    if (normalizeHex(value) !== normalizeHex(emitted.current)) {
      emitted.current = value
      setHsv(hexToHsv(value))
    }
  }, [value])

  // Bring the whole picker into view when it opens; scroll-margin keeps it clear of the sticky Download bar.
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    root.current?.scrollIntoView?.({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  }, [])

  // Coalesce drag updates to one per frame: each new color re-renders the recolored logo.
  const frame = useRef(0)
  const pending = useRef<string | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  // Closing mid-frame still commits the last color.
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current)
      if (pending.current) onChangeRef.current(pending.current)
    },
    [],
  )
  const update = (next: HSV) => {
    setHsv(next)
    const hex = hsvToHex(next)
    emitted.current = hex
    pending.current = hex
    if (!frame.current) {
      frame.current = requestAnimationFrame(() => {
        frame.current = 0
        if (pending.current) onChangeRef.current(pending.current)
        pending.current = null
      })
    }
  }

  const wheel = useRef<HTMLDivElement>(null)
  const pickAt = (e: PointerEvent<HTMLDivElement>) => {
    const r = wheel.current!.getBoundingClientRect()
    update({ ...hsv, ...wheelColor((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height) })
  }
  const onWheelKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const hueStep = e.shiftKey ? 15 : 3
    const satStep = e.shiftKey ? 0.1 : 0.02
    const moves: Record<string, Partial<HSV>> = {
      ArrowLeft: { h: (hsv.h - hueStep + 360) % 360 },
      ArrowRight: { h: (hsv.h + hueStep) % 360 },
      ArrowUp: { s: clamp01(hsv.s + satStep) },
      ArrowDown: { s: clamp01(hsv.s - satStep) },
    }
    if (moves[e.key]) {
      e.preventDefault()
      update({ ...hsv, ...moves[e.key] })
    } else if (e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault()
      onClose()
    }
  }

  const hex = hsvToHex(hsv)
  const thumb = wheelPosition(hsv)
  return (
    <div ref={root} className="color-picker" role="group" aria-label={`${label} color picker`}>
      <div
        ref={wheel}
        className="cp-wheel"
        style={{ '--dim': 1 - hsv.v } as CSSProperties}
        tabIndex={0}
        role="slider"
        aria-label={`${label} hue and saturation`}
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.round(hsv.h)}
        aria-valuetext={`Hue ${Math.round(hsv.h)}°, saturation ${Math.round(hsv.s * 100)}%, ${hex}`}
        onKeyDown={onWheelKey}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          e.currentTarget.focus({ preventScroll: true })
          pickAt(e)
        }}
        onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && pickAt(e)}
      >
        <span className="cp-thumb" style={{ left: `${thumb.x * 100}%`, top: `${thumb.y * 100}%`, background: hex }} aria-hidden="true" />
      </div>
      <div className="cp-side">
        {preview && (
          <div className="cp-preview" aria-hidden="true">
            {preview}
          </div>
        )}
        <input
          type="range"
          className="cp-value"
          style={{ '--full': hsvToHex({ ...hsv, v: 1 }) } as CSSProperties}
          min={0}
          max={100}
          step={1}
          value={Math.round(hsv.v * 100)}
          aria-label={`${label} brightness`}
          onChange={(e) => update({ ...hsv, v: +e.target.value / 100 })}
          onKeyDown={(e) => (e.key === 'Escape' || e.key === 'Enter') && onClose()}
        />
        <div className="cp-row">
          <HexField value={hex} label={label} onChange={onChange} />
          <button type="button" className="cp-done" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
