// Food & diet: a menu made for the elder's health and kitchen, nutrition
// check, and simple "eat more / eat less / be careful" advice.
import { store, save, logEvent } from '../store.js';
import { t, n, list, ymd } from '../i18n.js';
import { h, header, say, speakBtn, mount } from '../ui.js';
import { CONDITIONS } from '../data.js';
import { menuForToday, nutritionToday } from '../food.js';
import { route } from '../app.js';

export default function food(main) {
  const menu = menuForToday();
  const nut = nutritionToday();
  const conds = store.profile.conditions;
  const menuText = () => ['breakfast', 'lunch', 'snack', 'dinner'].filter((s) => menu[s])
    .map((s) => t('menu_say', { meal: t('meal_' + s), dish: n(menu[s].id) })).join(' ');

  let nutText;
  if (!nut.eaten.length) nutText = t('nutrients_none');
  else if (!nut.missing.length) nutText = t('nutrients_ok');
  else nutText = nut.missing.map((m) => t('nutrient_need', { nutrient: n('n_' + m), food: list(nut.suggestions[m].map(n)) })).join(' ');

  mount(main, 
    header(t('food_title'), '🍲'),
    h('div', { class: 'row-between' }, h('h2', { class: 'section-title' }, t('menu_today')), speakBtn(menuText)),
    h('div', { class: 'menu' }, ['breakfast', 'lunch', 'snack', 'dinner'].map((slot) => {
      const dish = menu[slot];
      const ate = store.log.some((e) => e.type === 'meal' && e.date === ymd() && e.meal === slot && e.dish);
      return h('div', { class: 'card menu-item' },
        h('div', { class: 'label' }, t('Meal_' + slot)),
        h('div', { class: 'dish' }, dish ? n(dish.id) : t('no_ingredients')),
        dish ? h('div', { class: 'chips' }, dish.nutrients.map((x) => h('span', { class: 'chip-s' }, n('n_' + x)))) : null,
        dish && !ate ? h('button', { class: 'big-btn ok small', onclick: () => { logEvent('meal', { meal: slot, dish: dish.id }); say(t('ate_ok', { meal: t('meal_' + slot) })); route(); } }, '✅ ' + t('i_ate_this')) : null,
        ate ? h('div', { class: 'badge taken' }, '✅ ' + t('status_taken')) : null);
    })),
    h('button', { class: 'big-btn ghost', onclick: () => { store.menuShift = (store.menuShift || 0) + 1; save(); route(); } }, '🔄 ', t('menu_change')),

    h('section', { class: 'card nutrition' },
      h('div', { class: 'row-between' }, h('h2', {}, '🥗 ', t('nutrients_today')), speakBtn(nutText)),
      h('div', { class: 'chips' }, ['protein', 'fiber', 'calcium', 'iron', 'vitamins'].map((x) => h('span', { class: 'chip-s ' + (nut.got.includes(x) ? 'yes' : 'no') }, (nut.got.includes(x) ? '✓ ' : '○ ') + n('n_' + x)))),
      h('p', { class: 'lead' }, nutText)),

    ...(conds.length ? conds : [null]).map((c) => {
      if (!c) return h('section', { class: 'card advice' }, h('h3', {}, '👍 ', t('good_tip')), h('p', {}, n('tip_general')));
      const d = CONDITIONS[c];
      const said = () => `${n('c_' + c)}. ${t('eat_more')}: ${list(d.more.map(n))}. ${t('eat_less')}: ${list(d.less.map(n))}. ${n('tip_' + c)} ${n('risk_' + c)}`;
      return h('section', { class: 'card advice' },
        h('div', { class: 'row-between' }, h('h2', {}, n('c_' + c)), speakBtn(said)),
        h('h3', { class: 'more' }, '⬆️ ', t('eat_more')), h('div', { class: 'chips' }, d.more.map((k) => h('span', { class: 'chip-s yes' }, n(k)))),
        h('h3', { class: 'less' }, '⬇️ ', t('eat_less')), h('div', { class: 'chips' }, d.less.map((k) => h('span', { class: 'chip-s no' }, n(k)))),
        h('h3', {}, '👍 ', t('good_tip')), h('p', {}, n('tip_' + c)),
        h('h3', { class: 'less' }, '⚠️ ', t('be_careful')), h('p', {}, n('risk_' + c)));
    }),
    h('p', { class: 'disclaimer' }, t('diet_disclaimer')),
  );
}
