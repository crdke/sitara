// Menu planning and nutrition, based on health conditions and what is in the kitchen.
import { store, todayLog } from './store.js';
import { DISHES, NUTRIENTS, NUTRIENT_FOODS } from './data.js';
import { ymd } from './i18n.js';

const SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'];

function inKitchen(item) {
  const lvl = store.pantry[item];
  return lvl === undefined || lvl === 'full' || lvl === 'half';
}

// Score each dish: avoid ones bad for the elder's conditions, prefer ones
// that are good for them, and only use what is available in the kitchen.
export function dishOptions(slot) {
  const conds = store.profile.conditions;
  return DISHES.filter((d) => d.slot === slot && !d.bad.some((b) => conds.includes(b)) && d.needs.every(inKitchen))
    .map((d) => ({ dish: d, score: (d.good || []).filter((g) => conds.includes(g)).length }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.dish);
}

// Same menu all day; "show another menu" moves to the next choices.
export function menuForToday() {
  const seed = [...ymd()].reduce((a, c) => a + c.charCodeAt(0), 0) + (store.menuShift || 0);
  const out = {};
  for (const slot of SLOTS) {
    const opts = dishOptions(slot);
    const top = opts.slice(0, 3); // the best choices for this person
    out[slot] = top.length ? top[seed % top.length] : null;
  }
  return out;
}

// Which nutrients the elder got today from dishes they marked as eaten.
export function nutritionToday() {
  const eaten = todayLog('meal').map((e) => DISHES.find((d) => d.id === e.dish)).filter(Boolean);
  const got = new Set(eaten.flatMap((d) => d.nutrients));
  const missing = NUTRIENTS.filter((x) => !got.has(x));
  return { eaten, got: [...got], missing, suggestions: Object.fromEntries(missing.map((m) => [m, NUTRIENT_FOODS[m]])) };
}

export const lowItems = () => Object.entries(store.pantry).filter(([, v]) => v === 'low').map(([k]) => k);
