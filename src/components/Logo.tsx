import { PERMS, type Team } from '../lib/teams'

interface Props {
  team: Team
  palette?: readonly string[]
  perm?: number
}

/** Procedural SVG logo: `team`'s shape/deco/abbr rendered in `palette` at permutation `perm`. */
export function Logo({ team, palette, perm = 0 }: Props) {
  const pal = palette ?? team.palette
  const p = PERMS[perm % 6]
  const a = pal[p[0]]
  const b = pal[p[1]]
  const c = pal[p[2]]
  const sw = { fill: a, stroke: c, strokeWidth: 3 }
  const fs = team.abbr.length >= 3 ? 24 : team.abbr.length === 2 ? 32 : 40
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" className="logo" aria-hidden="true">
      {team.shape === 'shield' && <path d="M50 5 L87 18 V50 C87 72 70 87 50 95 C30 87 13 72 13 50 V18 Z" {...sw} />}
      {team.shape === 'circle' && <circle cx={50} cy={50} r={44} {...sw} />}
      {team.shape === 'hex' && <polygon points="50,4 90,26 90,74 50,96 10,74 10,26" {...sw} />}
      {team.shape === 'diamond' && <polygon points="50,5 95,50 50,95 5,50" {...sw} />}
      {team.shape === 'square' && <rect x={9} y={9} width={82} height={82} rx={18} {...sw} />}
      {team.shape === 'pennant' && <polygon points="15,7 85,7 85,60 50,93 15,60" {...sw} />}
      {team.deco === 'stripe' && <rect x={27} y={66} width={46} height={6} rx={3} fill={c} />}
      {team.deco === 'star' && <polygon points="50,14 55,23 50,32 45,23" fill={c} />}
      {team.deco === 'dots' && (
        <g fill={c}>
          <circle cx={38} cy={77} r={3.4} />
          <circle cx={50} cy={77} r={3.4} />
          <circle cx={62} cy={77} r={3.4} />
        </g>
      )}
      <text
        x={50}
        y={59}
        textAnchor="middle"
        fontFamily="'Chakra Petch',sans-serif"
        fontWeight={700}
        fontSize={fs}
        letterSpacing={1}
        fill={b}
      >
        {team.abbr}
      </text>
    </svg>
  )
}
