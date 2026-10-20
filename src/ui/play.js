// play.js — game mode: run profiles, live HUD, instant EV feedback, animations
import { Table } from '../engine/blackjack.js';
import { handValue } from '../engine/hand.js';
import { withDeviations, basicStrategy, insuranceDeviation, betSpread, ACTION_NAMES } from '../engine/strategy.js';
import { evaluateActionsAV, evaluateInsurance } from '../engine/evaluator.js';
import { cardNode, el, showModal, hideModal, fmtMoney, flipUp } from './cards.js';
import { load, save } from './store.js';
import { sfx, setSoundEnabled } from './sound.js';
import { openGlossary } from './glossary.js';

export const PROFILES = {
  rookie: {
    name: 'Rookie Run', icon: '🎓', start: 500, goal: 1000, minBet: 5,
    desc: '1 deck · S17 · DAS · no surrender · deep 85% shoe. Forgiving pace to learn the flow.',
    rules: { numDecks: 1, hitSoft17: false, das: true, surrender: false, penetration: 0.85 },
  },
  counter: {
    name: 'Counter Run', icon: '🃏', start: 2000, goal: 4000, minBet: 25,
    desc: '6 decks · S17 · DAS · late surrender · 75% pen. The standard counting game.',
    rules: { numDecks: 6, hitSoft17: false, das: true, surrender: true, penetration: 0.75 },
  },
  pro: {
    name: 'High Roller', icon: '👑', start: 5000, goal: 10000, minBet: 100,
    desc: '6 decks · H17 · DAS · surrender · deep 80% pen · $100 min. Real conditions, real swings.',
    rules: { numDecks: 6, hitSoft17: true, das: true, surrender: true, penetration: 0.8 },
  },
};

let state = null;
let gotoFn = null;
let table = null;
let profileId = null;
let run = null;
let pendingBet = 0;
let countVisible = true;
let lastKeys = new Set();
let bannerTimer = null;
let roundSeq = 0;
let settleFxSeq = -1;
let holeKeys = new Set();   // dealer cards currently (or last seen) face down
let lastBankroll = null;    // for the HUD bankroll bump

// ---------- lifecycle ----------
export function initPlay(stateRef, goto) {
  state = stateRef;
  gotoFn = goto;
  setSoundEnabled(state.settings.sound);
  const $ = id => document.getElementById(id);

  document.querySelectorAll('#play-bet-controls [data-chip]').forEach(b =>
    b.addEventListener('click', () => {
      if (table?.round && table.round.phase !== 'settle') return;
      pendingBet = Math.min(pendingBet + parseInt(b.dataset.chip, 10), table ? table.bankroll : 0);
      sfx('chip');
      renderAll();
    }));
  $('play-bet-clear').addEventListener('click', () => { pendingBet = table ? table.rules.minBet : 5; renderAll(); });
  $('play-deal').addEventListener('click', dealRound);
  $('play-next').addEventListener('click', () => { $('play-next').style.display = 'none'; renderAll(); });
  $('play-menu').addEventListener('click', () => gotoFn('runs'));
  $('play-count-toggle').addEventListener('click', () => {
    countVisible = !countVisible;
    state.settings.showCount = countVisible;
    save(state);
    renderAll();
  });
  document.querySelectorAll('#play-actions [data-action]').forEach(b =>
    b.addEventListener('click', () => doAction(b.dataset.action)));
  $('play-ins-yes').addEventListener('click', () => resolveInsurance(true));
  $('play-ins-no').addEventListener('click', () => resolveInsurance(false));

  document.addEventListener('keydown', e => {
    if ($('screen-play').classList.contains('hidden')) return;
    const k = e.key.toLowerCase();
    if (k === 'h') doAction('H');
    else if (k === 's') doAction('S');
    else if (k === 'd') doAction('D');
    else if (k === 'p') doAction('P');
    else if (k === 'r') doAction('R');
    else if (k === 'y' && table?.round?.phase === 'insurance') resolveInsurance(true);
    else if (k === 'n' && table?.round?.phase === 'insurance') resolveInsurance(false);
    else if (e.key === 'Enter' && table?.round?.phase === 'settle') { $('play-next').style.display = 'none'; renderAll(); }
  });
}

