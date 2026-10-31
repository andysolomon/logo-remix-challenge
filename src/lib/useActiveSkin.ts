import { useEffect, useState } from 'react'
import { resolveSkin, type Skin, type SkinSetting } from './skins'

const HOUR = 60 * 60 * 1000

/** The skin in force for a Settings choice, re-checked hourly so `auto` flips over at midnight without a reload. */
export function useActiveSkin(setting: SkinSetting): Skin | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), HOUR)
    return () => window.clearInterval(id)
  }, [])
  return resolveSkin(setting, new Date(now))
}
