// POST /api/nudge — Gemini writes the nudge, ElevenLabs speaks it.
// Called by the server (src/trigger.js) when the detector fires.
//
// req.body:
//   { state: 'unfocused'|'overStressed', reasons: string[], confidence: number (0–1),
//     metrics: { avgPulse, avgBreathing, lookAwayRatio, talkingRatio, tenseRatio, pulseCoverage, ... },
//     baseline: { pulse, breathing }, gender: 'male'|'female', tone: 'chill'|'sarcastic'|'strict', at: number (ms) }
//   (`text` may also be passed to override the message, for testing with curl.)
//
// Respond with:
//   res.json({ text: string, audio?: string })   // audio = base64 mp3
//
// The server forwards { text, audio } to the browser, which shows the text and
// plays the audio (or uses browser speech when audio is missing).

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const GENDERS = ['male', 'female'];
const TONES = ['chill', 'sarcastic', 'strict'];

// Search terms per tone, tried in order. ElevenLabs searches voice name,
// description and labels.
const TONE_SEARCH = {
  chill: ['calm', 'relaxed', 'soft', 'warm', 'casual'],
  sarcastic: ['sassy', 'playful', 'quirky', 'expressive', 'upbeat'],
  strict: ['authoritative', 'confident', 'firm', 'professional', 'deep'],
};

// ElevenLabs premade voices, used when search isn't permitted (the API key
// needs the voices_read permission) or finds nothing.
const FALLBACK_VOICES = {
  male: {
    chill: { voiceId: 'bIHbv24MWmeRgasZH58o', name: 'Will' },
    sarcastic: { voiceId: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie' },
    strict: { voiceId: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel' },
  },
  female: {
    chill: { voiceId: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
    sarcastic: { voiceId: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica' },
    strict: { voiceId: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice' },
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
    unfocused: "Wow, that wall must be fascinating. Your work misses you, by the way.",
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

// One voice lookup per gender/tone combination for the life of the server.
const voiceCache = new Map();

async function findVoice(gender, tone) {
  const key = `${gender}:${tone}`;
  if (voiceCache.has(key)) return voiceCache.get(key);

  let voice = null;
  let how;
  try {
    for (const term of TONE_SEARCH[tone]) {
      const { voices } = await client().voices.search({ gender, search: term, pageSize: 10 });
      if (voices.length) {
        voice = { voiceId: voices[0].voiceId, name: voices[0].name };
        how = `search: "${term}"`;
        break;
      }
    }
    if (!voice) {
      const { voices } = await client().voices.search({ gender, pageSize: 10 });
      if (voices.length) {
        voice = { voiceId: voices[0].voiceId, name: voices[0].name };
        how = `search: any ${gender} voice`;
      }
    }
    how ??= 'fallback: search found nothing';
  } catch (err) {
    how = err.statusCode === 401 ? 'fallback: search not permitted (key needs voices_read)' : `fallback: ${err.message}`;
  }

  voice ??= FALLBACK_VOICES[gender][tone];
  console.log(`[voice] ${gender}/${tone} → ${voice.name} (${how})`);
  voiceCache.set(key, voice);
  return voice;
}

async function speak(text, gender, tone) {
  const { voiceId } = await findVoice(gender, tone);
  const audio = await client().textToSpeech.convert(voiceId, {
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
