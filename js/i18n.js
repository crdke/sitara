// Translation helpers: t('key', {vars}) for sentences, n('rice') for names.
import { LANGUAGES } from './lang/index.js';

const EN = LANGUAGES[0];
let current = EN;

export function setLang(code) {
  current = LANGUAGES.find((l) => l.code === code) || EN;
  document.documentElement.lang = current.code;
  return current;
}
export const lang = () => current;

function fill(str, vars) {
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] != null ? vars[k] : ''));
}

export function t(key, vars) {
  const s = current.strings[key] ?? EN.strings[key] ?? key;
  return fill(s, vars);
}

export function n(key) {
  return current.names[key] ?? EN.names[key] ?? key;
}

// All keyword lists for one intent, from every language (people mix languages).
const kwCache = {};
export function keywords(intent) {
  if (!kwCache[intent]) {
    kwCache[intent] = LANGUAGES.flatMap((l) => (l.keywords && l.keywords[intent]) || []).map((w) => w.toLowerCase());
  }
  return kwCache[intent];
}

// All the ways a name key is written across languages (used to spot foods in speech).
export function allNames(key) {
  return LANGUAGES.map((l) => l.names[key]).filter(Boolean).map((s) => s.toLowerCase());
}

const pad = (x) => String(x).padStart(2, '0');

export function fmtTime(d) {
  if (typeof d === 'string') {
    const [h, m] = d.split(':').map(Number);
    d = new Date(); d.setHours(h, m, 0, 0);
  }
  return d.toLocaleTimeString(current.locale, { hour: 'numeric', minute: '2-digit' });
}
export function fmtDate(d, opts) {
  return d.toLocaleDateString(current.locale, opts || { weekday: 'long', day: 'numeric', month: 'long' });
}
export function fmtWhen(d) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const diff = Math.round((day - today) / 86400000);
  const time = fmtTime(d);
  if (diff === 0) return t('when_today', { time });
  if (diff === 1) return t('when_tomorrow', { time });
  return t('when_date', { date: fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' }), time });
}
export function list(items) {
  return items.join(', ');
}
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hm = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
