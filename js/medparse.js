// Understanding medicines the elder says or searches for:
//   "Metformin 500, morning and night, after food"
//   "मेटफॉर्मिन सुबह और रात खाने के बाद"   "ഷെൽകാൽ ഉച്ചയ്ക്ക്"
// Works without internet. Names are matched by sound across scripts.
import { keywords } from './i18n.js';
import { COMMON_MEDICINES } from './data.js';
import { skeleton, lev } from './assistant.js';

export const SLOT_TIMES = { morning: '08:00', afternoon: '14:00', night: '21:00' };

const INDIC_DIGITS = /[०-९൦-൯]/g;
const toAscii = (s) => s.replace(INDIC_DIGITS, (d) => String((d.charCodeAt(0) - (d >= '൦' ? 0x0d66 : 0x0966))));
const has = (text, key) => keywords(key).some((k) => text.includes(k));

// Names to compare for a catalogue medicine: generic first word + each brand.
function namesOf(m) {
  return [m.name.split(' ')[0], ...m.aka.split(/[\/,]/).map((x) => x.trim().split(' ')[0])].filter((x) => x && x.length > 2);
}

function score(query, m) {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  let best = 0;
  for (const nm of namesOf(m)) {
    const n = nm.toLowerCase();
    if (q.length >= 3 && (n.startsWith(q) || (n.length >= 4 && q.startsWith(n)))) best = Math.max(best, 3);
    const a = skeleton(q.split(' ')[0]); const b = skeleton(n);
    if (a.length >= 2 && b.length >= 2) {
      if (a === b) best = Math.max(best, 3);
      else if (b.startsWith(a) && a.length >= 3) best = Math.max(best, 2);
      else if (Math.min(a.length, b.length) >= 4 && lev(a, b) <= 1) best = Math.max(best, 2);
      else if (Math.min(a.length, b.length) >= 5 && lev(a, b) <= 2) best = Math.max(best, 1);
    }
  }
  return best;
}

// Search the common-medicine list (by name or brand, in any script).
// minScore 1 = loose (good for a search list), 2 = sure enough to fill in by itself.
export function searchMedicines(query, minScore = 1) {
  const words = toAscii(query).split(/\s+/).filter((w) => w.length > 1);
  return COMMON_MEDICINES.map((m) => ({ m, s: Math.max(0, ...words.map((w) => score(w, m))) }))
    .filter((x) => x.s >= minScore).sort((a, b) => b.s - a.s).map((x) => x.m);
}

// Turn a spoken sentence into a medicine draft the elder then confirms.
export function parseSpoken(sentence) {
  const text = toAscii(sentence.toLowerCase());
  const match = searchMedicines(text, 2)[0] || null;

  const slots = [];
  if (has(text, 't_morning')) slots.push('morning');
  if (has(text, 't_afternoon')) slots.push('afternoon');
  if (has(text, 't_night')) slots.push('night');
  if (!slots.length && has(text, 'n_thrice')) slots.push('morning', 'afternoon', 'night');
  if (!slots.length && has(text, 'n_twice')) slots.push('morning', 'night');

  let food = null;
  if (has(text, 'f_empty')) food = 'empty';
  else if (has(text, 'f_before')) food = 'before';
  else if (has(text, 'f_after')) food = 'after';

  const strength = (text.match(/\b\d+(\.\d+)?\s*(mg|mcg|ml|g|units?)?\b/) || [''])[0].trim();
  let name;
  if (match) {
    name = match.name;
    if (strength && /^\d/.test(strength) && !match.name.includes(strength.replace(/\D+$/, ''))) {
      name = match.name.replace(/\s[\d.]+\s*(mg|mcg).*$/i, '') + ' ' + strength + (/[a-z]/.test(strength) ? '' : ' mg');
    }
  } else {
    // Unknown medicine: keep the first words that aren't times or food words.
    const drop = ['t_morning', 't_afternoon', 't_night', 'n_twice', 'n_thrice', 'f_after', 'f_before', 'f_empty', 'add_med'].flatMap(keywords);
    let rest = sentence;
    for (const d of drop.sort((a, b) => b.length - a.length)) rest = rest.split(new RegExp(d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig')).join(' ');
    name = rest.replace(/\b(and|और|आणि|ഉം|,)\b/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join(' ');
  }

  return {
    name,
    dose: match && match.dose ? match.dose : '1 tablet',
    slots: slots.length ? slots : match ? slotsFromTimes(match.times) : [],
    food: food || (match ? match.food : 'after'),
    purpose: match ? match.purpose : 'other',
  };
}

export function slotsFromTimes(times) {
  const out = new Set();
  for (const t of times || []) {
    const h = Number(String(t).split(':')[0]);
    out.add(h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'night');
  }
  return [...out];
}
