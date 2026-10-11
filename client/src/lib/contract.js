// Shared WebSocket contract with the Node server. Keep in sync with server/src/presage.js.
//
// Server -> client:
//   { type: 'metrics', t, pulse, pulseConfidence, pulseReliable, breathing, breathingConfidence, breathingReliable,
//                      hrv, faceDetected, faceCentered, talking, blinking, expression,   // confidences 0–100
//                      focusScore }   // 0–100: climbs while focused, drops on drifts
//   { type: 'state',   t, state, reasons: [], confidence }                                // confidence 0–1 or null
//   { type: 'validation', t, code, hint, ok, blocksVitals }   // Presage capture feedback, e.g.
//                      // code 'kFaceNotForward', hint 'Face the camera.'; blocksVitals: readings are being discarded
//   { type: 'nudge',   t, state, reasons, text, audio }   // audio: base64 mp3 from ElevenLabs (optional)
//     ^ sent after the server POSTs a detector trigger to the nudge endpoint (see server/src/trigger.js)
//       and gets back { text, audio }.
// Client -> server:
//   { type: 'session:start', gender: 'male'|'female', tone: 'chill'|'sarcastic'|'strict', goalMinutes }
//   { type: 'session:stop' }

export const MSG = {
  METRICS: 'metrics',
  STATE: 'state',
  NUDGE: 'nudge',
  VALIDATION: 'validation',
  SESSION_START: 'session:start',
  SESSION_STOP: 'session:stop',
}

export const STATES = {
  calibrating: {
    label: 'Calibrating',
    blurb: 'Learning your resting baseline…',
    color: '#94a3b8',
  },
  focused: {
    label: 'In the zone',
    blurb: 'Steady vitals, eyes on the work.',
    color: '#34d399',
  },
  unfocused: {
    label: 'Drifting',
    blurb: 'Your attention is wandering.',
    color: '#fbbf24',
  },
  overStressed: {
    label: 'Stressed',
    blurb: 'Heart rate and breathing are up.',
    color: '#fb7185',
  },
}

export const GENDERS = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
]

// Order matters: it's the knob's left → right positions.
export const TONES = [
  {
    id: 'chill',
    color: '#5eead4',
    label: 'Chill',
    blurb: 'Soft, easygoing, no pressure.',
    sample: "Hey, no stress. Let's ease back into it whenever you're ready.",
    speech: { rate: 0.9, pitch: 1 },
  },
  {
    id: 'sarcastic',
    color: '#c084fc',
    label: 'Sarcastic',
    blurb: 'Dry wit. Roasts you back to work.',
    sample: 'Wow, that wall must be fascinating. Your work misses you, by the way.',
    speech: { rate: 1.05, pitch: 1.05 },
  },
  {
    id: 'strict',
    color: '#fbbf24',
    label: 'Strict',
    blurb: 'Direct and no-nonsense.',
    sample: 'Eyes back on your work. Now.',
    speech: { rate: 1, pitch: 0.9 },
  },
]

export const toneOf = (id) => TONES.find((t) => t.id === id) ?? TONES[0]
export const voiceLabel = ({ gender, tone }) =>
  `${toneOf(tone).label} · ${GENDERS.find((g) => g.id === gender)?.label ?? ''}`

// Browser-speech fallback settings (used for previews and when a nudge has no audio).
export function speechSettings({ gender, tone }) {
  const { rate, pitch } = toneOf(tone).speech
  return { rate, pitch: gender === 'female' ? pitch * 1.25 : pitch * 0.85 }
}
