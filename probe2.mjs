import { Table } from './src/engine/blackjack.js';
import { Shoe, mulberry32 } from './src/engine/shoe.js';
import { withDeviations, insuranceDeviation, betSpread, basicStrategy } from './src/engine/strategy.js';

const t = new Table({ numDecks: 6, hitSoft17: false, das: true, surrender: true, penetration: 0.75 });
console.log('rules:', JSON.stringify(t.rules));
t.bankroll = 5000;
t.shoe = new Shoe(6, 0.75, mulberry32(7919));
let wagered = 0, rounds = 0;
const marks = [];
for (let i = 0; i < 8000; i++) {
  const bet = Math.min(12, betSpread(t.trueCount, 1)) * 5;
  const r = t.startRound(Math.min(bet, t.bankroll));
  if (r.phase === 'insurance') t.resolveInsurance(insuranceDeviation(t.trueCount));
  while (r.phase === 'player') {
    const h = r.hands[r.active];
    const avail = t.availableActions(r.active);
    const o = { das: true, h17: false, canDouble: avail.includes('D'), canSplit: avail.includes('P'), canSurrender: avail.includes('R') };
    t.playerAction(withDeviations(h.cards, r.dealer[0].card, t.trueCount, o).action);
  }
  wagered += r.bet; rounds++;
  if (rounds % 1000 === 0) marks.push(rounds + ':' + t.bankroll.toFixed(0) + '/w' + (wagered/rounds).toFixed(1));
  if (t.shoe.needsShuffle) { t.shoe.shuffle(); t.counter.reset(); }
}
console.log(marks.join('  '));
// flat-bet comparison, same seeds
const f = new Table({ numDecks: 6, hitSoft17: false, das: true, surrender: true, penetration: 0.75 });
f.bankroll = 1e9; f.shoe = new Shoe(6, 0.75, mulberry32(7919));
let w2 = 0, n2 = 0;
for (let i = 0; i < 8000; i++) {
  const r = f.startRound(5);
  if (r.phase === 'insurance') f.resolveInsurance(false);
  while (r.phase === 'player') {
    const h = r.hands[f.active];
    const avail = f.availableActions(f.active);
    const o = { das: true, h17: false, canDouble: avail.includes('D'), canSplit: avail.includes('P'), canSurrender: avail.includes('R') };
    f.playerAction(basicStrategy(h.cards, r.dealer[0].card, o));
  }
  w2 += 5; n2++;
  if (f.shoe.needsShuffle) { f.shoe.shuffle(); f.counter.reset(); }
}
console.log('flat: rounds', n2, 'net', f.bankroll - 1e9, 'ev%', (100 * (f.bankroll - 1e9) / w2).toFixed(3));
