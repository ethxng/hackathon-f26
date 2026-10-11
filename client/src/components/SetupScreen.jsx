import { useState } from 'react'
import { GENDERS, speechSettings, toneOf } from '../lib/contract.js'
import Ambient from './Ambient.jsx'
import ToneKnob from './ToneKnob.jsx'
import Logo from './Logo.jsx'

const LENGTHS = [25, 45, 60]
const FEATURES = ['♥ Heart Rate', '👀 Attention', '🎙 Personalized Voice']

function Step({ n, title, children }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-3">
        <span className="font-display text-sm italic text-ink-faint">{n}</span>
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">{title}</h2>
      </div>
      {children}
    </section>
  )
}

// Hand-drawn underline under the key words of the punch line.
function Swoosh({ color }) {
  return (
    <svg viewBox="0 0 300 24" preserveAspectRatio="none" className="absolute -bottom-3 left-0 h-4 w-full" aria-hidden>
      <path
        d="M4 16 C 60 6, 120 4, 180 10 S 270 18, 296 8"
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        className="transition-[stroke] duration-700"
      />
    </svg>
  )
}

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
    <div className="relative min-h-screen px-4 py-10 sm:px-8 lg:py-0">
      <Ambient color={toneInfo.color} />

      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 lg:grid-cols-[1fr_minmax(0,520px)] lg:gap-16">
        {/* Left: brand, punch line, what it does */}
        <div className="text-center animate-fade-up lg:text-left">
          <div className="mb-10 inline-flex items-center gap-4">
            <Logo size={84} />
            <span className="font-display text-5xl font-semibold tracking-tight sm:text-6xl">FocusUp</span>
          </div>

          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl xl:text-7xl">
            Drift less.
            <br />
            <span className="relative inline-block italic transition-colors duration-700" style={{ color: toneInfo.color }}>
              Finish more.
              <Swoosh color={`${toneInfo.color}66`} />
            </span>
            <span className="ml-2 inline-block align-top text-3xl text-[#e3a43a]" aria-hidden>
              ✦
            </span>
          </h1>

          <p className="mx-auto mt-8 max-w-md text-base leading-relaxed text-ink-soft sm:text-lg lg:mx-0">
            FocusUp notices when your mind drifts or your stress climbs, and a voice you choose helps you reset. No wearables, just your webcam.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2 lg:justify-start">
            {FEATURES.map((f) => (
              <span key={f} className="rounded-full border border-ink/10 bg-white/60 px-3 py-1 text-xs text-ink-soft">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Right: configuration */}
        <div className="glass rounded-[32px] p-6 sm:p-8 animate-fade-up" style={{ animationDelay: '120ms' }}>
          <div className="grid gap-6 sm:grid-cols-2">
            <Step n="01" title="Voice">
              <div className="flex rounded-2xl border border-ink/10 bg-ink/[0.04] p-1">
                {GENDERS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGender(g.id)}
                    aria-pressed={g.id === gender}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
                      g.id === gender ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </Step>

            <Step n="02" title="Session length">
              <div className="flex gap-2">
                {LENGTHS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setGoalMinutes(m)}
                    aria-pressed={m === goalMinutes}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-medium tabular-nums transition ${
                      m === goalMinutes
                        ? 'border-ink/20 bg-white text-ink shadow-sm'
                        : 'border-ink/10 text-ink-soft hover:border-ink/20 hover:text-ink'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </Step>
          </div>

          <div className="mt-6">
            <Step n="03" title="Tone">
              <div className="rounded-3xl border border-ink/[0.06] bg-white/50 px-4 pb-5 pt-2">
                <ToneKnob value={tone} onChange={setTone} />
                <div className="text-center">
                  <div className="text-sm text-ink-soft">{toneInfo.blurb}</div>
                  <p className="mx-auto mt-2 max-w-sm font-display text-lg italic leading-snug text-ink">
                    “{toneInfo.sample}”
                  </p>
                  <button
                    onClick={preview}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white/70 px-4 py-1.5 text-xs font-medium text-ink-soft transition hover:border-ink/30 hover:text-ink"
                  >
                    <span style={{ color: toneInfo.color }}>▶</span> Preview voice
                  </button>
                </div>
              </div>
            </Step>
          </div>

          <button
            onClick={() => onStart({ gender, tone, goalMinutes })}
            className="mt-8 w-full rounded-2xl bg-ink py-4 text-lg font-semibold text-paper shadow-[0_14px_34px_-14px_rgba(43,38,32,0.7)] transition hover:-translate-y-0.5 hover:bg-[#3a332b] active:translate-y-0"
          >
            Start Focus Session
          </button>
        </div>
      </div>
    </div>
  )
}
