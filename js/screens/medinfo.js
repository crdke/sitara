// Emergency medical info card — for a neighbour, doctor or ambulance crew who
// finds the elder alone. Big, plain, and opened automatically after HELP.
import { store, emergencyContact } from '../store.js';
import { t, n, fmtTime } from '../i18n.js';
import { h, header, mount, speakBtn } from '../ui.js';
import { dial } from '../actions.js';

export default function medinfo(main) {
  const p = store.profile;
  const none = t('mi_none');
  const c = emergencyContact();
  const doc = store.doctors[0];
  const row = (label, value, cls) => h('div', { class: 'mi-row ' + (cls || '') }, h('dt', {}, label), h('dd', {}, value || none));
  const conditions = p.conditions.map((k) => n('c_' + k)).join(', ');
  const meds = store.meds.map((m) => `${m.name} (${m.dose}, ${m.times.map(fmtTime).join(', ')})`);
  const spoken = () => [
    p.name, p.age && `${t('mi_age')} ${p.age}`, `${t('mi_blood')}: ${p.blood || none}`, `${t('mi_allergies')}: ${p.allergies || none}`,
    `${t('mi_conditions')}: ${conditions || none}`, `${t('mi_meds')}: ${store.meds.map((m) => m.name).join(', ') || none}`,
    c && `${t('mi_contact')}: ${c.name}`,
  ].filter(Boolean).join('. ');

  mount(main,
    header(t('mi_title'), '🆔'),
    h('p', { class: 'lead' }, t('mi_hint')),
    h('section', { class: 'card medinfo' },
      h('div', { class: 'mi-name' }, p.name || '—', p.age ? h('span', {}, ` · ${t('mi_age')} ${p.age}`) : null),
      h('dl', {},
        row(t('mi_blood'), p.blood, 'big'),
        row(t('mi_allergies'), p.allergies, p.allergies && !/^(none|no|nil|-)$/i.test(p.allergies) ? 'alert' : ''),
        row(t('mi_conditions'), conditions),
        row(t('mi_meds'), meds.length ? h('ul', {}, meds.map((m) => h('li', {}, m))) : null),
        row(t('mi_doctor'), doc ? `${doc.name} · ${doc.hospital || ''} · ${doc.phone || ''}` : null),
        row(t('mi_contact'), c ? `${c.name} (${n('r_' + c.relation)}) · ${c.phone || ''}` : null),
        row(t('mi_address'), p.address))),
    h('div', { class: 'btn-row' },
      c && c.phone ? h('button', { class: 'big-btn ok', onclick: () => dial(c.name, c.phone) }, '📞 ', c.name) : null,
      h('button', { class: 'big-btn', onclick: () => dial(t('sos_ambulance'), '108') }, '🚑 ', t('sos_ambulance'))),
    h('div', { class: 'row-center' }, speakBtn(spoken), h('span', {}, t('mi_say'))),
  );
}
