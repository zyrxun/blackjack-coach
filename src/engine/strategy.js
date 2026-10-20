// strategy.js — basic strategy (6-deck base), Hi-Lo deviations (Illustrious 18), bet spread
// Chart encodes: H hit, S stand, D double if allowed else hit, P split,
// R surrender if allowed else hit.dealer up encoded as 2..11 (11 = ace).
import { handValue, isPair, isBlackjack, cardValue, TEN_VALUED, SUITS } from './hand.js';

// ---- hard totals ----------------------------------------------------
const HARD = {
  5: 'H', 6: 'H', 7: 'H', 8: 'H',
  9:  { 2: 'H', 3: 'D', 4: 'D', 5: 'D', 6: 'D', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
  10: { 2: 'D', 3: 'D', 4: 'D', 5: 'D', 6: 'D', 7: 'D', 8: 'D', 9: 'D', 10: 'H', 11: 'H' },
  11: { 2: 'D', 3: 'D', 4: 'D', 5: 'D', 6: 'D', 7: 'D', 8: 'D', 9: 'D', 10: 'D', 11: 'D' },
  12: { 2: 'H', 3: 'H', 4: 'S', 5: 'S', 6: 'S', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
  13: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
  14: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
  15: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'H', 8: 'H', 9: 'H', 10: 'R', 11: 'H' },
  16: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'H', 8: 'H', 9: 'R', 10: 'R', 11: 'H' },
  17: 'S', 18: 'S', 19: 'S', 20: 'S', 21: 'S',
};

