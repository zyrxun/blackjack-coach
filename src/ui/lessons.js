// lessons.js — six interactive lessons from zero to Illustrious 18
import { RANKS } from '../engine/hand.js';
import { HILO_TAGS } from '../engine/count.js';
import { I18 } from '../engine/strategy.js';
import { SUIT_GLYPH, el } from './cards.js';
import { load, save } from './store.js';

let state = null;
let gotoFn = null;

export function initLessons(stateRef, goto) {
  state = stateRef;
  gotoFn = goto;
  renderList();
}

export function enterLessons() {
  renderList();
}

function renderList() {
  const list = document.getElementById('lessons-list');
  const view = document.getElementById('lesson-view');
  view.classList.add('hidden');
  list.classList.remove('hidden');
  list.replaceChildren(...LESSONS.map((L, i) => {
    const label = i === 0 ? 'Lesson 0 · start here' : `Lesson ${i + 1}`;
    return el('button', { class: `lesson-card ${state.stats.lessons[L.id] ? 'done' : ''}`, onclick: () => openLesson(i) },
      el('span', { class: 'num' }, `${label}${state.stats.lessons[L.id] ? ' · done ✓' : ''}`),
      el('h3', {}, L.title),
      el('p', {}, L.blurb),
    );
  }));
}

function openLesson(i) {
  const L = LESSONS[i];
  const list = document.getElementById('lessons-list');
  const view = document.getElementById('lesson-view');
  list.classList.add('hidden');
  view.classList.remove('hidden');
  view.replaceChildren(el('div', { class: 'panel' },
    el('div', { class: 'panel-title' }, i === 0 ? 'Lesson 0 — start here' : `Lesson ${i + 1} of ${LESSONS.length}`),
    el('div', { class: 'lesson-body' },
      el('h2', {}, L.title),
      ...L.render(),
      L.widget ? L.widget() : null,
      quiz(L.quiz, () => {
        state.stats.lessons[L.id] = true;
        save(state);
      }),
    ),
    el('div', { class: 'lesson-nav' },
      i > 0 ? el('button', { class: 'btn', onclick: () => openLesson(i - 1) }, '← Previous') : el('span'),
      i < LESSONS.length - 1
        ? el('button', { class: 'btn primary', onclick: () => openLesson(i + 1) }, 'Next lesson →')
        : el('button', { class: 'btn primary', onclick: () => gotoFn('play') }, 'Go play →'),
    ),
  ));
}

function quiz(questions, onPass) {
  let correct = 0;
  const wrap = el('div', { class: 'quiz' });
  questions.forEach((q, qi) => {
    const opts = el('div', { class: 'quiz-opts' });
    wrap.append(el('div', { class: 'quiz-q' }, `${qi + 1}. ${q.q}`), opts);
    q.opts.forEach(o => {
      const b = el('button', { onclick: () => {
        if (opts.dataset.done) return;
        opts.dataset.done = '1';
        if (o === q.answer) { b.classList.add('correct'); correct++; }
        else { b.classList.add('wrong'); [...opts.children].find(x => x.textContent === q.answer)?.classList.add('correct'); }
        if (correct === questions.length && onPass) onPass();
      } }, o);
      opts.append(b);
    });
  });
  return wrap;
}

// ---------- lesson content ----------