export function enterRuns() {
  const list = document.getElementById('runs-list');
  list.replaceChildren(...Object.entries(PROFILES).map(([id, p]) => {
    const saved = state.runs[id];
    const progress = saved ? Math.max(0, Math.min(1, (saved.bankroll - p.start) / (p.goal - p.start))) : 0;
    let status = '';
    if (saved?.status === 'won') status = '<span class="run-status won">WON 🏆</span>';
    else if (saved?.status === 'bust') status = '<span class="run-status bust">BUST</span>';
    else if (saved) status = '<span class="run-status" style="color:#b7ad93">IN PROGRESS</span>';
    const sub = saved?.status === 'active'
      ? `Continue at ${fmtMoney(saved.bankroll)} · ${saved.rounds} rounds`
      : saved?.status === 'won' ? 'Run beaten — start a fresh one'
      : saved?.status === 'bust' ? 'Bankroll gone — start a fresh one'
      : `Start with ${fmtMoney(p.start)}`;
    const card = el('button', { class: 'run-card' });
    card.innerHTML = `
      ${status}
      <span class="run-icon">${p.icon}</span>
      <h3>${p.name}</h3>
      <div class="run-desc">${p.desc}</div>
      <div class="run-goal">${fmtMoney(p.start)} → ${fmtMoney(p.goal)} · min bet ${fmtMoney(p.minBet)}</div>
      <div class="run-progress">
        <div class="run-progress-bar"><div style="width:${Math.round(progress * 100)}%"></div></div>
        <div style="font-size:0.82em;color:#9d947c;margin-top:4px">${sub}</div>
      </div>`;
    card.addEventListener('click', () => startRun(id));
    return card;
  }));
}

function startRun(id) {
  profileId = id;
  const p = PROFILES[id];
  run = state.runs[id];
  if (!run || run.status !== 'active') {
    run = {
      status: 'active', bankroll: p.start, start: p.start, goal: p.goal,
      rounds: 0, hands: 0, wagered: 0, net: 0,
      history: [{ r: 0, b: p.start }],
      decisions: 0, correct: 0, evLostUsd: 0,
      streak: 0, bestStreak: 0, points: 0,
    };
    state.runs[id] = run;
    save(state);
  }
  table = new Table({ ...p.rules, minBet: p.minBet });
  table.bankroll = run.bankroll;
  pendingBet = p.minBet;
  countVisible = state.settings.showCount;
  lastKeys = new Set();
  roundSeq++;
  gotoFn('play');
  renderAll();
}

// ---------- round flow ----------
function dealRound() {
  if (!table) return;
  if (table.bankroll < table.rules.minBet) { endRun('bust'); return; }
  const grade = table.lastShuffleCount;
  const bet = Math.max(table.rules.minBet, Math.min(pendingBet, table.bankroll));
  pendingBet = bet;
  table.startRound(bet);
  roundSeq++;
  holeKeys.clear();
  run.bankroll = table.bankroll;
  save(state);
  sfx('chip');
  setTimeout(() => sfx('card'), 120);
  hideBanner();
  setMessage('');
  if (grade !== null && state.settings.shuffleQuiz) askShuffleQuiz(grade);
  renderAll();
}

// ---------- animation helpers ----------
// deal cards face-down, then flip them face-up on landing (dealer-style)
function scheduleFlip(node, delay = 320) {
  setTimeout(() => {
    if (!node.isConnected) return;
    node.classList.add('flipping');
    flipUp(node);
    setTimeout(() => node.classList.remove('flipping'), 600);
  }, delay);
}

