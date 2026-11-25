// Talks to the Sitara backend: Gemini answers, Sarvam voice (speak + listen).
// If the backend is missing or down, every caller falls back to the free
// built-in options (Wikipedia, the phone's own voice), so Sitara never breaks.
import { store } from './store.js';
import { BACKEND_URL } from './config.js';
import { lang, n } from './i18n.js';

let health = null;
let checkedUrl = null;
let history = []; // last few questions and answers, so follow-up questions make sense

export const backendUrl = () => (store.settings.backendUrl || BACKEND_URL || '').trim().replace(/\/+$/, '');

async function call(path, opts = {}, ms = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const headers = { ...(opts.headers || {}) };
    if (store.settings.accessCode) headers['X-Sitara-Code'] = store.settings.accessCode;
    const res = await fetch(backendUrl() + path, { ...opts, headers, signal: ctrl.signal });
    if (!res.ok) {
      // Wrong code, paused, or today's limit used up: stop asking the backend
      // for this visit and quietly use the free features instead.
      if ([401, 429, 503].includes(res.status) && health) { health = { ...health, ai: false, voice: false, backupVoice: false, stopped: res.status }; }
      let msg = res.status + '';
      try { msg = (await res.json()).error || msg; } catch (e) { /* not JSON */ }
      throw new Error(msg);
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// Is the backend there, and which parts (AI, voice) have keys?
// Wait (briefly) for the first backend check, so the first answer of a visit
// already knows whether the backup voice is there.
let firstCheck = null;
export function backendKnown() {
  if (!backendUrl() || (health && checkedUrl)) return Promise.resolve();
  firstCheck = firstCheck || checkBackend();
  return Promise.race([firstCheck, new Promise((r) => setTimeout(r, 4000))]);
}

export async function checkBackend(force = false) {
  const url = backendUrl();
  if (!url) { health = null; return null; }
  const key = url + '|' + (store.settings.accessCode || '');
  if (health && !force && checkedUrl === key) return health;
  checkedUrl = key;
  try {
    health = await (await call('/health', {}, 6000)).json();
  } catch (e) {
    health = { ok: false, ai: false, voice: false, error: e.message };
  }
  return health;
}

const online = () => navigator.onLine && !!backendUrl();
export const aiReady = () => online() && !!(health && health.ai) && store.settings.useAI !== false;
// Sarvam voice is optional and OFF unless the family ticks it AND the backend has a Sarvam key.
// Listening through the backend (free Gemini, or Sarvam if set up) — a backup when
// the phone's own recognition can't do the language.
export const listenReady = () => online() && !!(health && health.listen);
export const voiceReady = () => online() && !!(health && health.voice) && store.settings.sarvamVoice === true;
// Free Gemini voice, used only for languages this phone has no voice for.
export const backupVoiceReady = () => online() && !!(health && health.backupVoice);

// Only shared when the family turns it on in Family Setup.
function personalContext() {
  if (!store.settings.shareHealth) return '';
  const p = store.profile;
  const parts = [];
  if (p.name) parts.push(`Name: ${p.name}.`);
  if (p.conditions.length) parts.push(`Health conditions: ${p.conditions.map((c) => n('c_' + c)).join(', ')}.`);
  if (store.meds.length) parts.push(`Medicines: ${store.meds.map((m) => `${m.name} ${m.dose} at ${m.times.join(' and ')}`).join('; ')}.`);
  if (store.contacts.length) parts.push(`Family: ${store.contacts.map((c) => `${c.name} (${c.relation})`).join(', ')}.`);
  return parts.join(' ');
}

export async function askAI(question) {
  const code = lang().code;
  if (history.length && history[0].lang !== code) history = [];
  const res = await call('/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, lang: code, history: history.map(({ role, text }) => ({ role, text })), context: personalContext(),
      now: new Date().toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) }),
  }, 25000);
  const data = await res.json();
  history.push({ role: 'user', text: question, lang: code }, { role: 'model', text: data.answer, lang: code });
  history = history.slice(-6);
  return data.answer;
}

// Natural voice: returns a playable URL for the sentence (cached for repeats).
const ttsCache = new Map();
export async function speechAudio(text, engine = 'sarvam') {
  const key = engine + '|' + lang().code + '|' + text;
  if (ttsCache.has(key)) return ttsCache.get(key);
  const res = await call('/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang: lang().code, engine }) }, 20000);
  const url = URL.createObjectURL(await res.blob());
  ttsCache.set(key, url);
  if (ttsCache.size > 60) { const [k, u] = ttsCache.entries().next().value; URL.revokeObjectURL(u); ttsCache.delete(k); }
  return url;
}

// Natural listening: send a short recording, get the words back.
export async function transcribe(blob) {
  const form = new FormData();
  const ext = (blob.type.split('/')[1] || 'webm').split(';')[0];
  form.append('file', blob, 'speech.' + ext);
  form.append('lang', lang().code);
  const data = await (await call('/stt', { method: 'POST', body: form }, 30000)).json();
  return data.transcript || '';
}

// Read medicines from a prescription photo, or from a spoken sentence.
// Returns [{ name, dose, times, food, purpose, unsure }]
export async function readPrescription({ image, mime, text }) {
  const res = await call('/read-prescription', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image, mime, text }),
  }, 45000);
  return (await res.json()).medicines || [];
}
