// Listening (speech-to-text) and speaking (text-to-speech) using the
// phone's built-in Web Speech API. Works in Chrome on Android.
import { lang } from './i18n.js';
import { store } from './store.js';
import { voiceReady, backupVoiceReady, listenReady, speechAudio, transcribe, backendKnown } from './backend.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const canRecord = () => !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
// The phone's own recognition (Chrome), or recording + the backend as a backup.
export const canListen = () => !!SR || ((voiceReady() || listenReady()) && canRecord());
export const canSpeak = 'speechSynthesis' in window;

let current = null;
let stopRecording = null;

// Returns a list of possible sentences the person may have said.
// iPhone/iPad: Safari's own recognition is unreliable for Indian languages
// other than Hindi, so Google (through the backend) writes down the words.
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const backendHearsBetter = () => listenReady() && canRecord() && isIOS() && !['en', 'hi'].includes(lang().code);

export async function listen() {
  if (voiceReady() && canRecord()) return recordAndTranscribe(); // Sarvam chosen in Family Setup
  if (backendHearsBetter()) return recordAndTranscribe();
  if (SR) {
    try {
      return await browserListen();
    } catch (e) {
      // This browser can't do the language (or its speech service is blocked):
      // record instead and let the backend (free Gemini) write down the words.
      // Also on 'not-allowed': on iPhones that is often Safari's speech service
      // (Siri/Dictation off), not the microphone. Recording still works then;
      // if the microphone itself is blocked, recording reports 'not-allowed' too.
      if (['language-not-supported', 'network', 'service-not-allowed', 'not-allowed'].includes(e.message) && listenReady() && canRecord()) return recordAndTranscribe();
      throw e;
    }
  }
  if (listenReady() && canRecord()) return recordAndTranscribe();
  throw new Error('unsupported');
}

// A short, soft beep so the elder knows exactly when to start speaking.
export function startCue() {
  try {
    const ctx = audioCtx(); ctx.resume();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 880; o.type = 'sine';
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.18, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
    o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + 0.2);
  } catch (e) { /* no audio */ }
  if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(60);
  return new Promise((r) => setTimeout(r, 250));
}

async function browserListen() {
  stopSpeaking();
  await startCue();
  return new Promise((resolve, reject) => {
    const r = new SR();
    current = r;
    r.lang = lang().speech;
    r.interimResults = false;
    r.maxAlternatives = 4;
    let done = false;
    r.onresult = (e) => {
      done = true;
      window.dispatchEvent(new Event('sitara:heard'));
      resolve([...e.results[0]].map((a) => a.transcript));
    };
    r.onerror = (e) => {
      if (done) return;
      done = true;
      if (e.error === 'no-speech' || e.error === 'aborted') resolve([]); else reject(new Error(e.error));
    };
    r.onend = () => { current = null; if (!done) { done = true; resolve([]); } };
    soundMode('play-and-record');
    try { r.start(); } catch (e) { reject(e); }
  });
}

export function stopListening() {
  if (stopRecording) { stopRecording(); return; }
  if (current) try { current.abort(); } catch (e) { /* ignore */ }
}