// gold coin burst over a winning hand
function coinBurst(host, n = 12) {
  const colors = ['#f1c40f', '#e67e22', '#f39c12', '#d4af37', '#2ecc71'];
  for (let i = 0; i < n; i++) {
    const p = el('span', { class: 'fx-coin' });
    const ang = -Math.random() * Math.PI;           // upward semicircle
    const dist = 60 + Math.random() * 80;
    p.style.setProperty('--dx', `${Math.round(Math.cos(ang) * dist)}px`);
    p.style.setProperty('--dy', `${Math.round(Math.sin(ang) * dist - 30)}px`);
    p.style.setProperty('--rot', `${Math.round(Math.random() * 720 - 360)}deg`);
    p.style.animationDelay = `${(Math.random() * 0.15).toFixed(2)}s`;
    p.style.background = colors[i % colors.length];
    host.append(p);
    setTimeout(() => p.remove(), 1300);
  }
}

function snapshot() {
  const r = table.round;
  const h = r.hands[r.active];
  return {
    cards: h.cards.slice(),
    up: r.dealer[0].card,
    allowed: table.availableActions(r.active).slice(),
    remaining: table.shoe.cards.slice(),
    bet: h.bet,
    tc: table.trueCount,
    rules: { hitSoft17: table.rules.hitSoft17 },
  };
}

function doAction(action) {
  if (!table?.round || table.round.phase !== 'player') return;
  const pre = snapshot();
  if (!pre.allowed.includes(action)) return;
  table.playerAction(action);
  sfx(action === 'H' || action === 'D' ? 'card' : 'flip');
  run.bankroll = table.bankroll;
  if (state.settings.feedback) gradeDecision(pre, action);
  save(state);
  renderAll();
}

function resolveInsurance(take) {
  if (table?.round?.phase !== 'insurance') return;
  const remaining = table.shoe.cards.slice();
  const bet = table.round.bet;
  table.resolveInsurance(take);
  run.bankroll = table.bankroll;
  if (state.settings.feedback) gradeInsurance(remaining, take, bet);
  save(state);
  renderAll();
}

// ---------- decision grading ----------
function gradeDecision(pre, action) {
  const opts = {
    canDouble: pre.allowed.includes('D'),
    canSplit: pre.allowed.includes('P'),
    canSurrender: pre.allowed.includes('R'),
  };
  const rec = withDeviations(pre.cards, pre.up, pre.tc, opts);
  let expected = rec.action;
  if (!pre.allowed.includes(expected)) expected = basicStrategy(pre.cards, pre.up, opts);
  const correct = action === expected;

  const evs = evaluateActionsAV({
    playerCards: pre.cards, dealerUp: pre.up, remaining: pre.remaining,
    rules: pre.rules, actions: pre.allowed, sims: 120,
  });
  const chosenEv = evs[action] ?? 0;
  const bestEv = Math.max(...Object.values(evs));
  const cost = correct ? 0 : Math.max(0, bestEv - chosenEv) * pre.bet;

  run.decisions++;
  if (correct) {
    run.correct++;
    run.streak++;
    run.bestStreak = Math.max(run.bestStreak, run.streak);
    run.points += 10 + run.streak * 2;
    if (run.streak >= 3) sfx('streak'); else sfx('correct');
  } else {
    run.streak = 0;
    run.evLostUsd += cost;
    sfx('wrong');
  }
  showBanner({ correct, deviation: rec.deviation, action, expected, evs, cost, allowed: pre.allowed });
}

function gradeInsurance(remaining, take, bet) {
  const ev = evaluateInsurance(remaining); // per $1 of insurance
  const correct = take === (ev >= 0);
  const cost = correct ? 0 : Math.abs(ev) * (bet / 2);
  run.decisions++;
  if (correct) {
    run.correct++;
    run.streak++;
    run.bestStreak = Math.max(run.bestStreak, run.streak);
    run.points += 10 + run.streak * 2;
    sfx('correct');
  } else {
    run.streak = 0;
    run.evLostUsd += cost;
    sfx('wrong');
  }
  const why = `Insurance EV ≈ ${ev >= 0 ? '+' : ''}${ev.toFixed(2)} per $1 (breaks even at ~1/3 tens) — ${ev >= 0 ? 'take it' : 'decline it'}.`;
  showBannerRaw(correct, take ? 'Insurance taken' : 'Insurance declined', why, cost);
}

