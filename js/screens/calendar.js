// Calendar: upcoming events with reminders in advance.
import { store, save, newId } from '../store.js';
import { t, fmtWhen, ymd } from '../i18n.js';
import { h, header, say, speakBtn, mount } from '../ui.js';
import { voiceInput, choiceGrid } from './common.js';
import { route } from '../app.js';

export default function calendar(main) {
  const all = [
    ...store.events.map((e) => ({ ...e, icon: '📅', kind: 'event' })),
    ...store.appointments.map((a) => ({ id: a.id, title: `${a.doctor} (${a.patient})`, at: a.at, icon: '🩺', kind: 'appt' })),
  ].filter((e) => new Date(e.at) > Date.now() - 3600000).sort((a, b) => new Date(a.at) - new Date(b.at));
  const listText = () => (all.length ? all.slice(0, 3).map((e) => t('event_next', { title: e.title, when: fmtWhen(new Date(e.at)) })).join(' ') : t('cal_none'));

  const vi = voiceInput({ placeholder: t('cal_what') });
  const date = h('input', { type: 'date', class: 'field', min: ymd(), value: ymd() });
  const time = h('input', { type: 'time', class: 'field', value: '10:00' });
  let remind = 1;
  const remindGrid = () => choiceGrid([0, 1, 2, 7].map((d) => ({ label: t('remind_' + d), value: d, selected: d === remind })), (v) => { remind = v; grid.replaceWith(grid = remindGrid()); });
  let grid = remindGrid();

  mount(main, 
    header(t('cal_title'), '📅'),
    h('div', { class: 'row-between' }, h('h2', { class: 'section-title' }, t('cal_upcoming')), speakBtn(listText)),
    all.length ? h('ul', { class: 'event-list' }, all.map((e) => h('li', { class: 'card event' },
      h('span', { class: 'big-ico', 'aria-hidden': 'true' }, e.icon),
      h('div', {}, h('div', { class: 'med-name' }, e.title), h('div', { class: 'label' }, fmtWhen(new Date(e.at))),
        e.kind === 'event' && e.remindDays ? h('div', { class: 'med-detail' }, '🔔 ' + t('remind_' + e.remindDays)) : null),
      e.kind === 'event' ? h('button', { class: 'icon-btn', 'aria-label': t('remove'), onclick: () => { store.events = store.events.filter((x) => x.id !== e.id); save(); route(); } }, '🗑') : null)))
      : h('p', { class: 'empty' }, t('cal_none')),

    h('section', { class: 'card form' },
      h('h2', {}, '➕ ', t('cal_add')),
      h('label', {}, t('cal_what')), vi.el,
      h('div', { class: 'two' }, h('div', {}, h('label', {}, t('cal_date')), date), h('div', {}, h('label', {}, t('cal_time')), time)),
      h('label', {}, t('cal_remind')), grid,
      h('button', { class: 'big-btn ok', onclick: () => {
        const title = vi.input.value.trim();
        if (!title || !date.value) { vi.input.focus(); return; }
        const at = new Date(`${date.value}T${time.value || '10:00'}:00`);
        store.events.push({ id: newId(), title, at: at.toISOString(), remindDays: remind });
        save();
        say(t('event_next', { title, when: fmtWhen(at) }));
        route();
      } }, '✅ ', t('save'))),
  );
}
