// app.js — screen router, settings UI, stats UI, bootstrap
import { initPlay, enterRuns } from './play.js';
import { initDrill, drillIsActive } from './drill.js';
import { initLessons, enterLessons } from './lessons.js';
import { initTrainer, trainerIsActive } from './trainer.js';
import { initStory, storyIsActive, enterStory, storyComplete } from './story.js';
import { initLab, enterLab } from './lab.js';
import { load, save, resetAll } from './store.js';
import { setSoundEnabled } from './sound.js';
import { el, fmtMoney } from './cards.js';

const state = load();
setSoundEnabled(state.settings.sound);
applyTheme(state.settings.theme);

function applyTheme(t) {
  document.body.dataset.theme = t;
}

// the tables unlock after the school: all 6 lessons + the full story path
const TEACHING_LESSONS = ['why', 'values', 'running', 'true', 'betting', 'i18'];
function playUnlocked() {
  return storyComplete() && TEACHING_LESSONS.every(id => state.stats.lessons[id]);
}

function renderGate() {
  const storyDone = Object.keys(state.stats.story).filter(id => state.stats.story[id] >= 1).length;
  const lessonsDone = TEACHING_LESSONS.filter(id => state.stats.lessons[id]).length;
  const bar = (label, done, total) => el('div', { style: 'margin:8px 0' },
    el('div', { style: 'display:flex;justify-content:space-between;font-size:0.9em' },
      el('span', {}, label), el('span', {}, `${done}/${total}`)),
    el('div', { class: 'run-progress-bar' }, el('div', { style: `width:${Math.round(100 * done / total)}%` })));
  document.getElementById('gate-progress').replaceChildren(
    bar('📖 Story Mode stages', storyDone, 13),
    bar('🎓 Lessons', lessonsDone, TEACHING_LESSONS.length),
  );
}

