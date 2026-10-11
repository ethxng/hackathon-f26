// Session focus score (0–100), ticked once per second with the detector's
// state. Climbs while you're in the zone, drops when you drift. Time comes from
// sample timestamps, so the same input always gives the same score.

export const SCORE_CONFIG = {
  start: 100, // start full; drifts cost points, focus earns them back
  max: 100,
  min: 0,
  focusedGainPerSec: 0.5, // +10 every 20s of focus
  driftPenalty: 10, // once, on entering `unfocused`
  driftLossPerSec: 1, // while staying `unfocused`
  // `overStressed` and `calibrating` hold the score.
  maxTickMs: 2_000, // a gap in data can't cause a big jump
};

export function createFocusScore(overrides = {}) {
  const c = { ...SCORE_CONFIG, ...overrides };
  let value = c.start;
  let lastT = null;
  let lastState = null;

  const clamp = (v) => Math.min(c.max, Math.max(c.min, v));

  return {
    tick(state, t) {
      const dtSec = lastT == null ? 0 : Math.min(c.maxTickMs, Math.max(0, t - lastT)) / 1000;
      if (state === 'focused') {
        value += c.focusedGainPerSec * dtSec;
      } else if (state === 'unfocused') {
        if (lastState !== 'unfocused') value -= c.driftPenalty;
        else value -= c.driftLossPerSec * dtSec;
      }
      value = clamp(value);
      lastT = t;
      lastState = state;
      return value;
    },
    reset() {
      value = c.start;
      lastT = null;
      lastState = null;
    },
    get value() {
      return value;
    },
  };
}
