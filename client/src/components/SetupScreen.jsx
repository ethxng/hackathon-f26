import { useState } from 'react'
import { VOICES } from '../lib/contract.js'

const LENGTHS = [25, 45, 60]

export default function SetupScreen({ onStart }) {
  const [voice, setVoice] = useState(VOICES[0].id)
  const [goalMinutes, setGoalMinutes] = useState(25)

  const preview = (v) => {
    window.speechSynthesis?.cancel()
    const u = new SpeechSynthesisUtterance(v.sample)
    u.rate = v.speech.rate
    u.pitch = v.speech.pitch
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

        <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-slate-500">Choose your voice</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {VOICES.map((v) => {
            const selected = v.id === voice
            return (
              <button
                key={v.id}
                onClick={() => setVoice(v.id)}
                className={`group rounded-2xl border p-5 text-left transition ${
                  selected
                    ? 'border-emerald-400/70 bg-emerald-400/10'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{v.name}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      preview(v)
                    }}
                    className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-300 hover:bg-white/10"
                  >
                    ▶ Preview
                  </span>
                </div>
                <div className="mt-1 text-sm text-slate-400">{v.tone}</div>
                <div className="mt-3 text-sm italic text-slate-300/80">“{v.sample}”</div>
              </button>
            )
          })}
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
          onClick={() => onStart({ voice, goalMinutes })}
          className="mt-12 w-full rounded-2xl bg-emerald-400 py-4 text-lg font-semibold text-slate-950 transition hover:bg-emerald-300"
        >
          Start focus session
        </button>
      </div>
    </div>
  )
}
