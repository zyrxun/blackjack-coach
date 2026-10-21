// story.js — Story Mode: a learning path from first hand to card counter.
// Stage teach panels -> focused challenges -> stars -> next stage unlocks.
import {
  STAGES, scenarioMatches, starsFor, makeCountSequence, choiceSet,
  trueCountAnswer, betAnswer,
} from '../engine/curriculum.js';
import { basicStrategy, withDeviations, randomScenario, scenarioKey, ACTION_NAMES } from '../engine/strategy.js';
import { handValue, isPair } from '../engine/hand.js';
import { tagFor } from '../engine/count.js';
import { cardNode, el, flipUp } from './cards.js';
import { load, save } from './store.js';
import { whyText } from './trainer.js';

let state = null;
let session = null;
const $ = id => document.getElementById(id);

export function initStory(stateRef) {
  state = stateRef;
  $('story-quit').addEventListener('click', endRun);
  $('story-tips-toggle').addEventListener('click', () => { tipsOpen = !tipsOpen; renderTips(); });
  $('story-next').addEventListener('click', () => advance());
  document.querySelectorAll('#story-actions [data-action]').forEach(b =>
    b.addEventListener('click', () => answer(b.dataset.action)));
  $('story-quiz').addEventListener('click', e => {
    const b = e.target.closest('[data-choice]');
    if (b) answer(Number(b.dataset.choice));
  });
  document.addEventListener('keydown', onKey);
}

export function storyIsActive() {
  return session && session.running;
}

// debug hook (used by automated verification)
window.__storyDbg = () => session && {
  kind: session.kind, idx: session.idx, target: session.target,
  awaiting: session.awaiting, stage: session.stage.id,
};

function onKey(e) {
  if (!storyIsActive()) return;
  if ($('screen-story').classList.contains('hidden')) return;
  if (session.kind !== 'hands') return;
  if (!session.awaiting) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); }
    return;
  }
  const map = { h: 'H', s: 'S', d: 'D', p: 'P', r: 'R' };
  if (map[e.key.toLowerCase()]) { e.preventDefault(); answer(map[e.key.toLowerCase()]); }
}

// ---- cumulative "what you've learned" drawer -------------------------------
let tipsOpen = typeof window !== 'undefined' && window.matchMedia('(min-width: 1100px)').matches;

function renderTips() {
  const through = unlockedThrough();
  const n = Math.min(through + 1, STAGES.length); // completed stages + the one in progress
  $('story-tips-toggle').textContent = tipsOpen ? '✕ hide tips' : `📘 Tips · ${n}`;
  $('story-tips').classList.toggle('hidden', !tipsOpen);
  if (!tipsOpen) return;
  const blocks = STAGES.slice(0, n).map((st, i) =>
    el('div', { class: `learned-stage${i === through ? ' current' : ''}` },
      el('div', { class: 'learned-title' }, `${st.icon} ${st.title}`,
        el('span', { class: 'stars' }, starsSaved(st.id) ? '★'.repeat(starsSaved(st.id)) + '☆'.repeat(3 - starsSaved(st.id)) : '')),
      el('ul', {}, ...st.teach.map(t => el('li', {}, t))),
    ));
  $('story-tips').replaceChildren(
    el('div', { class: 'panel-title' }, 'What you’ve learned'),
    ...blocks,
  );
}

// ---- path view --------------------------------------------------------------
export function enterStory() {
  hideRun();
  $('story-stage').classList.add('hidden');
  $('story-summary').classList.add('hidden');
  renderPath();
  renderTips();
}

function starsSaved(id) {
  return (state.stats.story && state.stats.story[id]) || 0;
}

function unlockedThrough() {
  let i = 0;
  while (i < STAGES.length && starsSaved(STAGES[i].id) >= 1) i++;
  return i; // STAGES[i] is the furthest playable stage
}

