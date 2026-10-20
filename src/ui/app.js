// app.js — screen router, settings UI, stats UI, bootstrap
import { initPlay, enterRuns } from './play.js';
import { initDrill, drillIsActive } from './drill.js';
import { initLessons, enterLessons } from './lessons.js';
import { load, save, resetAll } from './store.js';
import { setSoundEnabled } from './sound.js';
import { el, fmtMoney } from './cards.js';

const state = load();
setSoundEnabled(state.settings.sound);
applyTheme(state.settings.theme);

function applyTheme(t) {
  document.body.dataset.theme = t;
}

function show(screen) {
  if (screen !== 'drill' && drillIsActive()) {
    document.getElementById('drill-quit').click(); // leaving mid-drill: end without saving
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById('screen-' + screen).classList.remove('hidden');
  const inPlay = screen === 'play';
  document.getElementById('hdr-bankroll').classList.toggle('hidden', !inPlay);
  document.getElementById('hdr-count').classList.toggle('hidden', !inPlay);
  if (screen === 'runs') enterRuns();
  if (screen === 'lessons') enterLessons();
  if (screen === 'stats') renderStats();
  if (screen === 'settings') loadSettingsForm();
}

// ---- router wiring ----
document.getElementById('btn-home').addEventListener('click', () => show('menu'));
document.querySelectorAll('[data-goto]').forEach(b =>
  b.addEventListener('click', () => show(b.dataset.goto)));
initPlay(state, show);
initDrill(state, show);
initLessons(state, show);

// ---- settings ----
function loadSettingsForm() {
  const s = state.settings;
  const $ = id => document.getElementById(id);
  $('set-theme').value = s.theme;
  $('set-feedback').checked = s.feedback;
  $('set-count').checked = s.showCount;
  $('set-hints').checked = s.coachHints;
  $('set-quiz').checked = s.shuffleQuiz;
  $('set-sound').checked = s.sound;
}
document.getElementById('set-save').addEventListener('click', () => {
  const $ = id => document.getElementById(id);
  Object.assign(state.settings, {
    theme: $('set-theme').value,
    feedback: $('set-feedback').checked,
    showCount: $('set-count').checked,
    coachHints: $('set-hints').checked,
    shuffleQuiz: $('set-quiz').checked,
    sound: $('set-sound').checked,
  });
  setSoundEnabled(state.settings.sound);
  applyTheme(state.settings.theme);
  save(state);
  show('menu');
});
document.getElementById('set-theme').addEventListener('change', e => {
  state.settings.theme = e.target.value;
  save(state);
  applyTheme(e.target.value);
});
document.getElementById('set-clear').addEventListener('click', () => {
  if (confirm('Delete all settings, runs, stats and lesson progress?')) {
    resetAll();
    location.reload();
  }
});

// ---- stats ----
function renderStats() {
  const s = state.stats;
  const acc = s.drills.length
    ? Math.round(100 * s.drills.reduce((n, d) => n + d.correct, 0) / Math.max(s.drills.reduce((n, d) => n + d.checks, 0), 1))
    : 0;
  const bestStreak = s.drills.reduce((m, d) => Math.max(m, d.bestStreak), 0);
  const roi = s.play.wagered ? (100 * s.play.net / s.play.wagered).toFixed(2) : '0.00';
  const lessonsDone = Object.keys(s.lessons).length;
  const drillRows = s.drills.slice(0, 10).map(d => el('tr', {},
    el('td', {}, new Date(d.when).toLocaleDateString()),
    el('td', {}, d.mode),
    el('td', {}, String(d.cards)),
    el('td', {}, `${d.correct}/${d.checks}`),
    el('td', {}, d.bestStreak + ''),
  ));
  const chartFor = (r) => {
    const h = r.history || [];
    if (h.length < 2) return '';
    const W = 320, H = 90, P = 5;
    const lo = Math.min(...h.map(p => p.b), r.start) * 0.95;
    const hi = Math.max(...h.map(p => p.b), r.goal) * 1.05;
    const x = i => P + (W - 2 * P) * (i / Math.max(h.length - 1, 1));
    const y = b => H - P - (H - 2 * P) * ((b - lo) / Math.max(hi - lo, 1));
    const pts = h.map((p, i) => `${x(i).toFixed(1)},${y(p.b).toFixed(1)}`).join(' ');
    const last = h[h.length - 1];
    const dotColor = last.b >= r.goal ? 'var(--good)' : last.b < r.start ? 'var(--bad)' : 'var(--gold)';
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
      <line x1="${P}" y1="${y(r.goal).toFixed(1)}" x2="${W - P}" y2="${y(r.goal).toFixed(1)}" style="stroke:var(--gold)" stroke-dasharray="4 3" stroke-width="1" opacity="0.8"/>
      <line x1="${P}" y1="${y(r.start).toFixed(1)}" x2="${W - P}" y2="${y(r.start).toFixed(1)}" style="stroke:var(--muted)" stroke-dasharray="2 3" stroke-width="1" opacity="0.6"/>
      <polyline points="${pts}" fill="none" style="stroke:var(--gold)" stroke-width="1.6" stroke-linejoin="round"/>
      <circle cx="${x(h.length - 1).toFixed(1)}" cy="${y(last.b).toFixed(1)}" r="2.4" style="fill:${dotColor}"/>
    </svg>`;
  };
  const runRows = Object.entries(state.runs).map(([id, r]) => el('tr', {},
    el('td', {}, id),
    el('td', {}, r.status),
    el('td', {}, fmtMoney(r.bankroll)),
    el('td', {}, `${r.net >= 0 ? '+' : ''}${fmtMoney(r.net)}`),
    el('td', {}, r.decisions ? Math.round(100 * r.correct / r.decisions) + '%' : '—'),
    el('td', {}, fmtMoney(r.evLostUsd)),
  ));
  const runCharts = Object.entries(state.runs).map(([id, r]) => {
    const wrap = el('div', { style: 'margin-bottom:10px' },
      el('div', { style: 'font-size:0.82em;color:var(--muted);margin:2px 0 4px' },
        `${id} — ${r.status} at ${fmtMoney(r.bankroll)} · ${r.rounds} rounds · goal ${fmtMoney(r.goal)}`),
    );
    const box = el('div', { style: 'border:1px solid var(--panel-edge);border-radius:10px;padding:8px;background:var(--panel-alt)' });
    box.innerHTML = chartFor(r) || '<p style="color:var(--muted);font-size:0.85em;margin:4px">No history yet — play a few rounds of this run.</p>';
    wrap.append(box);
    return wrap;
  });
  document.getElementById('stats-content').replaceChildren(
    el('div', { class: 'panel-title' }, 'Your progress'),
    el('div', { class: 'stats-tables' },
      el('div', {},
        el('div', { class: 'panel-title' }, 'Counting'),
        el('div', { class: `big-stat ${s.drills.length ? (acc >= 90 ? 'good' : acc >= 70 ? '' : 'bad') : ''}` }, s.drills.length ? acc + '%' : '—'),
        el('p', { style: 'color:#9d947c;margin:4px 0 14px' }, 'overall checkpoint accuracy'),
        el('table', { class: 'stats' },
          el('tr', {}, el('td', {}, 'Drill sessions'), el('td', {}, String(s.drills.length))),
          el('tr', {}, el('td', {}, 'Best streak'), el('td', {}, String(bestStreak))),
          el('tr', {}, el('td', {}, 'Lessons completed'), el('td', {}, String(lessonsDone))),
        ),
      ),
      el('div', {},
        el('div', { class: 'panel-title' }, 'Table play (all time)'),
        el('div', { class: `big-stat ${s.play.net > 0 ? 'good' : s.play.net < 0 ? 'bad' : ''}` }, fmtMoney(s.play.net)),
        el('p', { style: 'color:#9d947c;margin:4px 0 14px' }, `net on ${fmtMoney(s.play.wagered)} wagered (${roi}% return)`),
        el('table', { class: 'stats' },
          el('tr', {}, el('td', {}, 'Rounds played'), el('td', {}, String(s.play.rounds))),
          el('tr', {}, el('td', {}, 'Hands resolved'), el('td', {}, String(s.play.hands))),
          el('tr', {}, el('td', {}, 'Shuffle quizzes'), el('td', {}, String(s.play.countGrades.length))),
        ),
      ),
    ),
    ...(Object.keys(state.runs).length ? [
      el('div', { class: 'panel-title', style: 'margin-top:18px' }, 'Bankroll over rounds'),
      ...runCharts,
      el('div', { class: 'panel-title', style: 'margin-top:18px' }, 'Runs'),
      el('table', { class: 'stats' },
        el('tr', {}, el('th', {}, 'Profile'), el('th', {}, 'Status'), el('th', {}, 'Bankroll'), el('th', {}, 'Net'), el('th', {}, 'Accuracy'), el('th', {}, 'EV lost')),
        ...runRows,
      ),
    ] : []),
    el('div', { class: 'panel-title', style: 'margin-top:18px' }, 'Recent drills'),
    el('table', { class: 'stats' },
      el('tr', {}, el('th', {}, 'Date'), el('th', {}, 'Mode'), el('th', {}, 'Cards'), el('th', {}, 'Correct'), el('th', {}, 'Streak')),
      ...drillRows,
    ),
    s.drills.length === 0 ? el('p', { style: 'color:#9d947c' }, 'No drills yet — run one from the Count Drill screen.') : null,
  );
}

// ---- secret card-art picker (invisible corner button, top right) ----
document.body.dataset.cardart = state.settings.cardArt || 'classic';
const artMenu = document.getElementById('art-menu');
function syncArtMenu() {
  artMenu.querySelectorAll('[data-art]').forEach(b =>
    b.classList.toggle('on', b.dataset.art === state.settings.cardArt));
}
document.getElementById('art-secret').addEventListener('click', e => {
  e.stopPropagation();
  syncArtMenu();
  artMenu.classList.toggle('hidden');
});
artMenu.querySelectorAll('[data-art]').forEach(b => b.addEventListener('click', () => {
  state.settings.cardArt = b.dataset.art;
  document.body.dataset.cardart = b.dataset.art;
  save(state);
  artMenu.classList.add('hidden');
}));
document.addEventListener('click', e => {
  if (!artMenu.classList.contains('hidden') && !artMenu.contains(e.target)) {
    artMenu.classList.add('hidden');
  }
});

show('menu');
