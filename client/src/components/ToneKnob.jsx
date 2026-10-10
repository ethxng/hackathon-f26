import { useRef } from 'react'
import { TONES } from '../lib/contract.js'

// Three detents, in degrees clockwise from 12 o'clock, matching TONES order.
const ANGLES = [-60, 0, 60]
const SIZE = 260
const C = SIZE / 2
const TRACK_R = 74
const KNOB_R = 56
const LABEL_R = 104

const polar = (deg, r) => {
  const a = ((deg - 90) * Math.PI) / 180
  return [C + r * Math.cos(a), C + r * Math.sin(a)]
}
const arc = (from, to, r) => {
  const [x1, y1] = polar(from, r)
  const [x2, y2] = polar(to, r)
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
}

// Rotary 3-position tone selector: click a label, click/drag the dial, or use arrow keys.
export default function ToneKnob({ value, onChange }) {
  const svgRef = useRef(null)
  const dragging = useRef(false)
  const index = Math.max(0, TONES.findIndex((t) => t.id === value))
  const tone = TONES[index]
  const angle = ANGLES[index]

  const select = (i) => onChange(TONES[Math.min(TONES.length - 1, Math.max(0, i))].id)

  // Snap the pointer's angle around the dial center to the nearest detent.
  const selectFromPointer = (e) => {
    const rect = svgRef.current.getBoundingClientRect()
    const dx = e.clientX - (rect.left + rect.width / 2)
    const dy = e.clientY - (rect.top + rect.height / 2)
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI
    let nearest = 0
    ANGLES.forEach((a, i) => {
      if (Math.abs(a - deg) < Math.abs(ANGLES[nearest] - deg)) nearest = i
    })
    select(nearest)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') select(index - 1)
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') select(index + 1)
    else return
    e.preventDefault()
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Tone"
      aria-valuemin={0}
      aria-valuemax={TONES.length - 1}
      aria-valuenow={index}
      aria-valuetext={tone.label}
      onKeyDown={onKeyDown}
      className="relative mx-auto select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      style={{ width: SIZE, height: SIZE * 0.82 }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        className="absolute left-0 top-0 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={(e) => {
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          selectFromPointer(e)
        }}
        onPointerMove={(e) => dragging.current && selectFromPointer(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <defs>
          <radialGradient id="knob-face" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#2a2f3d" />
            <stop offset="100%" stopColor="#12151c" />
          </radialGradient>
        </defs>

        {/* Track, filled up to the current detent */}
        <path d={arc(ANGLES[0], ANGLES.at(-1), TRACK_R)} stroke="rgba(255,255,255,0.1)" strokeWidth="6" fill="none" strokeLinecap="round" />
        {index > 0 && (
          <path d={arc(ANGLES[0], angle, TRACK_R)} stroke={tone.color} strokeWidth="6" fill="none" strokeLinecap="round" className="transition-all duration-300" />
        )}
        {ANGLES.map((a, i) => {
          const [x, y] = polar(a, TRACK_R)
          return <circle key={a} cx={x} cy={y} r={i <= index ? 5 : 4} fill={i <= index ? tone.color : '#3b4150'} className="transition-all duration-300" />
        })}

        {/* Dial */}
        <circle cx={C} cy={C} r={KNOB_R + 6} fill="none" stroke={tone.color} strokeOpacity="0.25" strokeWidth="2" className="transition-colors duration-300" />
        <circle
          cx={C}
          cy={C}
          r={KNOB_R}
          fill="url(#knob-face)"
          stroke="rgba(255,255,255,0.12)"
          style={{ filter: `drop-shadow(0 0 18px ${tone.color}55)`, transition: 'filter 300ms' }}
        />
        <g
          style={{
            transform: `rotate(${angle}deg)`,
            transformOrigin: `${C}px ${C}px`,
            transformBox: 'view-box',
            transition: 'transform 350ms cubic-bezier(0.3, 1.4, 0.5, 1)',
          }}
        >
          <line x1={C} y1={C - 18} x2={C} y2={C - KNOB_R + 10} stroke={tone.color} strokeWidth="5" strokeLinecap="round" />
        </g>
        <circle cx={C} cy={C} r="6" fill="#0b0d12" stroke="rgba(255,255,255,0.15)" />
      </svg>

      {TONES.map((t, i) => {
        const [x, y] = polar(ANGLES[i], LABEL_R)
        const selected = i === index
        return (
          <button
            key={t.id}
            type="button"
            tabIndex={-1}
            onClick={() => select(i)}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-sm font-semibold transition ${
              selected ? '' : 'text-slate-500 hover:text-slate-300'
            }`}
            style={{ left: x, top: y, color: selected ? t.color : undefined }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
