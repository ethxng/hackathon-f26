import { STATES } from '../lib/contract.js'

export default function StatusOrb({ state, reasons, confidence }) {
  const info = STATES[state] ?? STATES.calibrating
  const alert = state === 'unfocused' || state === 'overStressed'

  return (
    <div className="glass flex items-center gap-6 rounded-[28px] p-6">
      <div className="relative h-20 w-20 shrink-0">
        {alert && <div className="absolute inset-0 rounded-full animate-ripple" style={{ background: info.color }} />}
        <div className="absolute -inset-2 rounded-full border border-ink/10" />
        <div
          className="absolute inset-0 rounded-full animate-breathe transition-colors duration-700"
          style={{
            background: `radial-gradient(circle at 35% 30%, #ffffff, ${info.color} 55%, ${info.color})`,
            boxShadow: `0 14px 36px -10px ${info.color}`,
          }}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-display text-3xl font-semibold tracking-tight transition-colors duration-700" style={{ color: info.color }}>
            {info.label}
          </span>
          {confidence != null && (
            <span className="flex items-center gap-2 text-xs text-ink-soft">
              <span className="h-1 w-16 overflow-hidden rounded-full bg-ink/10">
                <span
                  className="block h-full rounded-full transition-[width] duration-700"
                  style={{ width: `${Math.round(confidence * 100)}%`, background: info.color }}
                />
              </span>
              <span className="tabular-nums">{Math.round(confidence * 100)}% sure</span>
            </span>
          )}
        </div>
        <div className="mt-1 text-ink-soft">{info.blurb}</div>
        {reasons.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {reasons.map((r) => (
              <span key={r} className="rounded-full border border-ink/10 bg-white/70 px-3 py-1 text-xs text-ink-soft">
                {r}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
