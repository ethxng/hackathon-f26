import { useEffect, useState } from 'react'
import { voiceLabel } from '../lib/contract.js'
import { useNudgeAudio } from '../hooks/useNudgeAudio.js'
import WebcamPanel from './WebcamPanel.jsx'
import StatusOrb from './StatusOrb.jsx'
import VitalCard from './VitalCard.jsx'
import NudgeToast from './NudgeToast.jsx'
import Timeline from './Timeline.jsx'
import DemoControls from './DemoControls.jsx'

function useElapsed() {
  const [start] = useState(() => Date.now())
  const [now, setNow] = useState(start)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const s = Math.floor((now - start) / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function SessionScreen({ session, stream, onEnd }) {
  const { metrics, history, status, nudge, validation, timeline, connected, source, demo, subscribeFrames } = stream
  const { current, progress, speaking } = useNudgeAudio(nudge, session)
  const elapsed = useElapsed()
  const stressNudge = current?.state === 'overStressed'

  return (
    <div className="mx-auto max-w-7xl px-6 pb-40 pt-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-emerald-400" />
          <span className="font-display text-xl font-semibold">Focus Up</span>
        </div>
        <div className="flex items-center gap-5 text-sm text-slate-400">
          <span className="tabular-nums text-lg text-slate-200">
            {elapsed} <span className="text-sm text-slate-500">/ {session.goalMinutes}:00</span>
          </span>
          <span>🎙 {voiceLabel(session)}</span>
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            {source === 'mock' ? 'Demo data' : connected ? 'Live' : 'Reconnecting…'}
          </span>
          <button onClick={onEnd} className="rounded-xl border border-white/15 px-4 py-2 text-slate-200 hover:bg-white/10">
            End session
          </button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <WebcamPanel
            state={status.state}
            faceDetected={metrics?.faceDetected}
            validation={validation}
            subscribeFrames={subscribeFrames}
          />
          <StatusOrb state={status.state} reasons={status.reasons} confidence={status.confidence} />
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
            <VitalCard
              label="Heart rate"
              unit="bpm"
              value={metrics?.pulse}
              reliable={metrics?.pulseReliable}
              confidence={metrics?.pulseConfidence}
              values={history.map((m) => (m.pulseReliable ? m.pulse : null))}
              color="#fb7185"
              highlight={stressNudge}
            />
            <VitalCard
              label="Breathing"
              unit="/min"
              value={metrics?.breathing}
              reliable={metrics?.breathingReliable}
              confidence={metrics?.breathingConfidence}
              values={history.map((m) => (m.breathingReliable ? m.breathing : null))}
              color="#38bdf8"
              highlight={stressNudge}
            />
          </div>
          <Timeline events={timeline} />
        </div>
      </div>

      <NudgeToast nudge={current} progress={progress} speaking={speaking} session={session} />
      {demo && <DemoControls demo={demo} />}
    </div>
  )
}
