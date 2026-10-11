import { STATES } from '../lib/contract.js'

const time = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })

export default function Timeline({ events }) {
  const items = [...events].reverse().slice(0, 12)
  return (
    <div className="glass rounded-[28px] p-5">
      <div className="mb-4 text-sm text-ink-soft">Session log</div>
      {items.length === 0 && <div className="font-display text-sm italic text-ink-faint">Nothing yet. Stay in the zone.</div>}
      <ul className="relative space-y-3 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-px before:bg-ink/10">
        {items.map((e, i) => {
          const color = STATES[e.state]?.color
          return (
            <li key={`${e.t}-${i}`} className="relative flex gap-3 pl-6 text-sm">
              <span
                className="absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-[#fbf7f0]"
                style={{ background: color }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] tabular-nums text-ink-faint">{time(e.t)}</div>
                {e.kind === 'nudge' ? (
                  <div className="mt-1 rounded-2xl rounded-tl-sm border border-ink/[0.06] bg-white/70 px-3 py-2 font-display italic leading-snug text-ink">
                    “{e.text}”
                  </div>
                ) : (
                  <div className="font-medium" style={{ color }}>
                    {STATES[e.state]?.label}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
