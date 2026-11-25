// Sitara — voice helper for elders. Starts the app, draws the top bar and
// switches between screens (#/home, #/meds, #/call ...).
import { store, save } from './store.js';
import { setLang, t, lang } from './i18n.js';
import { h, go, toast, popup, say, popupOpen } from './ui.js';
import { ask } from './assistant.js';
import { hearQuestion } from './screens/common.js';
import { speak, warmUp } from './voice.js';
import { startReminders } from './reminders.js';
import { checkBackend } from './backend.js';
import { readSetupLink, applySetup } from './update.js';
import { SCREENS } from './screens/index.js';

setLang(store.lang || 'en');
applyScale();

// A link like  https://…/sitara/?code=JUDGES2026  unlocks the AI and natural
// voice on this phone. The code is saved here and removed from the address bar.
{
  const params = new URLSearchParams(location.search);
  if (params.get('code')) {
    store.settings.accessCode = params.get('code').trim();
    save();
    history.replaceState(null, '', location.pathname + location.hash);
  }
}

const app = document.getElementById('app');
let cleanup = null;
let currentName = '';

export function route() {
  const [name = 'home', arg] = location.hash.replace(/^#\/?/, '').split('/');
  if (!store.lang && name !== 'language') { go('language'); return; }
  if (cleanup) { cleanup(); cleanup = null; }
  if (store.lang) warmUp([t('thinking_say')]); // so "let me see…" plays instantly (fetched once, then cached)
  const screen = SCREENS[name] || SCREENS.home;
  if (name !== currentName) window.scrollTo(0, 0);
  currentName = name;
  app.innerHTML = '';
  const main = h('main', { id: 'main', class: 'screen-' + (SCREENS[name] ? name : 'home') });
  app.append(topBar(), main);
  if (!['home', 'language', 'family', 'addmed', 'medinfo'].includes(name)) app.append(floatingMic());
  const res = screen(main, arg);
  if (typeof res === 'function') cleanup = res;
}

// A big microphone in the corner of every screen: ask a question from anywhere.
function floatingMic() {
  const btn = h('button', { class: 'fab-mic', 'aria-label': t('ask_anything'), onclick: async () => {
    const alts = await hearQuestion(btn, null);
    if (!alts) return;
    toast(`${t('you_said')}: “${alts[0]}”`);
    const r = await ask(alts);
    if (!r) { say(t('not_understood')); return; }
    if (r.rerender) { route(); say(r.text); return; }
    if (r.go) { go(r.go); say(r.text); return; }
    if (popupOpen()) return; // a call or HELP pop-up is already showing
    const btns = (r.buttons || []).map((b, i) => ({ label: b.label, value: i, cls: b.cls }));
    const pick = await popup({ icon: '💬', title: alts[0], text: r.text + (r.source ? `\n\n📖 ${r.source}` : ''), say: r.text,
      buttons: [...btns, { label: t('close'), value: 'close' }] });
    if (typeof pick === 'number') r.buttons[pick].run();
  } }, h('span', { 'aria-hidden': 'true' }, '🎤'));
  return btn;
}

function applyScale() {
  document.documentElement.style.setProperty('--scale', store.scale || 1);
}

function topBar() {
  const online = navigator.onLine;
  return h('div', { class: 'topbar' },
    h('a', { class: 'brand', href: '#/home', 'aria-label': t('home') }, '★ ', t('app_name')),
    h('span', { class: 'net ' + (online ? 'on' : 'off'), title: online ? t('on_wifi') : t('offline'), role: 'img', 'aria-label': online ? t('on_wifi') : t('offline') }, online ? '📶' : '⚠️'),
    h('button', { class: 'chip', onclick: () => go('language'), 'aria-label': t('lang_title') }, '🌐 ', lang().nativeName),
    h('button', { class: 'chip', 'aria-label': t('text_size'), onclick: () => {
      const steps = [1, 1.2, 1.4];
      store.scale = steps[(steps.indexOf(store.scale || 1) + 1) % steps.length];
      save(); applyScale();
      toast(t('text_size') + ': ' + Math.round(store.scale * 100) + '%');
    } }, 'A', h('span', { class: 'aplus' }, 'A+')));
}

// Wi-Fi / mobile data: a web app cannot switch these on by itself, so Sitara
// tells the elder clearly and keeps reminders working offline.
window.addEventListener('offline', () => { speak(t('offline')); toast(t('offline')); route(); });
window.addEventListener('online', () => { speak(t('online_back')); toast(t('online_back')); route(); });
window.addEventListener('hashchange', route);
window.addEventListener('sitara:update', () => { if (['meds', 'day', 'home', 'food'].includes(currentName)) route(); });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Keep the "Add to home screen" prompt for the Family Setup screen.
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installPrompt = e; });

// A "set up from far away" link: #setup=…  (sent by family on WhatsApp)
async function openSetupLink() {
  const packed = location.hash.slice('#setup='.length);
  history.replaceState(null, '', location.pathname + '#/home');
  let data;
  try { data = await readSetupLink(packed); } catch (e) { popup({ icon: '⚠️', title: t('rs_bad') }); return; }
  const r = await popup({ icon: '📲', title: t('rs_load_q', { meds: data.meds.length, contacts: (data.contacts || []).length }),
    buttons: [{ label: '✅ ' + t('yes'), value: 'yes', cls: 'ok' }, { label: t('no'), value: 'no' }] });
  if (r !== 'yes') return;
  applySetup(data);
  save();
  setLang(store.lang || 'en');
  route();
  say(t('rs_loaded'));
  checkBackend(true);
}

const setupLink = location.hash.startsWith('#setup=');
if (setupLink && !store.lang) store.lang = 'en'; // show the question even on a brand-new phone
route();
if (setupLink) openSetupLink();
startReminders();
checkBackend().then(() => { if (store.lang) warmUp([t('thinking_say')]); }); // find out if smart AI and the natural voice are available
