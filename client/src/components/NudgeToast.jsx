import { STATES, voiceLabel } from '../lib/contract.js'

const BARS = [0.5, 0.8, 1, 0.7, 0.9, 0.6, 0.4]

// The hero moment: Gemini's words appear in sync with the ElevenLabs voice.
export default function NudgeToast({ nudge, progress, speaking, session }) {
  if (!nudge) return null
  const color = STATES[nudge.state]?.color ?? '#2b2620'
  const words = nudge.text.split(' ')
  const shown = Math.ceil(progress * words.length)

  return (
    <div
      key={nudge.id}
      className="glass fixed bottom-8 left-1/2 z-50 w-[min(720px,92vw)] animate-slide-up overflow-hidden rounded-[30px] p-6 sm:p-7"
      style={{ background: 'rgba(255, 250, 242, 0.88)', borderColor: `${color}55`, boxShadow: `0 30px 80px -30px ${color}, inset 0 1px 0 #fff` }}
    >
      {/* Warm state-colored wash along the top edge. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-20"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}, transparent 70%)` }}
      />

      <div className="relative mb-4 flex items-center gap-3">
        <div className="flex h-7 items-end gap-[3px]">
          {BARS.map((scale, i) => (
            <span
              key={i}
              className={`w-[3px] rounded-full ${speaking ? 'animate-bar' : ''}`}
              style={{ background: color, height: speaking ? `${scale * 100}%` : '25%', animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
        <span className="rounded-full border border-ink/10 bg-white/80 px-3 py-1 text-xs font-medium" style={{ color }}>
          {voiceLabel(session)}
        </span>
        <span className="text-xs text-ink-faint">{STATES[nudge.state]?.label}</span>
      </div>

      <p className="relative font-display text-2xl leading-snug text-ink sm:text-[1.7rem]">
        {words.map((w, i) => (
          <span key={i} className={`transition-opacity duration-300 ${i < shown ? 'opacity-100' : 'opacity-15'}`}>
            {w}{' '}
          </span>
        ))}
      </p>
    </div>
  )
}
