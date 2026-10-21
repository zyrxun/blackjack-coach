// story.test.js — Story Mode curriculum: coverage, answers, and passability
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STAGES, scenarioMatches, starsFor, makeCountSequence, choiceSet,
  trueCountAnswer, betAnswer,
} from '../src/engine/curriculum.js';
import { basicStrategy, withDeviations, randomScenario, betSpread } from '../src/engine/strategy.js';
import { tagFor } from '../src/engine/count.js';

function seeded(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('the path is well-formed and progressively unlocked', () => {
  assert.equal(STAGES.length, 13);
  assert.equal(new Set(STAGES.map(s => s.id)).size, STAGES.length, 'unique ids');
  for (const s of STAGES) {
    assert.ok(s.icon && s.title && s.blurb);
    assert.ok(s.teach.length >= 2, `${s.id} teaches something`);
    assert.ok(s.challenge.count >= 8 || s.challenge.seqs >= 1 || s.challenge.items.length >= 3);
  }
});

test('scenarioMatches filters the right hands', () => {
  const h16v10 = randomScenario(seeded(1)); // may not match; use explicit hands instead
  const mk = (a, b, up) => ({ cards: [{ rank: a, suit: 'S' }, { rank: b, suit: 'H' }], dealerUp: { rank: up, suit: 'C' } });
  assert.equal(scenarioMatches(mk('10', '6', '10'), { kind: 'hard', total: [12, 16], up: [2, 6] }), false);
  assert.equal(scenarioMatches(mk('10', '6', '6'), { kind: 'hard', total: [12, 16], up: [2, 6] }), true);
  assert.equal(scenarioMatches(mk('A', '7', '6'), { kind: 'soft' }), true);
  assert.equal(scenarioMatches(mk('A', '7', '6'), { kind: 'hard' }), false);
  assert.equal(scenarioMatches(mk('8', '8', '5'), { kind: 'pair', ranks: ['A', '8'] }), true);
  assert.equal(scenarioMatches(mk('9', '9', '5'), { kind: 'pair', ranks: ['A', '8'] }), false);
  assert.equal(scenarioMatches(mk('A', 'A', '9'), { kind: 'pair', ranks: ['A', '8'] }), true);
  assert.equal(scenarioMatches(mk('10', 'J', '6'), { kind: 'any' }), true, 'hard 20');
  assert.equal(scenarioMatches(mk('10', '6', '10'), null), true, 'null filter = everything');
});

test('every hands stage is passable by perfect play (filters generate hands)', () => {
  for (const st of STAGES.filter(s => s.challenge.kind === 'hands')) {
    const { challenge } = st;
    let found = 0;
    for (let i = 0; i < 6000 && found < challenge.count * 2; i++) {
      const s = randomScenario(seeded(1000 + i));
      if (!scenarioMatches(s, challenge.filter)) continue;
      found++;
      const opts = { das: true, canDouble: true, canSplit: true, canSurrender: true };
      if (challenge.grade === 'deviations') {
        const r = withDeviations(s.cards, s.dealerUp, challenge.tcScript[0], opts);
        assert.ok(['H', 'S', 'D', 'P', 'R'].includes(r.action), `${st.id}: legal action`);
      } else {
        const a = basicStrategy(s.cards, s.dealerUp); // must not throw for any filtered hand
        assert.ok(['H', 'S', 'D', 'P', 'R'].includes(a), `${st.id}: legal action`);
      }
    }
    assert.ok(found >= challenge.count, `${st.id}: filter produces enough hands (got ${found})`);
  }
});

test('count sequences sum the Hi-Lo tags exactly', () => {
  for (const seed of [1, 2, 3, 42]) {
    const { cards, expected } = makeCountSequence(seeded(seed), 10);
    assert.equal(cards.length, 10);
    const manual = cards.reduce((n, c) => n + tagFor(c.rank), 0);
    assert.equal(expected, manual);
  }
});

test('choice sets contain the answer and three distinct others', () => {
  for (const e of [-4, -1, 0, 2, 7, 12]) {
    const opts = choiceSet(e);
    assert.equal(opts.length, 4);
    assert.ok(opts.includes(e));
    assert.equal(new Set(opts).size, 4);
  }
  const pos = choiceSet(1, 2, 1); // bets: no zero/negative units
  assert.ok(pos.every(v => v >= 1));
});

test('quiz answers derive from the engine, not hand-copied numbers', () => {
  assert.equal(trueCountAnswer({ rc: 6, decks: 3 }), Math.floor(6 / 3));
  assert.equal(trueCountAnswer({ rc: -3, decks: 2 }), -2); // floor, not truncate
  for (const st of STAGES.filter(s => s.challenge.kind === 'bet')) {
    for (const item of st.challenge.items) {
      assert.equal(betAnswer(item), betSpread(item.tc, 5) / 5);
    }
  }
});

test('stars thresholds are ordered and gate progression', () => {
  assert.deepEqual([0, 74, 75, 84, 85, 94, 95, 100].map(starsFor), [0, 0, 1, 1, 2, 2, 3, 3]);
});
