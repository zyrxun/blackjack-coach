// trainer.js — Perfect Strategy trainer: basic-strategy drills, no counting
import {
  basicStrategy, randomScenario, scenarioKey, upValue, ACTION_NAMES,
} from '../engine/strategy.js';
import { handValue, isPair, TEN_VALUED } from '../engine/hand.js';
import { cardNode, el, showModal, hideModal, flipUp } from './cards.js';
import { load, save } from './store.js';

let state = null;
let session = null;

export function initTrainer(stateRef) {
  state = stateRef;
  document.getElementById('trainer-start').addEventListener('click', startSession);
  document.getElementById('trainer-chart').addEventListener('click', showChart);
  document.getElementById('trainer-quit').addEventListener('click', () => endSession(false));
  document.getElementById('trainer-next').addEventListener('click', () => nextHand());
  document.querySelectorAll('#trainer-actions [data-action]').forEach(b =>
    b.addEventListener('click', () => answer(b.dataset.action)));
  document.addEventListener('keydown', onKey);
}

function onKey(e) {
  if (!session || !session.running) return;
  if (document.getElementById('screen-trainer').classList.contains('hidden')) return;
  const k = e.key.toLowerCase();
  if (!session.awaiting) {
    if (k === 'enter' || k === ' ') { e.preventDefault(); nextHand(); }
    return;
  }
  const map = { h: 'H', s: 'S', d: 'D', p: 'P', r: 'R' };
  if (map[k]) { e.preventDefault(); answer(map[k]); }
}

export function trainerIsActive() {
  return session && session.running;
}

function startSession() {
  const $ = id => document.getElementById(id);
  const strategy = state.stats.strategy;
  const troubleKeys = new Set(Object.entries(strategy)
    .filter(([, v]) => v.seen >= 2 && v.right / v.seen < 0.8)
    .map(([k]) => k));
  session = {
    running: true,
    awaiting: false,
    focus: $('trainer-focus').value,
    target: parseInt($('trainer-hands').value, 10),
    troubleKeys,
    n: 0,
    correct: 0,
    streak: 0,
    bestStreak: 0,
    missed: [], // {key, label, expected}
    cur: null,
    timer: null,
    t0: Date.now(),
  };
  $('trainer-config').classList.add('hidden');
  $('trainer-summary').classList.add('hidden');
  $('trainer-run').classList.remove('hidden');
  renderMastery();
  nextHand();
}

function genScenario() {
  for (let i = 0; i < 400; i++) {
    const s = randomScenario();
    const key = scenarioKey(s.cards, s.dealerUp);
    const kind = key.split('-')[0];
    if (session.focus === 'hard' || session.focus === 'soft' || session.focus === 'pair') {
      if (kind !== session.focus) continue;
    } else if (session.focus === 'trouble' && session.troubleKeys.size
               && !session.troubleKeys.has(key)) {
      continue;
    }
    return s;
  }
  return randomScenario(); // focused pool ran dry — any hand is better than none
}

function nextHand() {
  if (!session || !session.running || session.awaiting) return;
  if (session.n >= session.target) { endSession(true); return; }
  if (session.timer) { clearTimeout(session.timer); session.timer = null; }
  session.cur = genScenario();
  const { cards, dealerUp } = session.cur;
  const { total, soft } = handValue(cards);
  const $ = id => document.getElementById(id);
  const dealer = cardNode(dealerUp, { faceDown: true });
  const c1 = cardNode(cards[0], { faceDown: true });
  const c2 = cardNode(cards[1], { faceDown: true });
  $('trainer-dealer').replaceChildren(dealer);
  $('trainer-player').replaceChildren(c1, c2);
  [c1, c2, dealer].forEach(c => flipUp(c));
  $('trainer-hand-total').textContent =
    (isPair(cards) ? `Pair ${cards[0].rank},${cards[1].rank} — ` : soft ? 'Soft ' : 'Hard ') + total;
  $('trainer-verdict').textContent = '';
  $('trainer-verdict').className = '';
  $('trainer-why').textContent = '';
  $('trainer-next').style.display = 'none';
  document.querySelectorAll('#trainer-actions .btn.action').forEach(b => {
    b.disabled = false;
    b.classList.remove('right', 'wrong');
    if (b.dataset.action === 'P' && !isPair(cards)) b.disabled = true;
  });
  session.awaiting = true;
  renderProgress();
}

