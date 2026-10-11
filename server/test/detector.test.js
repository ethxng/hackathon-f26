import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessQuality, createDetector } from '../src/detector.js';

// How Presage reports a missing face / a turned head.
const NO_FACE = { validation: 'kNoFaceFound', faceDetected: false };
const TURNED = { validation: 'kFaceNotForward' };

const CALM = {
  pulse: 70,
  pulseConfidence: 90,
  breathing: 14,
  breathingConfidence: 90,
  validation: 'kOk',
  faceDetected: true,
  faceCentered: true,
  talking: false,
  expression: 'neutral',
  expressionConfidence: 80,
};

// Feeds one sample per second; `at(i)` returns overrides for second i.
function run(detector, seconds, at = () => ({}), startSec = 0) {
  const results = [];
  for (let i = startSec; i < startSec + seconds; i++) {
    results.push(detector.push({ type: 'metrics', t: i * 1000, ...CALM, ...at(i) }));
  }
  return results;
}

// Calibrated detector at t = 20s, sitting in `focused`.
function calibrated(config) {
  const d = createDetector(config);
  run(d, 20);
  assert.equal(d.state, 'focused');
  return d;
}

test('stays calibrating until 10 pulse readings, then goes focused', () => {
  const d = createDetector();
  const r = run(d, 13, (i) => (i < 3 ? { pulse: null, pulseConfidence: null } : {}));
  assert.equal(r[0].reasons[0], 'waiting for first pulse reading');
  assert.equal(r[5].state, 'calibrating');
  assert.match(r[5].reasons[0], /learning resting heart rate \(3\/10\)/);
  assert.equal(r[11].state, 'calibrating'); // 9 readings
  assert.equal(r[12].state, 'focused');
  assert.equal(r[12].baseline.pulse, 70);
});

test('face missing → unfocused only after the hold time, then recovers', () => {
  const d = calibrated();
  const away = run(d, 15, () => NO_FACE, 20);
  const firstUnfocused = away.findIndex((r) => r.state === 'unfocused');
  // Needs > 35% of the 8s window away (3 samples) plus the 2s hold: ~5s.
  assert.ok(firstUnfocused >= 3 && firstUnfocused <= 5, `switched at +${firstUnfocused}s`);
  assert.match(away.at(-1).reasons[0], /looking away/);

  const back = run(d, 20, () => ({}), 35);
  assert.equal(back.at(-1).state, 'focused');
  assert.deepEqual(back.at(-1).reasons, []);
});

test('a single glance away does not flip the state', () => {
  const d = calibrated();
  const r = run(d, 15, (i) => (i === 25 ? TURNED : {}), 20);
  assert.ok(r.every((x) => x.state === 'focused'));
});

test('turning your head (kFaceNotForward) counts as looking away', () => {
  const d = calibrated();
  const r = run(d, 8, () => TURNED, 20);
  const first = r.findIndex((x) => x.state === 'unfocused');
  assert.ok(first >= 3 && first <= 5, `switched at +${first}s`);
  assert.match(r.at(-1).reasons[0], /looking away \d+% of the last 8s/);
});

test('glancing away 2s out of every 8 is not drifting', () => {
  const d = calibrated();
  const r = run(d, 24, (i) => (i % 8 < 2 ? TURNED : {}), 20);
  assert.ok(r.every((x) => x.state === 'focused'));
});

test('talking most of the time → unfocused', () => {
  const d = calibrated();
  const r = run(d, 20, () => ({ talking: true }), 20);
  assert.equal(r.at(-1).state, 'unfocused');
  assert.match(r.at(-1).reasons[0], /talking/);
});

test('pulse above 100 and well above resting → overStressed', () => {
  const d = calibrated();
  const r = run(d, 20, () => ({ pulse: 105 }), 20);
  assert.equal(r.at(-1).state, 'overStressed');
  assert.match(r.at(-1).reasons[0], /heart rate .* \(resting 70\)/);
});

test('below 100 bpm is never stress, even with fast breathing and a tense face', () => {
  const d = calibrated();
  const r = run(d, 20, () => ({ pulse: 98, breathing: 22, expression: 'angry' }), 20).at(-1);
  assert.equal(r.state, 'focused');
});

test('above 100 bpm still needs the other rules to pass', () => {
  // Resting 95: 102 is above 100 but not 8% above resting, with no other signal.
  const d = createDetector();
  run(d, 20, () => ({ pulse: 95 }));
  assert.equal(run(d, 20, () => ({ pulse: 102 }), 20).at(-1).state, 'focused');
  // Same pulse plus fast breathing and a tense face → two signals → stressed.
  const r = run(d, 20, () => ({ pulse: 102, breathing: 20, expression: 'angry' }), 40).at(-1);
  assert.equal(r.state, 'overStressed');
});

test('stressed wins over distracted', () => {
  const d = calibrated();
  const r = run(d, 20, () => ({ pulse: 110, ...TURNED }), 20);
  assert.equal(r.at(-1).state, 'overStressed');
});

