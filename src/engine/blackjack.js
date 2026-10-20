// blackjack.js — table rules and round flow (engine, no DOM)
import { Shoe } from './shoe.js';
import { handValue, isBlackjack, isBust, isPair, TEN_VALUED } from './hand.js';
import { Counter } from './count.js';

export const ACTIONS = { HIT: 'H', STAND: 'S', DOUBLE: 'D', SPLIT: 'P', SURRENDER: 'R' };

export class Table {
  constructor(opts = {}) {
    this.rules = {
      numDecks: 6,
      hitSoft17: false,   // S17 by default
      das: true,          // double after split
      surrender: true,    // late surrender
      blackjackPays: 1.5, // 3:2
      penetration: 0.75,
      maxHands: 4,
      minBet: 5,
      ...opts,
    };
    this.counter = new Counter();
    this.shoe = new Shoe(this.rules.numDecks, this.rules.penetration);
    this.bankroll = 1000;
    this.round = null;
    this.lastShuffleCount = null; // running count at the moment of a shuffle (for quiz grading)
    this.history = [];            // {bet, tc, results:[{outcome, net}], net}
  }

  // ---- count / shoe state -------------------------------------------
  get runningCount() { return this.counter.runningCount; }
  get decksRemaining() { return this.shoe.decksRemaining; }
  get trueCount() { return this.counter.trueCount(this.shoe.decksRemaining); }

  shuffleIfDue() {
    if (this.shoe.needsShuffle) {
      this.lastShuffleCount = this.counter.runningCount;
      this.shoe.shuffle();
      this.counter.reset();
      return true;
    }
    return false;
  }

  // ---- round lifecycle -----------------------------------------------
  startRound(bet) {
    if (this.round && this.round.phase !== 'settle' && this.round.phase !== 'done')
      throw new Error('round in progress');
    const b = Math.max(this.rules.minBet, Math.min(bet, this.bankroll));
    if (b < this.rules.minBet) throw new Error('insufficient bankroll');
    this.shuffleIfDue();
    this.bankroll -= b;
    this.round = {
      phase: 'dealing',
      bet: b,
      hands: [this._newHand(b)],
      active: 0,
      dealer: [],            // [{card, faceUp}]
      insuranceBet: 0,
      insuranceResolved: false,
    };
    this._dealTo(this.round.hands[0]);
    this._dealDealer(true);            // dealer up card first (US order)
    this._dealTo(this.round.hands[0]);
    this._dealDealer(false);           // hole card second

    const up = this.round.dealer[0].card;
    if (up.rank === 'A') {
      this.round.phase = 'insurance';   // insurance offered, then peek
    } else if (TEN_VALUED.has(up.rank)) {
      if (!this._peek()) {           // no dealer BJ: play on
        this.round.phase = 'player';
        this._autoAdvance();
      }
    } else {
      this.round.phase = 'player';
      this._autoAdvance();
    }
    return this.round;
  }

  // player took insurance (only offered when dealer shows an ace)
  resolveInsurance(take) {
    const r = this.round;
    if (r.phase !== 'insurance') throw new Error('insurance not offered');
    if (take) {
      r.insuranceBet = r.bet / 2;
      this.bankroll -= r.insuranceBet;
    }
    r.insuranceResolved = true;
    const dealerBJ = this._peek();
    if (dealerBJ) return;               // _peek settled the round
    // no dealer blackjack: insurance lost (stake already deducted)
    const ph = r.hands[0];
    if (isBlackjack(ph.cards)) {
      ph.result = 'bj';
      this.bankroll += ph.bet * (1 + this.rules.blackjackPays);
      this._finishRound();
    } else {
      r.phase = 'player';
      this._autoAdvance();
    }
  }

