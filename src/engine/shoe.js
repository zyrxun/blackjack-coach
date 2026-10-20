// shoe.js — multi-deck shoe with cut card (pure; injectable rng for tests)
import { RANKS, SUITS } from './hand.js';

export class Shoe {
  constructor(numDecks = 6, penetration = 0.75, rng = Math.random) {
    this.numDecks = numDecks;
    this.penetration = Math.min(Math.max(penetration, 0.5), 0.95);
    this.rng = rng;
    this.reset();
  }

  reset() {
    this.cards = [];
    for (let d = 0; d < this.numDecks; d++)
      for (const s of SUITS)
        for (const r of RANKS)
          this.cards.push({ rank: r, suit: s });
    this.shuffle();
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
    // shuffle point: stop dealing once remaining cards drop to this level
    this.cutIndex = Math.floor(this.cards.length * (1 - this.penetration));
  }

  deal() {
    if (this.cards.length === 0) this.reset();
    return this.cards.pop();
  }

  get cardsRemaining() {
    return this.cards.length;
  }

  get decksRemaining() {
    return this.cardsRemaining / 52;
  }

  get needsShuffle() {
    return this.cardsRemaining <= this.cutIndex;
  }
}

// deterministic rng for tests / replays
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
