import { useEffect, useState } from 'react'

const QUERY = '(prefers-color-scheme: dark)'
const prefersDarkNow = () => typeof window !== 'undefined' && !!window.matchMedia?.(QUERY).matches

/** OS-level dark preference, tracked live so `system` theme follows a switch without reload. */
export function usePrefersDark(): boolean {
  const [dark, setDark] = useState(prefersDarkNow)
  useEffect(() => {
    const mq = window.matchMedia?.(QUERY)
    if (!mq) return
    const onChange = () => setDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return dark
}
