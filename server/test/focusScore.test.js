import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFocusScore } from '../src/focusScore.js';

// Ticks once per second in `state` for `seconds`, continuing from second `from`.
function tickFor(score, state, seconds, from = 0) {
  for (let i = from; i < from + seconds; i++) score.tick(state, i * 1000);
  return from + seconds;
}

test('starts at 50 and climbs 0.5 per second while focused', () => {
  const s = createFocusScore();
  assert.equal(s.value, 50);
  tickFor(s, 'focused', 21); // first tick has no elapsed time, then 20s
  assert.equal(s.value, 60);
});

test('caps at 100', () => {
  const s = createFocusScore();
  tickFor(s, 'focused', 300);
  assert.equal(s.value, 100);
});

test('drifting costs 10 at once, then 1 per second', () => {
  const s = createFocusScore();
  let t = tickFor(s, 'focused', 1); // 50
  t = tickFor(s, 'unfocused', 1, t);
  assert.equal(s.value, 40);
  tickFor(s, 'unfocused', 5, t);
  assert.equal(s.value, 35);
});

test('each new drift episode is penalized again', () => {
  const s = createFocusScore();
  let t = tickFor(s, 'focused', 1);
  t = tickFor(s, 'unfocused', 1, t); // 40
  t = tickFor(s, 'focused', 4, t); // +2 → 42
  tickFor(s, 'unfocused', 1, t); // −10 → 32
  assert.equal(s.value, 32);
});

test('never drops below 0', () => {
  const s = createFocusScore();
  tickFor(s, 'unfocused', 200);
  assert.equal(s.value, 0);
});

test('stressed and calibrating hold the score', () => {
  const s = createFocusScore();
  let t = tickFor(s, 'calibrating', 10);
  assert.equal(s.value, 50);
  t = tickFor(s, 'focused', 11, t); // +5 (first focused tick counts 1s from the last calibrating tick)
  const before = s.value;
  tickFor(s, 'overStressed', 30, t);
  assert.equal(s.value, before);
});

test('a gap in data counts as at most 2 seconds', () => {
  const s = createFocusScore();
  s.tick('focused', 0);
  s.tick('focused', 60_000); // a minute with no samples
  assert.equal(s.value, 51);
});

test('reset goes back to 50', () => {
  const s = createFocusScore();
  tickFor(s, 'focused', 50);
  s.reset();
  assert.equal(s.value, 50);
  s.tick('focused', 999_000); // no jump from the old timestamps
  assert.equal(s.value, 50);
});