function showBanner({ correct, deviation, action, expected, evs, cost, allowed }) {
  const icon = deviation ? '⭐' : correct ? '✓' : '✗';
  const what = ACTION_NAMES[action];
  const recTxt = d => d ? ` <span class="fb-cost">(deviation ${d.name} at TC ≥ ${d.index > 0 ? '+' : ''}${d.index})</span>` : '';
  let main;
  if (correct && deviation) {
    main = `<span class="fb-cost">DEVIATION</span> — ${deviation.name}: ${what} at TC ≥ ${deviation.index > 0 ? '+' : ''}${deviation.index}. You had it.`;
  } else if (correct) {
    main = `${what} is right${recTxt(deviation)}.`;
  } else {
    main = `${what}? Best was <b>${ACTION_NAMES[expected]}</b>${recTxt(deviation)}.`;
  }
  const evStr = Object.entries(evs).filter(([a]) => allowed.includes(a))
    .sort((x, y) => y[1] - x[1])
    .map(([a, v]) => `${ACTION_NAMES[a]} ${v >= 0 ? '+' : ''}${v.toFixed(2)}`)
    .join(' · ');
  const costStr = cost > 0.005 ? `<span class="fb-cost">cost ≈ ${fmtMoney(cost)}</span>` : '';
  renderBanner(correct ? 'ok' : 'bad', icon, main, `${evStr}<br>${costStr}`);
  if (deviation) document.getElementById('play-feedback').classList.add('dev');
}

function showBannerRaw(correct, title, why, cost) {
  const costStr = cost > 0.005 ? `<span class="fb-cost">cost ≈ ${fmtMoney(cost)}</span>` : '';
  renderBanner(correct ? 'ok' : 'bad', correct ? '✓' : '✗', `<b>${title}</b> — ${why}`, costStr);
}

function renderBanner(cls, icon, mainHtml, evHtml) {
  const b = document.getElementById('play-feedback');
  b.className = `fb-banner ${cls}`;
  b.innerHTML = `<span class="fb-icon">${icon}</span><span class="fb-main">${mainHtml}</span><span class="fb-ev">${evHtml || ''}</span>`;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(hideBanner, 6000);
}

function hideBanner() {
  const b = document.getElementById('play-feedback');
  b.classList.add('hidden');
  b.classList.remove('ok', 'bad', 'dev');
}

// ---------- HUD ----------
function rank(acc, decisions) {
  if (decisions < 8) return '—';
  if (acc < 60) return '🐟 Fish';
  if (acc < 75) return '👤 Tourist';
  if (acc < 85) return '📈 Basic';
  if (acc < 92) return '🧠 Counter';
  if (acc < 97) return '💼 AP';
  return '🦈 Shark';
}

function renderHud() {
  const hud = document.getElementById('play-hud');
  const p = PROFILES[profileId];
  const acc = run.decisions ? Math.round(100 * run.correct / run.decisions) : 100;
  const prog = Math.max(0, Math.min(1, (run.bankroll - p.start) / (p.goal - p.start)));
  const bankChanged = lastBankroll !== null && lastBankroll !== run.bankroll;
  lastBankroll = run.bankroll;
  hud.innerHTML = `
    <div class="hud-box${bankChanged ? ' bump' : ''}"><span class="v">${p.icon} ${fmtMoney(run.bankroll)}</span><span class="k">${p.name}</span></div>
    <div class="hud-box goal"><span class="v">${Math.round(prog * 100)}% <span style="font-weight:400;color:#9d947c">to goal ${fmtMoney(p.goal)}</span></span>
      <div class="run-progress-bar" style="margin-top:6px"><div style="width:${Math.round(prog * 100)}%"></div></div></div>
    <div class="hud-box"><span class="v" style="color:${run.net > 0 ? 'var(--good)' : run.net < 0 ? 'var(--bad)' : 'inherit'}">${run.net > 0 ? '+' : ''}${fmtMoney(run.net)}</span><span class="k">net · ${run.rounds} rds</span></div>
    <div class="hud-box"><span class="v" style="color:var(--gold)">${run.evLostUsd > 0.005 ? '-' + fmtMoney(run.evLostUsd) : '$0'}</span><span class="k">EV lost</span></div>
    <div class="hud-box"><span class="v">${acc}%</span><span class="k">accuracy${run.decisions ? ` (${run.correct}/${run.decisions})` : ''}</span></div>
    <div class="hud-box"><span class="v ${run.streak >= 3 ? 'hud-flame' : ''}">${run.streak >= 3 ? '🔥' : ''}${run.streak}×</span><span class="k">streak</span></div>
    <div class="hud-box"><span class="v">${run.points}</span><span class="k">pts · ${rank(acc, run.decisions)}</span></div>
    <button class="hud-btn ${state.settings.feedback ? '' : 'off'}" id="hud-feedback" title="Instant feedback">🎯</button>
    <button class="hud-btn ${state.settings.sound ? '' : 'off'}" id="hud-sound" title="Sound">🔊</button>
    <button class="hud-btn" id="hud-glossary" title="What do these words mean?">📖</button>
    <button class="hud-btn" id="hud-cash" title="Cash out and end the run">💵</button>`;
  document.getElementById('hud-feedback').addEventListener('click', () => {
    state.settings.feedback = !state.settings.feedback;
    save(state);
    renderHud();
  });
  document.getElementById('hud-glossary').addEventListener('click', () => openGlossary());
  document.getElementById('hud-sound').addEventListener('click', () => {
    state.settings.sound = !state.settings.sound;
    setSoundEnabled(state.settings.sound);
    save(state);
    renderHud();
  });
  document.getElementById('hud-cash').addEventListener('click', () => {
    if (run.rounds === 0) { gotoFn('runs'); return; }
    confirmCashOut();
  });
}

