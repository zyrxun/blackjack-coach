// hand.js — card and hand math (pure, no DOM)
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['S', 'H', 'D', 'C'];
export const TEN_VALUED = new Set(['10', 'J', 'Q', 'K']);

export function cardValue(rank) {
  if (rank === 'A') return 11;
  if (TEN_VALUED.has(rank)) return 10;
  return parseInt(rank, 10);
}

// total with aces downgraded 11 -> 1 as needed; soft = an ace still counts as 11
export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c.rank);
    if (c.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards).total === 21;
}

export function isBust(cards) {
  return handValue(cards).total > 21;
}

export function isPair(cards) {
  return cards.length === 2 && cards[0].rank === cards[1].rank;
}
