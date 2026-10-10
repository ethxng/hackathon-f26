import { MSG } from './contract.js'

// Fake server that speaks the same contract as the real WebSocket. Used until
// the Node server exists, and as a demo safety net.

const CALIBRATION_MS = 6000
const NUDGE_DELAY_MS = 4000
const TRACE_HZ = 30

const PROFILES = {
  focused: { pulse: 72, breathing: 14, faceDetected: true, talking: false },
  unfocused: { pulse: 76, breathing: 15, faceDetected: false, talking: true },
  overStressed: { pulse: 101, breathing: 23, faceDetected: true, talking: false },
}

const REASONS = {
  unfocused: ['looking away 70% of the last 20s', 'talking 55% of the time'],
  overStressed: ['heart rate 101 bpm (baseline 72)', 'breathing 23/min (baseline 14)'],
}

const CANNED_TEXT = {
  calm: {
    unfocused: "Hey, it looks like your mind wandered off. That's okay. Gently bring your eyes back to the page.",
    overStressed: "Your heart's racing a little. Let's breathe in for four, hold, and out for six. You've got time.",
  },
  coach: {
    unfocused: "Eyes up, champ! The finish line is right there. Let's lock back in!",
    overStressed: "Whoa, pace yourself! Shake it out, one big breath, and attack it again.",
  },
  buddy: {
    unfocused: 'Psst, we kinda drifted there. Wanna jump back in? Just one more section.',
    overStressed: "Hey, you seem pretty stressed. Quick stretch? I'll wait.",
  },
  mentor: {
    unfocused: 'You looked away again. Put the distraction down and finish this problem.',
    overStressed: 'Your vitals are spiking. Stop, breathe for ten seconds, then continue.',
  },
}

const jitter = (base, amount) => base + (Math.random() - 0.5) * amount * 2
const round1 = (v) => Math.round(v * 10) / 10
const round3 = (v) => Math.round(v * 1000) / 1000

export function createMockStream({ onMessage, onOpen }) {
  let timer = null
  let startedAt = 0
  let scenario = 'focused'
  let state = null
  let voice = 'calm'
  let current = { ...PROFILES.focused }
  let nudgeTimer = null
  let traceTimer = null
  let lastTraceAt = 0
  let pulsePhase = 0
  let breathPhase = 0

  const emit = (msg) => onMessage({ t: Date.now(), ...msg })

  function setState(next) {
    if (next === state) return
    state = next
    const confidence = state === 'unfocused' || state === 'overStressed' ? 0.8 : null
    emit({ type: MSG.STATE, state, reasons: REASONS[state] ?? [], confidence })
    clearTimeout(nudgeTimer)
    if (state === 'unfocused' || state === 'overStressed') {
      nudgeTimer = setTimeout(() => fireNudge(), NUDGE_DELAY_MS)
    }
  }

  function fireNudge(forState = state) {
    const s = forState === 'unfocused' || forState === 'overStressed' ? forState : 'unfocused'
    emit({ type: MSG.NUDGE, state: s, reasons: REASONS[s], text: CANNED_TEXT[voice][s], audio: null })
  }

  function tick() {
    // Ease metrics toward the active scenario so changes look physiological.
    const target = PROFILES[scenario]
    // Mimic Presage warm-up: confidence climbs from 0 over the first few seconds.
    const warm = Math.min(1, (Date.now() - startedAt) / 4000)
    const pulseConfidence = Math.round(jitter(90, 5) * warm)
    const breathingConfidence = Math.round(jitter(85, 5) * warm)
    current.pulse += (target.pulse - current.pulse) * 0.25
    current.breathing += (target.breathing - current.breathing) * 0.25
    emit({
      type: MSG.METRICS,
      pulse: round1(jitter(current.pulse, 1.5)),
      pulseConfidence,
      pulseReliable: pulseConfidence >= 50,
      breathing: round1(jitter(current.breathing, 0.6)),
      breathingConfidence,
      breathingReliable: breathingConfidence >= 50,
      hrv: round1(jitter(scenario === 'overStressed' ? 22 : 45, 3)),
      faceDetected: target.faceDetected,
      faceCentered: target.faceDetected,
      faceForward: target.faceDetected,
      talking: target.talking,
      blinking: Math.random() < 0.2,
      expression: scenario === 'overStressed' ? 'fear' : 'neutral',
    })
    setState(Date.now() - startedAt < CALIBRATION_MS ? 'calibrating' : scenario)
  }

  // Fake waveforms: one beat / breath per cycle at the current rates. Phase is
  // accumulated so the wave stays continuous when the rate changes.
  function traceTick() {
    const now = Date.now()
    const dt = (now - lastTraceAt) / 1000
    lastTraceAt = now
    pulsePhase += (current.pulse / 60) * dt
    breathPhase += (current.breathing / 60) * dt
    const beat = Math.exp(-(((pulsePhase % 1) - 0.2) ** 2) / 0.006) + 0.35 * Math.exp(-(((pulsePhase % 1) - 0.5) ** 2) / 0.02)
    onMessage({
      type: MSG.TRACE,
      pulse: [[now, round3(jitter(beat, 0.02))]],
      breathing: [[now, round3(jitter(Math.sin(2 * Math.PI * breathPhase), 0.03))]],
      pulseRate: [[now, round1(jitter(current.pulse, 0.4))]],
      breathingRate: [[now, round1(jitter(current.breathing, 0.2))]],
    })
  }

  function stopTimers() {
    clearInterval(timer)
    clearInterval(traceTimer)
    clearTimeout(nudgeTimer)
  }

  return {
    send(msg) {
      if (msg.type === MSG.SESSION_START) {
        voice = msg.voice ?? voice
        startedAt = Date.now()
        scenario = 'focused'
        state = null
        stopTimers()
        timer = setInterval(tick, 1000)
        lastTraceAt = Date.now()
        traceTimer = setInterval(traceTick, 1000 / TRACE_HZ)
        tick()
      } else if (msg.type === MSG.SESSION_STOP) {
        stopTimers()
      }
    },
    connect() {
      queueMicrotask(() => onOpen?.())
    },
    close() {
      stopTimers()
    },
    // Demo controls
    setScenario(next) {
      scenario = next
      startedAt = Math.min(startedAt, Date.now() - CALIBRATION_MS) // skip calibration
    },
    fireNudge: () => fireNudge(),
  }
}