function confirmCashOut() {
  showModal(el('div', {},
    el('div', { style: 'font-weight:800;font-size:1.2em' }, 'Cash out?'),
    el('p', { style: 'color:#b7ad93' }, `Leave the run with ${fmtMoney(run.bankroll)} (net ${run.net >= 0 ? '+' : ''}${fmtMoney(run.net)}).`),
    el('div', { style: 'display:flex;gap:10px;justify-content:center;margin-top:12px' },
      el('button', { class: 'btn primary', onclick: () => { hideModal(); endRun('cashed'); } }, 'Cash out'),
      el('button', { class: 'btn', onclick: hideModal }, 'Keep playing'))));
}

function endRun(status) {
  run.status = status;
  run.bankroll = table ? table.bankroll : run.bankroll;
  save(state);
  const acc = run.decisions ? Math.round(100 * run.correct / run.decisions) : 0;
  const p = PROFILES[profileId];
  const title = status === 'won' ? '🏆 RUN BEATEN!' : status === 'bust' ? '💀 BUSTED' : '💵 Cashed out';
  if (status === 'won') sfx('trophy'); else if (status === 'bust') sfx('lose');
  showModal(el('div', {},
    el('div', { style: 'font-weight:900;font-size:1.4em;margin-bottom:8px' }, title),
    el('table', { class: 'stats', style: 'margin:0 auto' },
      el('tr', {}, el('td', {}, 'Bankroll'), el('td', {}, fmtMoney(run.bankroll))),
      el('tr', {}, el('td', {}, 'Net'), el('td', {}, `${run.net >= 0 ? '+' : ''}${fmtMoney(run.net)}`)),
      el('tr', {}, el('td', {}, 'Rounds / hands'), el('td', {}, `${run.rounds} / ${run.hands}`)),
      el('tr', {}, el('td', {}, 'Decision accuracy'), el('td', {}, `${acc}% (${run.correct}/${run.decisions})`)),
      el('tr', {}, el('td', {}, 'EV lost to mistakes'), el('td', {}, fmtMoney(run.evLostUsd))),
      el('tr', {}, el('td', {}, 'Points'), el('td', {}, `${run.points} · ${rank(acc, run.decisions)}`)),
    ),
    el('div', { style: 'display:flex;gap:10px;justify-content:center;margin-top:14px' },
      el('button', { class: 'btn primary', onclick: () => { hideModal(); startRun(profileId); } }, `New ${p.name}`),
      el('button', { class: 'btn', onclick: () => { hideModal(); gotoFn('runs'); } }, 'Choose run'))));
}

