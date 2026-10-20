// store.js — settings + stats persisted to localStorage
const KEY = 'bj-coach-v1';

export const DEFAULTS = {
  settings: {
    numDecks: 6, penetration: 0.75, hitSoft17: false, das: true,
    surrender: true, showCount: true, coachHints: true, shuffleQuiz: true,
    bankroll: 1000, minBet: 5, sound: true, feedback: true, theme: 'toon',
  },
  stats: {
    drills: [],            // {when, mode, cards, checks, correct, bestStreak}
    play: { rounds: 0, hands: 0, wagered: 0, net: 0, countGrades: [] },
    lessons: {},           // {id: true}
  },
  runs: {},                // per-profile saved runs
};

export function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY)) || {};
    return {
      settings: { ...DEFAULTS.settings, ...(raw.settings || {}) },
      stats: {
        ...DEFAULTS.stats,
        ...(raw.stats || {}),
        play: { ...DEFAULTS.stats.play, ...((raw.stats || {}).play || {}) },
        lessons: (raw.stats || {}).lessons || {},
      },
      runs: raw.runs || {},
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
}

export function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function resetAll() {
  localStorage.removeItem(KEY);
}