function answer(act) {
  if (!session || !session.running || !session.awaiting) return;
  session.awaiting = false;
  const { cards, dealerUp } = session.cur;
  const expected = basicStrategy(cards, dealerUp);
  const ok = act === expected;
  const key = scenarioKey(cards, dealerUp);
  const m = state.stats.strategy[key] || { seen: 0, right: 0 };
  m.seen++;
  if (ok) m.right++;
  state.stats.strategy[key] = m;
  save(state);

  session.n++;
  if (ok) {
    session.correct++;
    session.streak++;
    session.bestStreak = Math.max(session.bestStreak, session.streak);
  } else {
    session.streak = 0;
    session.missed.push({
      key,
      label: prettyKey(key),
      expected: ACTION_NAMES[expected],
    });
  }

  const $ = id => document.getElementById(id);
  const verdict = $('trainer-verdict');
  verdict.textContent = ok
    ? `✓ Perfect — ${ACTION_NAMES[expected]}${session.streak >= 3 ? `  ·  ${session.streak} in a row 🔥` : ''}`
    : `✗ ${ACTION_NAMES[act]} — correct play is ${ACTION_NAMES[expected]}`;
  verdict.className = ok ? 'ok' : 'no';
  $('trainer-why').textContent = whyText(session.cur, expected);
  document.querySelectorAll('#trainer-actions .btn.action').forEach(b => {
    b.disabled = true;
    if (b.dataset.action === expected) b.classList.add('right');
    else if (b.dataset.action === act) b.classList.add('wrong');
  });
  $('trainer-next').style.display = '';
  renderProgress();
  renderMastery();
  if (ok) session.timer = setTimeout(() => nextHand(), 1100);
}

function renderProgress() {
  document.getElementById('trainer-progress-bar').style.width =
    (100 * session.n / session.target) + '%';
}

function renderMastery() {
  const { cats, seen, right } = masteryTotals();
  const box = document.getElementById('trainer-mastery');
  const rows = Object.entries(cats).map(([c, [s, r]]) => {
    const pct = s ? Math.round(100 * r / s) : 0;
    return el('div', { class: 'm-row' },
      el('span', {}, { hard: 'Hard totals', soft: 'Soft totals', pair: 'Pairs' }[c]),
      el('div', { class: 'm-bar' }, el('div', { style: `width:${pct}%` })),
      el('span', {}, s ? `${pct}% · ${s} seen` : '—'),
    );
  });
  const pct = seen ? Math.round(100 * right / seen) : 0;
  box.replaceChildren(
    el('div', { class: 'm-row' },
      el('span', {}, 'Overall'),
      el('div', { class: 'm-bar' }, el('div', { style: `width:${pct}%` })),
      el('span', {}, seen ? `${pct}% · ${seen} seen` : '—'),
    ),
    ...rows,
  );
}

function masteryTotals() {
  const cats = { hard: [0, 0], soft: [0, 0], pair: [0, 0] };
  let seen = 0, right = 0;
  for (const [key, v] of Object.entries(state.stats.strategy)) {
    const c = key.split('-')[0];
    if (!cats[c]) continue;
    cats[c][0] += v.seen;
    cats[c][1] += v.right;
    seen += v.seen;
    right += v.right;
  }
  return { cats, seen, right };
}

