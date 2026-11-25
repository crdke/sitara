// "Today's update" message for family far away, and the remote-setup link.
import { store, dosesToday, todayLog, waterToday } from './store.js';
import { t, fmtDate, fmtTime, fmtWhen, list } from './i18n.js';

export function todaysUpdate() {
  const doses = dosesToday();
  const taken = doses.filter((d) => d.status === 'taken');
  const missed = doses.filter((d) => d.status === 'missed').map((d) => `${d.med.name} (${fmtTime(d.time)})`);
  const meals = [...new Set(todayLog('meal').map((e) => e.meal))].map((m) => t('Meal_' + m));
  const ok = todayLog('okcheck').find((e) => e.ok);
  const soon = [...store.appointments.map((a) => ({ title: `${a.doctor} (${a.patient})`, at: a.at })), ...store.events]
    .filter((x) => { const ms = new Date(x.at) - Date.now(); return ms > 0 && ms < 3 * 86400000; })
    .sort((a, b) => new Date(a.at) - new Date(b.at))[0];
  return [
    t('up_head', { name: store.profile.name, date: fmtDate(new Date(), { weekday: 'short', day: 'numeric', month: 'short' }) }),
    (ok ? '✅ ' : '⚠️ ') + (ok ? t('up_ok', { time: fmtTime(new Date(ok.at)) }) : t('up_ok_none')),
    '💊 ' + t('up_meds', { taken: taken.length, total: doses.length }),
    missed.length ? '⚠️ ' + t('up_missed', { list: list(missed) }) : null,
    '🍽️ ' + t('up_meals', { list: meals.length ? list(meals) : '—' }),
    '💧 ' + t('up_water', { n: waterToday() }),
    soon ? '📅 ' + t('up_next', { text: `${soon.title} ${fmtWhen(new Date(soon.at))}` }) : null,
  ].filter(Boolean).join('\n');
}

// ---- Set up from far away ----
// Everything is packed into the part of the link after "#", which browsers never
// send to any server. It only travels inside the WhatsApp/SMS message itself.
const PACK = ['profile', 'meds', 'contacts', 'doctors', 'appointments', 'events', 'playlist'];
const SETTINGS = ['backendUrl', 'accessCode', 'checkinTime', 'updateTime', 'slow', 'simple', 'demo', 'useAI', 'shareHealth'];

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

export async function makeSetupLink() {
  const data = { v: 1, lang: store.lang, settings: Object.fromEntries(SETTINGS.map((k) => [k, store.settings[k]])) };
  for (const k of PACK) data[k] = store[k];
  data.meds = data.meds.map(({ photoId, ...m }) => m); // photos stay on this phone
  const raw = new TextEncoder().encode(JSON.stringify(data));
  const packed = window.CompressionStream ? 'z' + b64url(await pipe(raw, new CompressionStream('deflate-raw'))) : 'j' + b64url(raw);
  return `${location.origin}${location.pathname}#setup=${packed}`;
}

export async function readSetupLink(packed) {
  const bytes = unb64url(packed.slice(1));
  const raw = packed[0] === 'z' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : bytes;
  const data = JSON.parse(new TextDecoder().decode(raw));
  if (data.v !== 1 || !Array.isArray(data.meds)) throw new Error('bad');
  return data;
}

export function applySetup(data) {
  for (const k of PACK) if (data[k] !== undefined) store[k] = data[k];
  for (const k of SETTINGS) if (data.settings && data.settings[k] !== undefined) store.settings[k] = data.settings[k];
  if (data.lang) store.lang = data.lang;
}
