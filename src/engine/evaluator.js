// evaluator.js — Monte Carlo EV of player decisions, sampled from the
// remaining-shoe composition. Used to grade moves and power instant feedback.
import { handValue, isBust, isPair, TEN_VALUED } from './hand.js';
import { basicStrategy } from './strategy.js';

const X = 'X'; // fake suit

function card(rank) { return { rank, suit: X }; }

export function tally(cards) {
  const t = {};
  for (const c of cards) {
    const rank = typeof c === 'string' ? c : c.rank;
    t[rank] = (t[rank] || 0) + 1;
  }
  return t;
}

export function deckFromTally(t) {
  const arr = [];
  for (const [rank, n] of Object.entries(t)) for (let i = 0; i < n; i++) arr.push(rank);
  return arr;
}

function shuffled(t, rng) {
  const arr = deckFromTally(t);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// weighted random rank with replacement (fallback when sampled deck is spent)
function drawWeighted(t, total, rng) {
  let r = rng() * total;
  for (const [rank, n] of Object.entries(t)) {
    r -= n;
    if (r <= 0) return rank;
  }
  return Object.keys(t)[0];
}

// dealer hole conditioned on the peek: up ten -> hole not ace; up ace -> hole not ten-valued
function drawHole(t, total, upRank, rng) {
  for (;;) {
    const r = drawWeighted(t, total, rng);
    if (TEN_VALUED.has(upRank) && r === 'A') continue;
    if (upRank === 'A' && TEN_VALUED.has(r)) continue;
    return r;
  }
}

function playDealer(dealerRanks, deck, idx, t, total, rng, h17) {
  for (;;) {
    const { total: v, soft } = handValue(dealerRanks.map(card));
    if (v > 21) return v;
    if (v < 17 || (v === 17 && soft && h17)) {
      const c = idx < deck.length ? deck[idx++] : drawWeighted(t, total, rng);
      dealerRanks.push(c);
    } else return v;
  }
}

function settle(pv, dv) {
  if (pv > 21) return -1;
  if (dv > 21 || pv > dv) return 1;
  if (pv < dv) return -1;
  return 0;
}

// simulate one full outcome for a fixed first action, net per original unit bet
function simulateOne(playerRanks, upRank, deck, idx, t, total, rng, rules, action) {
  const mine = playerRanks.slice();
  const draw = () => {
    const c = idx < deck.length ? deck[idx++] : drawWeighted(t, total, rng);
    mine.push(c);
    return c;
  };

  if (action === 'R') return -0.5;

  if (action === 'D') {
    draw();
    const { total: pv } = handValue(mine.map(card));
    const hole = drawHole(t, total, upRank, rng);
    const dv = playDealer([upRank, hole], deck, idx, t, total, rng, rules.hitSoft17);
    return settle(pv, dv) * 2;
  }

  if (action === 'P') {
    // two split hands, one fresh card each; aces get one card; no resplit
    let net = 0;
    for (const r of [mine[0], mine[1]]) {
      const hand = [r, idx < deck.length ? deck[idx++] : drawWeighted(t, total, rng)];
      if (r === 'A') {
        const { total: pv } = handValue(hand.map(card));
        const hole = drawHole(t, total, upRank, rng);
        const dv = playDealer([upRank, hole], deck, idx, t, total, rng, rules.hitSoft17);
        net += settle(pv, dv);
      } else {
        net += playOut(hand, deck, idx, t, total, rng, upRank, rules, false);
      }
    }
    return net;
  }

  if (action === 'S') {
    const { total: pv } = handValue(mine.map(card));
    const hole = drawHole(t, total, upRank, rng);
    const dv = playDealer([upRank, hole], deck, idx, t, total, rng, rules.hitSoft17);
    return settle(pv, dv);
  }

  // H: force one hit, then continue with basic strategy (no double/split/surrender)
  draw();
  if (isBust(mine.map(card))) return -1;
  return playOut(mine, deck, idx, t, total, rng, upRank, rules, false);
}

// play a hand to completion with basic strategy; when canDouble, the first
// decision may return D (double: one card, stake x2)
function playOut(mine, deck, idx, t, total, rng, upRank, rules, canDouble) {
  let stake = 1;
  let first = canDouble && mine.length === 2;
  for (;;) {
    const { total: pv } = handValue(mine.map(card));
    if (pv > 21) return -stake;
    if (pv === 21) break;
    const opts = { canDouble: first, canSplit: false, canSurrender: false };
    let a = basicStrategy(mine.map(card), card(upRank), opts);
    if (a === 'D') {
      if (first && mine.length === 2) {
        first = false;
        stake = 2;
        const c = idx < deck.length ? deck[idx++] : drawWeighted(t, total, rng);
        mine.push(c);
        const { total: pv2 } = handValue(mine.map(card));
        const hole = drawHole(t, total, upRank, rng);
        const dv = playDealer([upRank, hole], deck, idx, t, total, rng, rules.hitSoft17);
        return settle(pv2, dv) * stake;
      }
      a = 'H';
    }
    first = false;
    if (a === 'S') break;
    const c = idx < deck.length ? deck[idx++] : drawWeighted(t, total, rng);
    mine.push(c);
  }
  const { total: pv } = handValue(mine.map(card));
  const hole = drawHole(t, total, upRank, rng);
  const dv = playDealer([upRank, hole], deck, idx, t, total, rng, rules.hitSoft17);
  return settle(pv, dv) * stake;
}

// EV per action, net per original unit bet, forward-looking (sunk bet excluded:
// a stand that wins returns +1 total, matching engine payout conventions).
// Common random numbers: one sampled deck scores ALL actions per iteration.
export function evaluateActions({ playerCards, dealerUp, remaining, rules = {}, actions, sims = 150, rng = Math.random }) {
  const t = tally(remaining);
  const total = Object.values(t).reduce((a, b) => a + b, 0);
  const playerRanks = playerCards.map(c => c.rank);
  const upRank = typeof dealerUp === 'string' ? dealerUp : dealerUp.rank;
  const sums = {}, counts = {};
  for (const a of actions) { sums[a] = 0; counts[a] = 0; }
  for (let s = 0; s < sims; s++) {
    const deck = shuffled(t, rng);
    let idx = 0;
    for (const a of actions) {
      const idx0 = idx;
      const net = simulateOne(playerRanks, upRank, deck, idx0, t, total, rng, rules, a);
      // idx advances only for the first action per iteration; restart each action
      // from the same deck position so comparisons share common cards
      sums[a] += net;
      counts[a]++;
    }
  }
  const out = {};
  for (const a of actions) out[a] = sums[a] / Math.max(counts[a], 1);
  return out;
}

// antithetic helper: score a deck and its reverse together to halve variance
export function evaluateActionsAV({ playerCards, dealerUp, remaining, rules = {}, actions, sims = 150, rng = Math.random }) {
  const t = tally(remaining);
  const total = Object.values(t).reduce((a, b) => a + b, 0);
  const playerRanks = playerCards.map(c => c.rank);
  const upRank = typeof dealerUp === 'string' ? dealerUp : dealerUp.rank;
  const sums = {}, counts = {};
  for (const a of actions) { sums[a] = 0; counts[a] = 0; }
  const half = Math.max(1, Math.floor(sims / 2));
  for (let s = 0; s < half; s++) {
    const deck = shuffled(t, rng);
    for (const d of [deck, deck.slice().reverse()]) {
      for (const a of actions) {
        sums[a] += simulateOne(playerRanks, upRank, d, 0, t, total, rng, rules, a);
        counts[a]++;
      }
    }
  }
  const result = {};
  for (const a of actions) result[a] = sums[a] / Math.max(counts[a], 1);
  return result;
}

// exact insurance EV per unit staked (pays 2:1): 3*P(ten) - 1
export function evaluateInsurance(remaining) {
  const t = tally(remaining);
  let tens = 0, n = 0;
  for (const [rank, c] of Object.entries(t)) {
    n += c;
    if (TEN_VALUED.has(rank)) tens += c;
  }
  if (n === 0) return 0;
  return 3 * (tens / n) - 1;
}

// best action per EV; ties within eps resolve to the first listed
export function bestAction(evs, eps = 0.004) {
  let best = null;
  for (const [a, ev] of Object.entries(evs)) {
    if (best === null || ev > evs[best] + eps) best = a;
  }
  return best;
}
