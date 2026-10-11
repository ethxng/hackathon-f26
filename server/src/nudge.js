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
        'Hey bestie, your brain wandered off. No stress, just hop back in.',
        "Lowkey drifting there. Totally fine, let's gently get back to it.",
        'Your focus took a little detour. Come back whenever you are ready.',
        'No worries, we all zone out. Easy reset and we are back.',
        'Soft reminder: your attention left the chat. Let us bring it home.',
      ],
      overStressed: [
        "You're giving tense vibes. Breathe in slow, out slower. You've got this.",
        'Quick reset time. One deep breath, then back at your own pace.',
        'Shoulders down bestie, the vibes are a little tight right now.',
        'No rush. Take a breath, let it go, and keep it moving.',
        "Let's slow it down for a sec. In through the nose, out gently.",
      ],
    },
    sarcastic: {
      unfocused: [
        'Not you staring at nothing. The screen is right here, bestie.',
        "Oh cool, we're doing brain rot instead of work. Love that for you.",
        'Your focus really said see you later. Ask it to come back.',
        'Be so for real, that wall is not that interesting.',
        'The audacity of you to zone out while your work waits.',
      ],
      overStressed: [
        "Okay main character, it's just a task. Breathe before you spiral.",
        "That's a lot of panic for one assignment. Deep breath, please.",
        "Calm down, nobody's chasing you. Breathe like you mean it.",
        'We love the drama, but the vibes need a breath.',
        'Stress mode activated. Cute. Now take a slow breath.',
      ],
    },
    strict: {
      unfocused: [
        'Lock in. Eyes on the screen, starting right now.',
        'No more zoning out. Get locked in and finish this.',
        'Focus up. The scrolling in your head can wait.',
        'Time to get serious. Lock in and put in the work.',
        'Stop drifting. Lock in, no cap, and get it done.',
      ],
      overStressed: [
        'Pause. Three slow breaths, then lock back in. No spiraling.',
        'Reset now. Slow breath, steady hands, then back to the grind.',
        "Stressing won't finish this faster. Breathe, then lock in.",
        'Take a breath and get your head right. Then we keep moving.',
        'Stop and breathe. Clear your head, then get back to it.',
      ],
    },
  },
  male: {
    chill: {
      unfocused: [
        "Yo, easy does it. Your focus wandered, so let's slide back in.",
        'Lowkey zoned out there. No stress, just ease back into it.',
        'Your brain went on a side quest. Come back when you are ready.',
        'All good, everybody drifts. Take a breath and pick it back up.',
        "Small check in: your attention went missing. No worries, let's find it.",
      ],
      overStressed: [
        "Things are feeling tense. Slow breath in, slow breath out. You're good.",
        "Let's take it down a notch. One deep breath and keep rolling.",
        'Easy now. Drop your shoulders and let the stress go.',
        'No rush at all. Breathe, reset, and we vibe back into it.',
        'Quick pause. Deep breath, then back at your own pace.',
      ],
    },
    sarcastic: {
      unfocused: [
        'Bold move, zoning out. Your work is still right here, by the way.',
        'Oh nice, side quest unlocked. Maybe finish the main quest first.',
        'Your attention really left the chat. Rude, honestly.',
        "That's some elite staring at nothing. Now use those eyes on the screen.",
        'Imagine focusing. Wild idea, I know. Give it a shot.',
      ],
      overStressed: [
        "Easy there, it's a task, not the final boss. Breathe.",
        "That's some big panic energy for one task. Deep breath, chief.",
        'Oh sure, stressing totally helps. Try a slow breath instead.',
        'Calm down before you launch into orbit. Breathe.',
        "Impressive tension levels. Shoulders down, deep breath, we're good.",
      ],
    },
    strict: {
      unfocused: [
        'Lock in. Eyes on the screen, no excuses.',
        'Focus up. Quit drifting and get back to work.',
        'No more zoning out. Get locked in and finish strong.',
        "You're off track. Reset and lock back in right now.",
        'Time to grind. Distractions out, mind in, let us go.',
      ],
      overStressed: [
        'Stop and breathe. Three slow ones, then lock back in.',
        'Too tense to work well. Pause, breathe deep, then get back to it.',
        'Reset right now. Slow breath, clear head, then keep moving.',
        "Stress isn't helping. Breathe out slow and lock back in.",
        'Pause. Shoulders down, one deep breath, then back to the task.',
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