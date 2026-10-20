import test from 'node:test';
import assert from 'node:assert/strict';
import { Shoe, mulberry32 } from '../src/engine/shoe.js';

test('shoe composition and depletion', () => {
  const s = new Shoe(2, 0.75, mulberry32(1));
  assert.equal(s.cardsRemaining, 104);
  const dealt = [s.deal(), s.deal(), s.deal()];
  assert.equal(s.cardsRemaining, 101);
  assert.equal(dealt.length, 3);
});

test('shoe has no duplicate cards', () => {
  const s = new Shoe(1, 0.75, mulberry32(2));
  const seen = new Set();
  while (s.cardsRemaining) {
    const c = s.deal();
    const key = c.rank + c.suit;
    seen.add(key);
  }
  assert.equal(seen.size, 52);
});

test('needsShuffle respects penetration cut card', () => {
  const s = new Shoe(1, 0.75, mulberry32(3)); // cutIndex = 52 * 0.25 = 13
  assert.equal(s.needsShuffle, false);
  while (s.cardsRemaining > 13) s.deal();
  assert.equal(s.needsShuffle, true);
  assert.equal(s.decksRemaining > 0, true);
});

test('same seed -> same order', () => {
  const a = new Shoe(1, 0.75, mulberry32(42));
  const b = new Shoe(1, 0.75, mulberry32(42));
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(a.deal(), b.deal());
  }
});
