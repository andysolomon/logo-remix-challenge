import { findTeam, fullName, jerseyColors, seasonLabel, type Player } from '../lib/teams'

/** NBA tank top: scoop neck, deep armholes. */
const TANK = {
  body: 'M50 8 L70 8 Q100 60 130 8 L150 8 C152 48 162 72 180 80 L180 206 Q100 214 20 206 L20 80 C38 72 48 48 50 8 Z',
  trim: ['M70 8 Q100 60 130 8', 'M150 8 C152 48 162 72 180 80', 'M50 8 C48 48 38 72 20 80'],
  patch: { cx: 100, cy: 64, r: 17 },
  numberY: 142,
}

/** NFL jersey: wide shoulders and short sleeves with cuff stripes. */
const FOOTBALL = {
  body: 'M72 10 Q100 34 128 10 L162 18 L196 52 L180 94 L162 86 L162 206 L38 206 L38 86 L20 94 L4 52 L38 18 Z',
  trim: ['M72 10 Q100 34 128 10', 'M185 42 L171 89', 'M15 42 L29 89'],
  patch: { cx: 100, cy: 52, r: 14 },
  numberY: 136,
}

/**
 * A jersey in its team's colors with the player's number, a team-logo patch and a season tag. It names the
 * team and season, never the player: those are the clues a "Who wore it?" round gives away on purpose.
 */
export function Jersey({ player }: { player: Player }) {
  const team = findTeam(player.team)!
  const { body, number, trim } = jerseyColors(team)
  const shape = player.league === 'NBA' ? TANK : FOOTBALL
  const season = seasonLabel(player)
  const { cx, cy, r } = shape.patch
  return (
    <svg className="jersey-art" viewBox="0 0 200 220" role="img" aria-label={`Jersey number ${player.number}, ${fullName(team)}, ${season} season`}>
      <path d={shape.body} fill={body} stroke={trim} strokeWidth={3} strokeLinejoin="round" />
      {shape.trim.map((d) => (
        <path key={d} d={d} fill="none" stroke={trim} strokeWidth={7} strokeLinecap="round" />
      ))}
      <circle cx={cx} cy={cy} r={r} fill="#FFFFFF" stroke={trim} strokeWidth={2.5} />
      <image href={team.logo} x={cx - r * 0.72} y={cy - r * 0.72} width={r * 1.44} height={r * 1.44} preserveAspectRatio="xMidYMid meet" />
      <text
        x={100}
        y={shape.numberY}
        textAnchor="middle"
        dominantBaseline="central"
        fill={number}
        stroke={trim}
        strokeWidth={3}
        paintOrder="stroke"
        fontFamily="'Chakra Petch', sans-serif"
        fontWeight={700}
        fontSize={player.number.length > 1 ? 82 : 92}
      >
        {player.number}
      </text>
      <rect x={128} y={180} width={42} height={16} rx={2} fill="#FFFFFF" stroke={trim} strokeWidth={1.5} />
      <text x={149} y={188.5} textAnchor="middle" dominantBaseline="central" fill="#1A1714" fontFamily="'Space Grotesk', sans-serif" fontWeight={700} fontSize={season.length > 4 ? 8.5 : 10}>
        {season}
      </text>
    </svg>
  )
}
