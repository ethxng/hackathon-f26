import { useState } from 'react'
import { GENDERS, speechSettings, toneOf } from '../lib/contract.js'
import ToneKnob from './ToneKnob.jsx'

const LENGTHS = [25, 45, 60]

export default function SetupScreen({ onStart }) {
  const [gender, setGender] = useState(GENDERS[0].id)
  const [tone, setTone] = useState('chill')
  const [goalMinutes, setGoalMinutes] = useState(25)
  const toneInfo = toneOf(tone)

  const preview = () => {
    window.speechSynthesis?.cancel()
    const u = new SpeechSynthesisUtterance(toneInfo.sample)
    Object.assign(u, speechSettings({ gender, tone }))
    window.speechSynthesis?.speak(u)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-3xl">
        <div className="mb-12 text-center">
          <div className="mx-auto mb-6 h-14 w-14 rounded-full bg-emerald-400/90 animate-breathe shadow-[0_0_60px_-10px] shadow-emerald-400" />
          <h1 className="font-display text-5xl font-semibold tracking-tight">Focus Up</h1>
          <p className="mt-3 text-slate-400 text-lg">
            Your camera reads your heart rate, breathing, and attention. When you drift or stress out, a voice brings you back.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-slate-500">Voice</h2>
            <div className="flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
              {GENDERS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGender(g.id)}
                  aria-pressed={g.id === gender}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
                    g.id === gender ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-slate-500">Tone</h2>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 pb-5 pt-2">
              <ToneKnob value={tone} onChange={setTone} />
              <div className="text-center">
                <div className="text-sm text-slate-400">{toneInfo.blurb}</div>
                <div className="mt-2 text-sm italic text-slate-300/80">“{toneInfo.sample}”</div>
                <button
                  onClick={preview}
                  className="mt-4 rounded-full border border-white/15 px-4 py-1.5 text-xs text-slate-300 hover:bg-white/10"
                >
                  ▶ Preview
                </button>
              </div>
            </div>
          </section>
        </div>

        <h2 className="mt-10 mb-3 text-sm font-medium uppercase tracking-widest text-slate-500">Session length</h2>
        <div className="flex gap-3">
          {LENGTHS.map((m) => (
            <button
              key={m}
              onClick={() => setGoalMinutes(m)}
              className={`rounded-xl border px-5 py-2.5 text-sm font-medium transition ${
                m === goalMinutes ? 'border-emerald-400/70 bg-emerald-400/10' : 'border-white/10 hover:border-white/25'
              }`}
            >
              {m} min
            </button>
          ))}
        </div>

        <button
          onClick={() => onStart({ gender, tone, goalMinutes })}
          className="mt-12 w-full rounded-2xl bg-emerald-400 py-4 text-lg font-semibold text-slate-950 transition hover:bg-emerald-300"
        >
          Start focus session
        </button>
      </div>
    </div>
  )
}