function renderPath() {
  const done = unlockedThrough();
  const totalStars = STAGES.reduce((n, s) => n + starsSaved(s.id), 0);
  const cards = STAGES.map((st, i) => {
    const locked = i > done;
    const stars = starsSaved(st.id);
    return el('button', { class: `stage-card${locked ? ' locked' : ''}`, disabled: locked, onclick: () => openStage(st) },
      el('span', { class: 'stage-icon' }, locked ? '🔒' : st.icon),
      el('span', { class: 'stage-name' }, `${i + 1}. ${st.title}`),
      el('span', { class: 'stage-blurb' }, locked ? 'Finish the previous stage' : st.blurb),
      el('span', { class: 'stars' }, locked ? '' : '★'.repeat(stars) + '☆'.repeat(3 - stars)),
    );
  });
  $('story-list').replaceChildren(
    el('div', { class: 'menu-wrap', style: 'padding-top:2vh' },
      el('h1', { style: 'font-size:1.7em' }, 'Story Mode'),
      el('p', { class: 'tagline' }, done >= STAGES.length
        ? `🏆 All ${STAGES.length} stages complete — you're a card counter. ${totalStars}/${STAGES.length * 3} stars.`
        : `From your first hard 12 to betting a rich shoe. ${done}/${STAGES.length} stages · ${totalStars}/${STAGES.length * 3} stars.`),
      el('div', { class: 'story-path' }, ...cards),
      el('button', { class: 'btn', style: 'margin-top:16px', onclick: () => $('btn-home').click() }, 'Back to menu'),
    ),
  );
}

function openStage(st) {
  hideRun();
  $('story-list').classList.add('hidden');
  $('story-summary').classList.add('hidden');
  const c = st.challenge;
  const what = c.kind === 'hands' ? `${c.count} hands${c.grade === 'deviations' ? ', played with a live true count' : ''}`
    : c.kind === 'count' ? `${c.seqs} quick card sequences — name the running count`
    : c.kind === 'truecount' ? `${c.items.length} true-count questions`
    : `${c.items.length} bet-sizing questions`;
  $('story-stage').replaceChildren(
    el('div', { class: 'panel-title' }, `${st.icon} ${st.title}`),
    el('p', { style: 'color:var(--muted);margin:6px 0 12px' }, st.blurb),
    ...st.teach.map(t => el('p', { class: 'tip-line' }, '💡 ', t)),
    el('p', { style: 'margin:12px 0 4px;font-weight:700' }, 'Your challenge'),
    el('p', { style: 'color:var(--muted);margin:0 0 12px' }, `${what} · pass at 75% to unlock the next stage (85% = ★★, 95% = ★★★)`),
    el('div', { style: 'display:flex;gap:10px' },
      el('button', { class: 'btn primary', onclick: () => startChallenge(st) }, 'Start challenge'),
      el('button', { class: 'btn', onclick: enterStory }, 'Back to path'),
    ),
  );
  $('story-stage').classList.remove('hidden');
  renderTips();
}

// ---- challenge runner -------------------------------------------------------
function startChallenge(st) {
  clearTimers();
  session = {
    running: true, awaiting: false, stage: st, kind: st.challenge.kind,
    idx: 0, target: st.challenge.kind === 'count' ? st.challenge.seqs : st.challenge.kind === 'hands' ? st.challenge.count : st.challenge.items.length,
    correct: 0, missed: [], cur: null, timers: [],
    t0: Date.now(),
  };
  $('story-list').classList.add('hidden');
  $('story-stage').classList.add('hidden');
  $('story-summary').classList.add('hidden');
  $('story-run').classList.remove('hidden');
  $('story-actions').classList.toggle('hidden', st.challenge.kind !== 'hands');
  renderTips();
  if (st.challenge.kind === 'hands') { hideQuiz(); nextHand(); }
  else { showQuiz(); nextQuestion(); }
}

function hideRun() {
  if (session) clearTimers();
  session = null;
  $('story-run').classList.add('hidden');
  $('story-quiz').classList.add('hidden');
  $('story-dealer').replaceChildren();
  $('story-player').replaceChildren();
}

function showQuiz() {
  $('story-quiz').classList.remove('hidden');
  $('story-dealer').parentElement.querySelectorAll('.area-label').forEach(n => n.classList.add('hidden'));
  $('story-dealer').classList.add('hidden');
  $('story-player').classList.add('hidden');
  $('story-hand-total').classList.add('hidden');
}
function hideQuiz() {
  $('story-quiz').classList.add('hidden');
  $('story-quiz').replaceChildren();
  $('story-dealer').parentElement.querySelectorAll('.area-label').forEach(n => n.classList.remove('hidden'));
  $('story-dealer').classList.remove('hidden');
  $('story-player').classList.remove('hidden');
  $('story-hand-total').classList.remove('hidden');
}

