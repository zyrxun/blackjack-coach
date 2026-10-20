// drill.js — count training: cards flip, checkpoints quiz your running/true count
import { Shoe } from '../engine/shoe.js';
import { HILO_TAGS } from '../engine/count.js';
import { cardNode, el, showModal, hideModal } from './cards.js';
import { load, save } from './store.js';

let session = null;

export function initDrill(state, goto) {
  const $ = id => document.getElementById(id);
  $('drill-start').addEventListener('click', () => startDrill(state));
  $('drill-next').addEventListener('click', () => nextCard());
  $('drill-quit').addEventListener('click', () => endDrill(state, false));
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !$('screen-drill').classList.contains('hidden')
        && session && session.running && !session.awaitingInput
        && $('drill-pace').value === 'manual') {
      e.preventDefault();
      nextCard();
    }
  });
}

function startDrill(state) {
  const $ = id => document.getElementById(id);
  const numCards = parseInt($('drill-cards').value, 10);
  const pace = $('drill-pace').value;
  const deckSize = numCards <= 52 ? 1 : 6;
  session = {
    running: true,
    awaitingInput: false,
    mode: $('drill-mode').value,
    hints: $('drill-hints').checked,
    pace,
    numCards,
    i: 0,
    rc: 0,
    correct: 0,
    checks: 0,
    streak: 0,
    bestStreak: 0,
    nextCheck: 3 + Math.floor(Math.random() * 4),
    shoe: new Shoe(deckSize, 0.9),
    t0: Date.now(),
    timer: null,
  };
  $('drill-config').classList.add('hidden');
  $('drill-summary').classList.add('hidden');
  $('drill-run').classList.remove('hidden');
  $('drill-count-display').classList.add('hidden');
  renderProgress();
  $('drill-card-slot').replaceChildren();
  if (pace !== 'manual') session.timer = setInterval(nextCard, parseInt(pace, 10));
}

function nextCard() {
  if (!session || !session.running || session.awaitingInput) return;
  if (session.i >= session.numCards) { endDrill(load(), true); return; }
  const card = session.shoe.deal();
  session.rc += HILO_TAGS[card.rank];
  session.i++;
  const slot = document.getElementById('drill-card-slot');
  const showTag = session.hints;
  const node = cardNode(card, { showTag });
  node.classList.remove('up');
  slot.replaceChildren(node);
  requestAnimationFrame(() => requestAnimationFrame(() => node.classList.add('up')));
  const tag = document.getElementById('drill-tag');
  if (session.hints) {
    const v = HILO_TAGS[card.rank];
    tag.textContent = `${card.rank}${card.suit === 'S' ? '♠' : card.suit === 'H' ? '♥' : card.suit === 'D' ? '♦' : '♣'} counts ${v > 0 ? '+' : ''}${v}`;
    tag.classList.remove('hidden');
  }
  renderProgress();
  if (session.i >= session.nextCheck && session.i < session.numCards) {
    askCount();
  } else if (session.i >= session.numCards) {
    setTimeout(() => askCount(true), session.pace === 'manual' ? 300 : 700);
  }
}

function renderProgress() {
  document.getElementById('drill-progress-bar').style.width =
    (100 * session.i / session.numCards) + '%';
}

