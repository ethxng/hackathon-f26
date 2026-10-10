import { useEffect, useState } from 'react'

const SCENARIOS = [
  { key: '1', id: 'focused', label: 'Focused' },
  { key: '2', id: 'unfocused', label: 'Unfocused' },
  { key: '3', id: 'overStressed', label: 'Stressed' },
]

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
    <div className="fixed right-4 top-20 z-40 rounded-2xl border border-white/10 bg-[#12151c]/95 p-3 text-sm shadow-xl backdrop-blur">
      <div className="mb-2 px-1 text-xs uppercase tracking-widest text-slate-500">Demo</div>
      <div className="flex flex-col gap-1.5">
        {SCENARIOS.map((s) => (
          <button key={s.id} onClick={() => demo.current?.setScenario(s.id)} className="rounded-lg px-3 py-1.5 text-left hover:bg-white/10">
            <kbd className="mr-2 text-slate-500">{s.key}</kbd>
            {s.label}
          </button>
        ))}
        <button onClick={() => demo.current?.fireNudge()} className="rounded-lg px-3 py-1.5 text-left hover:bg-white/10">
          <kbd className="mr-2 text-slate-500">N</kbd>
          Fire nudge
        </button>
      </div>
    </div>
  )
}
