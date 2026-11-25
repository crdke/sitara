// Small helpers for building screens, speaking, and big pop-up messages.
import { speak } from './voice.js';
import { t } from './i18n.js';
import { icon, iconFor, textWithIcons } from './icons.js';

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    if (kid instanceof Node) el.append(kid);
    else el.append(...textWithIcons(String(kid)));
  }
  return el;
}

export const go = (path) => { location.hash = '#/' + path; };

// Set an element's text (emoji become calm line icons).
export function setText(el, text) {
  el.replaceChildren(...textWithIcons(String(text || '')));
}

// A screen header with a big Back button and a title.
const iconEl = (name) => icon(name);
export function header(title, ico) {
  return h('header', { class: 'screen-head' },
    h('button', { class: 'back', onclick: () => history.length > 1 ? history.back() : go('home'), 'aria-label': t('back') }, iconEl('back'), t('back')),
    h('h1', {}, ico ? h('span', { class: 'ico', 'aria-hidden': 'true' }, ico) : null, title));
}

// A "speak this" button so any text can be read aloud.
export function speakBtn(text) {
  return h('button', { class: 'speak-btn', onclick: (e) => { e.stopPropagation(); speak(typeof text === 'function' ? text() : text); }, 'aria-label': 'Read aloud' }, '🔊');
}

let toastTimer;
export function toast(text) {
  const el = document.getElementById('toast');
  setText(el, text);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4000);
}

// Speak and show the sentence in the reply bubble (if on screen).
export function say(text) {
  speak(text);
  const bubble = document.getElementById('reply');
  if (bubble) { setText(bubble, text); bubble.hidden = false; }
  else toast(text);
}

// ---- Full-screen pop-ups (one at a time, others wait in a queue) ----
const queue = [];
let active = null;

export function popup(opts) {
  return new Promise((resolve) => {
    queue.push({ ...opts, resolve });
    if (!active) next();
  });
}

function next() {
  const box = document.getElementById('overlay');
  active = queue.shift();
  if (!active) { box.hidden = true; box.innerHTML = ''; return; }
  const o = active;
  let timer;
  const finish = (val) => {
    clearInterval(timer);
    o.resolve(val);
    next();
  };
  const countEl = h('p', { class: 'countdown' });
  box.innerHTML = '';
  box.append(h('div', { class: 'popup ' + (o.tone || ''), role: 'alertdialog', 'aria-live': 'assertive' },
    o.icon ? h('div', { class: 'popup-icon' }, icon(iconFor(o.icon) || 'bell')) : null,
    o.title ? h('h2', {}, o.title) : null,
    o.text ? h('p', { class: 'popup-text' }, o.text) : null,
    o.content || null,
    o.listen ? h('p', { class: 'popup-hint' }, '🎤 ', t('say_yes_no')) : null,
    o.countdown ? countEl : null,
    h('div', { class: 'popup-btns' }, (o.buttons || [{ label: t('close'), value: 'close' }]).map((b) =>
      h('button', { class: 'big-btn ' + (b.cls || ''), onclick: () => finish(b.value) }, b.label)))));
  box.hidden = false;
  const spoken = o.speak !== false ? speak(o.say || [o.title, o.text].filter(Boolean).join('. ')) : Promise.resolve();
  // Answer by voice: after the question is read out, listen for "yes" or "no".
  // o.listen = { yes: value, no: value }
  if (o.listen) {
    (async () => {
      await spoken;
      for (let tries = 0; tries < 2 && active === o; tries++) {
        const { listenForYesNo } = await import('./talk.js');
        const said = await listenForYesNo();
        if (active !== o) return;
        if (said && o.listen[said] !== undefined) { finish(o.listen[said]); return; }
        if (said === null && tries === 0) continue; // one more chance
        return;
      }
    })();
  }
  if (o.countdown) {
    let n = o.countdown.seconds;
    const tick = () => {
      countEl.textContent = o.countdown.label(n);
      if (n <= 0) finish('timeout');
      n -= 1;
    };
    tick();
    timer = setInterval(tick, 1000);
  }
}

export const popupOpen = () => !!active;

// Add children to a screen, skipping empty ones and flattening lists.
export function mount(el, ...kids) {
  el.append(...kids.flat(Infinity).filter((k) => k != null && k !== false));
}