// ---- soft totals (A + x, x = total - 11) -----------------------------
const SOFT = {
  13: { 2: 'H', 3: 'H', 4: 'H', 5: 'D', 6: 'D', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
  14: { 2: 'H', 3: 'H', 4: 'H', 5: 'D', 6: 'D', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
  15: { 2: 'H', 3: 'H', 4: 'D', 5: 'D', 6: 'D', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
  16: { 2: 'H', 3: 'H', 4: 'D', 5: 'D', 6: 'D', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
  17: { 2: 'H', 3: 'D', 4: 'D', 5: 'D', 6: 'D', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
  18: { 2: 'S', 3: 'D', 4: 'D', 5: 'D', 6: 'D', 7: 'S', 8: 'S', 9: 'H', 10: 'H', 11: 'H' },
  19: 'S', 20: 'S', 21: 'S',
};

// ---- pairs ------------------------------------------------------------
const PAIRS = {
  A: { 2: 'P', 3: 'P', 4: 'P', 5: 'P', 6: 'P', 7: 'P', 8: 'P', 9: 'P', 10: 'P', 11: 'P' },
  10: { 2: 'S', 3: 'S', 4: 'S', 5: 'S', 6: 'S', 7: 'S', 8: 'S', 9: 'S', 10: 'S', 11: 'S' },
  9:  { 2: 'P', 3: 'P', 4: 'P', 5: 'P', 6: 'P', 7: 'S', 8: 'P', 9: 'P', 10: 'S', 11: 'S' },
  8:  { 2: 'P', 3: 'P', 4: 'P', 5: 'P', 6: 'P', 7: 'P', 8: 'P', 9: 'P', 10: 'P', 11: 'P' },
  7:  { 2: 'P', 3: 'P', 4: 'P', 5: 'P', 6: 'P', 7: 'P', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
  6:  { 2: 'P', 3: 'P', 4: 'P', 5: 'P', 6: 'P', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
  5:  null, // never split — treated as hard 10
  4:  { 2: 'H', 3: 'H', 4: 'H', 5: 'P', 6: 'P', 7: 'H', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
  3:  { 2: 'P', 3: 'P', 4: 'P', 5: 'P', 6: 'P', 7: 'P', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
  2:  { 2: 'P', 3: 'P', 4: 'P', 5: 'P', 6: 'P', 7: 'P', 8: 'H', 9: 'H', 10: 'H', 11: 'H' },
};
PAIRS.J = PAIRS.Q = PAIRS.K = PAIRS['10']; // ten-valued cards pair interchangeably in casinos rarely; treat as tens

function lookup(table, total, up) {
  const row = table[total];
  return typeof row === 'string' ? row : row[up];
}

export function upValue(dealerUp) {
  // accepts a rank string ('10', 'A') or a card object ({rank, suit})
  const rank = typeof dealerUp === 'string' ? dealerUp : dealerUp.rank;
  return cardValue(rank); // A -> 11
}

// basic strategy for a 2+ card hand. opts: {das, canDouble, canSplit, canSurrender, h17}
export function basicStrategy(cards, dealerUp, opts = {}) {
  const { das = true, canDouble = true, canSplit = true, canSurrender = true, h17 = false } = opts;
  const up = upValue(dealerUp);
  const { total, soft } = handValue(cards);

  // pairs
  if (isPair(cards) && canSplit) {
    const rank = cards[0].rank;
    if (rank === '5') {
      // hard 10 path below
    } else if (rank === 'A' || rank === '8') {
      return 'P';
    } else {
      const row = PAIRS[rank];
      let act = typeof row === 'string' ? row : row[up];
      if (act === 'P' && !das && (rank === '2' || rank === '3') && up <= 3) act = 'H';
      if (act === 'P' && !das && rank === '4') act = 'H';
      if (act === 'P' && !das && rank === '6' && up === 2) act = 'H';
      return act;
    }
  }

  // soft totals
  if (soft && total >= 13) {
    let act = lookup(SOFT, Math.min(total, 21), up);
    if (h17 && total === 19 && up === 6) act = 'D';
    if (act === 'D') return canDouble ? 'D' : 'H';
    return act;
  }

  // hard totals
  const t = Math.min(Math.max(total, 5), 21);
  let act = lookup(HARD, t, up);
  if (h17) {
    if (t === 15 && up === 11) act = 'R';
    if (t === 17 && up === 11) act = 'R';
  }
  if (act === 'R') return canSurrender ? 'R' : 'H';
  if (act === 'D') return canDouble ? 'D' : 'H';
  return act;
}

// ---- Hi-Lo deviations: the Illustrious 18 ------------------------------
// Indices per Blackjack Attack (6D, S17 convention); true count floored.
// t: hard total (or 'TT' for a pair of tens), up: dealer up (2..11),
// i: index (stand/double/split when trueCount >= i).
export const I18 = [
  { name: 'Insurance', t: 'INS', up: null, i: 3, a: 'take' },
  { name: '16 v 10', t: 16, up: 10, i: 0, a: 'S' },
  { name: '15 v 10', t: 15, up: 10, i: 4, a: 'S' },
  { name: 'T,T v 5', t: 'TT', up: 5, i: 5, a: 'P' },
  { name: 'T,T v 6', t: 'TT', up: 6, i: 4, a: 'P' },
  { name: '10 v 10', t: 10, up: 10, i: 4, a: 'D' },
  { name: '12 v 3', t: 12, up: 3, i: 2, a: 'S' },
  { name: '12 v 2', t: 12, up: 2, i: 3, a: 'S' },
  { name: '11 v A', t: 11, up: 11, i: 1, a: 'D' },
  { name: '9 v 2', t: 9, up: 2, i: 1, a: 'D' },
  { name: '10 v A', t: 10, up: 11, i: 4, a: 'D' },
  { name: '9 v 7', t: 9, up: 7, i: 3, a: 'D' },
  { name: '16 v 9', t: 16, up: 9, i: 5, a: 'S' },
  { name: '13 v 2', t: 13, up: 2, i: -1, a: 'S' },
  { name: '12 v 4', t: 12, up: 4, i: 0, a: 'S' },
  { name: '12 v 5', t: 12, up: 5, i: -2, a: 'S' },
  { name: '13 v 3', t: 13, up: 3, i: -2, a: 'S' },
  { name: '12 v 6', t: 12, up: 6, i: -1, a: 'S' },
];

export function insuranceDeviation(trueCount) {
  return trueCount >= 3;
}

// Returns { action, deviation: {name, index} | null }
export function withDeviations(cards, dealerUp, trueCount, opts = {}) {
  const up = upValue(dealerUp);
  const { total, soft } = handValue(cards);
  const isTT = isPair(cards) && TEN_VALUED.has(cards[0].rank);
  for (const d of I18) {
    if (d.t === 'INS') continue;
    const tMatch = d.t === 'TT' ? isTT : (d.t === total && !soft);
    if (tMatch && d.up === up && trueCount >= d.i) {
      const basic = basicStrategy(cards, dealerUp, opts);
      let act = d.a;
      if (act === 'D' && !(opts.canDouble !== false)) act = basic;
      if (act === 'P' && !(opts.canSplit !== false)) act = basic;
      if (act !== basic) return { action: act, deviation: { name: d.name, index: d.i } };
      return { action: basic, deviation: null };
    }
  }
  return { action: basicStrategy(cards, dealerUp, opts), deviation: null };
}

// teaching 1-12 spread for a 6-deck game
export function betSpread(trueCount, unit) {
  if (trueCount <= 1) return unit;
  if (trueCount === 2) return unit * 2;
  if (trueCount === 3) return unit * 4;
  if (trueCount === 4) return unit * 8;
  return unit * 12;
}

export const ACTION_NAMES = { H: 'Hit', S: 'Stand', D: 'Double', P: 'Split', R: 'Surrender' };

// ---- perfect-strategy trainer: scenario generation ----------------------
// weighted rank pool = composition of one fresh deck (16 ten-valued cards)
const RANK_POOL = [];
for (const r of ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']) {
  const w = TEN_VALUED.has(r) ? 16 : 4;
  for (let i = 0; i < w; i++) RANK_POOL.push(r);
}

// random decidable hand: 2 player cards + dealer up-card, never a natural
export function randomScenario(rng = Math.random) {
  const pick = () => ({
    rank: RANK_POOL[Math.floor(rng() * RANK_POOL.length)],
    suit: SUITS[Math.floor(rng() * SUITS.length)],
  });
  let cards;
  do {
    cards = [pick(), pick()];
  } while (isBlackjack(cards)); // naturals leave no decision
  return { cards, dealerUp: pick() };
}

// stable grouping key per basic-strategy row, e.g. hard-16-v-10, soft-18-v-6, pair-8-v-5
export function scenarioKey(cards, dealerUp) {
  const up = upValue(dealerUp);
  const { total, soft } = handValue(cards);
  if (isPair(cards)) {
    const r = cards[0].rank;
    return `pair-${r === 'A' ? 'A' : cardValue(r)}-v-${up}`;
  }
  return `${soft ? 'soft' : 'hard'}-${total}-v-${up}`;
}