function show(screen) {
  if (screen !== 'drill' && drillIsActive()) {
    document.getElementById('drill-quit').click(); // leaving mid-drill: end without saving
  }
  if (screen !== 'trainer' && trainerIsActive()) {
    document.getElementById('trainer-quit').click(); // leaving mid-session: stop, keep mastery
  }
  if (screen !== 'story' && storyIsActive()) {
    document.getElementById('story-quit').click(); // leaving mid-stage: stop
  }
  if ((screen === 'runs' || screen === 'play') && !playUnlocked()) {
    renderGate();
    screen = 'gate';
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById('screen-' + screen).classList.remove('hidden');
  const inPlay = screen === 'play';
  document.getElementById('hdr-bankroll').classList.toggle('hidden', !inPlay);
  document.getElementById('hdr-count').classList.toggle('hidden', !inPlay);
  if (screen === 'story') enterStory();
  if (screen === 'lab') enterLab();
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
initTrainer(state);
initStory(state);
initLab(state);

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
function prettyKeyLabel(k) {
  const [kind, total, , up] = k.split('-');
  const upTxt = up === '11' ? 'A' : up;
  if (kind === 'pair') return `${total === 'A' ? 'A,A' : `${total},${total}`} v ${upTxt}`;
  return `${kind} ${total} v ${upTxt}`;
}

function strategySection(strategy) {
  const entries = Object.entries(strategy || {}).filter(([k]) => /^(hard|soft|pair)-/.test(k));
  if (!entries.length) return [];
  const cat = { hard: [0, 0], soft: [0, 0], pair: [0, 0] };
  let seen = 0, right = 0;
  for (const [k, v] of entries) {
    const c = k.split('-')[0];
    cat[c][0] += v.seen;
    cat[c][1] += v.right;
    seen += v.seen;
    right += v.right;
  }
  const pct = (r, s) => s ? Math.round(100 * r / s) + '%' : '—';
  const cls = 100 * right / seen >= 90 ? 'good' : 100 * right / seen >= 70 ? '' : 'bad';
  const CAT_NAMES = { hard: 'Hard totals', soft: 'Soft totals', pair: 'Pairs' };
  const troubles = entries
    .filter(([, v]) => v.seen >= 2 && v.right / v.seen < 0.8)
    .sort((a, b) => a[1].right / a[1].seen - b[1].right / b[1].seen)
    .slice(0, 3);
  return [
    el('div', { class: 'panel-title', style: 'margin-top:18px' }, 'Perfect strategy'),
    el('div', { class: 'stats-tables' },
      el('div', {},
        el('div', { class: `big-stat ${cls}` }, pct(right, seen)),
        el('p', { style: 'color:#9d947c;margin:4px 0 14px' }, `mastery over ${seen} trained decisions`),
        el('table', { class: 'stats' },
          ...Object.entries(cat).map(([c, [s2, r2]]) => el('tr', {},
            el('td', {}, CAT_NAMES[c]),
            el('td', {}, `${r2}/${s2} (${pct(r2, s2)})`),
          )),
        ),
      ),
      el('div', {},
        el('div', { class: 'panel-title' }, 'Trouble spots'),
        troubles.length
          ? el('table', { class: 'stats' },
              el('tr', {}, el('th', {}, 'Hand'), el('th', {}, 'Accuracy')),
              ...troubles.map(([k, v]) => el('tr', {},
                el('td', {}, prettyKeyLabel(k)),
                el('td', {}, Math.round(100 * v.right / v.seen) + '%'),
              )),
            )
          : el('p', { style: 'color:#9d947c;margin:8px 0' }, 'No persistent mistakes — keep drilling.'),
      ),
    ),
  ];
}

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
  const profRows = Object.entries(state.profiles).map(([id, p]) => el('tr', {},
    el('td', {}, p.name + (p.busted ? ' 💀' : '')),
    el('td', {}, fmtMoney(p.bankroll)),
    el('td', {}, `${p.net >= 0 ? '+' : ''}${fmtMoney(p.net)}`),
    el('td', {}, String(p.rounds)),
    el('td', {}, p.decisions ? Math.round(100 * p.correct / p.decisions) + '%' : '—'),
    el('td', {}, fmtMoney(p.evLostUsd)),
  ));
  const profCharts = Object.entries(state.profiles).filter(([, p]) => (p.history || []).length > 2).map(([id, p]) => {
    const h = p.history;
    const lo = Math.min(...h.map(x => x.b), p.start) * 0.95;
    const hi = Math.max(...h.map(x => x.b), p.start) * 1.05;
    const W = 320, H = 90, P = 5;
    const x = i => P + (W - 2 * P) * (i / Math.max(h.length - 1, 1));
    const y = b => H - P - (H - 2 * P) * ((b - lo) / Math.max(hi - lo, 1));
    const pts = h.map((pt, i) => `${x(i).toFixed(1)},${y(pt.b).toFixed(1)}`).join(' ');
    const last = h[h.length - 1];
    const dotColor = last.b >= p.start ? 'var(--good)' : last.b < p.start ? 'var(--bad)' : 'var(--gold)';
    const box = el('div', { style: 'border:1px solid var(--panel-edge);border-radius:10px;padding:8px;background:var(--panel-alt)' });
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
      <line x1="${P}" y1="${y(p.start).toFixed(1)}" x2="${W - P}" y2="${y(p.start).toFixed(1)}" style="stroke:var(--muted)" stroke-dasharray="2 3" stroke-width="1" opacity="0.6"/>
      <polyline points="${pts}" fill="none" style="stroke:var(--gold)" stroke-width="1.6" stroke-linejoin="round"/>
      <circle cx="${x(h.length - 1).toFixed(1)}" cy="${y(last.b).toFixed(1)}" r="2.4" style="fill:${dotColor}"/>
    </svg>`;
    return el('div', { style: 'margin-bottom:10px' },
      el('div', { style: 'font-size:0.82em;color:var(--muted);margin:2px 0 4px' },
        `${p.name} — ${fmtMoney(p.bankroll)} · ${p.rounds} rounds · start ${fmtMoney(p.start)}`),
      box);
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
    ...strategySection(s.strategy),
    ...(Object.keys(state.profiles).length ? [
      el('div', { class: 'panel-title', style: 'margin-top:18px' }, 'Bankroll over rounds'),
      ...profCharts,
      el('div', { class: 'panel-title', style: 'margin-top:18px' }, 'Players'),
      el('table', { class: 'stats' },
        el('tr', {}, el('th', {}, 'Player'), el('th', {}, 'Bankroll'), el('th', {}, 'Net'), el('th', {}, 'Rounds'), el('th', {}, 'Accuracy'), el('th', {}, 'EV lost')),
        ...profRows,
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
document.body.dataset.cardart = state.settings.cardArt || 'custom';
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
