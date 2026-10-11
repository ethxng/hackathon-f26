import { useEffect, useState } from 'react'

const SCENARIOS = [
  { key: '1', id: 'focused', label: 'Focused' },
  { key: '2', id: 'unfocused', label: 'Unfocused' },
  { key: '3', id: 'overStressed', label: 'Stressed' },
]

function Key({ children }) {
  return (
    <kbd className="mr-3 inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-ink/15 bg-white px-1.5 font-sans text-xs text-ink-soft shadow-[inset_0_-2px_0_rgba(90,60,20,0.08)]">
      {children}
    </kbd>
  )
}

// Mock-mode only. Hotkeys always work; press ` to show the panel.
export default function DemoControls({ demo }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return
      const s = SCENARIOS.find((x) => x.key === e.key)
      if (s) demo.current?.setScenario(s.id)
      else if (e.key.toLowerCase() === 'n') demo.current?.fireNudge()
      else if (e.key === '`') setOpen((o) => !o)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [demo])

  if (!open) return null
  return (
    <div className="glass fixed right-4 top-24 z-40 rounded-2xl p-3 text-sm text-ink">
      <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint">Demo</div>
      <div className="flex flex-col gap-1">
        {SCENARIOS.map((s) => (
          <button key={s.id} onClick={() => demo.current?.setScenario(s.id)} className="flex items-center rounded-xl px-2 py-1.5 text-left transition hover:bg-white/70">
            <Key>{s.key}</Key>
            {s.label}
          </button>
        ))}
        <button onClick={() => demo.current?.fireNudge()} className="flex items-center rounded-xl px-2 py-1.5 text-left transition hover:bg-white/70">
          <Key>N</Key>
          Fire nudge
        </button>
      </div>
    </div>
  )
}
