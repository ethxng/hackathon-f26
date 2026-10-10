// POST /api/nudge — Gemini writes the nudge, ElevenLabs speaks it.
// Called by the server (src/trigger.js) when the detector fires.
//
// req.body:
//   { state: 'unfocused'|'overStressed', reasons: string[], confidence: number (0–1),
//     metrics: { avgPulse, avgBreathing, lookAwayRatio, talkingRatio, tenseRatio, pulseCoverage, ... },
//     baseline: { pulse, breathing }, voice: 'calm'|'coach'|'buddy'|'mentor', at: number (ms) }
//
// Respond with:
//   res.json({ text: string, audio?: string })   // audio = base64 mp3
//
// The server forwards { text, audio } to the browser, which shows the text and
// plays the audio (or uses browser speech when audio is missing).
export async function nudgeHandler(req, res) {
  // TODO: Gemini (text from state/reasons/metrics/voice) → ElevenLabs (text → base64 mp3).
  res.status(501).json({ error: 'nudge endpoint not implemented yet' });
}
