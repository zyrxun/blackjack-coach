// lab.js — Bankroll Lab UI: CVCX-style EV/risk preview for bet-sizing choices.
// Compares fixed-unit vs bankroll-scaled sizing on the player's own roll.
import { runLab } from '../engine/lab.js';
import { el, fmtMoney } from './cards.js';
import { load } from './store.js';

let state = null;
let running = false;

export function initLab(stateRef) {
  state = stateRef;
  document.getElementById('lab-run').addEventListener('click', startLab);
}

export function enterLab() {
  const prof = state.activeProfile && state.profiles[state.activeProfile];
  if (prof && !document.getElementById('lab-bankroll').value) {
    document.getElementById('lab-bankroll').value = Math.max(100, Math.round(prof.bankroll));
  }
}

function startLab() {
  if (running) return;
  const $ = id => document.getElementById(id);
  const bankroll = Math.max(100, parseInt($('lab-bankroll').value, 10) || 5000);
  const unit = Math.max(5, parseInt($('lab-unit').value, 10) || 5);
  const maxUnits = parseInt($('lab-spread').value, 10) || 12;
  const handsPerHour = parseInt($('lab-hph').value, 10) || 80;
  const rounds = parseInt($('lab-rounds').value, 10) || 25000;
  const sessions = 16;

  running = true;
  $('lab-run').disabled = true;
  $('lab-results').replaceChildren(
    el('div', { class: 'panel-title' }, 'Simulating…'),
    el('p', { style: 'color:var(--muted)' }, `${sessions} counting sessions × ${rounds.toLocaleString()} hands (Hi-Lo, I18 play, your spread). Hang on a second.`));

  setTimeout(() => {
    const common = { bankroll, unit, minUnit: 5, maxUnits, rounds };
    const fixed = runLab({ ...common, mode: 'count' }, sessions);
    const scaled = runLab({ ...common, mode: 'scaled' }, sessions);
    const rows = (lab) => [
      el('tr', {}, el('td', {}, 'EV per hour'), el('td', {}, `${lab.evPer100 >= 0 ? '+' : ''}${fmtMoney(lab.evPer100 * handsPerHour / 100)}`)),
      el('tr', {}, el('td', {}, 'EV per 100 hands'), el('td', {}, `${lab.evPer100 >= 0 ? '+' : ''}${fmtMoney(lab.evPer100)}`)),
      el('tr', {}, el('td', {}, 'Risk of ruin'), el('td', {}, (100 * lab.bustRate).toFixed(1) + '%')),
      el('tr', {}, el('td', {}, 'Doubled bankroll'), el('td', {}, lab.doubledShare
        ? `${Math.round(100 * lab.doubledShare)}% of sims · ~${Math.round(lab.medianDouble / handsPerHour)} h median`
        : 'never within horizon')),
      el('tr', {}, el('td', {}, 'Median final roll'), el('td', {}, fmtMoney(lab.medianFinal))),
      el('tr', {}, el('td', {}, 'Worst final roll'), el('td', {}, fmtMoney(lab.worstFinal))),
    ];
    const tbl = lab => el('table', { class: 'stats' },
      el('tr', {}, el('th', {}, 'Metric'), el('th', {}, 'Value')), ...rows(lab));
    const box = (title, lab, tone) => el('div', {},
      el('div', { class: 'panel-title' }, title),
      tbl(lab),
      el('p', { style: `color:var(--${tone});font-size:0.85em;margin-top:6px` },
        tone === 'good' ? 'Bet sizing that scales with the roll survives downswings.'
          : 'Fixed units on a shrunken roll quietly raise your risk of ruin.'));
    $('lab-results').replaceChildren(
      el('div', { class: 'panel-title' }, 'Results'),
      el('p', { style: 'color:var(--muted);margin:0 0 10px' },
        `Start ${fmtMoney(bankroll)} · $${unit} units · 1–${maxUnits} spread · ${handsPerHour} hands/h · ${sessions} sims × ${rounds.toLocaleString()} hands. 6D S17 DAS LS, Hi-Lo with Illustrious-18 play.`),
      el('div', { class: 'stats-tables' },
        box(`Scaled sizing (unit = roll ÷ 1000)`, scaled, 'good'),
        box(`Fixed sizing (${fmtMoney(unit)} units)`, fixed, 'bad'),
      ),
      el('p', { style: 'color:var(--muted);font-size:0.85em' },
        'Same shoes, same decisions — only bet sizing differs. Scaling your unit to the CURRENT roll is how pros keep risk of ruin low; frozen units on a hurt roll are how bankrolls die. This is a model, not a promise.'),
      ...(bankroll <= unit * 1000 ? [el('p', { style: 'color:var(--gold);font-size:0.85em' },
        `Note: at ${fmtMoney(bankroll)} the scaled unit never leaves the table minimum (scaling needs roughly $1,000 of roll per $1 of unit) — that's why both rows match.`)] : []),
    );
    running = false;
    $('lab-run').disabled = false;
  }, 30);
}