function genHand() {
  const filter = session.stage.challenge.filter;
  for (let i = 0; i < 400; i++) {
    const s = randomScenario();
    if (scenarioMatches(s, filter)) return s;
  }
  return randomScenario();
}

function nextHand() {
  if (!session || session.idx >= session.target) { finish(); return; }
  clearTimers();
  session.cur = genHand();
  session.tc = session.stage.challenge.grade === 'deviations'
    ? session.stage.challenge.tcScript[session.idx % session.stage.challenge.tcScript.length]
    : null;
  const { cards, dealerUp } = session.cur;
  const { total, soft } = handValue(cards);
  const dealer = cardNode(dealerUp, { faceDown: true });
  const c1 = cardNode(cards[0], { faceDown: true });
  const c2 = cardNode(cards[1], { faceDown: true });
  $('story-dealer').replaceChildren(dealer);
  $('story-player').replaceChildren(c1, c2);
  [c1, c2, dealer].forEach(flipUp);
  $('story-hand-total').textContent =
    (isPair(cards) ? `Pair ${cards[0].rank},${cards[1].rank} — ` : soft ? 'Soft ' : 'Hard ') + total;
  const banner = $('story-count-banner');
  if (session.tc === null) banner.classList.add('hidden');
  else {
    banner.classList.remove('hidden');
    banner.textContent = `True count: ${session.tc >= 0 ? '+' : ''}${session.tc}`;
  }
  $('story-verdict').textContent = '';
  $('story-verdict').className = '';
  $('story-why').textContent = '';
  $('story-next').style.display = 'none';
  document.querySelectorAll('#story-actions .btn.action').forEach(b => {
    b.disabled = false;
    b.classList.remove('right', 'wrong');
    if (b.dataset.action === 'P' && !isPair(cards)) b.disabled = true;
  });
  session.awaiting = true;
  renderProgress();
}

// ---- question kinds (count / truecount / bet) ------------------------------
function nextQuestion() {
  if (!session || session.idx >= session.target) { finish(); return; }
  clearTimers();
  const c = session.stage.challenge;
  const banner = $('story-count-banner');
  banner.classList.add('hidden');
  $('story-verdict').textContent = '';
  $('story-verdict').className = '';
  $('story-why').textContent = '';
  $('story-next').style.display = 'none';

  if (c.kind === 'count') {
    session.seq = makeCountSequence(Math.random, c.cardsPer);
    const row = el('div', { class: 'cards-row center' },
      ...session.seq.cards.map(card => cardNode(card, { faceDown: true })));
    const q = el('div', { class: 'quiz-question' }, 'Watch the cards…');
    $('story-quiz').replaceChildren(row, q);
    session.seq.cards.forEach((card, i) => {
      session.timers.push(setTimeout(() => {
        const node = row.children[i];
        node.classList.add('up');
        q.textContent = `Card ${i + 1}/${c.cardsPer} — keep counting…`;
      }, 350 + i * 550));
    });
    session.timers.push(setTimeout(() => askCount(row, q), 350 + c.cardsPer * 550 + 250));
  } else if (c.kind === 'truecount') {
    const item = c.items[session.idx];
    const exp = trueCountAnswer(item);
    session.cur = { exp, why: `True count = running count ÷ decks remaining, rounded down: ${fmtN(item.rc)} ÷ ${item.decks} = ${fmtN(exp)}.` };
    renderQuizChoices(`${fmtN(item.rc)} running · ${item.decks} deck${item.decks > 1 ? 's' : ''} left — true count?`,
      choiceSet(exp, 2, -12), v => (v === exp ? `✓ ${fmtN(exp)}` : `✗ ${fmtN(v)} — correct is ${fmtN(exp)}`));
  } else if (c.kind === 'bet') {
    const item = c.items[session.idx];
    const exp = betAnswer(item);
    session.cur = { exp, why: `At TC ${fmtN(item.tc)}: bet ${exp} unit${exp > 1 ? 's' : ''}. The 1–12 ramp: TC ≤ +1 → 1 unit, +2 → 2, +3 → 4, +4 → 8, +5 or more → 12.` };
    renderQuizChoices(`True count ${fmtN(item.tc)} — how many units ($5 each)?`,
      choiceSet(exp, 2, 1), v => (v === exp ? `✓ ${exp} unit${exp === 1 ? '' : 's'}` : `✗ ${v} units — correct is ${exp}`),
      false, String);
  }
  session.awaiting = true;
  renderProgress();
}

