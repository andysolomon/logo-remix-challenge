import { useEffect, useState } from 'react'

export interface KeyboardInset {
  /** Height of the region the browser is actually showing, in px. */
  height: number
  /** How much of the window the on-screen keyboard covers, in px. */
  inset: number
  /** How far down the window the visible strip starts, in px. */
  top: number
  /** True once the covered strip is too tall to be anything but a keyboard. */
  open: boolean
}

/** Browser chrome sliding away shaves a little height; a keyboard takes a lot more. */
const KEYBOARD_MIN = 120

const read = (): KeyboardInset => {
  if (typeof window === 'undefined') return { height: 0, inset: 0, top: 0, open: false }
  const vv = window.visualViewport
  const height = Math.round(vv ? vv.height : window.innerHeight)
  // iOS slides the visible strip down the page to reveal the focused field, so
  // the round has to follow it rather than sit at the top of the layout.
  const top = Math.round(vv ? vv.offsetTop : 0)
  const inset = Math.max(0, Math.round(window.innerHeight - height - top))
  return { height, inset, top, open: inset >= KEYBOARD_MIN }
}

/**
 * Tracks the visual viewport. iOS never shrinks the layout viewport for the
 * keyboard — it just slides the page up — so `100dvh` layouts spill their top
 * off screen. Reading the visual viewport lets the page resize itself instead.
 */
export function useKeyboardInset(): KeyboardInset {
  const [state, setState] = useState<KeyboardInset>(read)
  useEffect(() => {
    const vv = window.visualViewport
    const sync = () => {
      setState((prev) => {
        const next = read()
        return prev.height === next.height && prev.inset === next.inset && prev.top === next.top ? prev : next
      })
      // Safari may have scrolled the window to reveal the field; the resized
      // layout already shows it, so scrolling back keeps the header in view.
      if (window.scrollY !== 0) window.scrollTo(0, 0)
    }
    vv?.addEventListener('resize', sync)
    vv?.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    return () => {
      vv?.removeEventListener('resize', sync)
      vv?.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])
  return state
}