function endSession(finished) {
  if (!session) return;
  if (session.timer) clearTimeout(session.timer);
  session.running = false;
  const s = session;
  session = null;
  if (finished && s.n > 0) {
    state.stats.drills.unshift({
      when: Date.now(),
      mode: 'Perfect strategy',
      cards: s.n,
      checks: s.n,
      correct: s.correct,
      bestStreak: s.bestStreak,
      seconds: Math.round((Date.now() - s.t0) / 1000),
    });
    state.stats.drills = state.stats.drills.slice(0, 100);
    save(state);
  }
  const acc = s.n ? Math.round(100 * s.correct / s.n) : 0;
  const sum = document.getElementById('trainer-summary');
  const seenMissed = new Set();
  const missedRows = s.missed
    .filter(m => (seenMissed.has(m.key) ? false : (seenMissed.add(m.key), true)))
    .slice(0, 10)
    .map(m => el('tr', {}, el('td', {}, m.label), el('td', {}, m.expected)));
  sum.replaceChildren(
    el('div', { class: 'panel-title' }, finished ? 'Session complete' : 'Session ended'),
    el('div', { class: 'stats-tables' },
      el('div', {},
        el('div', { class: `big-stat ${s.n ? (acc >= 90 ? 'good' : acc >= 70 ? '' : 'bad') : ''}` }, s.n ? acc + '%' : '—'),
        el('div', {}, 'decision accuracy'),
      ),
      el('div', {},
        el('table', { class: 'stats' },
          el('tr', {}, el('td', {}, 'Hands answered'), el('td', {}, `${s.correct}/${s.n}`)),
          el('tr', {}, el('td', {}, 'Best streak'), el('td', {}, String(s.bestStreak))),
          el('tr', {}, el('td', {}, 'Time'), el('td', {}, Math.round((Date.now() - s.t0) / 1000) + 's')),
        ),
        ...(missedRows.length ? [
          el('div', { class: 'panel-title', style: 'margin-top:12px' }, 'Missed — correct plays'),
          el('table', { class: 'stats' },
            el('tr', {}, el('th', {}, 'Hand'), el('th', {}, 'Correct play')),
            ...missedRows,
          ),
        ] : []),
      ),
    ),
    el('div', { style: 'margin-top:12px; display:flex; gap:10px' },
      el('button', { class: 'btn primary', onclick: () => { sum.classList.add('hidden'); startSession(); } }, 'Train again'),
      el('button', { class: 'btn', onclick: () => { sum.classList.add('hidden'); document.getElementById('trainer-run').classList.add('hidden'); document.getElementById('trainer-config').classList.remove('hidden'); } }, 'Back to setup'),
    ),
  );
  sum.classList.remove('hidden');
  document.getElementById('trainer-run').classList.add('hidden');
}

function prettyKey(k) {
  const [kind, total, , up] = k.split('-');
  const upTxt = up === '11' ? 'A' : up;
  if (kind === 'pair') return `${total === 'A' ? 'A,A' : `${total},${total}`} v ${upTxt}`;
  return `${kind} ${total} v ${upTxt}`;
}

// ---------- the coaching "why" (shared with Story Mode) ----------
export function whyText(s, act) {
  const up = upValue(s.dealerUp);
  const { total, soft } = handValue(s.cards);
  const upTxt = up === 11 ? 'A' : up;
  const weak = up >= 2 && up <= 6;
  if (isPair(s.cards)) {
    const r = s.cards[0].rank;
    if (r === 'A') return 'A,A starts as soft 12 — splitting makes two strong hands. Always split.';
    if (r === '8') return '16 is the worst hand in the game — 8,8 becomes two hands starting at 8. Always split.';
    if (TEN_VALUED.has(r)) return '20 wins most hands — never break up a made 20.';
    if (r === '5') return '5,5 is just hard 10 — one good card wins double money. Double, never split.';
    if (r === '9') return act === 'P'
      ? `9,9 vs ${upTxt}: 18 underperforms here — two hands starting at 9 win more. Split.`
      : 'vs 7, 10 or A your 18 is already good — stand instead of splitting.';
    if (r === '7') return act === 'P'
      ? '7,7 vs 2-7: two hands from 7 beat one 14, and 14 loses to strong up-cards.'
      : 'vs 8+ the dealer already beats 14 too often — just hit.';
    if (r === '6') return act === 'P'
      ? '6,6 vs a weak up-card: two hands from 6 beat one stiff 12.'
      : 'against this up-card, splitting 6s just loses twice — hit.';
    if (r === '4') return act === 'P'
      ? '4,4 vs 5-6 only: the weak up-card makes two hands from 4 worth it (with DAS).'
      : '4,4 is a poor split — play it as hard 8 and hit.';
    return act === 'P'
      ? '2,2 / 3,3 vs 2-7: the dealer is weak (2-6) or 14 is hopeless (7) — take two hands.'
      : 'vs 8+ splitting deuces loses twice — hit.';
  }
  if (soft) {
    if (act === 'D') return `Soft ${total} can't bust with one card, and ${upTxt} is weak — double to press your edge.`;
    if (act === 'S') return total === 18
      ? `A,7 vs ${upTxt} — 18 plays well here; doubling risks the hand for little.`
      : `Soft ${total} is already there — stand.`;
    return `Soft ${total} can't bust — hit and try to improve.`;
  }
  if (act === 'D') return `Hard ${total} vs ${upTxt}: one ten-valued card (31% of the shoe) makes a strong 20-21 — double.`;
  if (act === 'R') return `Hard ${total} vs ${upTxt} wins so rarely that losing half the bet beats playing it out.`;
  if (act === 'S') {
    if (total >= 17) return `Hard ${total} — you are past the bust zone. Stand, always.`;
    if (total === 12) return '12 vs 4-6: the dealer busts often from these — stand and stay out of the bust path.';
    if (weak) return `Dealer ${upTxt} must draw to 17 and busts often — stand on your stiff and let them bust.`;
    return `Hard ${total} — 17+ is where stiff hands were heading anyway. Stand.`;
  }
  if (total <= 8) return `Hard ${total} can't bust — always hit.`;
  if (total >= 12) return `Dealer ${upTxt} (7-A) usually makes 17+ — 12-16 rarely wins as-is, so you must improve. Hit.`;
  return `Hard ${total}: too low to stand on — take a card.`;
}