  playerAction(action) {
    const r = this.round;
    if (!r || r.phase !== 'player') throw new Error(`action ${action} out of phase ${r && r.phase}`);
    const h = r.hands[r.active];
    const allowed = this.availableActions(r.active);
    if (!allowed.includes(action)) throw new Error(`${action} not allowed here`);

    if (action === 'H') {
      this._dealTo(h);
      if (isBust(h.cards)) { h.busted = true; h.result = 'bust'; this._nextHand(); }
      else if (handValue(h.cards).total === 21) { h.stood = true; this._nextHand(); }
    } else if (action === 'S') {
      h.stood = true;
      this._nextHand();
    } else if (action === 'D') {
      this.bankroll -= h.bet;
      h.bet *= 2;
      h.doubled = true;
      this._dealTo(h);
      if (isBust(h.cards)) { h.busted = true; h.result = 'bust'; }
      h.stood = true;
      this._nextHand();
    } else if (action === 'P') {
      this.bankroll -= h.bet;
      const second = h.cards.pop();
      const nh = this._newHand(h.bet);
      nh.cards.push(second);
      nh.fromSplit = true;
      nh.splitAces = second.rank === 'A';
      h.fromSplit = true;
      h.splitAces = h.cards[0].rank === 'A';
      r.hands.splice(r.active + 1, 0, nh);
      this._dealTo(h);
      this._dealTo(nh);
      if (h.splitAces) h.stood = true;    // split aces: one card each, no hits
      if (nh.splitAces) nh.stood = true;
      if (handValue(h.cards).total === 21) h.stood = true; // 21 on split is just 21
      if (handValue(nh.cards).total === 21) nh.stood = true;
      if (h.stood) this._nextHand();      // active index still on h; advance if already done
    } else if (action === 'R') {
      h.surrendered = true;
      this._nextHand();
    }
    return this.round;
  }

  availableActions(i) {
    const r = this.round;
    if (!r || r.phase !== 'player') return [];
    const h = r.hands[i];
    if (!h || h.stood || h.busted || h.surrendered) return [];
    const a = ['H', 'S'];
    const two = h.cards.length === 2;
    if (two && !h.splitAces && this.bankroll >= h.bet && (this.rules.das || !h.fromSplit))
      a.push('D');
    if (two && isPair(h.cards) && !h.splitAces && r.hands.length < this.rules.maxHands && this.bankroll >= h.bet)
      a.push('P');
    if (two && this.rules.surrender && !h.fromSplit)
      a.push('R');
    return a;
  }

  // ---- internals ------------------------------------------------------
  _newHand(bet) {
    return { cards: [], bet, doubled: false, surrendered: false, stood: false, busted: false, fromSplit: false, splitAces: false, result: null };
  }

  _dealTo(hand) {
    hand.cards.push(this.shoe.deal());
    this.counter.add(hand.cards[hand.cards.length - 1]);
  }

  _dealDealer(faceUp) {
    const card = this.shoe.deal();
    this.round.dealer.push({ card, faceUp });
    if (faceUp) this.counter.add(card);
  }

  // peek at the hole card for dealer blackjack (ten or ace up).
  // the hole stays hidden when there is no BJ, so it is NOT counted then.
  _peek() {
    const r = this.round;
    const hole = r.dealer[1];
    if (isBlackjack([r.dealer[0].card, hole.card])) {
      hole.faceUp = true;
      this.counter.add(hole.card);
      this._settleDealerBJ();
      return true;
    }
    return false;
  }

  _settleDealerBJ() {
    const r = this.round;
    const results = [];
    for (const h of r.hands) {
      if (isBlackjack(h.cards) && !h.fromSplit) {
        h.result = 'push';
        this.bankroll += h.bet;
        results.push({ outcome: 'push', net: 0 });
      } else {
        h.result = 'lose';
        results.push({ outcome: 'lose', net: -h.bet });
      }
    }
    if (r.insuranceBet > 0) {
      this.bankroll += r.insuranceBet * 3; // stake back + 2:1
    }
    r.phase = 'settle';
    r.results = results;
    this._record(results);
  }

