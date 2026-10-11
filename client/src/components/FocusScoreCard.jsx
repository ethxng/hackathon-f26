import { Sparkline, WINDOW_MS } from './VitalCard.jsx'
import RingGauge from './RingGauge.jsx'

const PENALTY_DROP = 5 // a drop this big between samples is a drift penalty
const PENALTY_SHOW_MS = 3_000 // how long the "−10" chip stays up

const bandColor = (score) => (score >= 70 ? '#3f9a6b' : score >= 40 ? '#d58a1e' : '#d1495b')

function TrendChip({ state, penalty }) {
  const base = 'rounded-full px-2.5 py-1 text-xs font-semibold'
  if (penalty) return <span className={`${base} bg-[#d1495b]/12 text-[#b23a4b]`}>▼ −{penalty}</span>
  if (state === 'focused') return <span className={`${base} bg-[#3f9a6b]/12 text-[#2f7d55]`}>▲ climbing</span>
  if (state === 'unfocused') return <span className={`${base} bg-[#d58a1e]/12 text-[#a8650f]`}>▼ dropping</span>
  return <span className={`${base} bg-ink/5 font-medium text-ink-faint`}>paused</span>
}

// Session focus score (0–100) from the server: up while in the zone, down on drifts.
export default function FocusScoreCard({ history, state }) {
  const points = history.filter((m) => m.focusScore != null).map((m) => ({ t: m.t, v: m.focusScore }))
  const now = history.at(-1)?.t ?? 0
  const recent = points.filter((p) => p.t > now - WINDOW_MS)
  const score = points.at(-1)?.v

  // Most recent big drop, shown for a few seconds.
  let penalty = null
  for (let i = points.length - 1; i > 0 && now - points[i].t <= PENALTY_SHOW_MS; i--) {
    const drop = points[i - 1].v - points[i].v
    if (drop >= PENALTY_DROP) {
      penalty = Math.round(drop)
      break
    }
  }

  const color = score == null ? '#b8ad9c' : bandColor(score)

  return (
    <div className="glass rounded-[28px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-ink-soft">Focus score</div>
          <div className="mt-3">{score != null && <TrendChip state={state} penalty={penalty} />}</div>
        </div>
        <RingGauge value={score} max={100} size={92} stroke={8} color={color}>
          <span className="font-display text-3xl font-semibold leading-none tabular-nums transition-colors duration-500" style={{ color }}>
            {score ?? '—'}
          </span>
          <span className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-ink-faint">of 100</span>
        </RingGauge>
      </div>

      <Sparkline points={recent} color={color} now={now} range={[0, 100]} />
    </div>
  )
}
