// curriculum.js — Story Mode: the learning path from first hand to card counter.
// Pure data + helpers (no DOM) so tests can validate the whole path.
import { randomScenario, scenarioKey, betSpread, ACTION_NAMES } from './strategy.js';
import { handValue, isPair, isBlackjack, cardValue, TEN_VALUED, RANKS, SUITS } from './hand.js';
import { tagFor } from './count.js';

// weighted rank pool = composition of one fresh deck (16 ten-valued cards)
const DECK_POOL = [];
for (const r of RANKS) {
  const w = TEN_VALUED.has(r) ? 16 : 4;
  for (let i = 0; i < w; i++) DECK_POOL.push(r);
}

// ---- stage filters (declarative, so tests can verify coverage) -------------
// { kind: 'hard'|'soft'|'pair'|'any', total?: [min,max], up?: [min,max], ranks?: [...] }
export function scenarioMatches(s, filter) {
  if (!filter || filter.kind === 'any') return true;
  const key = scenarioKey(s.cards, s.dealerUp);
  const [kind, totalTok, , upTok] = key.split('-');
  if (kind !== filter.kind) return false;
  if (filter.ranks && !filter.ranks.includes(totalTok)) return false;
  if (filter.total) {
    const t = Number(totalTok);
    if (t < filter.total[0] || t > filter.total[1]) return false;
  }
  if (filter.up) {
    const u = Number(upTok);
    if (u < filter.up[0] || u > filter.up[1]) return false;
  }
  return true;
}

export function starsFor(accuracy) {
  if (accuracy >= 95) return 3;
  if (accuracy >= 85) return 2;
  if (accuracy >= 75) return 1;
  return 0;
}

// ---- counting-challenge generators -----------------------------------------
export function makeCountSequence(rng = Math.random, n = 10) {
  const cards = [];
  let expected = 0;
  for (let i = 0; i < n; i++) {
    const rank = DECK_POOL[Math.floor(rng() * DECK_POOL.length)];
    const card = { rank, suit: SUITS[Math.floor(rng() * SUITS.length)] };
    cards.push(card);
    expected += tagFor(rank);
  }
  return { cards, expected };
}

export function choiceSet(expected, spread = 2, lo = -Infinity) {
  const opts = new Set([expected]);
  let d = 1;
  while (opts.size < 4) {
    for (const v of [expected - d, expected + d]) {
      if (opts.size >= 4) break;
      if (v >= lo && v !== expected) opts.add(v);
    }
    d++;
  }
  return [...opts].sort((a, b) => a - b);
}