// ---------- rendering ----------
function setMessage(html, cls) {
  const m = document.getElementById('play-message');
  m.innerHTML = html ? `<span class="msg-pop ${cls || ''}">${html}</span>` : '';
}

function outcomeText(results) {
  const total = results.reduce((s, r) => s + r.net, 0);
  const names = { bj: 'BLACKJACK!', win: 'Win', lose: 'Lose', push: 'Push', bust: 'Bust', surrender: 'Surrender' };
  const label = results.map(r => names[r.outcome]).join(' · ');
  return `${label} <span class="${total > 0 ? 'win' : total < 0 ? 'lose' : 'push'}">${total > 0 ? '+' : ''}${fmtMoney(total)}</span>`;
}

function renderAll() {
  const $ = id => document.getElementById(id);
  if (!table || !run) return;
  const r = table.round;

  $('hdr-bankroll').textContent = fmtMoney(table.bankroll);
  $('hdr-bankroll').classList.remove('hidden');
  renderHud();

  // dealer
  const dealerRow = $('play-dealer-cards');
  dealerRow.replaceChildren();
  const newKeys = new Set();
  if (r) {
    r.dealer.forEach((d, di) => {
      const key = `d${di}-${d.card.rank}${d.card.suit}`;
      newKeys.add(key);
      const isNew = d.faceUp && !lastKeys.has(key);
      const wasHidden = d.faceUp && holeKeys.has(key);
      const node = cardNode(d.card, { faceDown: !d.faceUp || isNew || wasHidden });
      if (d.faceUp) holeKeys.delete(key); else holeKeys.add(key);
      if (isNew) {
        node.classList.add('dealt');
        scheduleFlip(node);
      } else if (wasHidden) {
        scheduleFlip(node, 80);
      }
      dealerRow.append(node);
    });
  }
  const badge = $('play-dealer-total');
  if (r && r.dealer.length) {
    const visible = r.dealer.filter(d => d.faceUp).map(d => d.card);
    if (visible.length) {
      const { total, soft } = handValue(visible);
      const holeHidden = r.dealer.some(d => !d.faceUp);
      badge.textContent = (soft && total !== 21 ? `soft ${total}` : String(total)) + (holeHidden ? ' + ?' : '');
      badge.classList.remove('hidden');
    } else badge.classList.add('hidden');
  } else badge.classList.add('hidden');

  // player hands
  const handsRow = $('play-hands');
  handsRow.replaceChildren();
  if (r) {
    r.hands.forEach((h, i) => {
      const cardsBox = el('div', { class: 'cards-row' });
      h.cards.forEach((c, ci) => {
        const key = `p${i}-${ci}-${c.rank}${c.suit}`;
        newKeys.add(key);
        const isNew = !lastKeys.has(key);
        const node = cardNode(c, { faceDown: isNew });
        if (isNew) {
          node.classList.add('dealt');
          scheduleFlip(node);
        }
        cardsBox.append(node);
      });
      const { total, soft } = handValue(h.cards);
      const meta = el('div', { class: 'hand-meta' },
        el('span', {}, (soft && total !== 21 ? 'soft ' : '') + total),
        '  ', el('span', { class: 'hand-bet' }, fmtMoney(h.bet)),
        h.result && r.results ? el('span', {
          class: r.results[i].net > 0 ? ' win' : r.results[i].net < 0 ? ' lose' : ' push',
        }, '  ' + h.result.toUpperCase()) : '');
      const handEl = el('div', {
        class: `player-hand ${i === r.active && r.phase === 'player' ? 'active' : ''}`,
      }, cardsBox, meta);
      if (r.phase === 'settle' && r.results && settleFxSeq !== roundSeq) {
        const net = r.results[i].net;
        if (net > 0) {
          handEl.classList.add('result-win');
          coinBurst(handEl, r.results[i].outcome === 'bj' ? 22 : 12);
        } else if (net < 0) handEl.classList.add('result-lose');
      }
      const coins = Math.max(1, Math.min(6, Math.round(h.bet / (table.rules.minBet * 2) || 1)));
      const stack = el('div', { class: 'chip-stack' });
      for (let c = 0; c < coins; c++) {
        const coin = el('div', { class: `chip-coin${c === coins - 1 ? '' : ' no-anim'}` });
        coin.style.background = ['#c0392b', '#2e86c1', '#212f3d', '#7d3c98', '#b89420', '#1e8449'][c % 6];
        stack.append(coin);
      }
      handEl.append(stack);
      handsRow.append(handEl);
    });
  }
  lastKeys = newKeys;

  // phase controls
  const betting = !r || r.phase === 'settle';
  $('play-bet-controls').classList.toggle('hidden', !betting);
  $('play-actions').classList.toggle('hidden', betting);
  $('play-next').style.display = (r && r.phase === 'settle') ? '' : 'none';

  if (r && r.phase === 'insurance') {
    $('play-ins-yes').classList.remove('hidden');
    $('play-ins-no').classList.remove('hidden');
    setMessage(`Dealer shows an ace — insurance? (costs ${fmtMoney(r.bet / 2)}, pays 2:1)`);
  } else {
    $('play-ins-yes').classList.add('hidden');
    $('play-ins-no').classList.add('hidden');
  }

  document.querySelectorAll('#play-actions [data-action]').forEach(b => {
    const allowed = r && r.phase === 'player' ? table.availableActions(r.active) : [];
    b.disabled = !allowed.includes(b.dataset.action);
  });

  // settle effects + bookkeeping
  if (r && r.phase === 'settle' && r.results) {
    const anyBj = r.results.some(x => x.outcome === 'bj');
    const totalNet = r.results.reduce((s, x) => s + x.net, 0);
    setMessage(anyBj
      ? `<span class="bj-banner">BLACKJACK!</span> <span class="${r.results[0].net > 0 ? 'win' : 'push'}">${r.results[0].net >= 0 ? '+' : ''}${fmtMoney(r.results[0].net)}</span>`
      : outcomeText(r.results));
    if (settleFxSeq !== roundSeq) {
      settleFxSeq = roundSeq;
      sfx(anyBj ? 'bj' : totalNet > 0 ? 'win' : totalNet < 0 ? 'lose' : 'push');
      const dv = handValue(r.dealer.map(d => d.card));
      const badgeEl = $('play-dealer-total');
      if (dv.total > 21 && badgeEl) {
        badgeEl.classList.add('bust-flash');
        setTimeout(() => badgeEl.classList.remove('bust-flash'), 1100);
      }
      run.rounds++;
      run.hands += r.results.length;
      run.wagered += r.bet;
      run.net += totalNet;
      run.bankroll = table.bankroll;
      run.history = run.history || [{ r: 0, b: run.start }];
      run.history.push({ r: run.rounds, b: run.bankroll });
      if (run.history.length > 500) run.history.shift();
      save(state);
      renderHud();
      if (run.bankroll >= run.goal) { setTimeout(() => endRun('won'), 900); }
      else if (run.bankroll < table.rules.minBet) { setTimeout(() => endRun('bust'), 900); }
    }
  } else if (!r) {
    setMessage(`Bet ${fmtMoney(pendingBet)} and deal`);
  }

  renderCoach();
  renderCount();
}