  _nextHand() {
    const r = this.round;
    let i = r.active;
    // if current hand was split into, keep playing it first
    while (i < r.hands.length) {
      const h = r.hands[i];
      if (!h.stood && !h.busted && !h.surrendered) break;
      i++;
    }
    if (i < r.hands.length) {
      r.active = i;
      return;
    }
    this._dealerPlay();
  }

  _dealerPlay() {
    const r = this.round;
    const hole = r.dealer[1];
    if (!hole.faceUp) {
      hole.faceUp = true;
      this.counter.add(hole.card);
    }
    const anyLive = r.hands.some(h => !h.busted && !h.surrendered);
    if (anyLive) {
      // draw to 17; hit soft 17 when the rule says so
      for (;;) {
        const { total, soft } = handValue(r.dealer.map(d => d.card));
        if (total < 17 || (total === 17 && soft && this.rules.hitSoft17)) {
          const c = this.shoe.deal();
          r.dealer.push({ card: c, faceUp: true });
          this.counter.add(c);
        } else break;
      }
    }
    this._settle();
  }

  _settle() {
    const r = this.round;
    const dv = handValue(r.dealer.map(d => d.card));
    const dealerBJ = isBlackjack(r.dealer.map(d => d.card)) && r.dealer.length === 2;
    const results = [];
    for (const h of r.hands) {
      if (h.surrendered) {
        this.bankroll += h.bet / 2;
        h.result = 'surrender';
        results.push({ outcome: 'surrender', net: -h.bet / 2 });
        continue;
      }
      if (h.busted) {
        h.result = 'bust';
        results.push({ outcome: 'bust', net: -h.bet });
        continue;
      }
      const pv = handValue(h.cards);
      const playerBJ = isBlackjack(h.cards) && !h.fromSplit;
      if (playerBJ && !dealerBJ) {
        this.bankroll += h.bet * (1 + this.rules.blackjackPays);
        h.result = 'bj';
        results.push({ outcome: 'bj', net: h.bet * this.rules.blackjackPays });
      } else if (playerBJ && dealerBJ) {
        this.bankroll += h.bet;
        h.result = 'push';
        results.push({ outcome: 'push', net: 0 });
      } else if (dealerBJ) {
        h.result = 'lose';
        results.push({ outcome: 'lose', net: -h.bet });
      } else if (dv.total > 21) {
        this.bankroll += h.bet * 2;
        h.result = 'win';
        results.push({ outcome: 'win', net: h.bet });
      } else if (pv.total > dv.total) {
        this.bankroll += h.bet * 2;
        h.result = 'win';
        results.push({ outcome: 'win', net: h.bet });
      } else if (pv.total < dv.total) {
        h.result = 'lose';
        results.push({ outcome: 'lose', net: -h.bet });
      } else {
        this.bankroll += h.bet;
        h.result = 'push';
        results.push({ outcome: 'push', net: 0 });
      }
    }
    r.phase = 'settle';
    r.results = results;
    this._record(results);
  }

  _finishRound() {
    this.round.phase = 'settle';
    this._record([{ outcome: 'bj', net: this.round.bet * this.rules.blackjackPays }]);
  }

  _record(results) {
    const r = this.round;
    this.history.push({
      when: Date.now(),
      bet: r.bet,
      tc: this.trueCount,
      results,
      net: results.reduce((s, x) => s + x.net, 0),
    });
  }

  // auto-advance past hands that need no decision (e.g. dealt 21)
  _autoAdvance() {
    const r = this.round;
    const h = r.hands[r.active];
    if (h && isBlackjack(h.cards) && !h.fromSplit && r.phase === 'player') {
      // only reachable when dealer had no BJ; pay immediately
      this.bankroll += h.bet * (1 + this.rules.blackjackPays);
      h.result = 'bj';
      this._finishRound();
    } else if (h && handValue(h.cards).total === 21 && h.cards.length === 2) {
      h.stood = true;
      this._nextHand();
    }
  }
}
