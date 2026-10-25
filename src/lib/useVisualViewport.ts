import { useEffect } from 'react'

/** The keyboard counts as up once the visible area is at least this much shorter than the tallest seen at this width. */
const KEYBOARD_MIN_PX = 120

const TEXT_INPUT = /^(text|search|email|tel|url|password|number)$/

/** A text field has focus on a touch screen, where that means an on-screen keyboard. */
function typingOnTouch(): boolean {
  if (typeof window.matchMedia !== 'function' || !window.matchMedia('(pointer: coarse)').matches) return false
  const el = document.activeElement
  if (el instanceof HTMLTextAreaElement) return !el.readOnly
  return el instanceof HTMLInputElement && TEXT_INPUT.test(el.type) && !el.readOnly
}

/**
 * Keeps the app shell the size of what is actually visible. A phone keyboard does not shrink
 * `100dvh` (iOS Safari, Chrome ≥108): the browser instead scrolls the page to show the focused
 * field, which pushes the top of the screen — the logo in Play — out of view. Publishing the
 * visual viewport height as `--vvh` lets `.app` shrink to fit, so the flex column re-lays out
 * above the keyboard with the logo still in it; `html.kb-open` compacts the question layout to
 * make room. Pinch-zoom also shrinks the visual viewport and is left alone.
 *
 * The keyboard is measured against the tallest view seen at the current width, not against
 * `innerHeight`: iOS 26 Safari shrinks the layout viewport along with the visual one, so the two
 * stay equal with the keyboard up. A rotation changes the width and starts the measure over.
 * On a touch screen a focused text field counts too, so the logo keeps its room even if a
 * browser resizes in some way this measure misses.
 */
export function useVisualViewport(): void {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    let width = 0
    let tallest = 0
    const apply = () => {
      if (vv.scale > 1.01) return
      const h = Math.round(vv.height)
      if (window.innerWidth !== width) {
        width = window.innerWidth
        tallest = 0
      }
      tallest = Math.max(tallest, window.innerHeight, h)
      root.style.setProperty('--vvh', `${h}px`)
      root.classList.toggle('kb-open', tallest - h >= KEYBOARD_MIN_PX || typingOnTouch())
      // The browser scrolled the page to reveal the field; now that the shell fits, pull it back to the top.
      if (vv.offsetTop > 0 || window.scrollY > 0) window.scrollTo(0, 0)
    }
    // focusout fires before focus lands on the next field; check once it has settled.
    let soon: number | undefined
    const applySoon = () => {
      window.clearTimeout(soon)
      soon = window.setTimeout(apply, 0)
    }
    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    document.addEventListener('focusin', apply)
    document.addEventListener('focusout', applySoon)
    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
      document.removeEventListener('focusin', apply)
      document.removeEventListener('focusout', applySoon)
      window.clearTimeout(soon)
      root.style.removeProperty('--vvh')
      root.classList.remove('kb-open')
    }
  }, [])
}