// ---------- Lesson 0: the table tour ----------
function tableDiagram() {
  const wrap = el('div', { class: 'lesson-svg', id: 'tour-svg' });
  wrap.innerHTML = `
  <svg viewBox="0 0 800 470" role="img" aria-label="Annotated blackjack table">
    <defs>
      <marker id="arrw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#d4af37"></path>
      </marker>
      <radialGradient id="feltG" cx="50%" cy="45%">
        <stop offset="0%" stop-color="#2a7a52"></stop><stop offset="100%" stop-color="#164b31"></stop>
      </radialGradient>
    </defs>
    <rect x="8" y="8" width="784" height="454" rx="28" fill="#4a2f16"></rect>
    <rect x="24" y="24" width="752" height="420" rx="20" fill="url(#feltG)"></rect>
    <path id="payarc" d="M 225 215 A 340 250 0 0 1 575 215" fill="none"></path>
    <g class="hotspot" data-hs="9">
      <text font-size="21" font-weight="800" fill="#d4af37" letter-spacing="3">
        <textPath href="#payarc" startOffset="50%" text-anchor="middle">BLACKJACK PAYS 3 TO 2</textPath>
      </text>
      <path id="rulearc" d="M 265 238 A 280 200 0 0 1 535 238" fill="none"></path>
      <text font-size="11" fill="#cfe3d4" letter-spacing="2">
        <textPath href="#rulearc" startOffset="50%" text-anchor="middle">DEALER MUST STAND ON 17</textPath>
      </text>
    </g>
    <!-- shoe -->
    <g class="hotspot" data-hs="1">
      <rect x="640" y="58" width="96" height="58" rx="8" fill="#26262e" stroke="#d4af37" stroke-width="2"></rect>
      <rect x="650" y="64" width="20" height="46" rx="3" fill="#fdfcf7"></rect>
      <rect x="674" y="64" width="20" height="46" rx="3" fill="#7a1f2b" stroke="#fdfcf7" stroke-width="2"></rect>
      <rect x="698" y="64" width="20" height="46" rx="3" fill="#fdfcf7"></rect>
      <text x="688" y="132" text-anchor="middle" font-size="13" font-weight="700" fill="#cfe3d4">SHOE</text>
    </g>
    <!-- discard tray -->
    <g class="hotspot" data-hs="2">
      <rect x="64" y="58" width="96" height="58" rx="8" fill="#26262e" stroke="#8a8a8a" stroke-width="2"></rect>
      <rect x="76" y="80" width="72" height="30" rx="3" fill="#fdfcf7" stroke="#b9b4a4"></rect>
      <line x1="80" y1="90" x2="144" y2="90" stroke="#b9b4a4"></line>
      <line x1="80" y1="100" x2="144" y2="100" stroke="#b9b4a4"></line>
      <text x="112" y="132" text-anchor="middle" font-size="13" font-weight="700" fill="#cfe3d4">DISCARD TRAY</text>
    </g>
    <!-- dealer -->
    <text x="400" y="52" text-anchor="middle" font-size="15" font-weight="800" fill="#cfe3d4" letter-spacing="4">DEALER</text>
    <g class="hotspot" data-hs="3">
      <rect x="352" y="62" width="60" height="84" rx="6" fill="#fdfcf7" stroke="#b9b4a4"></rect>
      <text x="382" y="110" text-anchor="middle" font-size="26" fill="#c0392b">Q&#9829;</text>
    </g>
    <g class="hotspot" data-hs="4">
      <rect x="420" y="62" width="60" height="84" rx="6" fill="#7a1f2b" stroke="#fdfcf7" stroke-width="3"></rect>
      <text x="450" y="112" text-anchor="middle" font-size="12" fill="#fdfcf7">?</text>
    </g>
    <!-- insurance line -->
    <g class="hotspot" data-hs="5">
      <rect x="316" y="252" width="168" height="16" fill="rgba(212,175,55,0.12)" stroke="#d4af37" stroke-dasharray="5 4"></rect>
      <text x="400" y="263" text-anchor="middle" font-size="9" fill="#d4af37" letter-spacing="2">INSURANCE PAYS 2 TO 1</text>
    </g>
    <!-- player hand -->
    <g class="hotspot" data-hs="6">
      <rect x="286" y="290" width="54" height="76" rx="6" fill="#fdfcf7" stroke="#b9b4a4" transform="rotate(-4 313 328)"></rect>
      <text x="313" y="336" text-anchor="middle" font-size="22" fill="#222" transform="rotate(-4 313 328)">9&#9824;</text>
      <rect x="348" y="290" width="54" height="76" rx="6" fill="#fdfcf7" stroke="#b9b4a4" transform="rotate(4 375 328)"></rect>
      <text x="375" y="336" text-anchor="middle" font-size="22" fill="#c0392b" transform="rotate(4 375 328)">A&#9829;</text>
    </g>
    <!-- betting circle -->
    <g class="hotspot" data-hs="7">
      <circle cx="470" cy="330" r="34" fill="rgba(0,0,0,0.18)" stroke="#d4af37" stroke-dasharray="6 5"></circle>
      <text x="470" y="334" text-anchor="middle" font-size="9" fill="#d4af37">BET HERE</text>
    </g>
    <!-- chip rack -->
    <g class="hotspot" data-hs="8">
      <circle cx="300" cy="424" r="15" fill="#c0392b" stroke="#fff" stroke-dasharray="3 3"></circle>
      <circle cx="350" cy="424" r="15" fill="#2e86c1" stroke="#fff" stroke-dasharray="3 3"></circle>
      <circle cx="400" cy="424" r="15" fill="#212f3d" stroke="#fff" stroke-dasharray="3 3"></circle>
      <circle cx="450" cy="424" r="15" fill="#7d3c98" stroke="#fff" stroke-dasharray="3 3"></circle>
      <circle cx="500" cy="424" r="15" fill="#b89420" stroke="#fff" stroke-dasharray="3 3"></circle>
    </g>
    <!-- numbered badges + arrows -->
    <g font-size="14" font-weight="800">
      <line x1="628" y1="92" x2="662" y2="88" stroke="#d4af37" stroke-width="2" marker-end="url(#arrw)"></line>
      <circle cx="616" cy="93" r="13" fill="#d4af37"></circle><text x="616" y="98" text-anchor="middle" fill="#241c05">1</text>
      <line x1="196" y1="92" x2="164" y2="90" stroke="#d4af37" stroke-width="2" marker-end="url(#arrw)"></line>
      <circle cx="208" cy="93" r="13" fill="#d4af37"></circle><text x="208" y="98" text-anchor="middle" fill="#241c05">2</text>
      <line x1="322" y1="42" x2="350" y2="58" stroke="#d4af37" stroke-width="2" marker-end="url(#arrw)"></line>
      <circle cx="310" cy="40" r="13" fill="#d4af37"></circle><text x="310" y="45" text-anchor="middle" fill="#241c05">3</text>
      <line x1="500" y1="42" x2="462" y2="58" stroke="#d4af37" stroke-width="2" marker-end="url(#arrw)"></line>
      <circle cx="512" cy="40" r="13" fill="#d4af37"></circle><text x="512" y="45" text-anchor="middle" fill="#241c05">4</text>
      <line x1="288" y1="260" x2="314" y2="258" stroke="#d4af37" stroke-width="2" marker-end="url(#arrw)"></line>
      <circle cx="276" cy="260" r="13" fill="#d4af37"></circle><text x="276" y="265" text-anchor="middle" fill="#241c05">5</text>
      <line x1="252" y1="328" x2="282" y2="326" stroke="#d4af37" stroke-width="2" marker-end="url(#arrw)"></line>
      <circle cx="238" cy="329" r="13" fill="#d4af37"></circle><text x="238" y="334" text-anchor="middle" fill="#241c05">6</text>
      <line x1="536" y1="372" x2="492" y2="350" stroke="#d4af37" stroke-width="2" marker-end="url(#arrw)"></line>
      <circle cx="548" cy="380" r="13" fill="#d4af37"></circle><text x="548" y="385" text-anchor="middle" fill="#241c05">7</text>
      <line x1="256" y1="420" x2="282" y2="423" stroke="#d4af37" stroke-width="2" marker-end="url(#arrw)"></line>
      <circle cx="242" cy="420" r="13" fill="#d4af37"></circle><text x="242" y="425" text-anchor="middle" fill="#241c05">8</text>
      <line x1="196" y1="176" x2="252" y2="197" stroke="#d4af37" stroke-width="2" marker-end="url(#arrw)"></line>
      <circle cx="184" cy="172" r="13" fill="#d4af37"></circle><text x="184" y="177" text-anchor="middle" fill="#241c05">9</text>
    </g>
  </svg>`;
  // click a part in the picture -> highlight its explanation below
  wrap.querySelectorAll('.hotspot').forEach(g => {
    g.style.cursor = 'pointer';
    g.addEventListener('click', () => focusHotspot(g.dataset.hs, wrap));
  });
  return wrap;
}

