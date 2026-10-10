import { STATES, VOICES } from '../lib/contract.js'

// The hero moment: Gemini's words appear in sync with the ElevenLabs voice.
export default function NudgeToast({ nudge, progress, speaking, voiceId }) {
  if (!nudge) return null
  const color = STATES[nudge.state]?.color ?? '#fff'
  const voice = VOICES.find((v) => v.id === voiceId)
  const words = nudge.text.split(' ')
  const shown = Math.ceil(progress * words.length)

  return (
    <div
      key={nudge.id}
      className="fixed bottom-8 left-1/2 z-50 w-[min(680px,92vw)] animate-slide-up rounded-3xl border bg-[#12151c]/95 p-6 shadow-2xl backdrop-blur"
      style={{ borderColor: `${color}66`, boxShadow: `0 20px 80px -20px ${color}88` }}
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-6 items-end gap-0.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`w-1 rounded-full ${speaking ? 'animate-bar' : ''}`}
              style={{ background: color, height: speaking ? '100%' : '30%', animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
        <span className="text-sm font-medium" style={{ color }}>
          {voice?.name ?? 'Focus Up'}
        </span>
        <span className="text-sm text-slate-500">· {STATES[nudge.state]?.label}</span>
      </div>
      <p className="text-xl leading-relaxed">
        {words.map((w, i) => (
          <span key={i} className={`transition-opacity duration-300 ${i < shown ? 'opacity-100' : 'opacity-15'}`}>
            {w}{' '}
          </span>
        ))}
      </p>
    </div>
  )
}
