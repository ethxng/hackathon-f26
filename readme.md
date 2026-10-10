# Title: Focus Up

## Rutgers Fall Hackathon 2026
## Group: Hieu Nguyen, Ethan Nguyen, Andy Mao, Veda Yakkali 

### Track: Education
### Superlatives: Best UI/UX & Use of ElevenLabs

# Description:


Create a study tool that helps the user manage stress and focus levels.

This is done by using Prasage's *SmartSpectra* to determinisitically analyze the user's breathing, cardio, and face metrics to determine stress levels and current focus.

Focus is determined via facial data. If the user turns away from the camera too often, talks too much, or has a "strange" facial expression, it could be inferred that the user is not focused. Otherwise, focus is being kept.

Stress is determined via breathing, cardio, and facial expression. If the user is breathing heavily, has a high heart rate, or has facial expressions that are considered "poor", the user can be considered as too over-stressed. A heart rate too low, and breathing too slow can be considered too under-stressed.


If the user is determined to be either too over/under stressed or un-focused, we make a Google Gemini call to generate text that informs the user of their state in a predefined style.

The generated text is fed into ElevenLabs API to speak towards the user, in the pre-defined voice and style.


# Running locally

**Presage sanity check** (prints live metrics to the terminal):
```bash
cd server && npm install
cp .env.example .env        # add PRESAGE_API_KEY from physiology.presagetech.com
npm run metrics             # add `-- --raw` to dump one full decoded payload
```

**Server** (Presage → WebSocket, one sample/second):
```bash
cd server && npm start      # ws://localhost:3001, opens the camera
```

**Frontend** (React + Vite + Tailwind):
```bash
cd client && npm install
npm run dev                 # http://localhost:5173
```
`client/.env` sets `VITE_DATA_SOURCE=ws` (live Presage data from the server). Set it to `mock` for fake data. Demo hotkeys: `1` focused, `2` unfocused, `3` stressed, `N` fire a nudge, `` ` `` toggles the demo panel.
The WebSocket message contract is in `client/src/lib/contract.js`.
Presage's capture feedback (e.g. "Face the camera.") is sent as `validation` messages and shown as a hint on the camera preview.

## Nudge trigger (for the Gemini → ElevenLabs endpoint)

When the detector decides you're drifting (`unfocused`) or stressed (`overStressed`) with enough confidence, the server
POSTs to `NUDGE_URL` (default `http://localhost:3001/api/nudge`, set in `server/.env`). See `server/src/trigger.js`.

Request body:
```json
{
  "state": "unfocused",
  "reasons": ["looking away 73% of the last 15s"],
  "confidence": 0.73,
  "metrics": { "avgPulse": 72.4, "avgBreathing": 14.1, "lookAwayRatio": 0.73, "talkingRatio": 0, "tenseRatio": 0, "pulseCoverage": 0.9 },
  "baseline": { "pulse": 70, "breathing": 14 },
  "voice": "calm",
  "at": 1791660000000
}
```
`state` is `unfocused` or `overStressed`; `voice` is `calm`, `coach`, `buddy` or `mentor` (picked in the UI).

Expected response: `{ "text": "...", "audio": "<base64 mp3, optional>" }`. The server forwards it to the browser,
which shows the text and plays the audio (or uses browser speech if `audio` is missing).

- At most one request in flight; 20s timeout.
- Triggers are rate-limited by the detector (60s per state, 20s overall).
- Until the endpoint exists, the server logs `[nudge] failed: 501 — endpoint not implemented yet` and keeps running.
