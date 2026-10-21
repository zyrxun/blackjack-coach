// cards.js — DOM helpers for cards, totals, modal
import { HILO_TAGS } from '../engine/count.js';

export const SUIT_GLYPH = { S: '♠', H: '♥', D: '♦', C: '♣' };

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v === false) continue; // boolean false = attr not set (e.g. disabled: false)
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined) continue;
    node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
}

// face-down cards animate on .up
export function cardNode(card, { small = false, faceDown = false, showTag = false } = {}) {
  const red = card.suit === 'H' || card.suit === 'D';
  const flair = card.rank === 'A' ? 'ace' : ['J', 'Q', 'K'].includes(card.rank) ? 'face-card' : '';
  const c = el('div', { class: `card ${small ? 'small' : ''} ${red ? 'red' : 'black'} ${faceDown ? '' : 'up'} ${flair}` });
  const front = el('div', { class: 'face front' },
    el('div', { class: 'corner' }, card.rank, el('br'), SUIT_GLYPH[card.suit]),
    el('div', { class: 'pip' }, SUIT_GLYPH[card.suit]),
    el('div', { class: 'corner br' }, card.rank, el('br'), SUIT_GLYPH[card.suit]),
    showTag ? el('div', { class: 'tag-badge' }, (HILO_TAGS[card.rank] > 0 ? '+' : '') + HILO_TAGS[card.rank]) : null,
  );
  const back = el('div', { class: 'face back' });
  c.append(front, back);
  // trigger flip transition on next frame when dealt face down then revealed
  if (faceDown) c.dataset.facedown = '1';
  return c;
}

export function flipUp(node) {
  if (node.dataset.facedown === '1') {
    requestAnimationFrame(() => requestAnimationFrame(() => node.classList.add('up')));
    node.dataset.facedown = '0';
  }
}

export function showModal(content) {
  const modal = document.getElementById('modal');
  const box = document.getElementById('modal-box');
  box.replaceChildren(content);
  modal.classList.remove('hidden');
}

export function hideModal() {
  document.getElementById('modal').classList.add('hidden');
}

export function fmtMoney(n) {
  const s = Math.abs(n) % 1 ? Math.abs(n).toFixed(2) : Math.abs(n).toString();
  return (n < 0 ? '-$' : '$') + Number(s).toLocaleString('en-US');
}
