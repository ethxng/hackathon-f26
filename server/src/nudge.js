// POST /api/nudge — ElevenLabs speaks the nudge (Gemini text to be added later).
// Called by the server (src/trigger.js) when the detector fires.
//
// req.body:
//   { state: 'unfocused'|'overStressed', reasons: string[], confidence: number (0–1),
//     metrics: {...}, baseline: {...}, gender: 'male'|'female',
//     tone: 'chill'|'sarcastic'|'strict', at: number (ms) }
//   (`text` may also be passed to override the message, for testing.)
//
// Respond with:
//   res.json({ text: string, audio?: string })   // audio = base64 mp3

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const GENDERS = ['male', 'female'];
const TONES = ['chill', 'sarcastic', 'strict'];

const VOICES = {
  male: {
    chill: 'BgdB8LkxV25DmnTgabLx',
    sarcastic: '3IwIPyXc0WRkgKBE8KXP',
    strict: 'onwK4e9ZLuTAKqWW03F9', // Daniel
  },
  female: {
    chill: 'tnSpp4vdxKPjI9w0GnoV',
    sarcastic: 'cgSgspJ2msm6clMCkdW9',
    strict: 'Xb7hH8MSUJpSbSDYk0k2', // 
  },
};

const TONE_SETTINGS = {
  chill: { stability: 0.75, similarityBoost: 0.75, speed: 0.9 },
  sarcastic: { stability: 0.3, similarityBoost: 0.75, style: 0.4, speed: 1.0 },
  strict: { stability: 0.85, similarityBoost: 0.8, speed: 1.05 },
};

// Temporary stand-in until Gemini writes the text.
const PLACEHOLDER_TEXT = {
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
};

let eleven = null;
// Created on first use so the API key is read after dotenv has loaded.
const client = () => (eleven ??= new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY }));

async function speak(text, gender, tone) {
  const audio = await client().textToSpeech.convert(VOICES[gender][tone], {
    text,
    modelId: 'eleven_flash_v2_5',
    outputFormat: 'mp3_44100_128',
    voiceSettings: TONE_SETTINGS[tone],
  });
  const buf = Buffer.from(await new Response(audio).arrayBuffer());
  return buf.toString('base64');
}

export async function nudgeHandler(req, res) {
  const { state, text: textOverride } = req.body ?? {};
  if (!state && !textOverride) return res.status(400).json({ error: 'missing "state"' });
  const gender = GENDERS.includes(req.body.gender) ? req.body.gender : 'female';
  const tone = TONES.includes(req.body.tone) ? req.body.tone : 'chill';

  // TODO: Gemini — write the line from state/reasons/metrics, in the chosen tone.
  const text = textOverride || PLACEHOLDER_TEXT[tone][state] || 'Take a short break.';

  try {
    const audio = await speak(text, gender, tone);
    return res.json({ text, audio });
  } catch (err) {
    console.error('ElevenLabs failed:', err.message);
    return res.json({ text }); // audio is optional; the browser falls back to speech
  }
}