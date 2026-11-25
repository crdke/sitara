// The "brain": LISTEN → UNDERSTAND → RESPOND.
// Sitara looks for keywords (in all languages) to decide which job to do,
// then answers from the elder's own data (medicines, family, food...).
import { t, n, keywords, allNames, fmtTime, fmtDate, fmtWhen, list, setLang, lang } from './i18n.js';
import { LANGUAGES } from './lang/index.js';
import {
  store, save, dosesToday, markTaken, nextDose, logEvent, mealDone, waterToday,
  emergencyContact,
} from './store.js';
import { CONDITIONS, DISHES, ALL_FOOD_KEYS, RELATIONS } from './data.js';
import { callPerson, startSOS } from './actions.js';
import { go } from './ui.js';
import { menuForToday } from './food.js';
import * as music from './music.js';
import { wikiAnswer } from './wiki.js';
import { aiReady, askAI } from './backend.js';

// ---------- text helpers ----------
const norm = (s) => s.toLowerCase().replace(/[.,!?;:"'“”‘’()]/g, ' ').replace(/\s+/g, ' ').trim();
const isLatin = (w) => /^[a-z0-9' ]+$/.test(w);

function has(text, intent) {
  return keywords(intent).some((k) => (isLatin(k) ? new RegExp(`(^|\\s)${k.replace(/'/g, "'?")}(\\s|$)`).test(text) : text.includes(k)));
}

// Rough sound-alike matching so "रवि" / "രവി" / "Ravi" all match the same contact.
const TABLE = { 0x15: 'k', 0x16: 'k', 0x17: 'g', 0x18: 'g', 0x19: 'n', 0x1a: 'ch', 0x1b: 'ch', 0x1c: 'j', 0x1d: 'j', 0x1e: 'n',
  0x1f: 't', 0x20: 't', 0x21: 'd', 0x22: 'd', 0x23: 'n', 0x24: 't', 0x25: 't', 0x26: 'd', 0x27: 'd', 0x28: 'n', 0x29: 'n',
  0x2a: 'p', 0x2b: 'f', 0x2c: 'b', 0x2d: 'b', 0x2e: 'm', 0x2f: 'y', 0x30: 'r', 0x31: 'r', 0x32: 'l', 0x33: 'l', 0x34: 'l',
  0x35: 'v', 0x36: 'sh', 0x37: 'sh', 0x38: 's', 0x39: 'h', 0x02: 'n',
  0x7a: 'n', 0x7b: 'n', 0x7c: 'r', 0x7d: 'l', 0x7e: 'l', 0x7f: 'k' };
function latin(s) {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    const base = c >= 0x0900 && c < 0x0980 ? 0x0900 : c >= 0x0d00 && c < 0x0d80 ? 0x0d00 : null;
    if (base == null) { out += ch; continue; }
    const off = c - base;
    if (TABLE[off]) out += TABLE[off];
    else if ((off >= 0x05 && off <= 0x14) || (off >= 0x3e && off <= 0x4c)) out += 'a';
  }
  return out;
}
export function skeleton(s) {
  return latin(s.toLowerCase()).replace(/ph/g, 'f').replace(/w/g, 'v').replace(/z/g, 's').replace(/[^a-z]/g, '')
    .replace(/[aeiouh]/g, '').replace(/(.)\1+/g, '$1');
}
export function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

export function findContact(text) {
  const words = text.split(' ');
  const wordSk = words.map(skeleton);
  for (const c of store.contacts) {
    const names = [c.name, ...(c.aliases || '').split(',')].map((x) => x.trim()).filter(Boolean);
    for (const nm of names) {
      if (text.includes(nm.toLowerCase())) return c;
      const sk = skeleton(nm.split(' ')[0]);
      if (sk.length < 2) continue;
      if (wordSk.some((w) => w === sk || (w.startsWith(sk) && w.length - sk.length <= 2) || (sk.length >= 4 && lev(w, sk) <= 1))) return c;
    }
  }
  // "call my son" — match by relation word
  for (const r of ['grandson', 'granddaughter', ...RELATIONS]) {
    if (has(text, 'r_' + r)) {
      const c = store.contacts.find((x) => x.relation === r);
      if (c) return c;
    }
  }
  return null;
}

// Guess the name the person said, for the "I couldn't find X" message.
function leftoverName(text) {
  const drop = new Set([...keywords('call'), 'my', 'to', 'please', 'को', 'ला', 'നെ', 'करो', 'कर', 'please']);
  return text.split(' ').filter((w) => !drop.has(w) && ![...drop].some((d) => d.length > 2 && w.includes(d))).join(' ') || text;
}

function findFood(text) {
  let best = null;
  for (const key of ALL_FOOD_KEYS) {
    const variants = new Set([key.replace('_', ' ')]);
    for (const full of allNames(key)) {
      variants.add(full.split('(')[0].trim());
      const inner = full.match(/\(([^)]+)\)/);
      if (inner) inner[1].split(',').forEach((x) => variants.add(x.trim()));
    }
    for (const v of variants) {
      if (v.length < 2) continue;
      const hit = isLatin(v) ? new RegExp(`(^|\\s)${v}s?(\\s|$)`).test(text) : text.includes(v);
      if (hit && (!best || v.length > best.len)) best = { key, len: v.length };
    }
  }
  return best && best.key;
}

function findMeal(text) {
  for (const m of ['breakfast', 'lunch', 'dinner']) if (has(text, m)) return m;
  const hr = new Date().getHours();
  return hr < 11 ? 'breakfast' : hr < 17 ? 'lunch' : 'dinner';
}

function findLanguage(text) {
  return LANGUAGES.find((l) => (l.calledAs || [l.name.toLowerCase()]).some((w) => text.includes(w.toLowerCase())));
}

function findMed(text) {
  for (const m of store.meds) {
    const first = m.name.toLowerCase().split(' ')[0];
    if (text.includes(first) || text.split(' ').some((w) => skeleton(w) === skeleton(first))) return m;
  }
  for (const m of store.meds) if (has(text, 'p_' + m.purpose)) return m;
  return null;
}

// ---------- answers ----------
const foodWord = (f) => t('food_' + f);
const doseLine = (d) => `${d.med.name}, ${d.med.dose}, ${fmtTime(d.time)}`;

function medsAnswer() {
  const doses = dosesToday();
  if (!doses.length) return t('med_none_today');
  const nx = nextDose();
  if (!nx) return t('med_all_done');
  return t('med_list_say', { count: doses.length, name: nx.med.name, dose: nx.med.dose, time: fmtTime(nx.time), food: foodWord(nx.med.food) });
}

function didITakeAnswer(text) {
  const doses = dosesToday();
  if (!doses.length) return t('med_none_today');
  const med = findMed(text);
  if (med) {
    const mine = doses.filter((d) => d.med.id === med.id);
    const taken = mine.filter((d) => d.status === 'taken');
    const parts = [];
    if (taken.length) parts.push(t('med_already_taken', { name: med.name, time: fmtTime(taken[taken.length - 1].takenAt) }));
    for (const m of mine.filter((d) => d.status === 'missed')) parts.push(t('med_was_missed', { name: med.name, time: fmtTime(m.time) }));
    const upcoming = mine.find((d) => d.status === 'due' || d.status === 'later');
    if (upcoming) parts.push(t('med_not_taken_yet', { name: med.name, time: fmtTime(upcoming.time) }));
    return parts.join(' ');
  }
  const taken = doses.filter((d) => d.status === 'taken').map((d) => d.med.name);
  const pending = doses.filter((d) => d.status !== 'taken').map((d) => `${d.med.name} (${fmtTime(d.time)})`);
  return [taken.length ? t('med_summary_taken', { list: list(taken) }) : '', pending.length ? t('med_summary_pending', { list: list(pending) }) : t('med_all_done')].join(' ').trim();
}

export function canEatAnswer(key) {
  const conds = store.profile.conditions;
  const dish = DISHES.find((d) => d.id === key);
  const name = lang().code === 'en' ? n(key).toLowerCase() : n(key);
  if (dish) {
    const bad = conds.find((c) => dish.bad.includes(c));
    if (bad) return t('can_eat_bad', { food: name, condition: n('c_' + bad) });
    if (conds.some((c) => (dish.good || []).includes(c))) return t('can_eat_good', { food: name });
    return t('can_eat_ok', { food: name });
  }
  const bad = conds.find((c) => CONDITIONS[c] && CONDITIONS[c].less.includes(key));
  if (bad) return t('can_eat_bad', { food: name, condition: n('c_' + bad) });
  if (conds.some((c) => CONDITIONS[c] && CONDITIONS[c].more.includes(key))) return t('can_eat_good', { food: name });
  if (!conds.length && Object.values(CONDITIONS).some((c) => c.more.includes(key))) return t('can_eat_good', { food: name });
  return t('can_eat_ok', { food: name });
}

function nextAppointment() {
  return store.appointments.filter((a) => new Date(a.at) > new Date()).sort((a, b) => new Date(a.at) - new Date(b.at))[0];
}
function nextEvent() {
  return store.events.filter((e) => new Date(e.at) > new Date()).sort((a, b) => new Date(a.at) - new Date(b.at))[0];
}

function openBtn(label, path) { return { label, run: () => go(path) }; }

// ---------- main entry ----------
// Takes one or more possible sentences; returns { text, buttons }.
export function understand(alternatives) {
  const texts = (Array.isArray(alternatives) ? alternatives : [alternatives]).map(norm).filter(Boolean);
  for (const text of texts) {
    const r = answer(text);
    if (r) return r;
  }
  return null;
}

function answer(text) {
  const name = store.profile.name;

  if (has(text, 'sos')) { startSOS(); return { text: t('sos_title') }; }

  if (has(text, 'unwell')) {
    const c = emergencyContact();
    return { text: c ? t('unwell_say', { name: c.name }) : t('no_emergency_contact'),
      buttons: c ? [{ label: '📞 ' + c.name, run: () => callPerson(c, { confirm: false }), cls: 'ok' }, { label: '🆘 ' + t('tile_sos'), run: startSOS, cls: 'danger' }] : [] };
  }

  const L = findLanguage(text);
  if (L && (has(text, 'language') || text.split(' ').length <= 3)) {
    store.lang = L.code; save(); setLang(L.code);
    return { text: t('lang_changed'), rerender: true };
  }

  if (has(text, 'music_stop')) { music.stop(); return { text: t('music_stopped') }; }
  if (has(text, 'music') && !has(text, 'call')) {
    const item = store.playlist.find((p) => p.lang === lang().code);
    if (item) return { text: t('music_playing', { title: item.title }), buttons: [{ label: '▶ ' + item.title, run: () => music.play(item), cls: 'ok' }, { label: '🎵 ' + t('music_builtin'), run: () => music.play(null) }] };
    music.play(null);
    return { text: t('music_playing', { title: t('music_builtin') }), buttons: [{ label: '⏹ ' + t('music_stop'), run: music.stop }] };
  }

  if (has(text, 'add_med')) return { text: t('am_title'), go: 'addmed' };
  if (has(text, 'medinfo')) return { text: t('mi_title'), go: 'medinfo' };

  if (has(text, 'camera')) return { text: t('cam_title'), buttons: [openBtn('📷 ' + t('open'), 'camera')] };

  if (has(text, 'call')) {
    const c = findContact(text);
    if (c) { callPerson(c); return { text: t('call_confirm', { name: c.name }) }; }
    return { text: t('call_not_found', { name: leftoverName(text) }), go: 'call' };
  }

  const medWord = has(text, 'meds') || store.meds.some((m) => text.includes(m.name.toLowerCase().split(' ')[0]));
  if (has(text, 'did_i') && (medWord || findMed(text))) return { text: didITakeAnswer(text), buttons: [openBtn('💊 ' + t('tile_meds'), 'meds')] };
  if (has(text, 'did_i') && has(text, 'food')) {
    const meal = findMeal(text); const m = mealDone(meal);
    return { text: m ? t('ate_when', { meal: t('meal_' + meal), time: fmtTime(new Date(m.at)) }) : t('ate_none', { meal: t('meal_' + meal) }) };
  }
  if (has(text, 'took') && medWord) {
    const d = dosesToday().find((x) => x.status === 'due') || dosesToday().filter((x) => x.status === 'missed').pop();
    if (d) { markTaken(d); return { text: t('med_taken_ok') + ' ' + medsAnswer() }; }
    return { text: didITakeAnswer(text) };
  }
  if (medWord) return { text: medsAnswer(), buttons: [openBtn('💊 ' + t('tile_meds'), 'meds')] };

  if (has(text, 'can_eat') && findFood(text)) {
    return { text: canEatAnswer(findFood(text)), buttons: [openBtn('🍲 ' + t('tile_food'), 'food')] };
  }
  if (has(text, 'water_drank')) {
    logEvent('water'); return { text: t('water_added', { n: waterToday() }) };
  }
  if (has(text, 'ate') || has(text, 'took')) {
    const meal = findMeal(text);
    logEvent('meal', { meal });
    return { text: t('ate_ok', { meal: t('meal_' + meal) }) };
  }
  if (has(text, 'water')) return { text: t('water_say', { n: waterToday() }), buttons: [{ label: '💧 ' + t('water_add'), run: () => { logEvent('water'); } }] };

  if (has(text, 'pantry')) {
    const low = Object.entries(store.pantry).filter(([, v]) => v === 'low').map(([k]) => n(k));
    return { text: low.length ? t('pantry_low_say', { items: list(low) }) : t('pantry_all_ok'), buttons: [openBtn('🧺 ' + t('tile_pantry'), 'pantry')] };
  }

  const f = findFood(text);
  if (has(text, 'food') || (f && !has(text, 'wiki') && text.split(' ').length <= 4)) {
    if (f && !has(text, 'food')) return { text: canEatAnswer(f) };
    const meal = findMeal(text);
    const menu = menuForToday();
    const dish = menu[meal];
    return { text: dish ? t('menu_say', { meal: t('meal_' + meal), dish: n(dish.id) }) : t('no_ingredients'), buttons: [openBtn('🍲 ' + t('tile_food'), 'food')] };
  }

  if (has(text, 'appointment')) {
    if (has(text, 'book')) return { text: t('appt_book'), go: 'book' };
    const a = nextAppointment();
    return { text: a ? t('appt_next', { patient: a.patient, doctor: a.doctor, when: fmtWhen(new Date(a.at)) }) : t('appt_none'),
      buttons: [openBtn('🩺 ' + t('appt_book'), 'book'), openBtn('📋 ' + t('tile_doctor'), 'doctor')] };
  }

  if (has(text, 'calendar')) {
    const e = nextEvent();
    return { text: e ? t('event_next', { title: e.title, when: fmtWhen(new Date(e.at)) }) : t('cal_none'), buttons: [openBtn('📅 ' + t('tile_calendar'), 'calendar')] };
  }

  if (has(text, 'day')) return { text: dayAnswer(), go: 'day' };
  if (has(text, 'time')) return { text: t('ans_time', { time: fmtTime(new Date()) }) };
  if (has(text, 'date')) return { text: t('ans_date', { date: fmtDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }) };
  if (has(text, 'thanks')) return { text: t('ans_thanks') };
  if (has(text, 'name')) return { text: t('ans_name') };
  if (has(text, 'help_me')) return { text: t('ans_help') };
  if (has(text, 'hello')) return { text: t('ans_hello', { name }) };
  return null;
}

export function dayAnswer() {
  const doses = dosesToday().length;
  const today = new Date().toDateString();
  const others = [...store.appointments, ...store.events].filter((x) => new Date(x.at).toDateString() === today).length;
  return t('day_say', { date: fmtDate(new Date()), meds: doses, events: others });
}

// Full answer: Sitara's own knowledge first, then the AI, then Wikipedia.
// Returns { text, buttons, source } or null when nothing was found.
export async function ask(alternatives) {
  const own = understand(alternatives);
  if (own) return own;
  const first = (Array.isArray(alternatives) ? alternatives : [alternatives])[0] || '';
  // 1. Smart AI (Google Gemini through the Sitara backend), when it is set up.
  if (aiReady()) {
    try {
      const answer = await askAI(first);
      if (answer) { logEvent('ai', {}); return { text: answer, source: t('ai_source') }; }
    } catch (e) { /* AI busy or unreachable: use Wikipedia instead */ }
  }
  // 2. Wikipedia, free and without any key.
  const w = await wikiAnswer(norm(first));
  if (!w) return null;
  if (w.offline) return { text: t('wiki_offline') };
  logEvent('wiki', { title: w.title });
  return {
    text: w.text,
    source: t('wiki_source', { title: w.title }),
    buttons: [{ label: '📖 ' + t('wiki_more'), run: () => window.open(w.url, '_blank', 'noopener') }],
  };
}
