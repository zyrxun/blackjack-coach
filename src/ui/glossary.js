// glossary.js — plain-English definitions for every piece of casino jargon
import { el, showModal, hideModal } from './cards.js';

export const GLOSSARY = [
  { id: 'shoe', term: 'Shoe', plain: 'The box on the table that holds the shuffled decks (1 to 8 of them). Every card is dealt out of the shoe until it needs reshuffling.' },
  { id: 'discard', term: 'Discard tray', plain: 'Where played cards pile up after each round. Its thickness shows how much of the shoe has been used — that is how dealers ( and you ) estimate how many decks are left.' },
  { id: 'decks', term: 'Decks remaining', plain: 'How many 52-card decks are still unplayed in the shoe. The app shows it as a number like "4.8". Fewer decks left = each card dealt matters more.' },
  { id: 'pen', term: 'Penetration', plain: 'How deep into the shoe the dealer deals before reshuffling. "75% penetration" means 3 of every 4 cards get used. Deeper is better for counters — more rounds with a known count.' },
  { id: 'rc', term: 'Running count (RC)', plain: 'One number you keep in your head: +1 for every 2–6 you see, −1 for every 10/face/ace, 0 for 7–9. It starts at 0 after every shuffle.' },
  { id: 'tc', term: 'True count (TC)', plain: 'Running count ÷ decks remaining, rounded down. It is the fair version of the count — a +6 with two decks left is twice as strong as a +6 with four left.' },
  { id: 'spread', term: 'Bet spread', plain: 'Betting small when the count is neutral or negative and big when it is high. A "1–12 spread" means bets from 1 to 12 table minimums depending on the true count.' },
  { id: 'hit', term: 'Hit', plain: 'Take another card. Tap/click Hit or press H.' },
  { id: 'stand', term: 'Stand', plain: 'Keep your cards and end your turn. Press S.' },
  { id: 'double', term: 'Double', plain: 'Double your bet and take exactly one more card, then you automatically stand. Best when you have a strong total (like 11) against a weak dealer card.' },
  { id: 'split', term: 'Split', plain: 'If your two cards match (like 8♥8♦), split them into two separate hands with a second equal bet. Each hand is played on its own.' },
  { id: 'surrender', term: 'Surrender', plain: 'Give up right after the deal and lose only half your bet. Used for hopeless matchups like hard 16 against a dealer 10.' },
  { id: 'insurance', term: 'Insurance', plain: 'A side bet offered only when the dealer shows an ace: you bet half your original wager that the dealer has blackjack. It pays 2:1. Normally a bad bet — only correct when the true count is +3 or higher.' },
  { id: 'soft', term: 'Soft / hard hand', plain: 'A soft hand contains an ace still counted as 11, so it cannot bust with one more card (A+6 = "soft 17"). A hard hand has no ace, or the ace must count as 1.' },
  { id: 'hole', term: 'Hole card', plain: "The dealer's face-down card. It is revealed after every player finishes. It is NOT counted in your running count until you can see it." },
  { id: 'push', term: 'Push', plain: 'A tie — same total as the dealer. Your bet is returned, nothing won or lost.' },
  { id: 'unit', term: 'Unit', plain: 'One table minimum bet. If the minimum is $25, "bet 4 units" means $100.' },
  { id: 'edge', term: 'House edge', plain: 'The casino\'s built-in average profit per bet — about 0.5% against perfect basic strategy. Counting plus bigger bets at the right moments flips that to your side.' },
];

const byId = Object.fromEntries(GLOSSARY.map(g => [g.id, g]));

export function openGlossary(highlightId) {
  const list = el('div', { class: 'gloss-list' });
  for (const g of GLOSSARY) {
    const item = el('div', { class: `gloss-item ${g.id === highlightId ? 'hl' : ''}`, id: 'gloss-' + g.id },
      el('b', {}, g.term),
      el('p', {}, g.plain));
    list.append(item);
  }
  showModal(el('div', {},
    el('div', { style: 'font-weight:800;font-size:1.15em;margin-bottom:10px' }, '📖 Casino words, plainly'),
    list,
    el('div', { style: 'margin-top:12px' },
      el('button', { class: 'btn primary', onclick: hideModal }, 'Got it'))));
  if (highlightId) {
    const node = document.getElementById('gloss-' + highlightId);
    if (node) setTimeout(() => node.scrollIntoView({ block: 'center' }), 60);
  }
}

export function glossTerm(id, word) {
  const node = el('span', { class: 'term-dot', 'data-gloss': id }, word);
  node.addEventListener('click', () => openGlossary(id));
  return node;
}