// Record until the person stops talking, then let the backend (Google) write
// down the words. Nothing is kept: the recording is sent once and thrown away.
// iPhones pause their sound engine when switching to recording mode, which can
// stop Sitara from measuring the voice. Then it simply records for a while
// (tap the microphone again to finish sooner) and sends it anyway.
async function recordAndTranscribe() {
  stopSpeaking();
  soundMode('play-and-record'); // switch before the beep, not after
  await startCue();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    throw new Error(e.name === 'NotAllowedError' || e.name === 'SecurityError' ? 'not-allowed' : e.name === 'NotFoundError' ? 'no-mic' : 'mic-busy');
  }
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  // Voice meter (may not work on every phone; see above).
  const ctx = audioCtx();
  await Promise.race([ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 600))]);
  let src = null; let analyser = null;
  try {
    src = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
    src.connect(analyser);
  } catch (e) { analyser = null; }
  const buf = new Uint8Array(1024);
  const start = performance.now();
  let measuring = false; // true once the meter shows any real sound data
  let floor = 0; let peak = 0; let spoke = false; let lastLoud = start;

  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      const now = performance.now();
      if (analyser && ctx.state === 'running') {
        analyser.getByteTimeDomainData(buf);
        let sum = 0; let moved = false;
        for (const v of buf) { if (v !== 128) moved = true; const d = (v - 128) / 128; sum += d * d; }
        const rms = Math.sqrt(sum / buf.length);
        if (moved) measuring = true;
        if (now - start < 400) floor = Math.max(floor, rms); // room noise
        peak = Math.max(peak, rms);
        if (rms > Math.max(0.012, floor * 2.5)) { spoke = true; lastLoud = now; }
      }
      if (measuring) {
        if ((spoke && now - lastLoud > 1600) || now - start > 15000 || (!spoke && now - start > 7000)) stop();
      } else if (now - start > 8000) stop(); // can't measure: a fixed 8 seconds
    }, 100);
    function stop() { clearInterval(timer); if (rec.state !== 'inactive') rec.stop(); }
    stopRecording = stop;
    rec.onstop = async () => {
      stopRecording = null;
      stream.getTracks().forEach((tr) => tr.stop());
      if (src) src.disconnect();
      const worthSending = spoke || !measuring || peak > 0.008; // Google returns nothing for silence
      if (!worthSending || !chunks.length) { resolve([]); return; }
      window.dispatchEvent(new Event('sitara:heard')); // the person has finished: now working it out
      try {
        const text = await transcribe(await toWav(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })));
        resolve(text ? [text] : []);
      } catch (e) {
        reject(new Error(navigator.onLine ? 'not-caught' : 'network')); // busy, not offline: just ask again
      }
    };
    rec.start(250);
  });
}

// The phone's own voice: prefer Google's voices for the exact language
// (best quality on Android), then any voice for that language.
function voicesFor(code) {
  const base = code.split('-')[0];
  return speechSynthesis.getVoices().filter((v) => v.lang.replace('_', '-').toLowerCase().split('-')[0] === base);
}
function pickVoice(code) {
  const list = voicesFor(code);
  const score = (v) => (v.lang.replace('_', '-') === code ? 4 : 0) + (/google/i.test(v.name) ? 2 : 0) + (v.localService ? 1 : 0);
  return list.sort((a, b) => score(b) - score(a))[0] || null;
}

// How will Sitara speak the current language on this device?
//   'phone'  – the phone has a voice for it (best: works offline)
//   'backup' – no phone voice, so the free Gemini voice on the backend is used
//   'hindi'  – Marathi with no Marathi voice and no backend: the Hindi voice reads it
//   'none'   – nothing can speak it here (the answer is still shown in big letters)
//   null     – the phone has not listed its voices yet
export function voiceStatus() {
  if (!canSpeak) return backupVoiceReady() ? 'backup' : 'none';
  if (!speechSynthesis.getVoices().length) return backupVoiceReady() ? 'backup' : null;
  const code = lang().speech;
  if (voicesFor(code).length) return 'phone';
  if (backupVoiceReady()) return 'backup';
  return offlineFallback(code) ? offlineFallback(code).kind : 'none';
}
// Kept for older callers: true / false / null (can't tell yet).
export function hasPhoneVoice() {
  const st = voiceStatus();
  return st === null ? null : st === 'phone';
}

// Only used when there is no backend: Marathi shares its script with Hindi,
// so the Hindi voice is easy to follow. (Reading Malayalam with an English
// voice was tried and was too confusing, so Malayalam stays on screen instead.)
function offlineFallback(code) {
  const base = code.split('-')[0];
  if (['mr', 'ne', 'sa', 'kok'].includes(base) && pickVoice('hi-IN')) return { kind: 'hindi', code: 'hi-IN', voice: pickVoice('hi-IN') };
  return null;
}

