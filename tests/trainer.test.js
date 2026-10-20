// trainer.test.js — perfect-strategy trainer: scenario generation + grouping keys
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomScenario, scenarioKey } from '../src/engine/strategy.js';
import { handValue, isBlackjack, RANKS } from '../src/engine/hand.js';

// deterministic rng (mulberry32)
function seeded(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('randomScenario deals valid two-card hands with a dealer up-card', () => {
  const rng = seeded(42);
  for (let i = 0; i < 5000; i++) {
    const { cards, dealerUp } = randomScenario(rng);
    assert.equal(cards.length, 2);
    assert.ok(RANKS.includes(dealerUp.rank));
    assert.ok(RANKS.includes(cards[0].rank));
    assert.ok(RANKS.includes(cards[1].rank));
    assert.equal(isBlackjack(cards), false, 'no naturals — they leave no decision');
    const { total } = handValue(cards);
    assert.ok(total >= 4 && total <= 20);
  }
});

test('randomScenario is deterministic under a seeded rng', () => {
  assert.deepEqual(randomScenario(seeded(7)), randomScenario(seeded(7)));
  assert.notDeepEqual(randomScenario(seeded(8)), randomScenario(seeded(9)));
});

test('scenarios cover hard, soft and pair hands over a sample', () => {
  const rng = seeded(1);
  const kinds = new Set();
  for (let i = 0; i < 3000; i++) {
    const s = randomScenario(rng);
    kinds.add(scenarioKey(s.cards, s.dealerUp).split('-')[0]);
  }
  for (const k of ['hard', 'soft', 'pair']) assert.ok(kinds.has(k), `missing ${k}`);
});

test('scenarioKey groups hands by basic-strategy row', () => {
  assert.equal(scenarioKey([{ rank: 'K', suit: 'S' }, { rank: '6', suit: 'H' }], { rank: '10', suit: 'C' }), 'hard-16-v-10');
  assert.equal(scenarioKey([{ rank: 'A', suit: 'S' }, { rank: '7', suit: 'H' }], { rank: '6', suit: 'C' }), 'soft-18-v-6');
  assert.equal(scenarioKey([{ rank: '8', suit: 'S' }, { rank: '8', suit: 'H' }], { rank: '5', suit: 'C' }), 'pair-8-v-5');
  assert.equal(scenarioKey([{ rank: 'Q', suit: 'S' }, { rank: 'Q', suit: 'H' }], { rank: '6', suit: 'C' }), 'pair-10-v-6');
  assert.equal(scenarioKey([{ rank: 'A', suit: 'S' }, { rank: 'A', suit: 'H' }], { rank: '9', suit: 'C' }), 'pair-A-v-9');
  assert.equal(scenarioKey([{ rank: '5', suit: 'S' }, { rank: '5', suit: 'D' }], { rank: 'A', suit: 'C' }), 'pair-5-v-11');
});
