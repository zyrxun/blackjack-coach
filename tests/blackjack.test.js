import test from 'node:test';
import assert from 'node:assert/strict';
import { Table } from '../src/engine/blackjack.js';
import { HILO_TAGS } from '../src/engine/count.js';
import { handValue } from '../src/engine/hand.js';

const C = (rank, suit = 'S') => ({ rank, suit });

// script the shoe: cards are dealt from the END of the array (pop),
// so pass the deck in deal order and reverse it.
function script(t, dealOrder) {
  t.shoe.cards = dealOrder.slice().reverse();
  t.shoe.cutIndex = -1; // never auto-shuffle mid-test
}

test('player blackjack pays 3:2', () => {
  const t = new Table();
  script(t, [C('A'), C('9'), C('K'), C('5')]);
  t.startRound(10);
  assert.equal(t.round.phase, 'settle');
  assert.equal(t.round.hands[0].result, 'bj');
  assert.equal(t.bankroll, 1000 - 10 + 25); // 10 + 15 win
});

test('dealer blackjack (ten up, peek) beats non-BJ player', () => {
  const t = new Table();
  script(t, [C('9'), C('K'), C('5'), C('A')]);
  t.startRound(10);
  assert.equal(t.round.phase, 'settle');
  assert.equal(t.round.hands[0].result, 'lose');
  assert.equal(t.bankroll, 990);
});

test('ten up without dealer BJ continues to player phase', () => {
  const t = new Table();
  script(t, [C('9'), C('K'), C('5'), C('6')]);
  t.startRound(10);
  assert.equal(t.round.phase, 'player');
  assert.equal(t.runningCount, 0); // K -1, 9 0, 5 +1; hole 6 not counted yet
});

test('insurance on dealer ace + blackjack nets zero', () => {
  const t = new Table();
  script(t, [C('9'), C('A'), C('5'), C('K')]);
  t.startRound(10);
  assert.equal(t.round.phase, 'insurance');
  t.resolveInsurance(true);
  assert.equal(t.round.phase, 'settle');
  assert.equal(t.bankroll, 1000); // -10 bet -5 ins +15 ins payout
});

test('insurance declined, dealer no BJ, play continues', () => {
  const t = new Table();
  script(t, [C('9'), C('A'), C('5'), C('6'), C('K')]); // dealer A,6 -> after peek hits to 17? A+6=17 soft stands (S17)
  t.startRound(10);
  assert.equal(t.round.phase, 'insurance');
  t.resolveInsurance(false);
  // player 9,5=14: hit -> K -> 24 bust
  assert.equal(t.round.phase, 'player');
  t.playerAction('H');
  assert.equal(t.round.hands[0].busted, true);
  assert.equal(t.bankroll, 990);
  assert.equal(t.round.dealer.length, 2); // all busted -> dealer does not draw
});

test('split aces: one card each, no further action', () => {
  const t = new Table();
  script(t, [C('A'), C('9'), C('A'), C('5'), C('10'), C('6'), C('4')]);
  t.startRound(10);
  assert.ok(t.availableActions(0).includes('P'));
  t.playerAction('P');
  assert.equal(t.round.hands.length, 2);
  assert.equal(t.availableActions(0).length, 0);
  assert.equal(t.availableActions(1).length, 0);
  // h1: A+10 = 21 stood; h2: A+6 = 17 stood; dealer 9+5=14 -> draws 4 -> 18
  assert.equal(t.round.phase, 'settle');
  assert.equal(t.round.dealer.length, 3);
  assert.deepEqual(t.round.results.map(r => r.outcome), ['win', 'lose']);
  assert.equal(t.bankroll, 1000 - 20 + 20);
});

test('double on two cards takes one card and settles', () => {
  const t = new Table();
  script(t, [C('5'), C('9'), C('6'), C('10'), C('K')]);
  t.startRound(10);
  assert.ok(t.availableActions(0).includes('D'));
  t.playerAction('D');
  // player 5+6+K = 21; dealer 9+10 = 19
  assert.equal(t.round.phase, 'settle');
  assert.equal(t.round.hands[0].bet, 20);
  assert.equal(t.round.hands[0].cards.length, 3);
  assert.equal(t.bankroll, 1020);
});