// iPhones only play sound that is started by a tap. Sitara's replies arrive
// seconds after the tap (after listening and thinking), so on each tap we play
// a split-second of silence through ONE shared sound player, and once through
// the phone's voice. The iPhone then treats both as "started by a tap", and
// later replies can play through them.
let shared = null;
let silenceUrl = null;
let replyPlaying = false;
let speechUnlocked = false;
function sharedPlayer() {
  if (!shared) { shared = new Audio(); shared.preload = 'auto'; shared.setAttribute('playsinline', ''); }
  return shared;
}
function silence() {
  if (!silenceUrl) {
    const n = 1600; const v = new DataView(new ArrayBuffer(44 + n * 2)); // 0.1 s at 16 kHz
    const w = (o, x) => [...x].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    silenceUrl = URL.createObjectURL(new Blob([v], { type: 'audio/wav' }));
  }
  return silenceUrl;
}
function unlockAudio() {
  if (!replyPlaying) {
    try { const el = sharedPlayer(); el.src = silence(); el.play().catch(() => {}); } catch (e) { /* ignore */ }
  }
  try { const c = audioCtx(); if (c.state !== 'running') c.resume(); } catch (e) { /* ignore */ }
  if (!speechUnlocked && canSpeak) {
    speechUnlocked = true;
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { /* ignore */ }
  }
}
['pointerdown', 'touchend', 'keydown'].forEach((ev) => document.addEventListener(ev, unlockAudio, { capture: true, passive: true }));

// iPhone sound mode. 'playback' lets the voice play even when the silent
// switch is on, but it shuts the microphone out. So: recording mode just
// before listening, playback mode just before speaking.
export function soundMode(mode) {
  try { if (navigator.audioSession && navigator.audioSession.type !== mode) navigator.audioSession.type = mode; } catch (e) { /* older phones */ }
}

// Speaking finishes "when the sound ends", so the conversation knows when to
// listen again. Every way of speaking calls done() exactly once.
let player = null;
let speakToken = 0;
let finishSpeaking = null;
let soundStarted = null; // called once, when the voice can actually be heard
function started(token) {
  if (token === speakToken && soundStarted) { const f = soundStarted; soundStarted = null; f(); }
}
function finished(token) {
  started(token);
  if (token === speakToken && finishSpeaking) { const f = finishSpeaking; finishSpeaking = null; f(); }
}

// Play the backend's audio through the shared player that a tap unlocked;
// if that is refused, through the sound engine; if both fail, the caller
// falls back to the phone's own voice.
async function playAudio(url, token) {
  soundMode('playback');
  if (token !== speakToken) return;
  const el = sharedPlayer();
  el.onended = el.onerror = null;
  el.src = url;
  el.onended = () => { replyPlaying = false; finished(token); };
  el.onerror = () => { replyPlaying = false; finished(token); };
  player = { pause: () => { replyPlaying = false; try { el.pause(); } catch (e) { /* ignore */ } } };
  try {
    replyPlaying = true;
    await el.play();
    started(token);
    return;
  } catch (e) {
    replyPlaying = false;
  }
  const c = audioCtx();
  if (c.state !== 'running') await c.resume().catch(() => {});
  if (c.state !== 'running') throw new Error('sound locked');
  const buf = await c.decodeAudioData(await (await fetch(url)).arrayBuffer());
  if (token !== speakToken) return;
  const src = c.createBufferSource(); src.buffer = buf; src.connect(c.destination);
  src.onended = () => finished(token);
  src.start();
  started(token);
  player = { pause: () => { try { src.stop(); } catch (e) { /* already stopped */ } } };
}

// Should this sentence use the backend's voice?
function backendVoiceFor() {
  if (voiceReady()) return 'sarvam'; // the family chose Sarvam
  if (!backupVoiceReady()) return null;
  const phoneHas = canSpeak && voicesFor(lang().speech).length > 0;
  // One voice for every language (Family Setup can switch to the phone's own voice, which is faster).
  return store.settings.oneVoice !== false || !phoneHas ? 'gemini' : null;
}

