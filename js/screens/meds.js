// Medicines: today's doses with clear status, and the full medicine list.
import { store, dosesToday, markTaken, nextDose } from '../store.js';
import { t, n, fmtTime } from '../i18n.js';
import { h, header, say, speakBtn, mount } from '../ui.js';
import { understand } from '../assistant.js';
import { medAlert } from '../reminders.js';
import { route } from '../app.js';
import { go, popup } from '../ui.js';
import { loadPhoto } from './addmed.js';

const BADGE = { taken: '✅', due: '🔔', later: '⏳', missed: '⚠️' };

export default function meds(main) {
  const doses = dosesToday();
  const summary = () => understand(['medicine'])?.text || '';

  mount(main, 
    header(t('meds_title'), '💊'),
    h('button', { class: 'big-btn ok', onclick: () => go('addmed') }, '➕ ', t('tile_addmed')),
    h('div', { class: 'row-between' }, h('h2', { class: 'section-title' }, t('med_today')), speakBtn(summary)),
    doses.length ? h('ul', { class: 'dose-list' }, doses.map((d) => h('li', { class: 'dose ' + d.status },
      h('div', { class: 'dose-time' }, fmtTime(d.time)),
      h('div', { class: 'dose-main' },
        h('div', { class: 'med-name' }, d.med.name),
        h('div', { class: 'med-detail' }, `${d.med.dose} · ${t('food_' + d.med.food)}`),
        h('div', { class: 'med-purpose' }, t('med_for', { purpose: n('p_' + d.med.purpose) })),
        h('div', { class: 'badge ' + d.status }, BADGE[d.status] + ' ' + t('status_' + d.status) + (d.takenAt ? ' · ' + fmtTime(d.takenAt) : ''))),
      d.status === 'due' || d.status === 'missed'
        ? h('button', { class: 'big-btn ok', onclick: () => { markTaken(d); say(t('med_taken_ok')); route(); } }, '✅ ' + t('med_taken'))
        : null)))
      : h('p', { class: 'empty' }, t('med_none_today')),

    h('h2', { class: 'section-title' }, t('fs_meds')),
    h('div', { class: 'med-cards' }, store.meds.map((m) => h('div', { class: 'card med-card' },
      h('div', { class: 'med-name' }, m.name),
      h('div', { class: 'med-detail' }, `${m.dose} · ${m.times.map(fmtTime).join(', ')}`),
      h('div', { class: 'med-purpose' }, t('med_for', { purpose: n('p_' + m.purpose) }) + ' · ' + t('food_' + m.food)),
      typeof m.stock === 'number' ? h('div', { class: 'stock ' + (m.stock <= 7 ? 'low' : '') },
        (m.stock <= 7 ? '⚠️ ' : '📦 ') + t('med_stock', { n: m.stock })) : null,
      m.photoId && loadPhoto(m.photoId) ? h('button', { class: 'big-btn small ghost', onclick: () => popup({ icon: '📄', title: t('am_photo_saved'), speak: false,
        content: h('img', { src: loadPhoto(m.photoId), class: 'rx-preview', alt: t('am_photo_saved') }) }) }, '📄 ', t('am_photo_saved')) : null))),

    nextDose() ? h('button', { class: 'big-btn ghost', onclick: () => medAlert(nextDose()) }, '🔔 Demo: ', t('med_time_title')) : null,
  );
}