function askCount(final = false) {
  session.awaitingInput = true;
  if (session.timer) { clearInterval(session.timer); session.timer = null; }
  const answer = el('input', { type: 'number', step: '1', placeholder: 'count' });
  const verdict = el('div', { class: 'verdict' });
  const submit = el('button', { class: 'btn primary' }, final ? 'Finish' : 'Submit');

  const remaining = session.shoe.cardsRemaining; // unseen cards
  const decksLeft = Math.max(remaining, 1) / 52;

  const boxes = [];
  const rows = [el('div', {}, 'Your running count?'), answer];
  if (session.mode === 'true' || final) {
    const tc = el('input', { type: 'number', step: '1', placeholder: 'true count' });
    boxes.push(tc);
    rows.push(el('div', { style: 'margin-top:10px' },
      `True count? (about ${decksLeft.toFixed(1)} decks left, ${remaining} cards)`), tc);
  }
  const check = () => {
    const rcVal = parseInt(answer.value, 10);
    if (Number.isNaN(rcVal)) return;
    session.checks++;
    let ok = rcVal === session.rc;
    const parts = [`RC ${rcVal === session.rc ? '✓' : `✗ (was ${session.rc > 0 ? '+' : ''}${session.rc})`}`];
    if (boxes.length) {
      const decksRemaining = session.shoe.cardsRemaining / 52;
      const trueAnswer = Math.floor(session.rc / Math.max(decksRemaining, 0.5));
      const tcVal = parseInt(boxes[0].value, 10);
      const okTc = tcVal === trueAnswer;
      ok = ok && okTc;
      parts.push(`TC ${tcVal === trueAnswer ? '✓' : `✗ (was ${trueAnswer})`}`);
    }
    if (ok) { session.correct++; session.streak++; session.bestStreak = Math.max(session.bestStreak, session.streak); }
    else session.streak = 0;
    verdict.textContent = parts.join('   ');
    verdict.className = 'verdict ' + (ok ? 'ok' : 'no');
    answer.disabled = true;
    boxes.forEach(b => b.disabled = true);
    submit.textContent = final ? 'See summary' : 'Continue';
    submit.onclick = () => {
      hideModal();
      session.awaitingInput = false;
      if (final) { endDrill(load(), true); return; }
      session.nextCheck = session.i + 3 + Math.floor(Math.random() * 4);
      if (session.pace !== 'manual') session.timer = setInterval(nextCard, parseInt(session.pace, 10));
    };
  };
  const onKeyDown = e => { if (e.key === 'Enter') { e.preventDefault(); submit.click(); } };
  document.addEventListener('keydown', onKeyDown, { once: true });
  submit.addEventListener('click', check, { once: true });
  showModal(el('div', {}, ...rows, verdict, el('div', { style: 'margin-top:8px' }, submit)));
  answer.focus();
}

function endDrill(state, saveStats) {
  if (!session) return;
  if (session.timer) clearInterval(session.timer);
  session.running = false;
  hideModal();
  if (saveStats) {
    state.stats.drills.unshift({
      when: Date.now(),
      mode: session.mode,
      cards: session.i,
      checks: session.checks,
      correct: session.correct,
      bestStreak: session.bestStreak,
      seconds: Math.round((Date.now() - session.t0) / 1000),
    });
    state.stats.drills = state.stats.drills.slice(0, 100);
    save(state);
  }
  const acc = session.checks ? Math.round(100 * session.correct / session.checks) : 0;
  const sum = document.getElementById('drill-summary');
  sum.replaceChildren(
    el('div', { class: 'panel-title' }, 'Session summary'),
    el('div', { class: 'stats-tables' },
      el('div', {},
        el('div', { class: `big-stat ${acc >= 90 ? 'good' : acc >= 70 ? '' : 'bad'}` }, acc + '%'),
        el('div', {}, 'checkpoint accuracy'),
      ),
      el('table', { class: 'stats' },
        el('tr', {}, el('td', {}, 'Cards seen'), el('td', {}, String(session.i))),
        el('tr', {}, el('td', {}, 'Checkpoints'), el('td', {}, `${session.correct}/${session.checks}`)),
        el('tr', {}, el('td', {}, 'Best streak'), el('td', {}, String(session.bestStreak))),
        el('tr', {}, el('td', {}, 'Time'), el('td', {}, Math.round((Date.now() - session.t0) / 1000) + 's')),
      ),
    ),
    el('div', { style: 'margin-top:12px; display:flex; gap:10px' },
      el('button', { class: 'btn primary', onclick: () => { sum.classList.add('hidden'); startDrill(state); } }, 'Drill again'),
      el('button', { class: 'btn', onclick: () => { sum.classList.add('hidden'); document.getElementById('drill-run').classList.add('hidden'); document.getElementById('drill-config').classList.remove('hidden'); } }, 'Back to setup'),
    ),
  );
  sum.classList.remove('hidden');
  document.getElementById('drill-run').classList.add('hidden');
  document.getElementById('drill-card-slot').replaceChildren();
  session = null;
}

export function drillIsActive() {
  return session && session.running;
}
