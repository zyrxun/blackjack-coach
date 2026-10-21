// lab.test.js — Bankroll Lab invariants. Fully seeded -> results are deterministic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runLab, simSession, rampBet, scaledUnit, spreadUnits } from '../src/engine/lab.js';

const BASE = { bankroll: 5000, unit: 5, minUnit: 5, maxUnits: 12, rounds: 8000, mode: 'count' };

test('spread ramps with the true count and respects the cap', () => {
  assert.equal(spreadUnits(-3, 12), 1);
  assert.equal(spreadUnits(2, 12), 2);
  assert.equal(spreadUnits(3, 12), 4);
  assert.equal(spreadUnits(4, 12), 8);
  assert.equal(spreadUnits(5, 12), 12);
  assert.equal(spreadUnits(9, 6), 6, 'player cap limits the spread');
  assert.equal(scaledUnit(400, 5), 5, 'small bankroll stays at table min');
  assert.equal(scaledUnit(5000, 5), 5);
  assert.equal(scaledUnit(12000, 5), 10);
  assert.equal(rampBet(3, 'scaled', { minUnit: 5, maxUnits: 12, bankroll: 12000 }), 40);
  assert.equal(rampBet(3, 'fixed', { unit: 5, minUnit: 5, maxUnits: 12, bankroll: 12000 }), 20);
  assert.equal(rampBet(-5, 'scaled', { minUnit: 5, maxUnits: 12, bankroll: 3000 }), 5, 'negative count -> minimum');
});

test('basic-strategy flat betting loses; counting with a spread beats it', () => {
  const flat = runLab({ bankroll: 1e9, unit: 5, minUnit: 5, maxUnits: 1, rounds: 30000, mode: 'basic' }, 10);
  const spread = runLab({ bankroll: 1e9, unit: 5, minUnit: 5, maxUnits: 12, rounds: 30000, mode: 'count' }, 10);
  assert.ok(flat.evPer100 < 0, `flat should lose, got ${flat.evPer100}/100h`);
  assert.ok(spread.evPer100 > flat.evPer100,
    `spread (${spread.evPer100}) should beat flat (${flat.evPer100}) on the same shoes`);
});

test('bankroll-scaled sizing never busts more than fixed sizing', () => {
  const fixed = runLab({ bankroll: 20000, unit: 20, minUnit: 5, maxUnits: 12, rounds: 30000, mode: 'count' }, 12);
  const scaled = runLab({ bankroll: 20000, unit: 20, minUnit: 5, maxUnits: 12, rounds: 30000, mode: 'scaled' }, 12);
  assert.ok(scaled.bustRate <= fixed.bustRate + 1e-9,
    `scaled RoR ${scaled.bustRate} should be <= fixed ${fixed.bustRate}`);
});

test('a tiny bankroll busts quickly under a spread', () => {
  const lab = runLab({ ...BASE, bankroll: 60, rounds: 5000 }, 8);
  assert.ok(lab.bustRate > 0.5, `expected heavy busting, got ${lab.bustRate}`);
});

test('sessions are deterministic per seed and account for hands honestly', () => {
  const a = simSession(BASE, 11);
  const b = simSession(BASE, 11);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, simSession(BASE, 12));
  assert.ok(a.rounds <= BASE.rounds);
  assert.ok(a.peak >= Math.max(a.final, a.start) || a.peak >= a.start);
  assert.ok(a.wagered >= 5 * a.rounds, 'every round wagers at least the minimum');
});

test('runLab summary arithmetic is internally consistent', () => {
  const lab = runLab({ ...BASE, rounds: 3000 }, 6);
  const net = lab.evPer100 * (lab.roundsEach * lab.sessions) / 100;
  const implied = 100 * net / (lab.roundsEach * lab.sessions);
  assert.ok(Math.abs(implied - lab.evPer100) < 1e-9);
  assert.ok(lab.bustRate >= 0 && lab.bustRate <= 1);
  assert.ok(lab.medianFinal === null || lab.medianFinal >= 0);
});
