// Streams Presage metrics to the frontend over WebSocket, one sample per second,
// and serves HTTP routes (POST /api/nudge) on the same port.
//   npm start
import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { decodeMetrics } from '@smartspectra/node-sdk';
import {
  createPresage,
  createSecondSampler,
  encodePreviewFrame,
  normalize,
  validationName,
  statusName,
} from './presage.js';
import { assessQuality, createDetector, DEFAULT_CONFIG } from './detector.js';
import { sendTrigger, TriggerSkipped } from './trigger.js';
import { nudgeHandler } from './nudge.js';

const PORT = Number(process.env.PORT ?? 3001);
const PREVIEW_FPS = 15;
// Skip preview frames for a client that can't keep up instead of queueing them.
const MAX_BUFFERED_BYTES = 2_000_000;
const apiKey = process.env.PRESAGE_API_KEY;
if (!apiKey) {
  console.error('Missing PRESAGE_API_KEY. Copy .env.example to .env and add your key.');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '1mb' }));
app.post('/api/nudge', nudgeHandler);

// HTTP and WebSocket share one port, so the client's ws://localhost:3001 is unchanged.
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}

function broadcastFrame(frame) {
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client.bufferedAmount < MAX_BUFFERED_BYTES) client.send(frame);
  }
}

wss.on('connection', (ws) => {
  console.log(`[ws] client connected (${wss.clients.size} total)`);
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === 'session:start') {
      sessionVoice = msg.voice ?? sessionVoice;
      console.log(`[ws] session start (voice=${msg.voice}, ${msg.goalMinutes} min)`);
      // Send where the detector already is; it has been running since boot.
      ws.send(JSON.stringify(currentState));
      if (currentValidation) ws.send(JSON.stringify(currentValidation));
    } else if (msg.type === 'session:stop') {
      console.log('[ws] session stop');
    }
  });
  ws.on('close', () => console.log(`[ws] client disconnected (${wss.clients.size} total)`));
});

// Presage is the only thing that opens the camera. If the browser opened it
// too, macOS would switch the shared camera's resolution mid-stream and crash
// Presage's optical flow (OpenCV lkpyramid size assertion). The browser preview
// is fed from Presage's own frames instead.
// Presage starts at boot (not per session) so pulse/breathing are already
// warmed up by the time someone hits Start in the UI.
const sdk = createPresage({ apiKey });
let validationCode = null;
let currentValidation = null;

const detector = createDetector();
// The voice persona picked in the UI; the nudge endpoint needs it.
let sessionVoice = 'calm';
let currentState = { type: 'state', t: Date.now(), state: detector.state, reasons: [], confidence: null };

const sampler = createSecondSampler((sample) => {
  // Tag reliability so the UI shows "Measuring…" instead of low-confidence numbers.
  const { pulseReliable, breathingReliable } = assessQuality(sample);
  broadcast({ ...sample, pulseReliable, breathingReliable });
  const result = detector.push(sample);
  const confidence = result.confidence == null ? null : Math.round(result.confidence * 10) / 10;

  if (result.changed) {
    console.log(`[detector] ${currentState.state} → ${result.state}${result.reasons.length ? ` (${result.reasons.join('; ')})` : ''}`);
  }
  // Also resend when only the reasons or confidence change, so calibration
  // progress and "looking away N%" stay live in the UI.
  if (
    result.state !== currentState.state ||
    result.reasons.join('|') !== currentState.reasons.join('|') ||
    confidence !== currentState.confidence
  ) {
    currentState = { type: 'state', t: sample.t, state: result.state, reasons: result.reasons, confidence };
    broadcast(currentState);
  }
  if (result.trigger) {
    const { state, confidence: c, reasons } = result.trigger;
    console.log(`[detector] TRIGGER ${state} (confidence ${Math.round(c * 100)}%): ${reasons.join('; ')}`);
    nudge(result.trigger);
  }
});

// Sends the trigger to the nudge endpoint (Gemini → ElevenLabs) and forwards
// the result to the browser. Not awaited, so a slow call never stalls the 1Hz stream.
function nudge(trigger) {
  const startedAt = Date.now();
  console.log(`[nudge] → ${trigger.state} (voice=${sessionVoice})`);
  sendTrigger(trigger, { voice: sessionVoice })
    .then(({ text, audio }) => {
      const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
      const audioInfo = audio ? `audio ${Math.round((audio.length * 3) / 4 / 1024)}KB` : 'no audio';
      console.log(`[nudge] ← ${secs}s, ${text.length} chars, ${audioInfo}`);
      broadcast({ type: 'nudge', t: Date.now(), state: trigger.state, reasons: trigger.reasons, text, audio });
    })
    .catch((err) => {
      console.log(err instanceof TriggerSkipped ? `[nudge] skipped: ${err.message}` : `[nudge] failed: ${err.message}`);
    });
}

sdk.on('processingStatus', (s) => console.log(`[presage] ${statusName(s)}`));
sdk.on('validationStatus', (code, _ts, hint) => {
  if (code === validationCode) return;
  validationCode = code;
  const name = validationName(code);
  console.log(`[presage] validation: ${name}${hint ? ` — ${hint}` : ''}`);
  // Presage's hint is written to be shown to users as-is.
  currentValidation = {
    type: 'validation',
    t: Date.now(),
    code: name,
    hint: hint || null,
    ok: name === 'kOk',
    blocksVitals: DEFAULT_CONFIG.quality.blockingValidation.includes(name),
  };
  broadcast(currentValidation);
});
sdk.on('error', (code, message) => console.error(`[presage] error ${code}: ${message}`));
let lastFrameAt = 0;
sdk.on('videoOutput', (buf, width, height, stride, pixelFormat) => {
  const now = Date.now();
  if (wss.clients.size === 0 || now - lastFrameAt < 1000 / PREVIEW_FPS) return;
  lastFrameAt = now;
  const frame = encodePreviewFrame(buf, width, height, stride, pixelFormat);
  if (frame) broadcastFrame(frame);
});
sdk.on('metrics', (buf, timestampUs) => {
  const decoded = decodeMetrics(buf);
  if (Buffer.isBuffer(decoded)) return;
  sampler.push(normalize(decoded, { timestampUs, validationCode }));
});

process.on('SIGINT', async () => {
  sampler.stop();
  wss.close();
  server.close();
  // destroy() shuts the native runtime down cleanly; stopAsync() + exit aborted with a mutex error.
  await sdk.destroy();
  process.exit(0);
});

server.listen(PORT, () =>
  console.log(`Focus Up server on http://localhost:${PORT} (WebSocket + /api/nudge) — Presage starting (pulse needs ~12s to warm up)`)
);
sdk.start();