// ---------- strategy chart (rendered from the engine, never hand-copied) ----------
const CARD = rank => ({ rank, suit: 'S' });
const UPS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function rowCards(kind, v) {
  if (kind === 'hard') {
    if (v <= 11) return [CARD('2'), CARD(String(v - 2))];
    if (v <= 19) return [CARD('10'), CARD(String(v - 10))];
    if (v === 20) return [CARD('10'), CARD('J')]; // not a pair -> hard 20
    return [CARD('10'), CARD('A')];
  }
  if (kind === 'soft') return [CARD('A'), CARD(String(v - 11))];
  return [CARD(v), CARD(v)];
}

function chartTable(title, kind, values) {
  const head = el('tr', {}, el('th', {}, ''), ...UPS.map(u => el('th', {}, u === 11 ? 'A' : u)));
  const rows = values.map(v => {
    const cards = rowCards(kind, v);
    return el('tr', {},
      el('td', { class: 'rowlab' }, kind === 'pair' ? `${v},${v}` : `${kind} ${v}`),
      ...UPS.map(u => {
        const a = basicStrategy(cards, CARD(u === 11 ? 'A' : String(u)));
        return el('td', {}, el('span', { class: `cc ${a}` }, a));
      }),
    );
  });
  return el('div', {},
    el('div', { class: 'panel-title' }, title),
    el('table', { class: 'strategy-chart' }, head, ...rows),
  );
}

function showChart() {
  showModal(el('div', { id: 'trainer-chart-wrap' },
    el('div', { class: 'panel-title' }, 'Perfect basic strategy — 6 decks, S17, DAS'),
    el('div', { class: 'chart-legend' },
      el('span', {}, el('span', { class: 'cc H' }, 'H'), ' Hit'),
      el('span', {}, el('span', { class: 'cc S' }, 'S'), ' Stand'),
      el('span', {}, el('span', { class: 'cc D' }, 'D'), ' Double'),
      el('span', {}, el('span', { class: 'cc P' }, 'P'), ' Split'),
      el('span', {}, el('span', { class: 'cc R' }, 'R'), ' Surrender'),
    ),
    chartTable('Hard totals', 'hard', [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]),
    chartTable('Soft totals (A + x)', 'soft', [13, 14, 15, 16, 17, 18, 19, 20, 21]),
    chartTable('Pairs', 'pair', ['A', '10', '9', '8', '7', '6', '5', '4', '3', '2']),
    el('p', { style: 'color:var(--muted);font-size:0.85em' },
      '5,5 is played as hard 10; every cell comes straight from the same engine the trainer grades you with.'),
    el('div', { style: 'margin-top:10px' },
      el('button', { class: 'btn primary', onclick: hideModal }, 'Close')),
  ));
}