function renderCoach() {
  const box = document.getElementById('play-coach');
  const r = table?.round;
  if (!state.settings.coachHints) {
    box.innerHTML = 'Coach hints are off — enable them in Settings.';
    return;
  }
  if (!r || r.phase !== 'player') {
    const tc = table.trueCount;
    const sug = betSpread(tc, table.rules.minBet);
    box.innerHTML = r && r.phase === 'insurance'
      ? 'Insurance: normally never. It turns +EV near true count +3 — the feedback banner will grade it.'
      : `Suggested bet at true count ${tc >= 0 ? '+' : ''}${tc}: <b>${fmtMoney(sug)}</b> (1–12 spread).`;
    return;
  }
  const h = r.hands[r.active];
  const up = r.dealer[0].card;
  const av = table.availableActions(r.active);
  const opts = {
    canDouble: av.includes('D'), canSplit: av.includes('P'),
    canSurrender: av.includes('R'), das: table.rules.das,
  };
  const { action, deviation } = withDeviations(h.cards, up, table.trueCount, opts);
  const basic = basicStrategy(h.cards, up, opts);
  const tcStr = `<b>${table.trueCount >= 0 ? '+' : ''}${table.trueCount}</b>`;
  if (deviation) {
    box.innerHTML = `<span class="dev">DEVIATION — ${deviation.name}</span>: ${ACTION_NAMES[action]} at TC ≥ ${deviation.index > 0 ? '+' : ''}${deviation.index} (now ${tcStr}). Basic would be ${ACTION_NAMES[basic]}. <span class="why">The shoe is rich — change the play.</span>`;
  } else {
    box.innerHTML = `Basic strategy: <b>${ACTION_NAMES[action]}</b>. <span class="why">${tip(h.cards, up, action)}</span>`;
  }
}

