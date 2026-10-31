/**
 * A stage of decorative sprites for holiday skins: empty boxes a skin may dress and animate from CSS
 * under `:root[data-skin="<id>"] .skin-stage .sprite.sN` (bats and ghosts for Halloween, snow for Christmas…).
 * Hidden unless a skin styles it, invisible to assistive tech, and never in the way of a tap.
 */
export const SPRITE_COUNT = 8

export function SkinStage() {
  return (
    <div className="skin-stage" aria-hidden="true">
      {Array.from({ length: SPRITE_COUNT }, (_, i) => (
        <i key={i} className={`sprite s${i + 1}`} />
      ))}
    </div>
  )
}