function focusHotspot(n) {
  const wrap = document.getElementById('tour-svg');
  if (!wrap) return;
  const item = document.getElementById('hs-' + n);
  if (!item) return;
  wrap.querySelectorAll('.hotspot.on').forEach(x => x.classList.remove('on'));
  wrap.querySelector(`.hotspot[data-hs="${n}"]`)?.classList.add('on');
  wrap.querySelectorAll('.hs-item.on').forEach(x => x.classList.remove('on'));
  item.classList.add('on');
  item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

const TOUR = {
  id: 'tour',
  title: 'Take a seat: tour of the table',
  blurb: 'What everything is called — shoe, discard tray, betting circle — and how a round flows.',
  render: () => [
    el('p', {}, 'New to blackjack? Start here. This is the whole table — tap any numbered part (or the matching line below) to see it highlighted.'),
    tableDiagram(),
    (() => {
      const items = [
        ['1', 'Shoe', 'The box holding every shuffled deck (here: 6 decks = 312 cards). All cards are dealt out of the shoe.'],
        ['2', 'Discard tray', 'Where cards go after each round. The fuller it is, the fewer decks remain — this is exactly how "decks remaining" is estimated, and it is what makes the true count possible.'],
        ['3', 'Dealer', 'Runs the game with fixed printed rules: draw until 17, then stop. The dealer has no choices — that is why the game can be beaten.'],
        ['4', 'Hole card', "The dealer's face-down card, revealed when the round ends. You cannot see it, so it is not counted until revealed."],
        ['5', 'Insurance line', 'A side-bet spot, only used when the dealer shows an ace. You are betting the dealer has blackjack. Normally bad — counters know when it turns good.'],
        ['6', 'Your hand', 'Two cards, both face up. You act on them: Hit, Stand, Double, Split or Surrender.'],
        ['7', 'Betting circle', 'Your chips go in the circle before the cards are dealt. No chips = no cards.'],
        ['8', 'Chip rack', 'Your money, in chips. Each color is a different value.'],
        ['9', 'Rules on the felt', '"Blackjack pays 3 to 2" and the dealer rules are printed right on the table. Read them before you sit — they change your odds.'],
      ];
      const list = el('div', { class: 'hs-list' });
      for (const [n, term, plain] of items) {
        const item = el('div', { class: 'hs-item', id: 'hs-' + n },
          el('span', { class: 'hs-num' }, n),
          el('span', {}, el('b', {}, term + ' — '), plain));
        item.addEventListener('click', () => focusHotspot(n));
        list.append(item);
      }
      return list;
    })(),
    el('h3', { style: 'margin-top:22px' }, 'How a round works'),
    el('ol', { class: 'round-steps' },
      el('li', {}, el('b', {}, 'Bet — '), 'chips in the circle. In the app: click chips, then Deal.'),
      el('li', {}, el('b', {}, 'Deal — '), 'you get two face-up cards. The dealer gets one face-up card and one face-down "hole card".'),
      el('li', {}, el('b', {}, 'Your turn — '), 'Hit (take a card), Stand (stop), Double (double the bet for one card), Split (a pair becomes two hands), or Surrender (quit for half your bet).'),
      el('li', {}, el('b', {}, 'Dealer plays — '), 'the hole card flips over and the dealer draws until reaching 17 or more. No strategy — the rules force every move.'),
      el('li', {}, el('b', {}, 'Payout — '), 'closest to 21 without going over wins. An ace + ten on your first two cards is a blackjack and pays 3 to 2. A tie is a "push" and your bet comes back.'),
      el('li', {}, el('b', {}, 'Repeat — '), 'used cards go to the discard tray. Your count keeps running until the dealer shuffles.')),
  ],
  widget: null,
  quiz: [
    { q: 'How do you estimate how many decks are left in the shoe?', answer: 'By how full the discard tray is', opts: ['By how full the discard tray is', 'The dealer announces it every hand', 'Count the players at the table', 'You cannot estimate it'] },
    { q: 'When does the hole card count in your running count?', answer: 'Only when it is revealed', opts: ['As soon as it is dealt', 'Only when it is revealed', 'Never at all', 'Only if it is an ace'] },
    { q: 'The betting circle is where you…', answer: 'Place chips before the cards are dealt', opts: ['Place chips before the cards are dealt', 'Store winnings', 'Signal the dealer', 'Keep your drink'] },
  ],
};

const LESSONS = [TOUR,
  {
    id: 'why', title: 'Why counting works', blurb: 'The simple idea behind every counting system',
    render: () => [
      el('p', {}, 'Blackjack has a memory. Unlike roulette, each dealt card ', el('b', {}, 'changes the odds of every future hand'), ' because the shoe is finite — dealt cards are gone.'),
      el('p', {}, 'Big cards (10s and aces) are good for you: they make blackjacks (paid 3:2!), power your doubles and splits, and make the dealer — who must hit until 17 — bust more often. Small cards (2–6) do the opposite: they prop up the dealer\'s stiff hands.'),
      el('p', {}, 'So if you could track how many big vs small cards have left the shoe, you would know when the remaining shoe favors ', el('b', {}, 'you'), '. That is all card counting is: keeping one running number that tells you when to bet more.'),
      el('div', { class: 'example' }, 'When the count is high → the shoe is rich in 10s and aces → your edge turns positive → bet more. When it is low → bet the table minimum.'),
      el('p', {}, 'Counting does not predict the next card. It measures the composition of everything left, and over hundreds of hands that measurement is worth roughly 0.5–1.5% in your favor — enough to beat the house.'),
    ],
    widget: null,
    quiz: [
      { q: 'Why does the count rise and fall?', answer: 'Dealt cards permanently change the shoe composition', opts: ['The dealer shuffles differently', 'Dealt cards permanently change the shoe composition', 'Luck swings back and forth', 'Casinos remove cards mid-shoe'] },
      { q: 'Which favors the player most in a rich shoe?', answer: 'More blackjacks paid 3:2 and dealer busts', opts: ['Smaller table minimums', 'More blackjacks paid 3:2 and dealer busts', 'Slower dealers', 'Fewer players at the table'] },
    ],
  },
  {
    id: 'values', title: 'Hi-Lo card values', blurb: 'Every card maps to +1, 0, or −1',
    render: () => [
      el('p', {}, 'Hi-Lo is the most used system ever. Every card gets a tag:'),
      el('div', { class: 'example' },
        el('b', {}, '+1'), ' — low cards 2, 3, 4, 5, 6 (they leave → good for you)',
        el('br'), el('b', {}, '0'), ' — neutral cards 7, 8, 9',
        el('br'), el('b', {}, '−1'), ' — high cards 10, J, Q, K, A (they leave → bad for you)'),
      el('p', {}, 'Tap the cards below to quiz yourself. Low cards add up, high cards subtract. The balance is zero over a full deck — that is why it is called a ', el('i', {}, 'balanced'), ' system.'),
    ],
    widget: () => {
      const grid = el('div', { class: 'tag-grid' });
      RANKS.filter(r => r !== '10').concat(['10']).forEach(r => {
        const tag = HILO_TAGS[r];
        const card = el('div', { class: 'tag-card' },
          el('span', {}, r === '10' ? '10' : r),
          el('div', { class: `t hidden ${tag > 0 ? 'pos' : tag < 0 ? 'neg' : 'zero'}` }, (tag > 0 ? '+' : '') + tag));
        card.addEventListener('click', () => card.querySelector('.t').classList.toggle('hidden'));
        grid.append(card);
      });
      return el('div', {}, el('p', {}, 'Tap to reveal:'), grid);
    },
    quiz: [
      { q: 'What is the tag of a 5?', answer: '+1', opts: ['+1', '0', '−1', '+2'] },
      { q: 'What is the tag of a King?', answer: '−1', opts: ['+1', '0', '−1', '−2'] },
      { q: 'Sum the tags of a full 52-card deck:', answer: '0', opts: ['+4', '0', '−4', '52'] },
    ],
  },
  {
    id: 'running', title: 'The running count', blurb: 'Add every card as it lands on the table',
    render: () => [
      el('p', {}, 'The ', el('b', {}, 'running count (RC)'), ' is just the running total of tags for every card you can see — player cards, dealer up-card, other players\' cards. Start at 0 after a shuffle and never stop.'),
      el('div', { class: 'example' }, 'Cards dealt: 4, K, 6, 2, 10', el('br'),
        'Count: +1 −1 +1 +1 −1 = ', el('b', {}, '+1')),
      el('p', {}, 'Count cards the moment they are exposed. The dealer\'s hole card counts only when it is revealed. If you lose the count, stop playing and wait for the shuffle — playing without a count is just gambling.'),
    ],
    widget: () => {
      const seq = ['3', 'Q', '5', '7', '9'];
      let shown = 0; let rc = 0;
      const row = el('div', { class: 'cards-row center', style: 'min-height:104px' });
      const label = el('p', {}, 'Deal the five cards, keep the count in your head:');
      const btn = el('button', { class: 'btn primary' }, 'Deal next');
      const check = el('div', {});
      const suits = ['S', 'H', 'D', 'C'];
      btn.addEventListener('click', () => {
        if (shown < seq.length) {
          const r = seq[shown];
          rc += HILO_TAGS[r];
          row.append(el('div', { class: 'card small black up', style: 'width:62px;height:88px;border-radius:7px;position:relative;color:#222;display:flex;align-items:center;justify-content:center;font-weight:800;' },
            `${r}${SUIT_GLYPH[suits[shown % 4]]}`));
          shown++;
          if (shown === seq.length) {
            btn.textContent = 'Check my count';
          }
        } else {
          const input = check.querySelector('input');
          const ok = parseInt(input.value, 10) === rc;
          check.querySelector('.verdict').textContent = ok ? '✓ Correct!' : `✗ It was ${rc > 0 ? '+' : ''}${rc}. ${input.value}`;
          check.querySelector('.verdict').className = 'verdict ' + (ok ? 'ok' : 'no');
        }
      });
      check.append(el('input', { type: 'number', placeholder: 'your RC', style: 'width:110px;padding:8px;border-radius:8px;background:#17130d;color:#f5f0e1;border:1px solid #3a3226;' }),
        el('div', { class: 'verdict' }));
      return el('div', {}, label, row, el('div', { style: 'display:flex;gap:12px;align-items:center;margin-top:10px' }, btn, check));
    },
    quiz: [
      { q: 'The hole card counts when…', answer: 'It is revealed', opts: ['It is dealt', 'It is revealed', 'Only on blackjacks', 'Never'] },
      { q: 'You lost the count mid-shoe. Best move?', answer: 'Sit out until the shuffle', opts: ['Guess and keep playing', 'Bet the minimum anyway', 'Sit out until the shuffle', 'Recount other players\' chips'] },
    ],
  },
  {
    id: 'true', title: 'The true count', blurb: 'Running count ÷ decks remaining',
    render: () => [
      el('p', {}, 'A +6 running count early in a 6-deck shoe means little; the same +6 with one deck left is huge. The ', el('b', {}, 'true count (TC)'), ' normalizes for depth:'),
      el('div', { class: 'example', style: 'text-align:center;font-size:1.2em' }, 'TC = RC ÷ decks remaining (round ', el('b', {}, 'down'), ')'),
      el('p', {}, 'Estimate decks remaining from the discard tray: cards dealt ≈ tray size; decks left = (total − dealt) ÷ 52. Round down — it is the conservative habit every pro uses, and it is what bet sizing and index plays assume.'),
      el('div', { class: 'example' }, 'RC +9, about 3 decks left → TC +3.', el('br'),
        'RC +9, about 1.5 decks left → 9 ÷ 1.5 = 6 → TC +6.'),
    ],
    widget: () => {
      const cases = [
        { rc: 8, decks: 4 }, { rc: -6, decks: 2 }, { rc: 12, decks: 5 }, { rc: 5, decks: 1 },
      ];
      let i = 0;
      const q = el('p', {}, '');
      const input = el('input', { type: 'number', placeholder: 'TC' });
      const verdict = el('div', { class: 'verdict' });
      const show = () => {
        q.innerHTML = `RC <b>${cases[i].rc > 0 ? '+' : ''}${cases[i].rc}</b>, about <b>${cases[i].decks}</b> decks left. True count?`;
        verdict.textContent = ''; input.value = '';
      };
      input.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        const ans = Math.floor(cases[i].rc / cases[i].decks);
        const ok = parseInt(input.value, 10) === ans;
        verdict.textContent = ok ? '✓ Correct!' : `✗ ${cases[i].rc} ÷ ${cases[i].decks} = ${(cases[i].rc / cases[i].decks).toFixed(2)} → floor = ${ans}`;
        verdict.className = 'verdict ' + (ok ? 'ok' : 'no');
        if (i < cases.length - 1) { i++; setTimeout(show, 1400); } else { q.textContent = 'Done — you can divide.'; }
      });
      show();
      return el('div', {}, el('p', {}, 'Practice (Enter to check):'), q, input, verdict);
    },
    quiz: [
      { q: 'RC +10, 2.5 decks left. TC?', answer: '+4', opts: ['+4', '+5', '+2.5', '+10'] },
      { q: 'Why round the TC down?', answer: 'Conservative — indices and bets assume the floor', opts: [' tradition only', 'It makes counting faster', 'Conservative — indices and bets assume the floor', 'Casinos require it'] },
    ],
  },
  {
    id: 'betting', title: 'Bet sizing', blurb: 'The count tells you how much to bet',
    render: () => [
      el('p', {}, 'Counting earns nothing until you bet differently. The classic approach for a 6-deck game is a ', el('b', {}, '1–12 spread'), ' in units (a unit = table minimum):'),
      el('div', { class: 'example' },
        'TC ≤ +1 → 1 unit', el('br'),
        'TC +2 → 2 units', el('br'),
        'TC +3 → 4 units', el('br'),
        'TC +4 → 8 units', el('br'),
        'TC +5 or more → 12 units'),
      el('p', {}, 'Bet the minimum in negative and neutral shoes — you still play perfect basic strategy (that keeps your play off-pattern), you just do not fund the house. Bigger spreads make more money but attract attention; the app\'s Play mode shows this advice live next to the count.'),
      el('p', {}, 'Bankroll matters: pros bring 100–500 max bets to survive swings. The simulator gives you 1,000 and remembers your profit.'),
    ],
    widget: null,
    quiz: [
      { q: 'TC is −2. Bet?', answer: 'Table minimum', opts: ['Table minimum', '2 units', '8 units', 'Leave the table immediately'] },
      { q: 'What makes counting profitable?', answer: 'Betting more only when the shoe favors you', opts: ['Memorizing dealt cards', 'Betting more only when the shoe favors you', 'Hitting 16 always', 'Tipping the dealer'] },
    ],
  },
  {
    id: 'i18', title: 'Illustrious 18 deviations', blurb: 'Where strategy departures from basic win the most',
    render: () => [
      el('p', {}, 'Basic strategy assumes a fresh shoe. At a true count far from zero, a few plays flip. The eighteen highest-value flips are the ', el('b', {}, 'Illustrious 18'), ' (per Blackjack Attack, 6-deck indices):'),
      (() => {
        const rows = I18.map(d => el('tr', {},
          el('td', {}, d.name),
          el('td', {}, d.t === 'INS' ? 'take insurance' : (d.a === 'S' ? 'stand' : d.a === 'D' ? 'double' : 'split')),
          el('td', {}, d.t === 'INS' ? '' : 'at TC ', el('b', {}, d.t === 'INS' ? '' : (d.i > 0 ? '+' : '') + d.i)),
        ));
        return el('table', { class: 'stats' },
          el('tr', {}, el('th', {}, 'Play'), el('th', {}, 'Instead'), el('th', {}, 'Index')),
          ...rows);
      })(),
      el('p', {}, 'Insurance is the big one: normally never, but at TC ≥ +3 a tenth of the remaining cards being tens makes it +EV. The Play mode coaches these live — when the true count crosses an index, the coach tells you to deviate and why.'),
    ],
    widget: null,
    quiz: [
      { q: '16 v 10 with TC exactly 0?', answer: 'Stand (deviation)', opts: ['Hit (basic)', 'Stand (deviation)', 'Surrender', 'Double'] },
      { q: 'Insurance becomes correct at TC…', answer: '+3 or higher', opts: ['+1 or higher', '+3 or higher', '0 or higher', 'never'] },
      { q: 'Deviations matter because…', answer: 'A high shoe changes the EV of plays', opts: ['They confuse the pit boss', 'A high shoe changes the EV of plays', 'Basic strategy is wrong', 'They speed up the game'] },
    ],
  },
];
