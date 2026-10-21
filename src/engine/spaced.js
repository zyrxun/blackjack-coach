// spaced.js — forgetting-curve scheduling for strategy scenarios.
// Each scenario key carries a Leitner box (0-5) and a due timestamp.
// Misses drop the box and make the scenario due immediately; correct answers
// promote it and push the next review further out (the gaps roughly double).
import { TEN_VALUED } from './hand.js';

export const GAPS_MIN = [0, 2, 5, 12, 30, 90]; // minutes per box
const MS = 60_000;

// older saves predate the boxes — normalise on read
export function ensureRec(rec) {
  if (rec && typeof rec.box === 'number') return rec;
  return { ...rec, box: 0, due: 0, missStreak: 0 };
}

// update a record after an answer; returns the new record (mutates a copy)
export function grade(rec, correct, now = Date.now()) {
  const r = ensureRec(rec);
  if (correct) {
    r.box = Math.min(5, r.box + 1);
    r.missStreak = 0;
  } else {
    r.box = Math.max(0, r.box - 1);
    r.missStreak = (r.missStreak || 0) + 1;
  }
  r.due = now + GAPS_MIN[r.box] * MS;
  return r;
}

// mastered scenarios (top box) stop resurfacing until they decay out naturally
export function isDue(rec, now = Date.now()) {
  const r = ensureRec(rec);
  return r.box < 5 && r.due <= now;
}

// weaker first: lower box, then most overdue
export function byWeakness(a, b) {
  const ra = ensureRec(a);
  const rb = ensureRec(b);
  return ra.box - rb.box || ra.due - rb.due;
}

// rebuild a decidable scenario from a row key like 'hard-16-v-10',
// 'soft-18-v-6' or 'pair-8-v-5' — inverse of scenarioKey for chart rows
export function scenarioForKey(key) {
  if (typeof key !== 'string') return null;
  const [kind, totalTok, , upTok] = key.split('-');
  if (!/^(hard|soft|pair)$/.test(kind)) return null;
  const up = upTok === '11' ? 'A' : upTok;
  const card = r => ({ rank: r, suit: 'S' });
  let cards;
  if (kind === 'pair') {
    const r = totalTok === 'A' ? 'A' : totalTok === '10' ? '10' : totalTok;
    if (!/^(A|2|3|4|5|6|7|8|9|10)$/.test(r)) return null;
    cards = [card(r), card(r)];
  } else if (kind === 'soft') {
    const t = Number(totalTok);
    if (!Number.isInteger(t) || t < 13 || t > 21) return null;
    cards = [card('A'), card(String(t - 11))];
  } else {
    const t = Number(totalTok);
    if (!Number.isInteger(t) || t < 5 || t > 20) return null; // hard 21 needs 3+ cards
    if (t <= 11) cards = [card('2'), card(String(t - 2))];
    else if (t <= 19) cards = [card('10'), card(String(t - 10))];
    else if (t === 20) cards = [card('10'), card('J')]; // hard 20, not a pair
  }
  // a "hard" total built from two ten-valued cards could become a pair key
  if (kind === 'hard' && cards[0].rank === cards[1].rank) return null;
  if (kind === 'hard' && TEN_VALUED.has(cards[0].rank) && TEN_VALUED.has(cards[1].rank)) {
    // 10+K style: fine (hard), but 10,10-shaped only for t=20 which uses 10+J ✓
  }
  return { cards, dealerUp: card(up) };
}
