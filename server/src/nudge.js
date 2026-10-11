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
    strict: 'onwK4e9ZLuTAKqWW03F9',
  },
  female: {
    chill: 'tnSpp4vdxKPjI9w0GnoV',
    sarcastic: 'cgSgspJ2msm6clMCkdW9',
    strict: 'Xb7hH8MSUJpSbSDYk0k2',
  },
};

const TONE_SETTINGS = {
  chill: { stability: 0.75, similarityBoost: 0.75, speed: 0.9 },
  sarcastic: { stability: 0.3, similarityBoost: 0.75, style: 0.4, speed: 1.0 },
  strict: { stability: 0.85, similarityBoost: 0.8, speed: 1.05 },
};

// Temporary stand-in until Gemini writes the text.
// LINES[gender][tone][state] = 5 lines, one picked at random.
const LINES = {
  female: {
    chill: {
      unfocused: [
        "Hey, no stress, but your attention wandered off. Let's ease back into it.",
        "Looks like your mind drifted. That's okay, just come back when you're ready.",
        'Gentle nudge: your focus slipped a bit. Take a breath and pick it back up.',
        "No worries, everyone drifts. Let's settle back in whenever you're ready.",
        'Your attention took a little walk. Wave it back and ease into the next step.',
      ],
      overStressed: [
        "You seem a little wound up. Breathe in slow, breathe out slower. You've got this.",
        "Let's pause for a second. One slow breath, then back at your own pace.",
        'Things look a bit tense. Loosen your shoulders and take a calm breath.',
        "Easy now. There's no rush, so take a moment to settle.",
        'A short breather could help right now. In through the nose, out slowly.',
      ],
    },
    sarcastic: {
      unfocused: [
        'Wow, that wall must be fascinating. Your work misses you, by the way.',
        'Oh, are we sightseeing now? Your screen is right here, still waiting.',
        "Great news, you're breaking records for staring at nothing. Back to work.",
        "I'd say your focus left the building, but it didn't even say goodbye.",
        "Truly riveting stuff over there, I'm sure. Meanwhile, your work is right here.",
      ],
      overStressed: [
        "Your heart's racing like you're defusing a bomb. It's homework. Breathe.",
        'Wow, so dramatic. Take a breath before you break something.',
        "Oh good, full panic mode. Let's try a slow breath instead.",
        "Relax, the deadline isn't chasing you. Probably. Breathe anyway.",
        "That's a lot of stress for one task. Shake it out and take a breath.",
      ],
    },
    strict: {
      unfocused: [
        'Eyes back on your work. Now. You can look around when the session is over.',
        'Focus. Your attention has drifted, so bring it back right now.',
        'Stop wandering. Return to the task and finish what you started.',
        "That's enough distraction. Back to work, starting immediately.",
        'Attention on the task. You set this time aside, so use it.',
      ],
      overStressed: [
        'Stop. Take three slow breaths, then continue. Panicking will not finish this faster.',
        'Pause now. Breathe in for four, out for six, then resume.',
        "You're tense. Put everything down, breathe slowly, then continue with a clear head.",
        'Reset. Slow breaths, steady hands, then back to work.',
        "Stress won't help you here. Breathe, regroup, and carry on.",
      ],
    },
  },
  male: {
    chill: {
      unfocused: [
        "Hey, easy does it. Your focus drifted, so let's bring it back nice and gentle.",
        "No pressure, but your mind wandered. Whenever you're ready, hop back in.",
        "Looks like you zoned out for a bit. All good, let's ease back to it.",
        'Quick heads up: your attention slipped. Take a breath and carry on.',
        'You drifted a little, no big deal. Settle in and pick up where you left off.',
      ],
      overStressed: [
        "Hey, you look a bit tense. Slow breath in, slow breath out. You're doing fine.",
        "Let's take it down a notch. One deep breath, then keep going at your pace.",
        'Easy, buddy. Drop your shoulders and breathe for a moment.',
        "Things seem a little tight. Pause, breathe, and come back when you're ready.",
        'No rush at all. Take a calm breath and let the tension go.',
      ],
    },
    sarcastic: {
      unfocused: [
        "Nice view over there? Your work's been waiting patiently, you know.",
        "Oh, so we're doing nothing now. Bold strategy. Back to it.",
        'Impressive commitment to not working. Maybe point those eyes at the screen.',
        "Don't mind me, just noting that your attention has left the chat.",
        "Staring into space is a skill, I'll give you that. Now use the other one.",
      ],
      overStressed: [
        "Easy, champ. You're acting like the deadline is chasing you. Breathe.",
        'That heart rate says action movie. The task says otherwise. Slow down.',
        'Oh sure, panic. That always speeds things up. Try a deep breath instead.',
        'Take it down a notch before you launch into orbit. Breathe.',
        'Impressive amount of tension for one task. Shoulders down, deep breath.',
      ],
    },
    strict: {
      unfocused: [
        'Eyes on the screen. Your focus has slipped, so fix it now.',
        'Stop drifting. Get back to the task right away.',
        'No more distractions. Refocus and keep going.',
        "You're off task. Correct that immediately.",
        'Back to work. Breaks are for later, not now.',
      ],
      overStressed: [
        'Stop and breathe. Three slow breaths, then continue with control.',
        "You're too tense to work well. Pause, breathe deeply, then resume.",
        'Reset right now. Slow your breathing and steady yourself.',
        'Stress is not helping. Breathe out slowly and regroup.',
        'Pause. Drop your shoulders, breathe, then pick the task back up.',
      ],
    },
  },
};

// Random line, never the same one twice in a row for a given combination.
const lastPicked = new Map();
function pickLine(gender, tone, state) {
  const lines = LINES[gender]?.[tone]?.[state];
  if (!lines?.length) return null;
  const key = `${gender}:${tone}:${state}`;
  let i = Math.floor(Math.random() * lines.length);
  if (lines.length > 1 && i === lastPicked.get(key)) {
    i = (i + 1 + Math.floor(Math.random() * (lines.length - 1))) % lines.length;
  }
  lastPicked.set(key, i);
  return lines[i];
}

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
  const text = textOverride || pickLine(gender, tone, state) || 'Take a short break.';

  try {
    const audio = await speak(text, gender, tone);
    return res.json({ text, audio });
  } catch (err) {
    console.error('ElevenLabs failed:', err.message);
    return res.json({ text }); // audio is optional; the browser falls back to speech
  }
}