// Call family: big photo-style cards. Help, ambulance and location below.
import { store } from '../store.js';
import { t, n } from '../i18n.js';
import { h, header, say, mount } from '../ui.js';
import * as voice from '../voice.js';
import { callPerson, startSOS, dial, sendLocation } from '../actions.js';
import { findContact } from '../assistant.js';
import { hearQuestion } from './common.js';

const COLORS = ['#1d4e89', '#1b7f3b', '#8a3ffc', '#b45309', '#0f766e', '#be185d'];

export default function call(main) {
  const status = h('p', { class: 'mic-status' });
  const mic = h('button', { class: 'mic small', 'aria-label': t('call_who'), onclick: async () => {
    const alts = await hearQuestion(mic, status);
    if (!alts) return;
    const c = findContact(alts.join(' ').toLowerCase());
    if (c) callPerson(c); else say(t('call_not_found', { name: alts[0] }));
  } }, '🎤');

  mount(main, 
    header(t('call_title'), '📞'),
    h('div', { class: 'row-center' }, mic, h('p', { class: 'lead' }, t('call_who'))), status,
    h('div', { class: 'contacts' }, store.contacts.map((c, i) => h('button', { class: 'contact', onclick: () => callPerson(c) },
      h('span', { class: 'avatar', style: `background:${COLORS[i % COLORS.length]}`, 'aria-hidden': 'true' }, c.name.trim()[0] || '?'),
      h('span', { class: 'contact-text' },
        h('span', { class: 'contact-name' }, c.name, c.emergency ? ' ⭐' : ''),
        h('span', { class: 'contact-rel' }, n('r_' + c.relation))),
      h('span', { class: 'phone-ico', 'aria-hidden': 'true' }, '📞')))),
    h('div', { class: 'help-row' },
      h('button', { class: 'big-btn danger', onclick: startSOS }, '🆘 ', t('tile_sos')),
      h('button', { class: 'big-btn', onclick: () => dial(t('sos_ambulance'), '108') }, '🚑 ', t('sos_ambulance')),
      h('button', { class: 'big-btn', onclick: sendLocation }, '📍 ', t('sos_location'))),
  );
  speakSoon(t('call_who'));
}

function speakSoon(text) { setTimeout(() => voice.speak(text), 300); }
