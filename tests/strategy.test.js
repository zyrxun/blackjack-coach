import test from 'node:test';
import assert from 'node:assert/strict';
import { basicStrategy, withDeviations, insuranceDeviation, betSpread, I18 } from '../src/engine/strategy.js';

const C = (rank) => ({ rank, suit: 'S' });
const h = (...ranks) => ranks.map(C);

test('basic strategy hard totals', () => {
  assert.equal(basicStrategy(h('10', '6'), C('10')), 'R');            // 16 v 10 surrender->stand? no: R
  assert.equal(basicStrategy(h('10', '6'), C('10'), { canSurrender: false }), 'H');
  assert.equal(basicStrategy(h('10', '6'), C('6')), 'S');             // 16 v 6
  assert.equal(basicStrategy(h('5', '6'), C('6')), 'D');              // 11 v 6
  assert.equal(basicStrategy(h('9', '2'), C('6')), 'D');              // 11 v 6
  assert.equal(basicStrategy(h('6', '6'), C('2')), 'P');              // 12 v 2 as pair w/ DAS -> split
  assert.equal(basicStrategy(h('6', '6'), C('2'), { das: false }), 'H');
  assert.equal(basicStrategy(h('8', '4'), C('4')), 'S');              // 12 v 4
  assert.equal(basicStrategy(h('9', '5'), C('10')), 'H');             // 14 v 10
  assert.equal(basicStrategy(h('9', '6'), C('10')), 'R');             // 15 v 10
  assert.equal(basicStrategy(h('10', '7'), C('2')), 'S');             // 17
});

test('basic strategy soft totals', () => {
  assert.equal(basicStrategy(h('A', '2'), C('5')), 'D');              // soft 13 v 5
  assert.equal(basicStrategy(h('A', '2'), C('4')), 'H');
  assert.equal(basicStrategy(h('A', '6'), C('3')), 'D');              // soft 17 v 3
  assert.equal(basicStrategy(h('A', '7'), C('2')), 'S');              // soft 18 v 2
  assert.equal(basicStrategy(h('A', '7'), C('4')), 'D');
  assert.equal(basicStrategy(h('A', '7'), C('9')), 'H');
  assert.equal(basicStrategy(h('A', '8'), C('6')), 'S');
});

test('basic strategy pairs', () => {
  assert.equal(basicStrategy(h('8', '8'), C('10')), 'P');
  assert.equal(basicStrategy(h('A', 'A'), C('A')), 'P');
  assert.equal(basicStrategy(h('9', '9'), C('7')), 'S');
  assert.equal(basicStrategy(h('9', '9'), C('8')), 'P');
  assert.equal(basicStrategy(h('5', '5'), C('6')), 'D');              // 5,5 -> hard 10
  assert.equal(basicStrategy(h('4', '4'), C('5')), 'P');              // DAS
  assert.equal(basicStrategy(h('4', '4'), C('5'), { das: false }), 'H');
  assert.equal(basicStrategy(h('2', '2'), C('3'), { das: false }), 'H');
  assert.equal(basicStrategy(h('2', '2'), C('3')), 'P');
  assert.equal(basicStrategy(h('7', '7'), C('8')), 'H');
});

test('H17 adjustments', () => {
  assert.equal(basicStrategy(h('10', '5'), C('A'), { h17: true }), 'R');   // 15 v A
  assert.equal(basicStrategy(h('10', '7'), C('A'), { h17: true }), 'R');   // 17 v A
  assert.equal(basicStrategy(h('10', '7'), C('A')), 'S');
});

test('Illustrious 18 deviations', () => {
  // 16 v 10: stand at TC 0; below index falls back to basic (surrender; hit if not allowed)
  assert.equal(withDeviations(h('10', '6'), C('K'), 0).action, 'S');
  assert.equal(withDeviations(h('10', '6'), C('K'), -1).action, 'R');
  assert.equal(withDeviations(h('10', '6'), C('K'), -1, { canSurrender: false }).action, 'H');
  // 15 v 10: stand at TC +4
  assert.equal(withDeviations(h('10', '5'), C('K'), 4).action, 'S');
  assert.equal(withDeviations(h('10', '5'), C('K'), 3).action, 'R'); // basic: surrender
  // 12 v 2: stand at TC +3 (non-pair 12; a pair of 6s splits instead)
  assert.equal(withDeviations(h('7', '5'), C('2'), 3).action, 'S');
  assert.equal(withDeviations(h('7', '5'), C('2'), 2).action, 'H');
  // 10 v 10: double at TC +4
  const d = withDeviations(h('6', '4'), C('K'), 4);
  assert.equal(d.action, 'D');
  assert.ok(d.deviation && d.deviation.name === '10 v 10');
  assert.equal(withDeviations(h('6', '4'), C('K'), 3).action, 'H');
  // TT v 5: split at TC +5
  assert.equal(withDeviations(h('J', 'J'), C('5'), 5).action, 'P');
  assert.equal(withDeviations(h('J', 'J'), C('5'), 4).action, 'S');
  // 11 v A: double at TC +1 (basic already doubles 11 v A; no deviation flag)
  const r = withDeviations(h('6', '5'), C('A'), 1);
  assert.equal(r.action, 'D');
  assert.equal(r.deviation, null);
});

test('insurance deviation at TC +3', () => {
  assert.equal(insuranceDeviation(3), true);
  assert.equal(insuranceDeviation(2), false);
  assert.equal(insuranceDeviation(-1), false);
});

test('bet spread', () => {
  assert.equal(betSpread(1, 5), 5);
  assert.equal(betSpread(2, 5), 10);
  assert.equal(betSpread(3, 5), 20);
  assert.equal(betSpread(4, 5), 40);
  assert.equal(betSpread(6, 5), 60);
  assert.equal(betSpread(-2, 5), 5);
});

test('I18 list has 18 entries', () => {
  assert.equal(I18.length, 18);
});