function askCount(row, q) {
  const exp = session.seq.expected;
  const cardsTxt = session.seq.cards.map(c => `${c.rank}${tagFor(c.rank) >= 0 ? '+' : ''}${tagFor(c.rank)}`).join(' ');
  session.cur = { exp, why: `Tags: ${cardsTxt} → running count ${fmtN(exp)}.` };
  renderQuizChoices('What is the running count?', choiceSet(exp, 2, -12),
    v => (v === exp ? `✓ ${fmtN(exp)}` : `✗ ${fmtN(v)} — correct is ${fmtN(exp)}`), true);
  q.textContent = 'Checkpoint!';
  row.querySelectorAll('.card').forEach(n => n.classList.add('dim'));
}

function renderQuizChoices(question, options, verdictFn, keepStage = false, labelFn = fmtN) {
  session.verdictFn = verdictFn;
  const quiz = $('story-quiz');
  if (!keepStage) quiz.replaceChildren();
  let q = quiz.querySelector('.quiz-question');
  if (!q) { q = el('div', { class: 'quiz-question' }); quiz.prepend(q); }
  q.textContent = question;
  quiz.append(el('div', { class: 'quiz-choices' },
    ...options.map(v => el('button', { class: 'btn action', 'data-choice': v }, labelFn(v)))));
  session.options = options;
}

// ---- grading ----------------------------------------------------------------
function answer(act) {
  if (!session || !session.awaiting) return;
  session.awaiting = false;
  let ok, why, verdict, expected, dev = null, basic;
  if (session.kind === 'hands') {
    const { cards, dealerUp } = session.cur;
    const opts = { das: true, canDouble: true, canSplit: isPair(cards), canSurrender: true };
    basic = basicStrategy(cards, dealerUp, opts);
    if (session.stage.challenge.grade === 'deviations') {
      const r = withDeviations(cards, dealerUp, session.tc, opts);
      expected = r.action;
      dev = r.deviation;
    } else expected = basic;
    ok = act === expected;
    const key = scenarioKey(cards, dealerUp);
    const m = state.stats.strategy[key] || { seen: 0, right: 0 };
    m.seen++;
    if (ok) m.right++;
    state.stats.strategy[key] = m;
    save(state);
    if (ok) {
      verdict = dev ? `✓ Deviation — ${ACTION_NAMES[expected]}` : `✓ Perfect — ${ACTION_NAMES[expected]}`;
    } else {
      verdict = `✗ ${ACTION_NAMES[act]} — correct play is ${ACTION_NAMES[expected]}`;
      session.missed.push({ key: `${key}${dev ? ` @ TC${session.tc >= 0 ? '+' : ''}${session.tc}` : ''}`, label: prettyKey(key), expected: ACTION_NAMES[expected] });
    }
    why = dev
      ? `Basic strategy says ${ACTION_NAMES[basic]}, but at true count ${fmtN(session.tc)} the “${dev.name}” index kicks in (TC ≥ ${dev.index}): ${ACTION_NAMES[expected]}.`
      : whyText(session.cur, expected);
    document.querySelectorAll('#story-actions .btn.action').forEach(b => {
      b.disabled = true;
      if (b.dataset.action === expected) b.classList.add('right');
      else if (b.dataset.action === act) b.classList.add('wrong');
    });
  } else {
    expected = session.cur.exp;
    ok = act === expected;
    verdict = session.verdictFn(act);
    why = session.cur.why;
    if (!ok) session.missed.push({ key: String(session.idx), label: session.cur.label || 'question', expected: String(expected) });
    document.querySelectorAll('#story-quiz [data-choice]').forEach(b => {
      b.disabled = true;
      const v = Number(b.dataset.choice);
      if (v === expected) b.classList.add('right');
      else if (v === act) b.classList.add('wrong');
    });
  }
  session.idx++;
  if (ok) {
    session.correct++;
    session.streak = (session.streak || 0) + 1;
    session.bestStreak = Math.max(session.bestStreak || 0, session.streak);
  } else session.streak = 0;
  const v = $('story-verdict');
  v.textContent = verdict;
  v.className = ok ? 'ok' : 'no';
  $('story-why').textContent = why;
  $('story-next').style.display = '';
  renderProgress();
  if (ok && session.kind === 'hands') session.timers.push(setTimeout(() => advance(), 1100));
}

