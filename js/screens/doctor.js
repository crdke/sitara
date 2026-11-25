// Doctor appointments: list, and a step-by-step booking helper.
import { store, save, newId } from '../store.js';
import { t, fmtWhen, fmtDate, fmtTime, ymd } from '../i18n.js';
import { h, header, go, say, mount } from '../ui.js';
import { voiceInput, choiceGrid } from './common.js';
import { dial, shareWithFamily } from '../actions.js';
import { route } from '../app.js';

export function doctor(main) {
  const upcoming = store.appointments.filter((a) => new Date(a.at) > Date.now() - 3600000).sort((a, b) => new Date(a.at) - new Date(b.at));
  mount(main, 
    header(t('appt_title'), '🩺'),
    h('button', { class: 'big-btn ok', onclick: () => go('book') }, '➕ ', t('appt_book')),
    upcoming.length ? h('div', {}, upcoming.map((a) => h('section', { class: 'card appt' },
      h('div', { class: 'label' }, fmtWhen(new Date(a.at))),
      h('div', { class: 'med-name' }, a.doctor),
      h('div', { class: 'med-detail' }, '👤 ' + a.patient),
      h('div', { class: 'btn-row' },
        a.phone ? h('button', { class: 'big-btn small', onclick: () => dial(a.doctor, a.phone) }, '📞 ', t('appt_call_clinic')) : null,
        h('button', { class: 'big-btn small ghost', onclick: () => { store.appointments = store.appointments.filter((x) => x !== a); save(); route(); } }, '🗑 ', t('remove'))))))
      : h('p', { class: 'empty' }, t('appt_none')),
  );
}

// Booking in 4 easy steps: who → which doctor → which day → what time.
export function book(main) {
  const s = { patient: store.profile.name, doctor: null, phone: '', day: null, time: null };
  const body = h('div');
  mount(main, header(t('appt_book'), '🩺'), body);

  const step = (n, title, content, next) => {
    body.innerHTML = '';
    body.append(h('p', { class: 'step' }, `${n} / 5`), h('h2', { class: 'q' }, title), content, next || '');
    say(title);
  };

  const askPatient = () => {
    const vi = voiceInput({ placeholder: t('type_or_speak') });
    step(1, t('appt_patient'), h('div', {},
      store.profile.name ? h('button', { class: 'big-btn ok', onclick: () => { s.patient = store.profile.name; askDoctor(); } }, '👤 ', store.profile.name) : null,
      h('p', { class: 'lead' }, t('appt_someone_else') + ':'), vi.el,
      h('button', { class: 'big-btn', onclick: () => { if (vi.input.value.trim()) { s.patient = vi.input.value.trim(); askDoctor(); } } }, t('next'), ' ›')));
  };

  const askDoctor = () => {
    const vi = voiceInput({ placeholder: t('fs_doctor_name') });
    step(2, t('appt_doctor'), h('div', {},
      h('div', { class: 'doc-list' }, store.doctors.map((d) => h('button', { class: 'contact', onclick: () => { s.doctor = d.name; s.phone = d.phone; askDay(); } },
        h('span', { class: 'avatar', style: 'background:#0f766e' }, '🩺'),
        h('span', { class: 'contact-text' }, h('span', { class: 'contact-name' }, d.name), h('span', { class: 'contact-rel' }, `${d.speciality || ''} · ${d.hospital || ''}`))))),
      h('p', { class: 'lead' }, t('appt_other_doctor') + ':'), vi.el,
      h('button', { class: 'big-btn', onclick: () => { if (vi.input.value.trim()) { s.doctor = vi.input.value.trim(); askDay(); } } }, t('next'), ' ›')));
  };

  const askDay = () => {
    const d = (k) => { const x = new Date(); x.setDate(x.getDate() + k); return ymd(x); };
    const picker = h('input', { type: 'date', class: 'field', min: ymd() });
    step(3, t('appt_day'), h('div', {},
      choiceGrid([{ label: t('today'), value: d(0) }, { label: t('tomorrow'), value: d(1) }, { label: t('day_after'), value: d(2) }], (v) => { s.day = v; askTime(); }),
      h('p', { class: 'lead' }, t('pick_date') + ':'), picker,
      h('button', { class: 'big-btn', onclick: () => { if (picker.value) { s.day = picker.value; askTime(); } } }, t('next'), ' ›')));
  };

  const askTime = () => {
    const picker = h('input', { type: 'time', class: 'field' });
    const opts = ['09:00', '10:30', '12:00', '16:00', '17:30', '19:00'].map((v) => ({ label: fmtTime(v), value: v }));
    step(4, t('appt_time'), h('div', {}, choiceGrid(opts, (v) => { s.time = v; confirm(); }), picker,
      h('button', { class: 'big-btn', onclick: () => { if (picker.value) { s.time = picker.value; confirm(); } } }, t('next'), ' ›')));
  };

  const confirm = () => {
    const at = new Date(`${s.day}T${s.time}:00`);
    step(5, t('appt_confirm'), h('section', { class: 'card appt' },
      h('div', { class: 'label' }, fmtWhen(at)), h('div', { class: 'med-name' }, s.doctor), h('div', { class: 'med-detail' }, '👤 ' + s.patient),
      h('div', { class: 'med-detail' }, fmtDate(at))),
    h('div', {}, h('button', { class: 'big-btn ok', onclick: () => {
      store.appointments.push({ id: newId(), patient: s.patient, doctor: s.doctor, phone: s.phone, at: at.toISOString() });
      save();
      const when = fmtWhen(at);
      body.innerHTML = '';
      body.append(h('div', { class: 'big-done' }, '✅'), h('p', { class: 'lead center' }, t('appt_booked', { patient: s.patient, doctor: s.doctor, when })),
        s.phone ? h('button', { class: 'big-btn', onclick: () => dial(s.doctor, s.phone) }, '📞 ', t('appt_call_clinic')) : null,
        h('button', { class: 'big-btn', onclick: () => shareWithFamily(t('appt_msg', { patient: s.patient, doctor: s.doctor, when })) }, '✉️ ', t('appt_share')),
        h('button', { class: 'big-btn ghost', onclick: () => go('doctor') }, t('done')));
      say(t('appt_booked', { patient: s.patient, doctor: s.doctor, when }));
    } }, '✅ ', t('appt_book_now')), h('button', { class: 'big-btn ghost', onclick: askPatient }, '↺ ', t('back'))));
  };

  askPatient();
}