// Speak a sentence. The returned promise resolves when it has been said
// (or was stopped), so callers can wait before listening.
// opts.onStart: called when the voice can actually be heard (not when it is
// still being fetched), so the screen only says "speaking" with sound.
export function speak(text, opts = {}) {
  stopSpeaking();
  if (!text) { if (opts.onStart) opts.onStart(); return Promise.resolve(); }
  const token = ++speakToken;
  soundStarted = opts.onStart || null;
  const done = new Promise((resolve) => { finishSpeaking = resolve; });
  // Never wait forever: a little longer than the sentence could possibly take.
  setTimeout(() => finished(token), 8000 + text.length * 160);
  (async () => {
    await backendKnown(); // the very first answer may come before the backend check finishes
    if (token !== speakToken) return;
    const engine = backendVoiceFor();
    if (engine) {
      try {
        const url = await speechAudio(text, engine);
        if (token === speakToken) await playAudio(url, token);
        return;
      } catch (e) { /* fall through to the phone's voice */ }
    }
    if (token === speakToken) phoneSpeak(text, token);
  })();
  return done;
}

// Fetch these sentences' audio ahead of time, so they play instantly later.
export function warmUp(texts) {
  if (!backendVoiceFor()) return;
  texts.filter(Boolean).forEach((x) => speechAudio(x, voiceReady() ? 'sarvam' : 'gemini').catch(() => {}));
}

function phoneSpeak(text, token) {
  if (!canSpeak) { finished(token); return; }
  soundMode('playback');
  speechSynthesis.cancel();
  let code = lang().speech;
  let v = pickVoice(code);
  if (!v && speechSynthesis.getVoices().length) {
    const fb = offlineFallback(code);
    if (!fb) { finished(token); return; } // no voice that can say this: better silent than confusing
    code = fb.code; v = fb.voice;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = code;
  if (v) u.voice = v;
  u.rate = store.settings.slow ? 0.85 : 1;
  u.onstart = () => started(token);
  u.onend = u.onerror = () => finished(token);
  speechSynthesis.speak(u);
  setTimeout(() => { if (speechSynthesis.speaking) started(token); }, 700); // some phones skip onstart
}

export function stopSpeaking() {
  const old = speakToken;
  speakToken++;
  soundStarted = null;
  if (finishSpeaking) { const f = finishSpeaking; finishSpeaking = null; f(); }
  if (player) { player.pause(); player = null; }
  if (canSpeak) speechSynthesis.cancel();
  return old;
}
export const isSpeaking = () => !!finishSpeaking;

// Some browsers load voices late.
if (canSpeak) speechSynthesis.onvoiceschanged = () => {};

// A soft two-tone chime for reminders.
let ctx;
export function chime() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    [659, 880].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = f; o.type = 'sine';
      const t0 = ctx.currentTime + i * 0.35;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.3, t0 + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
      o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + 0.65);
    });
  } catch (e) { /* no audio */ }
  if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate([300, 150, 300]);
}
export const audioCtx = () => (ctx = ctx || new (window.AudioContext || window.webkitAudioContext)());

// Turn the recording into a small 16 kHz mono WAV file, a format every speech
// service understands. If the phone can't convert it, the original is sent.
export async function toWav(blob) {
  try {
    const decoded = await audioCtx().decodeAudioData(await blob.arrayBuffer());
    const rate = 16000;
    const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
    const src = off.createBufferSource(); src.buffer = decoded; src.connect(off.destination); src.start();
    const pcm = (await off.startRendering()).getChannelData(0);
    const view = new DataView(new ArrayBuffer(44 + pcm.length * 2));
    const str = (o, s) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    str(36, 'data'); view.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
    return new Blob([view], { type: 'audio/wav' });
  } catch (e) {
    return blob;
  }
}
