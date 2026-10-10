import { STATES } from '../lib/contract.js'

export default function StatusOrb({ state, reasons, confidence }) {
  const info = STATES[state] ?? STATES.calibrating
  const alert = state === 'unfocused' || state === 'overStressed'

  return (
    <div className="flex items-center gap-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <div className="relative h-20 w-20 shrink-0">
        {alert && <div className="absolute inset-0 rounded-full animate-ripple" style={{ background: info.color }} />}
        <div
          className="absolute inset-0 rounded-full animate-breathe transition-colors duration-700"
          style={{ background: info.color, boxShadow: `0 0 50px -5px ${info.color}` }}
        />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-3xl font-semibold" style={{ color: info.color }}>
            {info.label}
          </span>
          {confidence != null && (
            <span className="text-sm tabular-nums text-slate-400">{Math.round(confidence * 100)}% confident</span>
          )}
        </div>
        <div className="mt-1 text-slate-400">{info.blurb}</div>
        {reasons.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-sm text-slate-300/80">
            {reasons.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
