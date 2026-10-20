import test from 'node:test';
import assert from 'node:assert/strict';
import { handValue, isBlackjack, isBust, isPair, cardValue } from '../src/engine/hand.js';

const C = (rank, suit = 'S') => ({ rank, suit });

test('hand totals with ace downgrades', () => {
  assert.deepEqual(handValue([C('10'), C('9')]), { total: 19, soft: false });
  assert.deepEqual(handValue([C('A'), C('9')]), { total: 20, soft: true });
  assert.deepEqual(handValue([C('A'), C('A')]), { total: 12, soft: true });
  assert.deepEqual(handValue([C('A'), C('A'), C('9')]), { total: 21, soft: true });
  assert.deepEqual(handValue([C('9'), C('A'), C('9')]), { total: 19, soft: false });
  assert.deepEqual(handValue([C('A'), C('K'), C('Q')]), { total: 21, soft: false });
});

test('blackjack, bust, pair detection', () => {
  assert.equal(isBlackjack([C('A'), C('K')]), true);
  assert.equal(isBlackjack([C('A'), C('K'), C('Q')]), false);
  assert.equal(isBust([C('10'), C('9'), C('5')]), true);
  assert.equal(isBust([C('A'), C('10')]), false);
  assert.equal(isPair([C('8', 'H'), C('8', 'C')]), true);
  assert.equal(isPair([C('8'), C('9')]), false);
});

test('card values', () => {
  assert.equal(cardValue('A'), 11);
  for (const r of ['10', 'J', 'Q', 'K']) assert.equal(cardValue(r), 10, r);
  assert.equal(cardValue('2'), 2);
});
