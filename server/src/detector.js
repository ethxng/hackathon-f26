// Deterministic focus/stress detector. Feed it one normalized sample per second
// (see normalize() in presage.js); it decides the state and when Gemini should
// be triggered. Time comes from sample.t, so the same input always gives the
// same output.
//
// States: calibrating -> focused | unfocused (distracted) | overStressed

export const DEFAULT_CONFIG = {
  // Stress rules are evaluated over this rolling window (vitals change slowly).
  windowMs: 10_000,

  // Resting baseline: median of the first N *reliable* pulse/breathing readings.
  baselineSamples: 10,
  // Give up waiting for a pulse baseline after this long and fall back to the
  // absolute thresholds, so bad lighting can't leave us calibrating forever.
  maxCalibrationMs: 45_000,

  // A new state must hold this long before we switch to it (both directions).
  holdMs: 2_000,

  unfocused: {
    // Shorter window than stress, so drifting is caught within ~5s.
    windowMs: 8_000,
    lookAwayRatio: 0.35, // looking away for > 35% of the window
    talkingRatio: 0.5,
    // Presage validation codes that mean "not looking at the screen".
    lookAwayValidation: ['kNoFaceFound', 'kFaceNotCentered', 'kFaceNotForward'],
  },

  overStressed: {
    pulseRatio: 1.08, // avg pulse > baseline * 1.08
    breathingRatio: 1.15,
    pulseAbs: 95, // used when there's no baseline
    breathingAbs: 20,
    strongPulseRatio: 1.10, // either of these alone is enough
    strongBreathingRatio: 1.25,
    tenseExpressionRatio: 0.2,
    minSignals: 2, // otherwise need 2 of: pulse, breathing, tense expression
  },
  tenseExpressions: ['angry', 'fear', 'sad', 'disgust', 'contempt'],

  quality: {
    // Presage confidences are 0–100 and start at 0 until their window fills
    // (~12s pulse, ~30s breathing). Tune these from real `npm run metrics` output.
    minPulseConfidence: 50,
    minBreathingConfidence: 50,
    minExpressionConfidence: 50,
    // Presage's per-reading `stable` flag. Off until we've confirmed Presage
    // actually sets it: protobuf decodes an unset bool as false, which would
    // reject every reading.
    requireStable: false,
    // Validation codes during which vitals are unreliable.
    blockingValidation: [
      'kExcessiveMotion',
      'kFaceTooClose',
      'kFaceTooFar',
      'kTooDark',
      'kTooBright',
      'kCameraTuning',
      'kFrameRateTooLow',
      'kMultipleFacesFound',
      'kNoFaceFound',
    ],
    // Share of the window that needs a reliable pulse before stress is judged.
    minPulseCoverage: 0.6,
    // State confidence (0–1) needed before a Gemini trigger.
    minTriggerConfidence: 0.6,
  },

  // Gemini trigger rate limits.
  stateCooldownMs: 60_000,
  globalCooldownMs: 20_000,
};

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const weightedMean = (pairs) => {
  const total = pairs.reduce((a, [, w]) => a + w, 0);
  return total ? pairs.reduce((a, [v, w]) => a + v * w, 0) / total : null;
};
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const round2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
const pct = (r) => `${Math.round(r * 100)}%`;
// Fraction of samples where pred is true, ignoring samples where it's unknown (null).
const ratio = (samples, pred) => {
  const known = samples.map(pred).filter((v) => v != null);
  return known.length ? known.filter(Boolean).length / known.length : null;
};
// confidence = dataQuality × strength, where strength grows from 0.5 at the
// threshold to 1.0 once the signal is well past it.
const stateConfidence = (dataQuality, excess) => round2(dataQuality * (0.5 + 0.5 * Math.min(1, Math.max(0, excess))));

function mergeConfig(overrides) {
  const c = { ...DEFAULT_CONFIG, ...overrides };
  for (const key of ['unfocused', 'overStressed', 'quality']) c[key] = { ...DEFAULT_CONFIG[key], ...overrides[key] };
  return c;
}

// Which values in a sample are trustworthy. Shared by the detector and the
// server (to tell the UI when to show a number vs "Measuring…").
export function assessQuality(sample, quality = DEFAULT_CONFIG.quality) {
  const blocked = sample.validation != null && quality.blockingValidation.includes(sample.validation);
  const ok = (value, confidence, min, stable) =>
    value != null &&
    !blocked &&
    confidence != null &&
    confidence >= min &&
    !(quality.requireStable && stable === false);
  return {
    pulseReliable: ok(sample.pulse, sample.pulseConfidence, quality.minPulseConfidence, sample.pulseStable),
    breathingReliable: ok(
      sample.breathing,
      sample.breathingConfidence,
      quality.minBreathingConfidence,
      sample.breathingStable
    ),
    expressionReliable:
      sample.expression != null &&
      sample.expressionConfidence != null &&
      sample.expressionConfidence >= quality.minExpressionConfidence,
  };
}

