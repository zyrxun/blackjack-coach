// sound.js — tiny WebAudio synth for game feedback (no assets)
let ctx = null;
let enabled = true;

export function setSoundEnabled(v) { enabled = v; }

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ freq, to = freq, dur = 0.1, type = 'sine', gain = 0.06, delay = 0 }) {
  const a = ac();
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function sfx(name) {
  if (!enabled) return;
  try {
    switch (name) {
      case 'card': // quick flick
        tone({ freq: 320, to: 180, dur: 0.05, type: 'triangle', gain: 0.05 });
        break;
      case 'flip':
        tone({ freq: 900, to: 600, dur: 0.06, type: 'triangle', gain: 0.04 });
        break;
      case 'chip':
        tone({ freq: 1900, dur: 0.03, type: 'square', gain: 0.025 });
        tone({ freq: 2400, dur: 0.03, type: 'square', gain: 0.02, delay: 0.045 });
        break;
      case 'win':
        [523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.12, type: 'sine', gain: 0.06, delay: i * 0.09 }));
        break;
      case 'bj':
        [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.14, type: 'sine', gain: 0.07, delay: i * 0.08 }));
        tone({ freq: 2093, dur: 0.3, type: 'sine', gain: 0.03, delay: 0.34 });
        break;
      case 'lose':
        tone({ freq: 160, to: 90, dur: 0.3, type: 'sawtooth', gain: 0.04 });
        break;
      case 'push':
        tone({ freq: 440, dur: 0.12, type: 'sine', gain: 0.04 });
        break;
      case 'correct':
        tone({ freq: 880, dur: 0.06, type: 'sine', gain: 0.04 });
        break;
      case 'wrong':
        tone({ freq: 210, to: 150, dur: 0.16, type: 'square', gain: 0.035 });
        break;
      case 'streak':
        [660, 880].forEach((f, i) => tone({ freq: f, dur: 0.07, type: 'sine', gain: 0.04, delay: i * 0.06 }));
        break;
      case 'trophy':
        [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ freq: f, dur: 0.16, type: 'sine', gain: 0.06, delay: i * 0.1 }));
        break;
    }
  } catch { /* audio unavailable — stay silent */ }
}
