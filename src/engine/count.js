// count.js — Hi-Lo counting (pure)
export const HILO_TAGS = {
  A: -1, '2': 1, '3': 1, '4': 1, '5': 1, '6': 1,
  '7': 0, '8': 0, '9': 0,
  '10': -1, J: -1, Q: -1, K: -1,
};

export function tagFor(rank) {
  return HILO_TAGS[rank];
}

export class Counter {
  constructor() {
    this.reset();
  }

  reset() {
    this.runningCount = 0;
    this.seen = 0;
  }

  add(card) {
    this.runningCount += HILO_TAGS[card.rank];
    this.seen++;
    return this.runningCount;
  }

  get decksSeen() {
    return this.seen / 52;
  }

  // true count = running / decks remaining, floored to an integer
  // (floor is the conservative convention used for betting and indices)
  trueCount(decksRemaining) {
    const d = Math.max(decksRemaining, 0.5); // floor the estimate at half a deck
    return Math.floor(this.runningCount / d);
  }
}
