import { useEffect, useState } from 'react'
import { STATES, voiceLabel } from '../lib/contract.js'
import { useNudgeAudio } from '../hooks/useNudgeAudio.js'
import Ambient from './Ambient.jsx'
import RingGauge from './RingGauge.jsx'
import WebcamPanel from './WebcamPanel.jsx'
import StatusOrb from './StatusOrb.jsx'
import VitalCard from './VitalCard.jsx'
import FocusScoreCard from './FocusScoreCard.jsx'
import NudgeToast from './NudgeToast.jsx'
import Timeline from './Timeline.jsx'
import DemoControls from './DemoControls.jsx'

function useElapsedSeconds() {
  const [start] = useState(() => Date.now())
  const [now, setNow] = useState(start)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return Math.floor((now - start) / 1000)
}

const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function SessionScreen({ session, stream, onEnd }) {
  const { metrics, history, status, nudge, validation, timeline, connected, source, demo, subscribeFrames } = stream
  const { current, progress, speaking } = useNudgeAudio(nudge, session)
  const elapsed = useElapsedSeconds()
  const stressNudge = current?.state === 'overStressed'
  // Presage's framing hint explains why there's no pulse yet (e.g. "Move up, or tilt the camera down.").
  const waitingHint = validation && !validation.ok ? validation.hint : null
  const stateColor = (STATES[status.state] ?? STATES.calibrating).color

  return (
    <div className="relative min-h-screen">
      <Ambient color={stateColor} />

      <div className="mx-auto max-w-7xl px-4 pb-44 pt-5 sm:px-6">
        <header className="glass mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[24px] px-5 py-3">
          <div className="flex items-center gap-3">
            <span
              className="h-3 w-3 rounded-full transition-colors duration-700"
              style={{ background: stateColor, boxShadow: `0 0 0 4px ${stateColor}22` }}
            />
            <span className="font-display text-xl font-semibold tracking-tight">FocusUp</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-ink-soft sm:gap-5">
            <div className="flex items-center gap-2.5">
              <RingGauge value={elapsed} max={session.goalMinutes * 60} size={34} stroke={3.5} color="#2b2620" />
              <span className="tabular-nums text-base text-ink">
                {clock(elapsed)} <span className="text-sm text-ink-faint">/ {session.goalMinutes}:00</span>
              </span>
            </div>
            <span className="rounded-full border border-ink/10 bg-white/60 px-3 py-1 text-xs text-ink-soft">
              🎙 {voiceLabel(session)}
            </span>
            <span className="flex items-center gap-1.5 text-xs">
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-[#3f9a6b]' : 'animate-pulse bg-[#d1495b]'}`} />
              {source === 'mock' ? 'Demo data' : connected ? 'Live' : 'Reconnecting…'}
            </span>
            <button
              onClick={onEnd}
              className="rounded-xl border border-ink/15 px-4 py-1.5 text-ink transition hover:border-ink/30 hover:bg-white/70"
            >
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <VitalCard
                label="Heart rate"
                unit="bpm"
                field="pulse"
                history={history}
                minSpan={20}
                waitingHint={waitingHint}
                color="#d1495b"
                highlight={stressNudge}
              />
              <FocusScoreCard history={history} state={status.state} />
            </div>
            <Timeline events={timeline} />
          </div>
        </div>
      </div>

      <NudgeToast nudge={current} progress={progress} speaking={speaking} session={session} />
      {demo && <DemoControls demo={demo} />}
    </div>
  )
}
