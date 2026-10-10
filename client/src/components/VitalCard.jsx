import LiveChart from './LiveChart.jsx'

// Matches the server's reliability cut-off (quality.min*Confidence in detector.js).
const MIN_CONFIDENCE = 50

const LEVELS = [
  { min: 80, label: 'High', color: '#34d399' },
  { min: MIN_CONFIDENCE, label: 'Moderate', color: '#fbbf24' },
  { min: 0, label: 'Low', color: '#fb7185' },
]

// How far to trust the number above, straight from Presage (0–100).
function Confidence({ value }) {
  const level = value == null ? null : LEVELS.find((l) => value >= l.min)
  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">Confidence</span>
        {level ? (
          <span className="tabular-nums text-slate-300">
            <span style={{ color: level.color }}>{level.label}</span> · {value}%
          </span>
        ) : (
          <span className="text-slate-500">Waiting for signal…</span>
        )}
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width,background-color] duration-700"
          style={{ width: `${value ?? 0}%`, background: level?.color }}
        />
      </div>
    </div>
  )
}

export default function VitalCard({
  label,
  unit,
  value,
  color,
  highlight,
  reliable,
  confidence,
  subscribeTraces,
  waveField,
  rateField,
  waveLabel,
}) {
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
        // Hold back low-confidence numbers.
        <div className="mt-1 flex h-10 items-center text-lg text-slate-400">Measuring…</div>
      )}

      <div className="mt-3 flex justify-between text-xs text-slate-500">
        <span>{waveLabel}</span>
        <span>last 10 s</span>
      </div>
      <LiveChart subscribe={subscribeTraces} field={waveField} color={color} className="mt-1 h-16 w-full" />

      <div className="mt-3 flex justify-between text-xs text-slate-500">
        <span>
          Rate ({unit})
        </span>
        <span>last 60 s</span>
      </div>
      <LiveChart
        subscribe={subscribeTraces}
        field={rateField}
        color={color}
        windowMs={60000}
        minSpan={10}
        minConfidence={MIN_CONFIDENCE}
        className="mt-1 h-10 w-full"
      />

      <Confidence value={confidence} />
    </div>
  )
}
