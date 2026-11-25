// Kitchen: tap Full / Half / Low for each item. Low items make a shopping list.
import { store, save } from '../store.js';
import { t, n, list } from '../i18n.js';
import { h, header, say, speakBtn, mount } from '../ui.js';
import { PANTRY_ITEMS } from '../data.js';
import { lowItems } from '../food.js';
import { shareWithFamily } from '../actions.js';
import { route } from '../app.js';

export default function pantry(main) {
  const low = lowItems();
  const lowText = () => (low.length ? t('pantry_low_say', { items: list(low.map(n)) }) : t('pantry_all_ok'));
  mount(main, 
    header(t('pantry_title'), '🧺'),
    h('section', { class: 'card ' + (low.length ? 'warn' : '') },
      h('div', { class: 'row-between' }, h('h2', {}, low.length ? '⚠️ ' + t('pantry_low_list') : '✅ ' + t('pantry_all_ok')), speakBtn(lowText)),
      low.length ? h('div', { class: 'chips' }, low.map((k) => h('span', { class: 'chip-s no' }, n(k)))) : null,
      low.length ? h('button', { class: 'big-btn ok', onclick: () => shareWithFamily(t('shopping_msg', { name: store.profile.name, items: list(low.map(n)) })) }, '✉️ ', t('pantry_share')) : null),
    h('p', { class: 'lead' }, t('pantry_hint')),
    h('ul', { class: 'pantry-list' }, PANTRY_ITEMS.map((k) => {
      const lvl = store.pantry[k] || 'full';
      return h('li', { class: 'pantry-item lvl-' + lvl },
        h('span', { class: 'pantry-name' }, n(k)),
        h('div', { class: 'seg', role: 'group', 'aria-label': n(k) }, ['full', 'half', 'low'].map((v) => h('button', {
          class: 'seg-btn ' + v + (lvl === v ? ' on' : ''), 'aria-pressed': String(lvl === v),
          onclick: () => { store.pantry[k] = v; save(); if (v === 'low') say(`${n(k)}: ${t('level_low')}`); route(); },
        }, t('level_' + v)))));
    })),
  );
}
