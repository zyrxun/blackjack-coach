// lab.js — Bankroll Lab: CVCX-style Monte Carlo for bet-sizing decisions.
// Simulates counting sessions (Hi-Lo, I18 play, configurable spread) from a
// starting bankroll and reports EV, risk of ruin, growth — for fixed-unit vs
// bankroll-scaled sizing, so the player can see what their choices cost.
import { Table } from './blackjack.js';
import { Shoe, mulberry32 } from './shoe.js';
import { withDeviations, insuranceDeviation, betSpread, basicStrategy } from './strategy.js';

export const LAB_RULES = { numDecks: 6, hitSoft17: false, das: true, surrender: true, penetration: 0.75 };

// bet in units at a true count, capped by the player's chosen max spread
export function spreadUnits(tc, maxUnits) {
  return Math.min(maxUnits, betSpread(tc, 1));
}

// unit for bankroll-scaled sizing: ~1/1000 of current bankroll (half-Kelly-ish
// for a 1-12 spread), floored at the table minimum
export function scaledUnit(bankroll, minUnit) {
  const raw = Math.floor(bankroll / 1000 / minUnit) * minUnit;
  return Math.max(minUnit, raw);
}

export function rampBet(tc, mode, { unit, minUnit, maxUnits, bankroll }) {
  const u = mode === 'scaled' ? scaledUnit(bankroll, minUnit) : unit;
  return u * spreadUnits(tc, maxUnits);
}

// one simulated session of `rounds` rounds (or until bust)
export function simSession(opts, seed) {
  const t = new Table(LAB_RULES);
  t.bankroll = opts.bankroll;
  t.shoe = new Shoe(6, LAB_RULES.penetration, mulberry32(seed));
  const start = opts.bankroll;
  let peak = start, rounds = 0, wagered = 0, busted = false, doubledRound = null;
  for (let i = 0; i < opts.rounds; i++) {
    const bet = rampBet(t.trueCount, opts.mode, { ...opts, bankroll: t.bankroll });
    // never shove the whole roll: leave at least one minimum marker when possible
    const wager = Math.min(bet, Math.max(opts.minUnit, t.bankroll - opts.minUnit));
    const r = t.startRound(Math.max(opts.minUnit, Math.min(wager, t.bankroll)));
    if (r.phase === 'insurance') t.resolveInsurance(insuranceDeviation(t.trueCount) && t.bankroll >= r.bet / 2);
    while (r.phase === 'player') {
      const h = r.hands[r.active];
      const avail = t.availableActions(r.active);
      const o = {
        das: true, h17: false,
        canDouble: avail.includes('D'), canSplit: avail.includes('P'), canSurrender: avail.includes('R'),
      };
      const act = opts.mode === 'basic'
        ? basicStrategy(h.cards, r.dealer[0].card, o)
        : withDeviations(h.cards, r.dealer[0].card, t.trueCount, o).action;
      t.playerAction(act);
    }
    wagered += r.bet;
    rounds++;
    peak = Math.max(peak, t.bankroll);
    if (!doubledRound && t.bankroll >= start * 2) doubledRound = rounds;
    if (t.bankroll < opts.minUnit) { busted = true; break; }
    if (t.shoe.needsShuffle) { t.shoe.shuffle(); t.counter.reset(); }
  }
  return { final: t.bankroll, start, peak, rounds, wagered, busted, doubledRound };
}

// aggregate N sessions; returns the summary the UI renders
export function runLab(opts, sessions = 32) {
  const runs = [];
  for (let s = 1; s <= sessions; s++) runs.push(simSession(opts, s * 7919));
  const sum = (f) => runs.reduce((a, r) => a + f(r), 0);
  const busted = runs.filter(r => r.busted);
  const doubles = runs.filter(r => r.doubledRound).map(r => r.doubledRound).sort((a, b) => a - b);
  const net = sum(r => r.final - r.start);
  const med = arr => arr.length ? arr[Math.floor(arr.length / 2)] : null;
  return {
    sessions,
    roundsEach: opts.rounds,
    evPerRound: net / sum(r => r.rounds),
    evPerHour: 0, // filled by caller (hands/hour)
    evPer100: 100 * net / sum(r => r.rounds),
    bustRate: busted.length / runs.length,
    medianFinal: med(runs.map(r => r.final).sort((a, b) => a - b)),
    medianPeak: med(runs.map(r => r.peak).sort((a, b) => a - b)),
    medianDouble: doubles.length ? med(doubles) : null,
    doubledShare: doubles.length / runs.length,
    worstFinal: Math.min(...runs.map(r => r.final)),
  };
}
