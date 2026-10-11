import { MSG } from './contract.js'

// Fake server that speaks the same contract as the real WebSocket. Used until
// the Node server exists, and as a demo safety net.

const CALIBRATION_MS = 6000
const NUDGE_DELAY_MS = 4000

const PROFILES = {
  focused: { pulse: 72, breathing: 14, faceDetected: true, faceCentered: true, talking: false },
  unfocused: { pulse: 76, breathing: 15, faceDetected: true, faceCentered: false, talking: true },
  overStressed: { pulse: 108, breathing: 23, faceDetected: true, faceCentered: true, talking: false },
}

const REASONS = {
  unfocused: ['looking away 70% of the last 20s', 'talking 55% of the time'],
  overStressed: ['heart rate 101 bpm (baseline 72)', 'breathing 23/min (baseline 14)'],
}

// Keyed by tone, mirroring the server's placeholder lines.
const CANNED_TEXT = {
  chill: {
    unfocused: "Hey, no stress, but your attention wandered off. Let's ease back into it.",
    overStressed: "You seem a little wound up. Breathe in slow, breathe out slower. You've got this.",
  },
  sarcastic: {
    unfocused: 'Wow, that wall must be fascinating. Your work misses you, by the way.',
    overStressed: "Your heart's racing like you're defusing a bomb. It's homework. Breathe.",
  },
  strict: {
    unfocused: 'Eyes back on your work. Now. You can look around when the session is over.',
    overStressed: 'Stop. Take three slow breaths, then continue. Panicking will not finish this faster.',
  },
}

const VALIDATION = {
  ok: { code: 'kOk', hint: 'Hold still and record.', ok: true, blocksVitals: false },
  notForward: { code: 'kFaceNotForward', hint: 'Face the camera.', ok: false, blocksVitals: false },
  motion: { code: 'kExcessiveMotion', hint: 'Hold still - motion may affect accuracy.', ok: false, blocksVitals: true },
}

const jitter = (base, amount) => base + (Math.random() - 0.5) * amount * 2
const round1 = (v) => Math.round(v * 10) / 10

export function createMockStream({ onMessage, onOpen }) {
  let timer = null
  let startedAt = 0
  let scenario = 'focused'
  let state = null
  let tone = 'chill'
  let current = { ...PROFILES.focused }
  let nudgeTimer = null
  let validationTimer = null
  // Same rules as server/src/focusScore.js: start 100, +0.5/s focused,
  // −10 on entering a drift then −1/s, otherwise hold. One tick = 1s.
  let focusScore = 100
  let scoredState = null

  const emit = (msg) => onMessage({ t: Date.now(), ...msg })
  const emitValidation = (v) => emit({ type: MSG.VALIDATION, ...v })

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
    emit({ type: MSG.NUDGE, state: s, reasons: REASONS[s], text: (CANNED_TEXT[tone] ?? CANNED_TEXT.chill)[s], audio: null })
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
    setState(Date.now() - startedAt < CALIBRATION_MS ? 'calibrating' : scenario)
    if (state === 'focused') focusScore += 0.5
    else if (state === 'unfocused') focusScore -= scoredState === 'unfocused' ? 1 : 10
    focusScore = Math.min(100, Math.max(0, focusScore))
    scoredState = state
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
      faceCentered: target.faceCentered,
      talking: target.talking,
      blinking: Math.random() < 0.2,
      expression: scenario === 'overStressed' ? 'fear' : 'neutral',
      focusScore: Math.round(focusScore),
    })
  }

  return {
    send(msg) {
      if (msg.type === MSG.SESSION_START) {
        tone = msg.tone ?? tone
        startedAt = Date.now()
        scenario = 'focused'
        state = null
        focusScore = 100
        scoredState = null
        clearInterval(timer)
        timer = setInterval(tick, 1000)
        tick()
        emitValidation(VALIDATION.ok)
      } else if (msg.type === MSG.SESSION_STOP) {
        clearInterval(timer)
        clearTimeout(nudgeTimer)
        clearTimeout(validationTimer)
      }
    },
    connect() {
      queueMicrotask(() => onOpen?.())
    },
    close() {
      clearInterval(timer)
      clearTimeout(nudgeTimer)
      clearTimeout(validationTimer)
    },
    // Demo controls
    setScenario(next) {
      scenario = next
      startedAt = Math.min(startedAt, Date.now() - CALIBRATION_MS) // skip calibration
      clearTimeout(validationTimer)
      if (next === 'unfocused') emitValidation(VALIDATION.notForward)
      else if (next === 'overStressed') {
        // A burst of motion, then a clean signal again.
        emitValidation(VALIDATION.motion)
        validationTimer = setTimeout(() => emitValidation(VALIDATION.ok), 4000)
      } else emitValidation(VALIDATION.ok)
    },
    fireNudge: () => fireNudge(),
  }
}
