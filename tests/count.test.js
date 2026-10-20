import test from 'node:test';
import assert from 'node:assert/strict';
import { Counter, HILO_TAGS, tagFor } from '../src/engine/count.js';

const C = (rank) => ({ rank, suit: 'S' });

test('Hi-Lo tags', () => {
  assert.equal(tagFor('2'), 1);
  assert.equal(tagFor('6'), 1);
  assert.equal(tagFor('7'), 0);
  assert.equal(tagFor('9'), 0);
  assert.equal(tagFor('K'), -1);
  assert.equal(tagFor('A'), -1);
  assert.equal(Object.keys(HILO_TAGS).length, 13);
});

test('running count accumulates and resets', () => {
  const c = new Counter();
  c.add(C('5')); c.add(C('K')); c.add(C('3')); c.add(C('7'));
  assert.equal(c.runningCount, 1); // +1 -1 +1 +0
  assert.equal(c.seen, 4);
  assert.equal(c.decksSeen, 4 / 52);
  c.reset();
  assert.equal(c.runningCount, 0);
  assert.equal(c.seen, 0);
});

test('true count floors to integer with half-deck minimum', () => {
  const c = new Counter();
  c.add(C('5')); c.add(C('5')); c.add(C('5')); c.add(C('5')); // rc +4
  assert.equal(c.trueCount(2), 2);      // 4 / 2
  assert.equal(c.trueCount(1.5), 2);    // 4 / 1.5 = 2.67 -> 2
  assert.equal(c.trueCount(0.4), 8);    // decks floored to 0.5 -> 4/0.5
  c.add(C('A')); // rc +3
  assert.equal(c.trueCount(1.5), 2);    // 3/1.5 = 2
  c.add(C('K')); c.add(C('Q')); // rc +1
  assert.equal(c.trueCount(1.5), 0);    // 1/1.5 -> 0
});