function advance() {
  if (!session || session.awaiting) return;
  if (session.kind === 'hands') nextHand();
  else nextQuestion();
}

// ---- finish -----------------------------------------------------------------
function finish() {
  const s = session;
  session = null;
  clearTimers();
  const acc = s.idx ? Math.round(100 * s.correct / s.idx) : 0;
  const stars = starsFor(acc);
  const passed = stars >= 1;
  const prev = starsSaved(s.stage.id);
  if (passed && stars > prev) {
    state.stats.story = state.stats.story || {};
    state.stats.story[s.stage.id] = stars;
    save(state);
  }
  if (passed) {
    state.stats.drills.unshift({
      when: Date.now(), mode: `Story · ${s.stage.title}`,
      cards: s.idx, checks: s.idx, correct: s.correct,
      bestStreak: s.bestStreak || 0, seconds: Math.round((Date.now() - s.t0) / 1000),
    });
    state.stats.drills = state.stats.drills.slice(0, 100);
    save(state);
  }
  const idx = STAGES.findIndex(x => x.id === s.stage.id);
  const next = passed && idx + 1 < STAGES.length ? STAGES[idx + 1] : null;
  const missedRows = s.missed.slice(0, 8).map(m => el('tr', {},
    el('td', {}, m.label), el('td', {}, m.expected)));
  $('story-summary').replaceChildren(
    el('div', { class: 'panel-title' }, passed ? `${s.stage.icon} Stage complete` : `${s.stage.icon} Not quite`),
    el('div', { class: `big-stat ${acc >= 90 ? 'good' : acc >= 70 ? '' : 'bad'}` },
      '★'.repeat(Math.max(stars, passed ? 1 : 0)) + '☆'.repeat(3 - Math.max(stars, passed ? 1 : 0))),
    el('p', { style: 'color:var(--muted);margin:6px 0' },
      `${s.correct}/${s.idx} correct (${acc}%)${passed ? '' : ' — you need 75% to unlock the next stage.'}`),
    ...(missedRows.length ? [
      el('div', { class: 'panel-title', style: 'margin-top:10px' }, 'Missed — correct answers'),
      el('table', { class: 'stats' },
        el('tr', {}, el('th', {}, 'Hand'), el('th', {}, 'Correct play')),
        ...missedRows),
    ] : []),
    el('div', { style: 'margin-top:12px;display:flex;gap:10px;flex-wrap:wrap' },
      el('button', { class: 'btn primary', onclick: () => { hideRun(); openStage(s.stage); } }, passed ? 'Replay for stars' : 'Try again'),
      ...(next ? [el('button', { class: 'btn', onclick: () => { hideRun(); openStage(next); } }, `Next: ${next.title} →`)] : []),
      el('button', { class: 'btn', onclick: enterStory }, 'Back to path'),
    ),
  );
  hideRun();
  $('story-summary').classList.remove('hidden');
  renderTips();
}

function endRun() {
  const s = session;
  session = null;
  if (s && s.timers) s.timers.forEach(clearTimeout);
  enterStory();
}

// ---- helpers ----------------------------------------------------------------
function clearTimers() {
  if (session && session.timers) session.timers.forEach(clearTimeout);
}
function renderProgress() {
  $('story-progress-bar').style.width = (100 * session.idx / session.target) + '%';
}
function prettyKey(k) {
  const [kind, total, , up] = k.split('-');
  const upTxt = up === '11' ? 'A' : up;
  if (kind === 'pair') return `${total === 'A' ? 'A,A' : `${total},${total}`} v ${upTxt}`;
  return `${kind} ${total} v ${upTxt}`;
}
function fmtN(n) {
  return n > 0 ? `+${n}` : String(n);
}
