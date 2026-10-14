import { useEffect } from 'react'

/** The keyboard counts as up once the visible area has lost at least this much of the window height. */
const KEYBOARD_MIN_PX = 120

/**
 * Keeps the app shell the size of what is actually visible. A phone keyboard does not shrink
 * `100dvh` (iOS Safari, Chrome ≥108): the browser instead scrolls the page to show the focused
 * field, which pushes the top of the screen — the logo in Play — out of view. Publishing the
 * visual viewport height as `--vvh` lets `.app` shrink to fit, so the flex column re-lays out
 * above the keyboard with the logo still in it; `html.kb-open` compacts the question layout to
 * make room. Pinch-zoom also shrinks the visual viewport and is left alone.
 */
export function useVisualViewport(): void {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    const apply = () => {
      if (vv.scale > 1.01) return
      const h = Math.round(vv.height)
      root.style.setProperty('--vvh', `${h}px`)
      root.classList.toggle('kb-open', window.innerHeight - h >= KEYBOARD_MIN_PX)
      // The browser scrolled the page to reveal the field; now that the shell fits, pull it back to the top.
      if (vv.offsetTop > 0 || window.scrollY > 0) window.scrollTo(0, 0)
    }
    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
      root.style.removeProperty('--vvh')
      root.classList.remove('kb-open')
    }
  }, [])
}
