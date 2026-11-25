// Everything is saved on the phone itself (localStorage). No login, no server.
import { demoData } from './data.js';
import { ymd } from './i18n.js';

const KEY = 'sitara.v1';

function defaults() {
  return {
    lang: null,
    scale: 1,
    settings: { simple: false, slow: true, demo: true, camera: false, stillMinutes: 120,
      backendUrl: '', accessCode: '', useAI: true, sarvamVoice: false, oneVoice: false, shareHealth: false,
      checkinTime: '09:00', updateTime: '20:30' },
    profile: { name: '', conditions: [] },
    meds: [], contacts: [], doctors: [], appointments: [], events: [], pantry: {}, playlist: [],
    log: [],      // what the elder did: medicines taken, meals, water, movement
    fired: {},    // reminders already shown, so they are not repeated
    snooze: {},
    menuShift: 0,
  };
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved) return { ...defaults(), ...saved, settings: { ...defaults().settings, ...saved.settings } };
  } catch (e) { /* storage blocked: run with demo data in memory */ }
  return { ...defaults(), ...demoData() }; // first visit: show a filled-in demo
}

export const store = load();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
}

export function loadDemo() {
  const keep = { lang: store.lang, scale: store.scale };
  Object.assign(store, defaults(), demoData(), keep);
  save();
}

export function clearAll() {
  const keep = { lang: store.lang, scale: store.scale };
  Object.assign(store, defaults(), keep);
  save();
}

export const newId = () => Math.random().toString(36).slice(2, 9);

export function logEvent(type, data = {}) {
  store.log.push({ type, at: new Date().toISOString(), date: ymd(), ...data });
  const cutoff = Date.now() - 30 * 86400000;
  store.log = store.log.filter((e) => new Date(e.at).getTime() > cutoff);
  save();
}

export const todayLog = (type) => store.log.filter((e) => e.date === ymd() && (!type || e.type === type));

// ---- Medicines ----
export function dosesToday(now = new Date()) {
  const today = ymd(now);
  const out = [];
  for (const med of store.meds) {
    for (const time of med.times) {
      const key = `${today}|${med.id}|${time}`;
      const taken = store.log.find((e) => e.type === 'med' && e.key === key);
      const [h, mi] = time.split(':').map(Number);
      const due = new Date(now); due.setHours(h, mi, 0, 0);
      let status;
      if (taken) status = 'taken';
      else if (now < due) status = 'later';
      else if (now - due <= 60 * 60000) status = 'due';
      else status = 'missed';
      out.push({ med, time, key, due, status, takenAt: taken && new Date(taken.at) });
    }
  }
  return out.sort((a, b) => a.due - b.due);
}

export function markTaken(dose) {
  if (store.log.some((e) => e.type === 'med' && e.key === dose.key)) return;
  logEvent('med', { key: dose.key, medId: dose.med.id, name: dose.med.name });
  if (typeof dose.med.stock === 'number' && dose.med.stock > 0) dose.med.stock -= 1;
  save();
}

export function nextDose() {
  const d = dosesToday();
  return d.find((x) => x.status === 'due') || d.find((x) => x.status === 'later') || null;
}

// ---- Meals & water ----
export const mealDone = (meal) => todayLog('meal').find((e) => e.meal === meal);
export const waterToday = () => todayLog('water').length;
export const waterTarget = () => (store.profile.conditions.includes('kidney') ? 6 : 8);

export function emergencyContact() {
  return store.contacts.find((c) => c.emergency) || store.contacts[0] || null;
}
