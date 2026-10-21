// spaced.test.js — forgetting-curve scheduling: boxes, due times, key roundtrip
import test from 'node:test';
import assert from 'node:assert/strict';
import { GAPS_MIN, ensureRec, grade, isDue, byWeakness, scenarioForKey } from '../src/engine/spaced.js';
import { randomScenario, scenarioKey } from '../src/engine/strategy.js';

function seeded(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('correct answers climb boxes and push the due time out', () => {
  const now = 1_000_000;
  let r = grade(undefined, true, now);
  assert.equal(r.box, 1);
  assert.equal(r.due, now + GAPS_MIN[1] * 60_000);
  r = grade(r, true, now);
  assert.equal(r.box, 2);
  assert.equal(r.due, now + GAPS_MIN[2] * 60_000);
  assert.equal(r.missStreak, 0);
});

test('misses drop the box and make the scenario due almost immediately', () => {
  let r = grade(undefined, true, 0);
  r = grade(r, true, 0);
  r = grade(r, true, 0);
  assert.equal(r.box, 3);
  const now = 5_000_000;
  r = grade(r, false, now);
  assert.equal(r.box, 2);
  assert.equal(r.missStreak, 1);
  assert.equal(r.due, now + GAPS_MIN[2] * 60_000);
  r = grade(r, false, now);
  assert.equal(r.box, 1);
  assert.equal(r.missStreak, 2);
});

test('box caps at 5 and mastered scenarios stop resurfacing', () => {
  let r;
  for (let i = 0; i < 10; i++) r = grade(r, true, 0);
  assert.equal(r.box, 5);
  assert.equal(isDue(r, Date.now() + 1000 * 60 * 60 * 24 * 365), false, 'top box stays retired');
});

test('isDue respects the timestamp', () => {
  const r = ensureRec({ seen: 3, right: 1, box: 1, due: 1000, missStreak: 2 });
  assert.equal(isDue(r, 999), false);
  assert.equal(isDue(r, 1000), true);
});

test('legacy records (seen/right only) migrate with box 0', () => {
  const r = ensureRec({ seen: 7, right: 2 });
  assert.equal(r.box, 0);
  assert.equal(r.due, 0);
  assert.equal(r.seen, 7);
  assert.ok(isDue(r), 'old unresolved trouble spots are due immediately');
});

test('byWeakness sorts lower boxes first, then most overdue', () => {
  const high = ensureRec({ box: 4, due: 100 });
  const low = ensureRec({ box: 1, due: 900 });
  const lowOlder = ensureRec({ box: 1, due: 100 });
  assert.ok(byWeakness(low, high) < 0);
  assert.ok(byWeakness(lowOlder, low) < 0);
  assert.ok(byWeakness(high, low) > 0);
});

test('scenarioForKey roundtrips every key the game can produce', () => {
  const rng = seeded(9);
  for (let i = 0; i < 4000; i++) {
    const s = randomScenario(rng);
    const key = scenarioKey(s.cards, s.dealerUp);
    const rebuilt = scenarioForKey(key);
    assert.ok(rebuilt, `no builder for ${key}`);
    assert.equal(scenarioKey(rebuilt.cards, rebuilt.dealerUp), key,
      `roundtrip mismatch for ${key}`);
  }
});

test('garbage keys are rejected, not thrown', () => {
  for (const k of ['', 'weird', 'pair-99-v-5', 'hard-3-v-10', 'soft-11-v-6', 'hard-21-v-10', null]) {
    assert.doesNotThrow(() => scenarioForKey(k));
    assert.equal(scenarioForKey(k), null);
  }
});