test('one trigger per episode, none again inside the cooldown', () => {
  // Pinned so the test doesn't break when the defaults are tuned.
  const d = calibrated({ stateCooldownMs: 60_000, globalCooldownMs: 20_000 });
  let t = 20;
  const episode = (overrides, secs) => {
    const r = run(d, secs, () => overrides, t);
    t += secs;
    return r.filter((x) => x.trigger).length;
  };
  assert.equal(episode(NO_FACE, 20), 1);
  episode({}, 20); // recover
  assert.equal(d.state, 'focused');
  assert.equal(episode(NO_FACE, 15), 0); // still within the 60s per-state cooldown
  episode({}, 20);
  assert.equal(episode(NO_FACE, 20), 1); // cooldown over
});

test('no pulse ever → leaves calibrating at 45s using absolute thresholds', () => {
  const d = createDetector();
  const r = run(d, 50, () => ({ pulse: null, pulseConfidence: null }));
  assert.equal(r[43].state, 'calibrating');
  assert.equal(r[46].state, 'focused');
  assert.equal(r[46].baseline.pulse, null);
});

test('assessQuality: confidence threshold, stable flag, blocking validation', () => {
  const base = { ...CALM };
  assert.equal(assessQuality({ ...base, pulseConfidence: 30 }).pulseReliable, true);
  assert.equal(assessQuality({ ...base, pulseConfidence: 29 }).pulseReliable, false);
  assert.equal(assessQuality({ ...base, pulseConfidence: null }).pulseReliable, false);
  assert.equal(assessQuality({ ...base, pulse: null }).pulseReliable, false);
  assert.equal(assessQuality({ ...base, validation: 'kExcessiveMotion' }).pulseReliable, false);
  assert.equal(assessQuality({ ...base, validation: 'kExcessiveMotion' }).breathingReliable, false);
  assert.equal(assessQuality({ ...base, expressionConfidence: 20 }).expressionReliable, false);
  // stable is ignored by default, enforced when requireStable is on
  const strict = { ...createDetectorQuality(), requireStable: true };
  assert.equal(assessQuality({ ...base, pulseStable: false }).pulseReliable, true);
  assert.equal(assessQuality({ ...base, pulseStable: false }, strict).pulseReliable, false);
});

function createDetectorQuality() {
  return { minPulseConfidence: 50, minBreathingConfidence: 50, minExpressionConfidence: 50, requireStable: false, blockingValidation: ['kExcessiveMotion'] };
}

test('low-confidence warm-up readings do not count toward or skew the baseline', () => {
  const d = createDetector();
  // 10s of warm-up at a wrong value with low confidence, then real readings.
  const r = run(d, 21, (i) => (i < 10 ? { pulse: 50, pulseConfidence: 10 } : {}));
  assert.match(r[5].reasons[0], /warming up — pulse confidence 10\/30/);
  assert.equal(r[18].state, 'calibrating'); // only 9 reliable readings so far
  assert.equal(r[19].state, 'focused');
  assert.equal(r[19].baseline.pulse, 70); // not dragged toward 50
});

test('readings during excessive motion are ignored', () => {
  const d = createDetector();
  const r = run(d, 5, () => ({ validation: 'kExcessiveMotion' }));
  assert.match(r[4].reasons[0], /waiting for a clean signal \(kExcessiveMotion\)/);

  // A pulse spike that only happens while moving is not stress.
  const c = calibrated();
  const moving = run(c, 20, () => ({ pulse: 110, validation: 'kExcessiveMotion' }), 20);
  assert.equal(moving.at(-1).state, 'focused');
});

test('high pulse with too little reliable coverage is not judged as stress', () => {
  const d = calibrated();
  // Only every third second has a confident reading (~33% coverage < 60%).
  const r = run(d, 20, (i) => ({ pulse: 110, pulseConfidence: i % 3 === 0 ? 90 : 20 }), 20);
  assert.equal(r.at(-1).state, 'focused');
});

test('state confidence scales with how far past the threshold the signal is', () => {
  const mild = calibrated();
  const strong = calibrated();
  const a = run(mild, 20, () => ({ pulse: 102 }), 20).at(-1); // just above 100
  const b = run(strong, 20, () => ({ pulse: 118 }), 20).at(-1);
  assert.equal(a.state, 'overStressed');
  assert.equal(b.state, 'overStressed');
  assert.ok(b.confidence > a.confidence, `${b.confidence} should exceed ${a.confidence}`);
  assert.ok(b.confidence <= 1 && a.confidence > 0);
});

test('trigger waits for enough confidence, then fires once in the episode', () => {
  const d = calibrated();
  // Stressed by pulse alone, but readings only just reliable (confidence 50) -> state confidence ≤ 0.5.
  const weak = run(d, 20, () => ({ pulse: 110, pulseConfidence: 50 }), 20);
  assert.equal(weak.at(-1).state, 'overStressed');
  assert.ok(weak.every((r) => !r.trigger), 'should not trigger on weak evidence');

  // Same episode, readings firm up -> exactly one trigger.
  const firm = run(d, 20, () => ({ pulse: 110, pulseConfidence: 95 }), 40);
  assert.equal(firm.filter((r) => r.trigger).length, 1);
  assert.ok(firm.find((r) => r.trigger).trigger.confidence >= 0.6);
});
