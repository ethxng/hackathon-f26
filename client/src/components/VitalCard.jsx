export const WINDOW_MS = 60_000 // graph shows the last minute
const SMOOTH_MS = 5_000 // value = median of reliable readings in the last 5s
const LIVE_MS = 2_500 // a reading this recent counts as live
const HOLD_MS = 10_000 // keep showing the last good value this long, dimmed
const GAP_MS = 2_500 // break the graph line across gaps longer than this

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// Each point is the median of reliable readings in the trailing SMOOTH_MS, or
// null where the reading itself wasn't reliable (drawn as a gap).
function smoothSeries(history, field, reliableField) {
  return history.map((m, i) => {
    if (!m[reliableField] || m[field] == null) return { t: m.t, v: null }
    const recent = []
    for (let j = i; j >= 0 && m.t - history[j].t < SMOOTH_MS; j--) {
      if (history[j][reliableField] && history[j][field] != null) recent.push(history[j][field])
    }
    return { t: m.t, v: median(recent) }
  })
}

// `range` = fixed [min, max]; otherwise auto-scales with at least `minSpan`.
export function Sparkline({ points, color, now, minSpan = 1, range }) {
  const vals = points.filter((p) => p.v != null).map((p) => p.v)
  if (vals.length < 2) return <div className="mt-2 h-12 rounded-lg border border-dashed border-white/5" />

  // Keep a minimum vertical range so a ±1 wobble doesn't fill the whole height.
  let [min, max] = range ?? [Math.min(...vals), Math.max(...vals)]
  if (!range && max - min < minSpan) {
    const mid = (max + min) / 2
    min = mid - minSpan / 2
    max = mid + minSpan / 2
  }
  const w = 200
  const h = 48
  const x = (t) => ((t - (now - WINDOW_MS)) / WINDOW_MS) * w
  const y = (v) => h - 3 - ((v - min) / (max - min)) * (h - 6)

  // Split into segments at missing readings and time gaps.
  const segments = []
  let seg = []
  let prevT = null
  for (const p of points) {
    if (p.v == null || (prevT != null && p.t - prevT > GAP_MS)) {
      if (seg.length) segments.push(seg)
      seg = []
    }
    if (p.v != null) seg.push(`${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`)
    prevT = p.t
  }
  if (seg.length) segments.push(seg)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-2 h-12 w-full">
      {segments.map((s, i) =>
        s.length === 1 ? (
          <circle key={i} cx={s[0].split(',')[0]} cy={s[0].split(',')[1]} r="1.5" fill={color} />
        ) : (
          <polyline
            key={i}
            points={s.join(' ')}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )
      )}
    </svg>
  )
}

export default function VitalCard({ label, unit, color, history, field, highlight, minSpan, waitingHint }) {
  const reliableField = `${field}Reliable`
  const confidenceField = `${field}Confidence`
  const now = history.at(-1)?.t ?? 0
  const points = smoothSeries(history, field, reliableField).filter((p) => p.t > now - WINDOW_MS)
  const lastGood = points.findLast((p) => p.v != null)
  const age = lastGood ? now - lastGood.t : Infinity
  const status = age <= LIVE_MS ? 'live' : age <= HOLD_MS ? 'stale' : 'none'
  const latest = history.at(-1)
  const confidence = latest?.[confidenceField]
  const hasRawReading = latest?.[field] != null

  return (
    <div
      className={`rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition ${highlight ? 'animate-flash' : ''}`}
      style={{ '--flash-color': color }}
    >
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>{label}</span>
        {status === 'stale' && <span className="text-xs text-slate-500">last reading</span>}
      </div>

      {status !== 'none' ? (
        <div className={`mt-1 flex items-baseline gap-1.5 transition-opacity ${status === 'stale' ? 'opacity-50' : ''}`}>
          <span className="text-4xl font-semibold tabular-nums">{Math.round(lastGood.v)}</span>
          <span className="text-slate-500">{unit}</span>
        </div>
      ) : (
        // No trustworthy reading recently: say why instead of showing a number.
        <div className="mt-1 flex min-h-10 flex-col justify-center">
          <span className="text-lg text-slate-400">Measuring…</span>
          <span className="text-xs text-slate-500">
            {hasRawReading
              ? `Warming up · ${confidence ?? 0}% confidence`
              : waitingHint
                ? `Waiting for a reading — ${waitingHint}`
                : 'Waiting for a reading — sit still, facing the camera'}
          </span>
        </div>
      )}

      <Sparkline points={points} color={color} now={now} minSpan={minSpan} />
    </div>
  )
}
