import { STATES } from '../lib/contract.js'

const time = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })

export default function Timeline({ events }) {
  const items = [...events].reverse().slice(0, 12)
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-3 text-sm text-slate-400">Session log</div>
      {items.length === 0 && <div className="text-sm text-slate-500">Nothing yet.</div>}
      <ul className="space-y-2.5">
        {items.map((e, i) => {
          const color = STATES[e.state]?.color
          return (
            <li key={`${e.t}-${i}`} className="flex gap-3 text-sm">
              <span className="w-20 shrink-0 tabular-nums text-slate-500">{time(e.t)}</span>
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
              {e.kind === 'nudge' ? (
                <span className="text-slate-300 italic">“{e.text}”</span>
              ) : (
                <span style={{ color }}>{STATES[e.state]?.label}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
