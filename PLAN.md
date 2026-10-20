# blackjack-coach — Project Plan

A browser app that teaches Hi-Lo card counting, then basic strategy, then
Illustrious-18 deviations — with casino-table visuals. Runs offline, zero
dependencies, starts with one command.

Created: 2026-10-19. Status: COMPLETE (Hi-Lo only, per user decision).

## Gamification phase (added later same day, COMPLETE)

- Run profiles: Rookie 🎓 ($500, 1D S17, 85% pen), Counter 🃏 ($2,000, 6D
  S17 standard), High Roller 👑 ($5,000, 6D H17 80% pen). Goal = 2x
  bankroll; per-profile saved progress (active/won/bust), cash-out.
- Live HUD: bankroll, goal progress, net, EV lost to mistakes, decision
  accuracy, streak flame, points, skill rank (Fish → Shark).
- Instant feedback banner after every decision (incl. insurance): grades vs
  basic strategy + I18 (exact charts) and shows Monte Carlo EVs per action
  from engine/evaluator.js (antithetic sampling, hole conditioned on peek).
- Animations: card deal fly-in, chip drop stacks, win glow / loss shake,
  blackjack shine banner; WebAudio synth SFX (sound.js) with mute.
- Networking: systemd user service blackjack-coach.service serves 0.0.0.0:8123.
  LAN access needs firewall-cmd --add-port=8123/tcp (user-run, pending).

## Decisions

- Platform: web app (plain HTML/CSS/JS ES modules, no build step)
- Counting: Hi-Lo first; KO and Omega II added later as selectable systems
  (engine is tag-table driven, so a new system is just a new tag map)
- Scope: counting + basic strategy + Illustrious-18 deviations
- Look: casino table — green felt, real card faces, chip betting
- Progress: localStorage (accuracy stats, lessons completed)

## Architecture

    blackjack-coach/
      index.html
      src/
        engine/       # pure logic, no DOM
          shoe.js       # decks, shuffle, penetration, deal
          hand.js       # hand values, soft/hard, splits
          blackjack.js  # table rules, payouts, dealer play
          count.js      # tag tables, running/true count
          strategy.js   # basic strategy chart, deviations, bet spread
        systems/      # hilo.js, ko.js, omega2.js (tag maps + metadata)
        ui/
          table.js      # felt, cards, chips rendering
          drill.js      # count drill mode
          play.js       # play mode
          lessons.js    # lesson pages
          stats.js      # progress store
      tests/            # engine + strategy tests (run with node --test)
      PLAN.md

Engine stays DOM-free so every rule is unit-testable. UI reads engine state.

Rules configurable: 1/2/6/8 decks, H17/S17, DAS, surrender, penetration %.

## Phases (each usable on its own)

1. Engine + tests — shoe, hands, full blackjack rules, Hi-Lo count math.
   Acceptance: test suite passes; CLI-free sanity script deals and plays.
2. Drill mode (the heart) — cards flip at adjustable speed, user inputs
   running count, instant feedback, per-card hint mode for beginners,
   true-count mode with deck estimation, accuracy/speed stats.
   Acceptance: full session with stats saved.
3. Play mode — bankroll, chip bets, dealer AI, count hidden/visible toggle,
   count grade at shuffle, bet-spread suggestion by true count.
   Acceptance: playable multi-hand session with correct payouts.
4. Strategy coaching — basic strategy table, soft hints in play mode,
   Illustrious-18 deviation prompts at the right true counts.
   Acceptance: coach flags every deviation from chart, explains why.
5. Lessons + polish — 6 short interactive lessons (why counting works, card
   values, running count, true count, bet sizing, deviations), animations,
   keyboard controls, resume where you left off.
   Acceptance: a beginner can go lesson 1 to passing the final drill.

## Counting systems

- Hi-Lo only (user decision): 2-6 = +1, 7-9 = 0, 10-A = -1; true count =
  running / decks remaining, floored. KO and Omega II deliberately omitted.
- Honest note: Hi-Lo executed cleanly beats a harder system executed
  sloppily. The app grades accuracy so users can see this themselves.

## Run / test

- Dev: `python3 -m http.server` in the project root (or any static server)
- Tests: `node --test tests/`
