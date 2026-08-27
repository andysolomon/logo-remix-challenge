import { useEffect, useState } from 'react'

const isPortraitNow = () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth

/** portrait = innerHeight > innerWidth, tracked on resize. */
export function useIsPortrait(): boolean {
  const [portrait, setPortrait] = useState(isPortraitNow)
  useEffect(() => {
    const onRz = () => setPortrait(isPortraitNow())
    window.addEventListener('resize', onRz)
    window.addEventListener('orientationchange', onRz)
    return () => {
      window.removeEventListener('resize', onRz)
      window.removeEventListener('orientationchange', onRz)
    }
  }, [])
  return portrait
}
