// Home: greeting, clock, next medicine, the big microphone, and big buttons.
import { store, nextDose, markTaken } from '../store.js';
import { t, n, list, fmtTime, fmtDate } from '../i18n.js';
import { h, go, say, popupOpen, mount, setText, header } from '../ui.js';
import { icon } from '../icons.js';
import * as voice from '../voice.js';
import { understand, ask } from '../assistant.js';
import { hearQuestion } from './common.js';
import { startSOS, shareWithFamily } from '../actions.js';
import { lowItems } from '../food.js';
import { route } from '../app.js';

let last = null; // last conversation, kept when the screen redraws

export const TILES = {
  meds: { icon: '💊', key: 'tile_meds', cls: '' },
  call: { icon: '📞', key: 'tile_call', cls: '' },
  day: { icon: '🗓️', key: 'tile_day', cls: '' },
  sos: { icon: '🆘', key: 'tile_sos', cls: 't-red' },
  food: { icon: '🍲', key: 'tile_food', cls: 't-plain' },
  pantry: { icon: '🧺', key: 'tile_pantry', cls: 't-plain' },
  doctor: { icon: '🩺', key: 'tile_doctor', cls: 't-plain' },
  calendar: { icon: '📅', key: 'tile_calendar', cls: 't-plain' },
  music: { icon: '🎵', key: 'tile_music', cls: 't-plain' },
  camera: { icon: '📷', key: 'tile_camera', cls: 't-plain' },
  addmed: { icon: '➕', key: 'tile_addmed', cls: 't-plain' },
  medinfo: { icon: '🆔', key: 'tile_medinfo', cls: 't-plain' },
};

export function tile(name) {
  const d = TILES[name];
  return h('button', { class: 'tile ' + d.cls, onclick: () => (name === 'sos' ? startSOS() : go(name)) },
    h('span', { class: 'tile-ico', 'aria-hidden': 'true' }, d.icon), h('span', { class: 'tile-label' }, t(d.key)));
}

// "More": everything else, as one calm list instead of a wall of buttons.
export const MORE = ['addmed', 'medinfo', 'food', 'pantry', 'doctor', 'calendar', 'music', 'camera'];
export function more(main) {
  mount(main,
    header(t('more')),
    h('ul', { class: 'list' }, MORE.map((name) => h('li', {},
      h('button', { class: 'row-link', onclick: () => go(name) },
        h('span', { class: 'row-ico' }, TILES[name].icon),
        h('span', { class: 'row-text' }, t(TILES[name].key)),
        h('span', { class: 'row-go' }, icon('chevron')))))));
}

function greeting() {
  const hr = new Date().getHours();
  const g = hr < 12 ? 'greet_morning' : hr < 17 ? 'greet_afternoon' : 'greet_evening';
  return t(g) + (store.profile.name ? ', ' + store.profile.name : '');
}

