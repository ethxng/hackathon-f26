import { useId } from 'react'

const TILT = -22 // ring tilt, degrees
const CRATERS = [
  { cx: 20.2, cy: 19.2, r: 1.3 },
  { cx: 27.4, cy: 21.6, r: 0.9 },
  { cx: 22.6, cy: 28.2, r: 1.1 },
  { cx: 28.6, cy: 17.4, r: 0.7 },
  { cx: 17.6, cy: 25.2, r: 0.6 },
]

// Focus Up mark: a turquoise (#30D5C8) Saturn with tilted rings and a few small craters.
// The ring's far half is drawn behind the planet and its near half in front.
export default function Logo({ size = 36 }) {
  const id = useId().replace(/:/g, '')
  const ring = `rotate(${TILT} 24 24)`

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-label="Focus Up logo" role="img">
      <defs>
        <radialGradient id={`planet-${id}`} cx="36%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#c4f7f2" />
          <stop offset="40%" stopColor="#30D5C8" />
          <stop offset="78%" stopColor="#1fa89d" />
          <stop offset="100%" stopColor="#127068" />
        </radialGradient>
        <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1fa89d" />
          <stop offset="50%" stopColor="#8fe9e0" />
          <stop offset="100%" stopColor="#168a81" />
        </linearGradient>
        <clipPath id={`clip-${id}`}>
          <circle cx="24" cy="24" r="11" />
        </clipPath>
      </defs>

      {/* Far half of the rings (behind the planet) */}
      <g transform={ring} stroke={`url(#ring-${id})`} strokeLinecap="round">
        <path d="M4 24 A20 6 0 0 1 44 24" strokeWidth="2.6" />
        <path d="M9 24 A15 4.4 0 0 1 39 24" strokeWidth="1" strokeOpacity="0.7" />
      </g>

      {/* Planet */}
      <circle cx="24" cy="24" r="11" fill={`url(#planet-${id})`} style={{ filter: 'drop-shadow(0 3px 6px rgba(31,168,157,0.35))' }} />
      <g clipPath={`url(#clip-${id})`}>
        {/* Faint bands along the ring plane */}
        <g transform={ring} fill="#effffd">
          <ellipse cx="24" cy="19.5" rx="14" ry="1.1" opacity="0.22" />
          <ellipse cx="24" cy="27.5" rx="14" ry="1.4" opacity="0.15" />
        </g>
        {/* Craters: a dark pit with a light lower rim */}
        {CRATERS.map((c, i) => (
          <g key={i}>
            <circle cx={c.cx} cy={c.cy + c.r * 0.25} r={c.r} fill="#d6fbf7" opacity="0.4" />
            <circle cx={c.cx} cy={c.cy} r={c.r} fill="#0d5751" opacity="0.55" />
          </g>
        ))}
      </g>

      {/* Near half of the rings (in front of the planet) */}
      <g transform={ring} stroke={`url(#ring-${id})`} strokeLinecap="round">
        <path d="M44 24 A20 6 0 0 1 4 24" strokeWidth="2.6" />
        <path d="M39 24 A15 4.4 0 0 1 9 24" strokeWidth="1" strokeOpacity="0.7" />
      </g>
    </svg>
  )
}
