# Blackjack Coach

Learn to count cards (Hi-Lo) and play perfect basic strategy in your browser:
lessons, drills, a strategy trainer, and a full casino table with a live
count, coach hints, and Illustrious-18 deviation prompts.

## Play online

No install, no clone: **https://zyrxun.github.io/blackjack-coach/**

(Progress is stored per browser, so your stats stay your own.)

## Run it

Any static file server from this directory, e.g.:

    python3 -m http.server 8123

Then open http://127.0.0.1:8123 — no build step, no dependencies, works
offline. Progress (settings, drill stats, lesson completion) is stored in
your browser's localStorage.

## Tests

    npm test          # or: node --test tests/

44 tests cover the engine: hand math, shoe/penetration, Hi-Lo counting,
full table rules (peek, insurance, splits, DAS, surrender, S17/H17,
payouts), basic strategy charts, the Illustrious 18 indices, and the
strategy-trainer scenario generator.

## What's inside

- **Runs** — pick a profile (Rookie 🎓 $500 / Counter 🃏 $2,000 / High Roller 👑 $5,000),
  double the bankroll to beat the run. Each run tracks bankroll, net, and a
  live **EV-lost counter** (expected value given away to mistakes), plus
  decision accuracy, streaks with a flame meter, points, and skill ranks
  (Fish → Shark). Cash out anytime; progress saves per profile.
- **Instant feedback** — after every move (including insurance) a banner
  grades the play against basic strategy + Illustrious-18 and shows Monte
  Carlo EVs of every option ("Stand +0.43 · Hit −0.77 · cost ≈ $30").
  Toggle with the 🎯 HUD button.
- **Play** — 1/2/6/8-deck shoe, chip betting with drop animations, dealt-card
  fly-ins that flip face-up on landing (gloss sweep, ace glow, gold frames on
  face cards, coin-burst wins, dealer-bust flash, bankroll bump), win glow /
  loss shake, blackjack slam-in banner, synthesized sounds (mute via 🔊),
  live Hi-Lo running + true count, bet-spread advice, shuffle-time count
  quizzes. All motion respects `prefers-reduced-motion`.
- **Perfect Strategy** — basic-strategy trainer with **no counting**: random
  hands graded against the exact chart, a coaching "why" after every answer,
  per-hand mastery stats, a "my trouble spots" focus mode, and a full
  color-coded strategy chart rendered straight from the engine tables.
- **Count Drill** — cards flip at adjustable speed; the app quizzes your
  running count at random checkpoints and grades accuracy and streaks.
- **Lessons** — six interactive lessons: why counting works → card values →
  running count → true count → bet sizing → Illustrious 18.
- **Stats** — accuracy history, per-run summaries, profit/loss, lessons done.

House rules live in the run profiles (Rookie / Counter / High Roller).
Engine logic is DOM-free (`src/engine/`), so every rule is unit-tested; the
UI (`src/ui/`) only reads engine state. Decision grading uses the exact
strategy charts; a Monte Carlo evaluator (`engine/evaluator.js`) supplies
the approximate per-action EVs shown in feedback.

For entertainment and skill training. Card counting is legal, but casinos
may refuse service to anyone.