test('late surrender returns half', () => {
  const t = new Table();
  script(t, [C('9'), C('6'), C('9'), C('K')]); // six up, no peek path
  t.startRound(10);
  assert.ok(t.availableActions(0).includes('R'));
  t.playerAction('R');
  assert.equal(t.round.hands[0].result, 'surrender');
  assert.equal(t.bankroll, 995);
});

test('dealer S17 stands on soft 17, H17 hits', () => {
  // player stands on 18; dealer A-down soft 17 (6 up so no peek path)
  const base = [C('10'), C('6'), C('8'), C('A'), C('10')];
  const s17 = new Table({ hitSoft17: false });
  script(s17, base);
  s17.startRound(10);
  s17.playerAction('S');
  assert.equal(s17.round.dealer.length, 2); // stood on soft 17
  assert.equal(s17.round.dealer.some(d => d.card.rank === '10'), false);

  const h17 = new Table({ hitSoft17: true });
  script(h17, base);
  h17.startRound(10);
  h17.playerAction('S');
  assert.equal(h17.round.dealer.length, 3); // hit soft 17 with a 10 -> hard 17
  assert.equal(h17.round.dealer.map(d => d.card.rank).join(''), '6A10');
});

test('counting: hole card excluded until revealed', () => {
  const t = new Table();
  script(t, [C('5'), C('K'), C('5'), C('6'), C('10')]); // P:5(+1) D:K(-1 up) P:5(+1) D:6(hole)
  t.startRound(10);
  assert.equal(t.round.phase, 'player');
  assert.equal(t.runningCount, 1); // hole 6 not counted
  t.playerAction('S');             // 10 vs K; dealer reveals 6 -> K+6=16, draws 10 -> bust
  assert.equal(t.round.hands[0].result, 'win');
  assert.equal(t.runningCount, 1); // +1 (6 revealed) then -1 (10 drawn) -> net back to 1
});

test('resplit up to four hands, then actions stop', () => {
  const t = new Table({ maxHands: 4 });
  script(t, [C('8'), C('9'), C('8'), C('6'), C('8'), C('3'), C('5'), C('K'), C('10'), C('7'), C('Q')]);
  t.startRound(10);
  t.playerAction('P'); // [8,8] -> [8,8] and [8,3]
  assert.equal(t.round.hands.length, 2);
  t.playerAction('P'); // resplit h1 -> [8,5] and [8,K]
  assert.equal(t.round.hands.length, 3);
  t.playerAction('H'); // [8,5]+10 = 23 bust
  t.playerAction('S'); // [8,K]=18 stands
  t.playerAction('H'); // [8,3]+7 = 18
  t.playerAction('S');
  assert.equal(t.round.phase, 'settle');
  assert.deepEqual(t.round.results.map(r => r.outcome), ['bust', 'win', 'win']);
  assert.equal(t.bankroll, 1010); // -30 bets, +20 +20 on two wins, bust loses
  // dealer 9+6=15 drew Q -> busted
  assert.ok(handValue(t.round.dealer.map(d => d.card)).total > 21);
});

test('shuffle captures count grade and resets counter', () => {
  const t = new Table({ numDecks: 1, penetration: 0.5 });
  t.counter.add({ rank: '5', suit: 'S' });
  t.counter.add({ rank: '5', suit: 'H' }); // rc +2
  t.shoe.cutIndex = t.shoe.cardsRemaining; // force needsShuffle
  t.startRound(5);
  assert.equal(t.lastShuffleCount, 2);
  // count now reflects only visible cards: 2 player + dealer up (hole hidden)
  const visible = [...t.round.hands[0].cards, t.round.dealer[0].card];
  const expected = visible.reduce((s, c) => s + HILO_TAGS[c.rank], 0);
  assert.equal(t.runningCount, expected);
});

test('guards: no action out of phase, no round overlap', () => {
  const t = new Table();
  script(t, [C('5'), C('9'), C('6'), C('10')]);
  assert.throws(() => t.playerAction('H'));
  t.startRound(10);
  assert.throws(() => t.startRound(10)); // round in progress
  t.playerAction('D');                   // 11 + 10 = 21
  assert.equal(t.round.phase, 'settle');
  t.startRound(5);                       // new round OK after settle
  assert.equal(t.round.bet, 5);
});

test('history records net per round', () => {
  const t = new Table();
  script(t, [C('A'), C('9'), C('K'), C('5')]);
  t.startRound(10);
  assert.equal(t.history.length, 1);
  assert.equal(t.history[0].net, 15);
  assert.equal(typeof t.history[0].tc, 'number');
});
