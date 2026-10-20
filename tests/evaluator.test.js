import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateActions, evaluateInsurance, bestAction, tally, deckFromTally } from '../src/engine/evaluator.js';
import { mulberry32 } from '../src/engine/shoe.js';

const C = (rank) => ({ rank, suit: 'S' });

// full-deck composition x1 for single-deck spots (dealer hole conditioned out)
const FULL = () => {
  const t = {};
  for (const r of ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) t[r] = 4;
  return deckFromTally(t);
};

test('tally and deckFromTally round-trip', () => {
  const t = tally([C('5'), C('5'), C('K')]);
  assert.equal(t['5'], 2);
  assert.equal(t['K'], 1);
  assert.equal(deckFromTally(t).length, 3);
});

test('20 v 6: standing is far better than hitting', () => {
  const rng = mulberry32(7);
  const evs = evaluateActions({
    playerCards: [C('K'), C('Q')], dealerUp: C('6'),
    remaining: FULL(), actions: ['H', 'S'], sims: 300, rng,
  });
  assert.equal(bestAction(evs), 'S');
  assert.ok(evs.S > 0.55, `stand 20 v 6 EV ${evs.S}`);
  assert.ok(evs.H < -0.4, `hit 20 v 6 EV ${evs.H}`);
});

test('11 v 6: doubling beats hitting and standing', () => {
  const rng = mulberry32(8);
  const evs = evaluateActions({
    playerCards: [C('5'), C('6')], dealerUp: C('6'),
    remaining: FULL(), actions: ['H', 'D', 'S'], sims: 300, rng,
  });
  assert.equal(bestAction(evs), 'D');
  assert.ok(evs.D > evs.H + 0.1, `double ${evs.D} vs hit ${evs.H}`);
});

test('pair of aces v 6: splitting is best', () => {
  const rng = mulberry32(9);
  const evs = evaluateActions({
    playerCards: [C('A'), C('A')], dealerUp: C('6'),
    remaining: FULL(), actions: ['H', 'P', 'S'], sims: 300, rng,
  });
  assert.equal(bestAction(evs), 'P');
});

test('surrender EV is exactly -0.5', () => {
  const rng = mulberry32(10);
  const evs = evaluateActions({
    playerCards: [C('10'), C('6')], dealerUp: C('K'),
    remaining: FULL(), actions: ['R'], sims: 50, rng,
  });
  assert.equal(evs.R, -0.5);
});

test('16 v 10: plausible EVs for both plays, surrender exact', () => {
  const rng = mulberry32(11);
  const evs = evaluateActions({
    playerCards: [C('10'), C('6')], dealerUp: C('K'),
    remaining: FULL(), actions: ['H', 'S', 'R'], sims: 400, rng,
  });
  assert.equal(evs.R, -0.5);
  // published 6D-S17: hit ~ -0.54, stand ~ -0.58; conditioning + noise keep
  // both within a wide band; the app grades via charts, MC only displays cost
  assert.ok(evs.H > -0.75 && evs.H < -0.3, `hit ${evs.H.toFixed(3)}`);
  assert.ok(evs.S > -0.8 && evs.S < -0.3, `stand ${evs.S.toFixed(3)}`);
  assert.ok(Math.abs(evs.H - evs.S) < 0.3, `spread ${Math.abs(evs.H - evs.S).toFixed(3)}`);
});

test('insurance EV exact from composition', () => {
  // 12 cards left: 4 tens, 8 others -> P(ten)=1/3 -> EV 0
  const rem = [...Array(4).fill(C('K')), ...Array(8).fill(C('5'))];
  assert.ok(Math.abs(evaluateInsurance(rem)) < 1e-9);
  // 6 tens, 6 others -> P=0.5 -> EV = +0.5
  const rem2 = [...Array(6).fill(C('K')), ...Array(6).fill(C('5'))];
  assert.ok(Math.abs(evaluateInsurance(rem2) - 0.5) < 1e-9);
});

test('hole conditioning: up=10 excludes ace hole (sanity via 20 v 10)', () => {
  const rng = mulberry32(12);
  const evs = evaluateActions({
    playerCards: [C('K'), C('Q')], dealerUp: C('10'),
    remaining: FULL(), actions: ['S'], sims: 300, rng,
  });
  // 20 vs made hands; dealer never has BJ here. EV around +0.4~0.7
  assert.ok(evs.S > 0.3 && evs.S < 0.9, `stand 20 v 10 EV ${evs.S}`);
});
