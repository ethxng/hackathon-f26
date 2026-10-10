import { Sparkline, WINDOW_MS } from './VitalCard.jsx'

const PENALTY_DROP = 5 // a drop this big between samples is a drift penalty
const PENALTY_SHOW_MS = 3_000 // how long the "−10" chip stays up

const bandColor = (score) => (score >= 70 ? '#34d399' : score >= 40 ? '#fbbf24' : '#fb7185')

function TrendChip({ state, penalty }) {
  if (penalty) {
    return <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-300">▼ −{penalty}</span>
  }
  if (state === 'focused') return <span className="text-xs font-medium text-emerald-300">▲ climbing</span>
  if (state === 'unfocused') return <span className="text-xs font-medium text-amber-300">▼ dropping</span>
  return <span className="text-xs text-slate-500">paused</span>
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

  const color = score == null ? '#64748b' : bandColor(score)

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>Focus score</span>
        {score != null && <TrendChip state={state} penalty={penalty} />}
      </div>

      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-4xl font-semibold tabular-nums transition-colors duration-500" style={{ color }}>
          {score ?? '—'}
        </span>
        <span className="text-slate-500">/100</span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width,background-color] duration-700"
          style={{ width: `${score ?? 0}%`, background: color }}
        />
      </div>

      <Sparkline points={recent} color={color} now={now} range={[0, 100]} />
    </div>
  )
}