export function createDetector(overrides = {}) {
  const c = mergeConfig(overrides);
  const q = c.quality;
  let window = [];
  let startT = null;
  const baselineReadings = { pulse: [], breathing: [] };
  const baseline = { pulse: null, breathing: null };
  let state = 'calibrating';
  let candidate = null;
  let candidateSince = null;
  let episodeTriggered = false;
  const lastFiredByState = {};
  let lastFiredAt = -Infinity;

  // Unreliable values become null, so every rule below ignores them.
  function gate(sample) {
    const { pulseReliable, breathingReliable, expressionReliable } = assessQuality(sample, q);
    return {
      ...sample,
      pulse: pulseReliable ? sample.pulse : null,
      breathing: breathingReliable ? sample.breathing : null,
      expression: expressionReliable ? sample.expression : null,
    };
  }

  function updateBaseline(s) {
    for (const key of ['pulse', 'breathing']) {
      if (baseline[key] != null || s[key] == null) continue;
      baselineReadings[key].push(s[key]);
      if (baselineReadings[key].length >= c.baselineSamples) baseline[key] = round1(median(baselineReadings[key]));
    }
  }

  const lookAwayCodes = new Set(c.unfocused.lookAwayValidation);
  // true/false when known, null when there's no face info in the sample.
  const isLookingAway = (s) => {
    if (s.validation != null) return lookAwayCodes.has(s.validation);
    if (s.faceDetected == null && s.faceCentered == null) return null;
    return s.faceDetected === false || s.faceCentered === false;
  };

  function metrics(t) {
    const tense = new Set(c.tenseExpressions);
    const recent = window.filter((s) => s.t > t - c.unfocused.windowMs);
    const withPulse = window.filter((s) => s.pulse != null);
    const withBreath = window.filter((s) => s.breathing != null);
    const faceKnown = recent.filter((s) => isLookingAway(s) != null);
    return {
      avgPulse: round1(weightedMean(withPulse.map((s) => [s.pulse, s.pulseConfidence]))),
      avgBreathing: round1(weightedMean(withBreath.map((s) => [s.breathing, s.breathingConfidence]))),
      pulseCoverage: round2(withPulse.length / window.length),
      meanPulseConfidence: round1(mean(withPulse.map((s) => s.pulseConfidence))),
      // Distraction metrics use the shorter unfocused window.
      faceCoverage: round2(faceKnown.length / recent.length),
      lookAwayRatio: ratio(recent, isLookingAway),
      talkingRatio: ratio(recent, (s) => s.talking),
      tenseRatio: ratio(window, (s) => (s.expression == null ? null : tense.has(s.expression))),
    };
  }

  function checkUnfocused(m) {
    const r = c.unfocused;
    const reasons = [];
    const excess = [];
    if (m.lookAwayRatio != null && m.lookAwayRatio > r.lookAwayRatio) {
      reasons.push(`looking away ${pct(m.lookAwayRatio)} of the last ${r.windowMs / 1000}s`);
      excess.push((m.lookAwayRatio - r.lookAwayRatio) / (1 - r.lookAwayRatio));
    }
    if (m.talkingRatio != null && m.talkingRatio > r.talkingRatio) {
      reasons.push(`talking ${pct(m.talkingRatio)} of the last ${r.windowMs / 1000}s`);
      excess.push((m.talkingRatio - r.talkingRatio) / (1 - r.talkingRatio));
    }
    return { reasons, confidence: reasons.length ? stateConfidence(m.faceCoverage, Math.max(...excess)) : null };
  }

  function checkOverStressed(m) {
    const none = { reasons: [], confidence: null };
    // Not enough trustworthy pulse data: don't guess (avoids false alarms).
    if (m.pulseCoverage < q.minPulseCoverage) return none;

    const r = c.overStressed;
    const pulseMax = baseline.pulse != null ? baseline.pulse * r.pulseRatio : r.pulseAbs;
    const breathMax = baseline.breathing != null ? baseline.breathing * r.breathingRatio : r.breathingAbs;
    const vs = (key) => (baseline[key] != null ? ` (resting ${baseline[key]})` : '');
    const reasons = [];
    const excess = [];
    if (m.avgPulse != null && m.avgPulse > pulseMax) {
      reasons.push(`heart rate ${m.avgPulse} bpm${vs('pulse')}`);
      excess.push(baseline.pulse != null ? (m.avgPulse / baseline.pulse - r.pulseRatio) / 0.1 : (m.avgPulse - r.pulseAbs) / 10);
    }
    if (m.avgBreathing != null && m.avgBreathing > breathMax) {
      reasons.push(`breathing ${m.avgBreathing}/min${vs('breathing')}`);
      excess.push(
        baseline.breathing != null
          ? (m.avgBreathing / baseline.breathing - r.breathingRatio) / 0.2
          : (m.avgBreathing - r.breathingAbs) / 4
      );
    }
    if (m.tenseRatio != null && m.tenseRatio > r.tenseExpressionRatio) {
      reasons.push(`tense expression ${pct(m.tenseRatio)} of the time`);
      excess.push((m.tenseRatio - r.tenseExpressionRatio) / (1 - r.tenseExpressionRatio));
    }
    const strongPulse =
      baseline.pulse != null && m.avgPulse != null && m.avgPulse > baseline.pulse * r.strongPulseRatio;
    const strongBreathing =
      baseline.breathing != null &&
      m.avgBreathing != null &&
      m.avgBreathing > baseline.breathing * r.strongBreathingRatio;
    if (reasons.length < r.minSignals && !strongPulse && !strongBreathing) return none;

    const dataQuality = m.pulseCoverage * ((m.meanPulseConfidence ?? 0) / 100);
    return { reasons, confidence: stateConfidence(dataQuality, Math.max(...excess)) };
  }

  function calibrationReason(raw) {
    const have = baselineReadings.pulse.length;
    if (have) return `learning resting heart rate (${have}/${c.baselineSamples})`;
    if (raw.validation != null && q.blockingValidation.includes(raw.validation))
      return `waiting for a clean signal (${raw.validation})`;
    if (raw.pulseConfidence != null) return `warming up — pulse confidence ${raw.pulseConfidence}/${q.minPulseConfidence}`;
    return 'waiting for first pulse reading';
  }

  // Returns { state, reasons, confidence, metrics, baseline, changed, trigger }.
  // `confidence` (0–1) is for the current state (null when focused/calibrating).
  // `trigger` is set when Gemini should be called.
  function push(raw) {
    const t = raw.t;
    startT ??= t;
    const sample = gate(raw);
    window.push(sample);
    window = window.filter((s) => s.t > t - c.windowMs);
    updateBaseline(sample);
    const m = metrics(t);

    const calibrated = baseline.pulse != null || t - startT >= c.maxCalibrationMs;
    if (!calibrated) {
      return {
        state,
        reasons: [calibrationReason(raw)],
        confidence: null,
        metrics: m,
        baseline: { ...baseline },
        changed: false,
        trigger: null,
      };
    }

    // Priority: stressed beats distracted.
    const stress = checkOverStressed(m);
    const unfocused = checkUnfocused(m);
    const next = stress.reasons.length ? 'overStressed' : unfocused.reasons.length ? 'unfocused' : 'focused';

    // Leaving calibration is immediate; any other switch must hold for holdMs.
    let changed = false;
    if (next === state) {
      candidate = null;
    } else if (state === 'calibrating') {
      state = next;
      changed = true;
    } else {
      if (candidate !== next) {
        candidate = next;
        candidateSince = t;
      }
      if (t - candidateSince >= c.holdMs) {
        state = next;
        candidate = null;
        changed = true;
      }
    }
    if (changed) episodeTriggered = false;

    const current = { overStressed: stress, unfocused, focused: { reasons: [], confidence: null } }[state];

    // Fire once per episode, as soon as the evidence is strong enough.
    let trigger = null;
    if (
      state !== 'focused' &&
      !episodeTriggered &&
      current.confidence != null &&
      current.confidence >= q.minTriggerConfidence &&
      t - lastFiredAt >= c.globalCooldownMs &&
      t - (lastFiredByState[state] ?? -Infinity) >= c.stateCooldownMs
    ) {
      episodeTriggered = true;
      lastFiredAt = lastFiredByState[state] = t;
      trigger = {
        state,
        reasons: current.reasons,
        confidence: current.confidence,
        metrics: m,
        baseline: { ...baseline },
        at: t,
      };
    }

    return {
      state,
      reasons: current.reasons,
      confidence: current.confidence,
      metrics: m,
      baseline: { ...baseline },
      changed,
      trigger,
    };
  }

  return {
    push,
    get state() {
      return state;
    },
  };
}
