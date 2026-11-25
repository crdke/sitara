// My Day: one simple timeline of medicines, meals, doctor visits and events,
// plus water, and a list of what is already done today.
import { store, dosesToday, markTaken, logEvent, mealDone, waterToday, waterTarget, todayLog } from '../store.js';
import { t, n, fmtTime, hm } from '../i18n.js';
import { h, header, say, speakBtn, mount } from '../ui.js';
import { MEAL_TIMES } from '../data.js';
import { dayAnswer } from '../assistant.js';
import { route } from '../app.js';
import { todaysUpdate } from '../update.js';
import { shareWithFamily } from '../actions.js';

export default function day(main) {
  const now = new Date();
  const items = [];
  for (const d of dosesToday()) {
    items.push({ time: d.time, icon: '💊', title: `${d.med.name} — ${d.med.dose}`, sub: t('food_' + d.med.food), done: d.status === 'taken',
      late: d.status === 'missed', action: d.status === 'due' || d.status === 'missed' ? { label: '✅ ' + t('med_taken'), run: () => { markTaken(d); say(t('med_taken_ok')); route(); } } : null });
  }
  for (const meal of ['breakfast', 'lunch', 'dinner']) {
    const done = mealDone(meal);
    items.push({ time: MEAL_TIMES[meal], icon: '🍽️', title: t('Meal_' + meal), done: !!done,
      action: !done && hm(now) >= MEAL_TIMES[meal] ? { label: '✅ ' + t('ate_yes'), run: () => { logEvent('meal', { meal }); say(t('ate_ok', { meal: t('meal_' + meal) })); route(); } } : null });
  }
  const today = now.toDateString();
  for (const a of store.appointments) if (new Date(a.at).toDateString() === today) items.push({ time: hm(new Date(a.at)), icon: '🩺', title: a.doctor, sub: a.patient });
  for (const e of store.events) if (new Date(e.at).toDateString() === today) items.push({ time: hm(new Date(e.at)), icon: '📅', title: e.title });
  const ok = todayLog('okcheck').find((e) => e.ok);
  items.push({ time: store.settings.checkinTime || '09:00', icon: '🌅', title: t('ok_day'), done: !!ok,
    action: !ok ? { label: '👍 ' + t('ok_yes'), run: () => { logEvent('okcheck', { ok: true }); say(t('ok_thanks')); route(); } } : null });
  items.sort((a, b) => a.time.localeCompare(b.time));

  const water = waterToday();
  const target = waterTarget();

  // Things already done today ("Did I already…?")
  const done = todayLog().filter((e) => ['med', 'meal', 'water', 'call', 'music'].includes(e.type));
  const doneText = (e) => e.type === 'med' ? `💊 ${e.name}` : e.type === 'meal' ? `🍽️ ${e.dish ? n(e.dish) : t('Meal_' + e.meal)}`
    : e.type === 'water' ? `💧 ${t('water')}` : e.type === 'call' ? `📞 ${e.name}` : `🎵 ${e.title === 'tanpura' ? t('music_builtin') : e.title}`;

  mount(main, 
    header(t('day_title'), '🗓️'),
    h('div', { class: 'row-between' }, h('p', { class: 'lead' }, dayAnswer()), speakBtn(dayAnswer)),
    h('ol', { class: 'timeline' }, items.map((it) => h('li', { class: 'tl-item' + (it.done ? ' done' : '') + (it.late ? ' late' : '') },
      h('span', { class: 'tl-time' }, fmtTime(it.time)),
      h('span', { class: 'tl-ico', 'aria-hidden': 'true' }, it.done ? '✅' : it.icon),
      h('div', { class: 'tl-body' }, h('div', { class: 'tl-title' }, it.title), it.sub ? h('div', { class: 'tl-sub' }, it.sub) : null,
        it.action ? h('button', { class: 'big-btn ok small', onclick: it.action.run }, it.action.label) : null)))),

    h('section', { class: 'card water' },
      h('h2', {}, '💧 ', t('water')),
      h('div', { class: 'glasses', 'aria-label': t('water_glasses', { n: water, target }) },
        Array.from({ length: target }, (_, i) => h('span', { class: 'glass' + (i < water ? ' full' : '') }))),
      h('p', { class: 'lead' }, t('water_glasses', { n: water, target })),
      h('button', { class: 'big-btn ok', onclick: () => { logEvent('water'); say(t('water_added', { n: waterToday() })); route(); } }, '+ ', t('water_add'))),

    h('button', { class: 'big-btn', onclick: () => shareWithFamily(todaysUpdate()) }, '💌 ', t('day_send_update')),
    h('section', { class: 'card' },
      h('h2', {}, '✔️ ', t('done_today')),
      done.length ? h('ul', { class: 'done-list' }, done.map((e) => h('li', {}, h('span', { class: 'tl-time' }, fmtTime(new Date(e.at))), ' ', doneText(e))))
        : h('p', { class: 'empty' }, '—')),
  );
}
