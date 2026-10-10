import TraceChart from './TraceChart.jsx'

// `charts` is a list of TraceChart props ({ series, title, unit, windowSec }) drawn under the number.
export default function VitalCard({ label, unit, value, color, highlight, reliable, confidence, subscribeTraces, charts }) {
  return (
    <div
      className={`rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition ${highlight ? 'animate-flash' : ''}`}
      style={{ '--flash-color': color }}
    >
      <div className="text-sm text-slate-400">{label}</div>
      {reliable ? (
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-4xl font-semibold tabular-nums">{Math.round(value)}</span>
          <span className="text-slate-500">{unit}</span>
        </div>
      ) : (
        // Hold back low-confidence numbers; show how close the reading is to trustworthy.
        <div className="mt-1 flex h-10 flex-col justify-center gap-1.5">
          <span className="text-lg text-slate-400">Measuring…</span>
          <div className="flex items-center gap-2">
            <div className="h-1 w-24 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{ width: `${confidence ?? 0}%`, background: color }}
              />
            </div>
            <span className="text-xs tabular-nums text-slate-500">{confidence ?? 0}%</span>
          </div>
        </div>
      )}
      {charts.map((c) => (
        <TraceChart key={c.series} subscribeTraces={subscribeTraces} color={color} {...c} />
      ))}
    </div>
  )
}
