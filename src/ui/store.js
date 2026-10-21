// store.js — settings + stats persisted to localStorage
const KEY = 'bj-coach-v1';

export const DEFAULTS = {
  settings: {
    numDecks: 6, penetration: 0.75, hitSoft17: false, das: true,
    surrender: true, showCount: true, coachHints: true, shuffleQuiz: true,
    bankroll: 1000, minBet: 5, sound: true, feedback: true, theme: 'toon',
    cardArt: 'classic',
  },
  stats: {
    drills: [],            // {when, mode, cards, checks, correct, bestStreak}
    play: { rounds: 0, hands: 0, wagered: 0, net: 0, countGrades: [] },
    lessons: {},           // {id: true}
    strategy: {},          // perfect-strategy trainer: {key: {seen, right}}
    story: {},             // story mode: {stageId: stars 1-3}
  },
  profiles: {},            // persistent player bankrolls (post-teaching)
  activeProfile: null,
  runs: {},                // legacy run saves (no longer used)
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
        strategy: (raw.stats || {}).strategy || {},
        story: (raw.stats || {}).story || {},
      },
      profiles: raw.profiles || {},
      activeProfile: raw.activeProfile || null,
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