function tip(cards, up, action) {
  const { total, soft } = handValue(cards);
  const uv = up.rank === 'A' ? 'ace' : up.rank;
  if (action === 'D') return `Doubles maximize money when the dealer is likely to bust (${uv} up).`;
  if (action === 'P') return `Split to turn one hand into two strong ones against ${uv}.`;
  if (action === 'S') return `${soft ? 'Soft ' : ''}${total} stands against ${uv} — dealer busts often here.`;
  if (action === 'R') return `Surrender: this matchup loses more than half your bet on average.`;
  return `${soft ? 'Soft ' : ''}${total} hits against ${uv} — standing loses long-term.`;
}

function renderCount() {
  const box = document.getElementById('play-count');
  const tc = table.trueCount;
  const rc = table.runningCount;
  const dk = table.decksRemaining;
  const hdr = document.getElementById('hdr-count');
  hdr.textContent = `RC ${rc > 0 ? '+' : ''}${rc} · TC ${tc > 0 ? '+' : ''}${tc}`;
  hdr.classList.toggle('hidden', !countVisible);
  hdr.classList.toggle('spicy', countVisible && Math.abs(tc) >= 2);
  if (!countVisible) {
    box.innerHTML = '<div class="count-hidden">Count hidden — track it yourself! Click "show/hide" to check.</div>';
    return;
  }
  const tcCls = tc >= 2 ? 'good' : tc <= -1 ? 'bad' : '';
  box.innerHTML = `
    <div class="stat" data-gloss="rc"><b>${rc > 0 ? '+' : ''}${rc}</b><span>running</span></div>
    <div class="stat" data-gloss="tc"><b class="${tcCls}">${tc > 0 ? '+' : ''}${tc}</b><span>true</span></div>
    <div class="stat" data-gloss="decks"><b>${dk.toFixed(1)}</b><span>decks left</span></div>
    <div class="stat" data-gloss="spread"><b>${fmtMoney(betSpread(tc, table.rules.minBet))}</b><span>bet advice</span></div>`;
  box.querySelectorAll('.stat[data-gloss]').forEach(s =>
    s.addEventListener('click', () => openGlossary(s.dataset.gloss)));
}

function askShuffleQuiz(grade) {
  const input = el('input', { type: 'number', step: '1', placeholder: 'running count' });
  const verdict = el('div', { class: 'verdict' });
  const ok = () => {
    const v = parseInt(input.value, 10);
    if (Number.isNaN(v)) return;
    const good = v === grade;
    verdict.textContent = good ? `✓ Correct — the count was ${grade > 0 ? '+' : ''}${grade}.` : `✗ It was ${grade > 0 ? '+' : ''}${grade} — you said ${v}.`;
    verdict.className = 'verdict ' + (good ? 'ok' : 'no');
    state.stats.play.countGrades.push({ when: Date.now(), actual: grade, guess: v });
    save(state);
    input.disabled = true;
    btn.textContent = 'Continue';
    btn.onclick = hideModal;
  };
  const btn = el('button', { class: 'btn primary', onclick: ok }, 'Check');
  showModal(el('div', {},
    el('div', { style: 'font-weight:700; font-size:1.1em' }, 'Shuffle! What was the running count?'),
    input, verdict, el('div', { style: 'margin-top:10px' }, btn)));
  input.focus();
}
