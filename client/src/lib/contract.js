// Shared WebSocket contract with the Node server. Keep in sync with server/src/presage.js.
//
// Server -> client:
//   { type: 'metrics', t, pulse, pulseConfidence, pulseReliable, breathing, breathingConfidence, breathingReliable,
//                      hrv, faceDetected, faceCentered, faceForward, talking, blinking, expression }   // confidences 0–100
//   { type: 'trace',   pulse: [[t, value], ...], breathing: [...], pulseRate: [...], breathingRate: [...] }
//     ^ every point Presage produced since the last event (~30 events/s; 'metrics' is 1/s):
//       the raw pulse/breathing waveforms and the bpm / breaths-per-minute readings. t is ms since epoch.
//   { type: 'state',   t, state, reasons: [], confidence }                                // confidence 0–1 or null
//   { type: 'nudge',   t, state, reasons, text, audio }   // audio: base64 mp3 from ElevenLabs (optional)
//     ^ sent after the server POSTs a detector trigger to the nudge endpoint (see server/src/trigger.js)
//       and gets back { text, audio }.
// Client -> server:
//   { type: 'session:start', voice, goalMinutes }
//   { type: 'session:stop' }

export const MSG = {
  METRICS: 'metrics',
  TRACE: 'trace',
  STATE: 'state',
  NUDGE: 'nudge',
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

export const VOICES = [
  {
    id: 'calm',
    name: 'Calm Guide',
    tone: 'Soft, slow, reassuring',
    sample: 'Hey, take a slow breath with me. You are doing fine.',
    speech: { rate: 0.85, pitch: 0.9 },
  },
  {
    id: 'coach',
    name: 'Hype Coach',
    tone: 'Energetic, motivating',
    sample: "Let's go! Eyes back on the prize — you've got this!",
    speech: { rate: 1.15, pitch: 1.1 },
  },
  {
    id: 'buddy',
    name: 'Study Buddy',
    tone: 'Casual, friendly',
    sample: 'Psst, looks like we got distracted. Wanna jump back in?',
    speech: { rate: 1, pitch: 1.05 },
  },
  {
    id: 'mentor',
    name: 'Strict Mentor',
    tone: 'Direct, no-nonsense',
    sample: 'Focus. Close the other tab and finish this section.',
    speech: { rate: 0.95, pitch: 0.8 },
  },
]
