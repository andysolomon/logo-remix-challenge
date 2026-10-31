/**
 * Holiday skins: a seasonal dress for the whole UI, layered over the light / dark color scheme.
 *
 * A skin is a token swap in `styles.css` under `:root[data-skin="<id>"]` (light) and
 * `:root[data-skin="<id>"][data-theme="dark"]` (dark), plus any decoration keyed off the same attribute.
 * App.tsx sets `data-skin` on <html> from the resolved skin; index.html restores it before first paint.
 *
 * To add a holiday: append it to SKINS with its season window, add the two CSS blocks, and the Settings
 * picker, the calendar-driven `auto` setting and the tests pick it up.
 */
export type SkinId = 'halloween'

/** A calendar day, 1-based month and day. */
export type MonthDay = readonly [month: number, day: number]

export interface Skin {
  id: SkinId
  label: string
  /** Shown under the Settings picker while this skin is chosen by hand. */
  hint: string
  /** Inclusive window during which `auto` dresses the app in this skin. `from` after `to` wraps over New Year. */
  season: { from: MonthDay; to: MonthDay }
}

export const SKINS: readonly Skin[] = [
  {
    id: 'halloween',
    label: 'Halloween',
    hint: 'Pumpkin orange and midnight purple, with a jack-o’-lantern in the header.',
    season: { from: [10, 24], to: [11, 1] },
  },
]

/** The Settings choice: follow the calendar, never, or one skin all year. */
export type SkinSetting = 'auto' | 'off' | SkinId
export const SKIN_SETTINGS: readonly SkinSetting[] = ['auto', 'off', ...SKINS.map((s) => s.id)]
export const SKIN_SETTING_LABEL: Record<SkinSetting, string> = {
  auto: 'Auto',
  off: 'Off',
  ...(Object.fromEntries(SKINS.map((s) => [s.id, s.label])) as Record<SkinId, string>),
}
export const isSkinSetting = (v: unknown): v is SkinSetting => SKIN_SETTINGS.includes(v as SkinSetting)
export const findSkin = (id: string): Skin | undefined => SKINS.find((s) => s.id === id)

const dayOfYear = ([month, day]: MonthDay) => month * 100 + day

/** Whether `date` falls inside the skin's season, including both ends. */
export function skinInSeason(skin: Skin, date: Date): boolean {
  const today = dayOfYear([date.getMonth() + 1, date.getDate()])
  const from = dayOfYear(skin.season.from)
  const to = dayOfYear(skin.season.to)
  return from <= to ? today >= from && today <= to : today >= from || today <= to
}

/** The skin to dress the app in right now, or null for the plain look. */
export function resolveSkin(setting: SkinSetting, date: Date = new Date()): Skin | null {
  if (setting === 'off') return null
  if (setting === 'auto') return SKINS.find((s) => skinInSeason(s, date)) ?? null
  return findSkin(setting) ?? null
}
