import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { hexToHsv, hsvToHex, normalizeHex, type HSV } from '../lib/designer'

interface Props {
  value: string
  label: string
  onChange: (hex: string) => void
  onClose: () => void
  /** Live preview of the design, so the result stays in view while the canvas is scrolled down to the picker. */
  preview?: ReactNode
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/**
 * In-page color picker for Designer mode. It sits in the controls column, in normal flow,
 * instead of the browser's native picker: on iPad that one is a system popover the page
 * cannot place, and it opens over the logo being recolored.
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

  const area = useRef<HTMLDivElement>(null)
  const pickAt = (e: PointerEvent<HTMLDivElement>) => {
    const r = area.current!.getBoundingClientRect()
    update({ ...hsv, s: clamp01((e.clientX - r.left) / r.width), v: 1 - clamp01((e.clientY - r.top) / r.height) })
  }
  const onAreaKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02
    const moves: Record<string, Partial<HSV>> = {
      ArrowLeft: { s: clamp01(hsv.s - step) },
      ArrowRight: { s: clamp01(hsv.s + step) },
      ArrowUp: { v: clamp01(hsv.v + step) },
      ArrowDown: { v: clamp01(hsv.v - step) },
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
  return (
    <div className="color-picker" role="group" aria-label={`${label} color picker`}>
      <div className="cp-main">
        {preview && (
          <div className="cp-preview" aria-hidden="true">
            {preview}
          </div>
        )}
        <div
          ref={area}
          className="cp-area"
          style={{ backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 }) }}
          tabIndex={0}
          role="slider"
          aria-label={`${label} saturation and brightness`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(hsv.s * 100)}
          aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%, ${hex}`}
          onKeyDown={onAreaKey}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            e.currentTarget.focus({ preventScroll: true })
            pickAt(e)
          }}
          onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && pickAt(e)}
        >
          <span className="cp-thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }} aria-hidden="true" />
        </div>
      </div>
      <div className="cp-row">
        <input
          type="range"
          className="cp-hue"
          min={0}
          max={359}
          step={1}
          value={Math.round(hsv.h)}
          aria-label={`${label} hue`}
          onChange={(e) => update({ ...hsv, h: +e.target.value })}
          onKeyDown={(e) => (e.key === 'Escape' || e.key === 'Enter') && onClose()}
        />
        <button type="button" className="cp-done" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  )
}