export default function home(main) {
  const clock = h('div', { class: 'clock' });
  const dateEl = h('div', { class: 'date' });
  const tickClock = () => { clock.textContent = fmtTime(new Date()); dateEl.textContent = fmtDate(new Date(), { weekday: 'short', day: 'numeric', month: 'short' }); };
  tickClock();
  const clockTimer = setInterval(tickClock, 15000);

  // Next medicine card
  const nx = nextDose();
  const medCard = nx ? h('section', { class: 'card next-med ' + (nx.status === 'due' ? 'due' : '') },
    h('div', { class: 'card-row' },
      h('span', { class: 'big-ico', 'aria-hidden': 'true' }, '💊'),
      h('div', {},
        h('div', { class: 'label' }, nx.status === 'due' ? t('status_due') : t('med_next')),
        h('div', { class: 'med-name' }, nx.med.name),
        h('div', { class: 'med-detail' }, `${nx.med.dose} · ${fmtTime(nx.time)} · ${t('food_' + nx.med.food)}`))),
    nx.status === 'due' ? h('button', { class: 'big-btn ok', onclick: () => { markTaken(nx); last = { text: t('med_taken_ok') }; say(t('med_taken_ok')); route(); } }, '✅ ' + t('med_taken')) : null)
    : null;

  // One quiet note for everything running low (medicines and kitchen),
  // with a single button to send the shopping list to family.
  const lowMeds = store.meds.filter((m) => typeof m.stock === 'number' && m.stock <= 7).map((m) => m.name);
  const lowAll = [...lowMeds, ...lowItems().map(n)];
  const notices = lowAll.length ? [h('section', { class: 'card warn notice' },
    h('p', {}, '⚠️ ', t('pantry_low_say', { items: list(lowAll) })),
    h('button', { class: 'big-btn small', onclick: () => shareWithFamily(t('shopping_msg', { name: store.profile.name, items: list(lowAll) })) }, '✉️ ', t('pantry_share')))] : [];


  // ---- Talking with Sitara ----
  // One big circle. Tap once and talk; Sitara answers out loud and then keeps
  // listening for a follow-up, like a conversation. Tap again any time to stop.
  const youSaid = h('p', { class: 'you-said', hidden: !(last && last.heard) }, last && last.heard ? `${t('you_said')}: “${last.heard}”` : '');
  const reply = h('p', { id: 'reply', class: 'reply', 'aria-live': 'polite', hidden: !last }, last ? last.text : '');
  const actions = h('div', { class: 'reply-actions' });
  const source = h('p', { class: 'source', hidden: !(last && last.source) }, last && last.source ? '📖 ' + last.source : '');
  const status = h('p', { class: 'orb-status', 'aria-live': 'polite' }, t('tap_speak'));
  // Under the circle: a small note when idle, and "please wait" with moving dots while working.
  const hint = h('p', { class: 'orb-hint' }, t('reply_hint'));
  const wait = h('p', { class: 'orb-wait', hidden: true }, t('please_wait'), h('span', { class: 'dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')));
  const orbIcon = h('span', { class: 'orb-icon', 'aria-hidden': 'true' }, icon('mic'));
  const orb = h('button', { class: 'orb', 'data-state': 'idle', 'aria-label': t('tap_speak'), onclick: () => (state === 'idle' ? converse() : stop()) }, orbIcon);

  let state = 'idle';
  let session = 0;
  const STATES = { idle: ['tap_speak', 'mic'], listening: ['listening', 'mic'], thinking: ['thinking', 'spark'], speaking: ['speaking', 'speaker'] };
  function setState(st) {
    state = st;
    orb.dataset.state = st;
    status.textContent = t(STATES[st][0]);
    orbIcon.replaceChildren(icon(STATES[st][1]));
    hint.hidden = st !== 'idle';
    wait.hidden = st !== 'thinking';
  }
  // The person stopped talking and the words are being written down: show "working".
  const onHeard = () => { if (state === 'listening') setState('thinking'); };
  window.addEventListener('sitara:heard', onHeard);
  function stop() {
    session++;
    voice.stopListening(); voice.stopSpeaking();
    setState('idle');
  }

  const showButtons = (btns) => {
    actions.innerHTML = '';
    (btns || []).forEach((b) => actions.append(h('button', { class: 'big-btn ' + (b.cls || ''), onclick: () => { stop(); b.run(); } }, b.label)));
  };
  if (last && last.buttons) showButtons(last.buttons);

  // Work out the answer. Sitara's own answers are instant; questions that go
  // to the AI or Wikipedia get a short "let me see…" so there is no silence.
  async function answer(alts) {
    let r = understand(alts);
    if (!r) {
      setState('thinking');
      voice.speak(t('thinking_say'));
      r = await ask(alts);
    }
    if (!r) {
      r = { text: t('not_understood'), buttons: ['meds', 'call', 'sos'].map((k) => ({ label: TILES[k].icon + ' ' + t(TILES[k].key), cls: k === 'sos' ? 'danger' : '', run: () => (k === 'sos' ? startSOS() : go(k)) })) };
    }
    return r;
  }

  async function converse(typed) {
    const my = ++session;
    let followUp = false;
    let alts = typed || null;
    while (my === session) {
      if (!alts) {
        setState('listening');
        alts = await hearQuestion(orb, null, { quiet: followUp });
        if (my !== session) return;
        if (!alts) break; // nothing said (after a follow-up: just stop quietly)
      }
      const heard = alts[0];
      setState('thinking');
      youSaid.textContent = `${t('you_said')}: “${heard}”`; youSaid.hidden = false;
      reply.hidden = true; source.hidden = true; showButtons([]); // no stale answer while waiting
      const r = await answer(alts);
      if (my !== session) return;
      last = { heard, text: r.text, buttons: r.buttons, source: r.source };
      if (r.rerender) { route(); say(r.text); return; }
      setText(reply, r.text); reply.hidden = false;
      if (r.source) { setText(source, '📖 ' + r.source); source.hidden = false; }
      showButtons(r.buttons);
      if (popupOpen()) break; // HELP or a call took over
      // Stay on "working" while the voice is fetched; switch to "speaking" only when it can be heard.
      await voice.speak(r.text, { onStart: () => { if (my === session) setState('speaking'); } });
      if (my !== session) return;
      if (r.go) { setTimeout(() => go(r.go), 400); break; }
      if (r.buttons && r.buttons.length) break; // a choice to make on screen
      followUp = true; alts = null; // keep the conversation going
    }
    if (my === session) setState('idle');
  }

  // Typing is still there for anyone who prefers it.
  const input = h('input', { type: 'text', class: 'ask-input', placeholder: t('type_instead'), 'aria-label': t('type_instead'), enterkeyhint: 'send' });
  const form = h('form', { class: 'ask-row', hidden: true, onsubmit: (e) => { e.preventDefault(); const q = input.value.trim(); if (q) { input.value = ''; input.blur(); stop(); converse([q]); } } },
    input, h('button', { class: 'ask-btn', type: 'submit' }, t('ask')));

  // Family setup: hold for 2 seconds so the elder does not open it by mistake.
  let holdTimer;
  const holdBtn = h('button', { class: 'hold-btn', 'aria-label': t('family_setup'),
    onpointerdown: () => { holdBtn.classList.add('holding'); holdTimer = setTimeout(() => go('family'), 2000); },
    onpointerup: () => { holdBtn.classList.remove('holding'); clearTimeout(holdTimer); },
    onpointerleave: () => { holdBtn.classList.remove('holding'); clearTimeout(holdTimer); },
    onkeydown: (e) => { if (e.key === 'Enter') go('family'); },
  }, '⚙️ ', t('family_setup'), h('small', {}, ' — ' + t('hold_to_open')), h('span', { class: 'hold-fill' }));

  mount(main, ...[
    h('section', { class: 'hello' }, h('div', {}, h('h1', {}, greeting()), dateEl), clock),
    h('section', { class: 'talk' }, orb, status, hint, wait, youSaid, reply, source, actions),
    medCard,
    h('nav', { class: 'tiles main-tiles' }, ['meds', 'call', 'day', 'sos'].map(tile)),
    h('div', { class: 'center' }, h('button', { class: 'type-toggle', onclick: (e) => { form.hidden = false; e.currentTarget.hidden = true; form.scrollIntoView({ block: 'center' }); input.focus(); } }, icon('keyboard'), t('type_instead')), form),
    ...notices,
    store.settings.simple ? null : h('ul', { class: 'list' }, h('li', {},
      h('button', { class: 'row-link', onclick: () => go('more') },
        h('span', { class: 'row-ico' }, icon('more')), h('span', { class: 'row-text' }, t('more')), h('span', { class: 'row-go' }, icon('chevron'))))),
    holdBtn,
  ].filter(Boolean));
  return () => { clearInterval(clockTimer); window.removeEventListener('sitara:heard', onHeard); if (state !== 'idle') stop(); };
}
