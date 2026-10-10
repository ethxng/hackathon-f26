// Sends a detector trigger to the nudge endpoint (Gemini → ElevenLabs), which
// a teammate implements in this server.
//
// Request body (POST, JSON):
//   { state: 'unfocused'|'overStressed', reasons: string[], confidence: number (0–1),
//     metrics: { avgPulse, avgBreathing, lookAwayRatio, talkingRatio, tenseRatio, pulseCoverage, ... },
//     baseline: { pulse, breathing }, voice: 'calm'|'coach'|'buddy'|'mentor', at: number (ms) }
// Expected response (JSON):
//   { text: string, audio?: string }   // audio = base64 mp3

const TIMEOUT_MS = 20_000;

let inFlight = false;

export class TriggerSkipped extends Error {}

export async function sendTrigger(trigger, { voice }) {
  if (inFlight) throw new TriggerSkipped('previous nudge still in flight');
  const url = process.env.NUDGE_URL ?? 'http://localhost:3001/api/nudge';
  inFlight = true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const { state, reasons, confidence, metrics, baseline, at } = trigger;
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state, reasons, confidence, metrics, baseline, voice, at }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') throw new Error(`timed out after ${TIMEOUT_MS / 1000}s`);
      throw new Error(`endpoint not reachable at ${url} (${err.cause?.code ?? err.message})`);
    }

    // 501 from the empty route in src/nudge.js; 404/426 if no route exists at that URL.
    if ([404, 426, 501].includes(res.status))
      throw new Error(`${res.status} — endpoint not implemented yet at ${url}`);
    if (!res.ok) throw new Error(`${res.status} from endpoint: ${(await res.text()).slice(0, 200)}`);

    const body = await res.json().catch(() => null);
    if (typeof body?.text !== 'string' || !body.text)
      throw new Error('endpoint response is missing a "text" string');
    return { text: body.text, audio: typeof body.audio === 'string' ? body.audio : null };
  } finally {
    clearTimeout(timer);
    inFlight = false;
  }
}