// ---- the path ---------------------------------------------------------------
export const STAGES = [
  {
    id: 'first-hands', icon: '🌅', title: 'First light',
    blurb: 'What beats what, and when to take a card.',
    teach: [
      'You win by having more than the dealer — without going over 21.',
      'Going over 21 is a bust: you lose instantly, even if the dealer busts too.',
      'Hands of 11 or less can never bust — always take a card.',
    ],
    challenge: { kind: 'hands', count: 8, filter: { kind: 'hard', total: [5, 11] } },
  },
  {
    id: 'stiff-hands', icon: '🃏', title: 'The dealer’s weakness',
    blurb: 'Dealer up-cards 2–6 bust often — stand on your stiff hands.',
    teach: [
      'The dealer must draw until 17 — no choice, no free will.',
      'Starting from 2–6, they bust surprisingly often (a 6 busts ~42% of the time).',
      'So: hard 12–16 against a 2–6? Stand and let the dealer bust.',
    ],
    challenge: { kind: 'hands', count: 8, filter: { kind: 'hard', total: [12, 16], up: [2, 6] } },
  },
  {
    id: 'strong-dealer', icon: '🛡️', title: 'Respect the strong card',
    blurb: 'Against 7–A you must improve — standing on 12–16 loses.',
    teach: [
      'A dealer showing 7, 8, 9, 10 or Ace usually makes 17 or better.',
      'Your stiff 12–16 almost never wins as-is — hitting is the only hope.',
      'Yes, you may bust — but standing loses more in the long run.',
    ],
    challenge: { kind: 'hands', count: 8, filter: { kind: 'hard', total: [12, 16], up: [7, 11] } },
  },
  {
    id: 'never-bust', icon: '🏔️', title: 'The wall at 17',
    blurb: 'Hard 17+ always stands — no exceptions.',
    teach: [
      'Hard 17 busts when hitting 69% of the time. The wall stops you here.',
      'Every hard total from 17 up stands. Always. There is literally no exception.',
      '16 is the hardest hand in blackjack — stage 9 teaches its escape hatch.',
    ],
    challenge: { kind: 'hands', count: 10, filter: { kind: 'hard', total: [13, 21] } },
  },
  {
    id: 'double-down', icon: '💰', title: 'Press your edge',
    blurb: 'Doubling: one card, twice the money, when the odds favor you.',
    teach: [
      'Double = one more card only, and your bet is doubled.',
      '11 is the best doubling hand — one ten (31% of the deck) makes 21.',
      '10 doubles against weak dealer cards; 9 only against 3–6.',
    ],
    challenge: { kind: 'hands', count: 10, filter: { kind: 'hard', total: [8, 11] } },
  },
  {
    id: 'soft-hands', icon: '🍮', title: 'The ace is two cards',
    blurb: 'Soft hands can’t bust — play them boldly.',
    teach: [
      'An ace counts as 11 or 1, whichever helps — so soft hands can’t bust with one card.',
      'Soft 13–17: hit or double; standing too early wastes the ace’s flexibility.',
      'A,7 (soft 18) is famous: double vs 3–6, stand vs 2/7/8, hit vs 9/10/A.',
    ],
    challenge: { kind: 'hands', count: 10, filter: { kind: 'soft' } },
  },
  {
    id: 'pairs-101', icon: '👯', title: 'Split the money pairs',
    blurb: 'A,A and 8,8 always split. 10,10 never. 5,5 is not a pair.',
    teach: [
      'A,A: two hands starting at 11 — the best split in the game. Always split.',
      '8,8: 16 is the worst hand — two 8s start fresh. Always split.',
      '10,10 is 20 — a winning hand. Never break it up. 10,10 = stand.',
      '5,5 is just hard 10: double down, never split.',
    ],
    challenge: { kind: 'hands', count: 10, filter: { kind: 'pair' } },
  },
  {
    id: 'surrender', icon: '🏳️', title: 'Know when to fold',
    blurb: 'Surrender + the rest of the pairs.',
    teach: [
      'Surrender: fold immediately, lose half your bet. Built for hopeless hands.',
      'Hard 16 vs 10 and hard 15 vs 10 lose so badly that half a bet is a bargain.',
      'Other pairs: 9,9 splits vs everything except 7/10/A. 7,7 vs 2–7. 6,6 and 2,2/3,3 vs weak cards. 4,4 vs 5–6 only.',
    ],
    challenge: { kind: 'hands', count: 12, filter: { kind: 'any' } },
  },
  {
    id: 'chart-boss', icon: '👑', title: 'The full chart',
    blurb: 'Boss stage: 15 hands from anywhere on the chart.',
    teach: [
      'Everything so far, no hints about what kind of hand is coming.',
      'Pass this and perfect basic strategy is yours — the house edge drops to ~0.5%.',
    ],
    challenge: { kind: 'hands', count: 15, filter: { kind: 'any' } },
  },
  {
    id: 'card-tags', icon: '🔢', title: 'Every card has a price',
    blurb: 'Hi-Lo: 2–6 are +1, 7–9 are 0, tens and aces are −1.',
    teach: [
      'Small cards (2–6) leaving the shoe help the dealer — count them +1.',
      'Big cards (10, J, Q, K, A) left in the shoe help YOU — count them −1.',
      '7, 8, 9 are neutral: 0. Add the tags as cards appear — that’s the running count.',
    ],
    challenge: { kind: 'count', seqs: 3, cardsPer: 10 },
  },
  {
    id: 'true-count', icon: '➗', title: 'Count what’s left',
    blurb: 'True count = running count ÷ decks remaining.',
    teach: [
      '+6 with 6 decks left is nothing; +6 with 1 deck left is a gold rush.',
      'True count = running count ÷ decks remaining (round down).',
      'A true count of +2 or more means the next hands favor you.',
    ],
    challenge: {
      kind: 'truecount',
      items: [{ rc: 6, decks: 3 }, { rc: 5, decks: 2 }, { rc: -3, decks: 2 }, { rc: 7, decks: 4 }],
    },
  },
  {
    id: 'bet-the-count', icon: '📈', title: 'Bet the rich shoe',
    blurb: 'The count tells you when the money is on the table.',
    teach: [
      'At true count ≤ +1 bet the minimum — the house still has the edge.',
      'As the count climbs, ramp up: +2 → 2 units, +3 → 4, +4 → 8, +5 → 12.',
      'This is where counting actually makes money: bet sizing, not tricky plays.',
    ],
    challenge: {
      kind: 'bet',
      items: [{ tc: -1 }, { tc: 2 }, { tc: 3 }, { tc: 5 }],
    },
  },
  {
    id: 'deviations', icon: '⚡', title: 'Break the rules (carefully)',
    blurb: 'The count lets you bend basic strategy — the Illustrious 18.',
    teach: [
      'Basic strategy assumes a fresh shoe. A hot count changes the best play.',
      '16 v 10: normally surrender/hit — at true count ≥ 0, STAND.',
      '11 v A: double at true count ≥ +1. Insurance: take it at true count ≥ +3.',
      'About 19 plays ever change — learn these first, the rest is polish.',
    ],
    challenge: {
      kind: 'hands', count: 8, grade: 'deviations',
      tcScript: [-2, 0, 1, 2, 3, -1, 4, 5],
      filter: { kind: 'any' },
    },
  },
];

// expected answers for the quiz-style stages (derived from the engine, so tests stay honest)
export function trueCountAnswer({ rc, decks }) {
  return Math.floor(rc / decks);
}
export function betAnswer({ tc }, unit = 5) {
  return betSpread(tc, unit) / unit;
}
