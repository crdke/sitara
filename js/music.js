// Music: a built-in calm tanpura (made with sound waves, works offline),
// MP3 links played inside the app, and YouTube links opened outside.
import { audioCtx } from './voice.js';
import { logEvent } from './store.js';

let nodes = [];
let audioEl = null;
export let playing = null;

export function play(item) {
  stop();
  if (!item) return playTanpura();
  logEvent('music', { title: item.title });
  if (/\.(mp3|m4a|ogg|wav)(\?|$)/i.test(item.url)) {
    audioEl = new Audio(item.url);
    audioEl.play().catch(() => {});
    playing = item.title;
  } else {
    window.open(item.url, '_blank', 'noopener');
  }
}

function playTanpura() {
  const ctx = audioCtx();
  ctx.resume();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 2);
  master.connect(ctx.destination);
  // Pa – Sa – Sa – low Sa, plucked in a slow loop like a tanpura.
  const base = 130.81; // C3 as Sa
  const notes = [base * 1.5, base * 2, base * 2, base];
  let i = 0;
  const pluck = () => {
    const f = notes[i % notes.length]; i += 1;
    const t0 = ctx.currentTime;
    [1, 2, 3, 4].forEach((h, k) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * h;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.5 / (k + 1), t0 + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.2);
      o.connect(g).connect(master); o.start(t0); o.stop(t0 + 3.3);
    });
  };
  pluck();
  const timer = setInterval(pluck, 1100);
  nodes = [master, timer];
  playing = 'tanpura';
  logEvent('music', { title: 'tanpura' });
}

export function stop() {
  if (nodes.length) { clearInterval(nodes[1]); try { nodes[0].disconnect(); } catch (e) { /* */ } nodes = []; }
  if (audioEl) { audioEl.pause(); audioEl = null; }
  playing = null;
}
