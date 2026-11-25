// The reminder engine. Every 20 seconds it checks: medicines, doctor
// appointments, calendar events, low medicine stock, kitchen and meals.
import { store, save, dosesToday, markTaken, todayLog, logEvent } from './store.js';
import { t, n, fmtTime, fmtWhen, list, ymd } from './i18n.js';
import { popup, popupOpen, say } from './ui.js';
import { chime, speak } from './voice.js';
import { checkIn, callPerson, shareWithFamily } from './actions.js';
import { emergencyContact } from './store.js';
import { todaysUpdate } from './update.js';
import { hm } from './i18n.js';
import { lowItems } from './food.js';

const MIN = 60000;
const isFired = (k) => !!store.fired[k];
const fire = (k) => { store.fired[k] = Date.now(); save(); };

export function startReminders() {
  // forget old reminder marks (older than 3 days)
  const old = Date.now() - 3 * 24 * 60 * MIN;
  for (const [k, v] of Object.entries(store.fired)) if (v < old) delete store.fired[k];
  setTimeout(tick, 1500);
  setInterval(tick, 20000);
}

// Also shows a phone notification if Sitara is in the background.
async function notify(title, body) {
  if (!document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) reg.showNotification(title, { body, icon: 'icons/icon-192.png', tag: title, renotify: true, requireInteraction: true, vibrate: [300, 150, 300] });
    else new Notification(title, { body });
  } catch (e) { /* ignore */ }
}

export async function medAlert(d) {
  const text = t('med_take_say', { name: d.med.name, dose: d.med.dose, food: t('food_' + d.med.food) });
  chime();
  notify(t('med_time_title'), text);
  const res = await popup({
    icon: '💊', title: t('med_time_title'), text,
    buttons: [{ label: '✅ ' + t('med_taken'), value: 'taken', cls: 'ok' }, { label: '⏰ ' + t('med_snooze'), value: 'snooze' }],
    say: text + ' ' + t('med_ask_taken'),
    listen: { yes: 'taken', no: 'snooze' },
  });
  if (res === 'taken') { markTaken(d); say(t('med_taken_ok')); }
  else { store.snooze[d.key] = Date.now() + 10 * MIN; save(); speak(t('med_snoozed')); }
  window.dispatchEvent(new Event('sitara:update'));
}

async function simpleAlert(key, icon, title, text, buttons) {
  fire(key);
  chime();
  notify(title, text);
  return popup({ icon, title, text, buttons });
}

async function tick() {
  if (popupOpen() || !store.lang) return;
  const now = new Date();
  const ms = now.getTime();

  // 1. Medicines
  for (const d of dosesToday(now)) {
    if (d.status === 'taken') continue;
    const late = ms - d.due.getTime();
    const snoozed = store.snooze[d.key];
    if (late >= 0 && late < 30 * MIN) {
      if (!isFired(d.key) || (snoozed && ms >= snoozed)) {
        delete store.snooze[d.key];
        fire(d.key);
        return medAlert(d);
      }
    } else if (late >= 30 * MIN && late < 90 * MIN && isFired(d.key) && !isFired(d.key + '|esc')) {
      // Missed and no answer: check on the elder; if no reply, family is called.
      fire(d.key + '|esc');
      notify(t('check_ok_q'), t('med_missed_q', { name: d.med.name }));
      return checkIn(t('med_missed_q', { name: d.med.name }));
    }
  }

  // 2. Doctor appointments: 1 day before and 2 hours before
  for (const a of store.appointments) {
    const at = new Date(a.at).getTime();
    for (const [tag, before] of [['day', 24 * 60 * MIN], ['hrs', 120 * MIN]]) {
      const key = `appt|${a.id}|${tag}`;
      if (ms >= at - before && ms < at && !isFired(key)) {
        if (ms >= at - 120 * MIN) { fire(`appt|${a.id}|day`); fire(`appt|${a.id}|hrs`); }
        const text = t('appt_reminder', { patient: a.patient, doctor: a.doctor, when: fmtWhen(new Date(a.at)) });
        return simpleAlert(key, '🩺', t('tile_doctor'), text);
      }
    }
  }

  // 3. Calendar events: some days before (from 9 am), and on the day (from 8 am)
  for (const e of store.events) {
    const at = new Date(e.at);
    if (at.getTime() < ms) continue;
    const pre = new Date(at); pre.setDate(pre.getDate() - (e.remindDays || 0)); pre.setHours(9, 0, 0, 0);
    const onDay = new Date(at); onDay.setHours(8, 0, 0, 0);
    const text = t('event_reminder', { title: e.title, when: fmtWhen(at) });
    if (e.remindDays > 0 && ms >= pre.getTime() && ms < onDay.getTime() && !isFired(`ev|${e.id}|pre`)) return simpleAlert(`ev|${e.id}|pre`, '📅', t('tile_calendar'), text);
    if (ms >= Math.min(onDay.getTime(), at.getTime() - 60 * MIN) && !isFired(`ev|${e.id}|day`)) return simpleAlert(`ev|${e.id}|day`, '📅', t('tile_calendar'), text);
  }

  const today = ymd(now);
  const hr = now.getHours() + now.getMinutes() / 60;

  // 4–5. Low medicine stock and kitchen items: said once a day, and shown
  // as cards on the Home screen (not a pop-up, because it is not urgent).
  if (hr >= 9 && !isFired('stock|' + today)) {
    const lowMeds = store.meds.filter((m) => typeof m.stock === 'number' && m.stock <= 7);
    fire('stock|' + today);
    if (lowMeds.length) { speak(lowMeds.map((m) => t('med_stock_low', { name: m.name, n: m.stock })).join(' ')); return; }
  }
  const low = lowItems();
  if (low.length && hr >= 10 && !isFired('pantry|' + today)) {
    fire('pantry|' + today);
    speak(t('pantry_low_say', { items: list(low.map(n)) }));
    return;
  }

  // 6. Daily "I'm okay" check-in — important for elders who live alone.
  //    First ask gently (10 minutes to answer). If there's no answer, ask again
  //    30 minutes later; if still no answer in 60 seconds, family is called.
  const ckTime = store.settings.checkinTime || '09:00';
  if (!todayLog('okcheck').length && hm(now) >= ckTime) {
    const k1 = 'ok1|' + today; const k2 = 'ok2|' + today;
    if (!isFired(k1) && hr < 14) {
      fire(k1); chime();
      const text = t('ok_q', { name: store.profile.name });
      notify(t('ok_title'), text);
      const r = await popup({ icon: '🌅', title: t('ok_title'), text, countdown: { seconds: 600, label: () => '' },
        buttons: [{ label: '👍 ' + t('ok_yes'), value: 'ok', cls: 'ok' }, { label: '🤒 ' + t('ok_no'), value: 'no', cls: 'danger' }],
        listen: { yes: 'ok', no: 'no' } });
      if (r === 'ok') { logEvent('okcheck', { ok: true }); say(t('ok_thanks')); }
      else if (r === 'no') {
        logEvent('okcheck', { ok: false });
        const c = emergencyContact();
        if (c) { say(t('unwell_say', { name: c.name })); callPerson(c); }
      }
      window.dispatchEvent(new Event('sitara:update'));
      return;
    }
    if (isFired(k1) && !isFired(k2) && Date.now() - store.fired[k1] > 30 * MIN) {
      fire(k2);
      notify(t('check_ok_q'), t('ok_again'));
      const r = await checkIn(t('ok_again'));
      if (r === 'ok') logEvent('okcheck', { ok: true });
      window.dispatchEvent(new Event('sitara:update'));
      return;
    }
  }

  // 7. Evening update for family far away (one tap to send).
  const upTime = store.settings.updateTime || '20:30';
  const fam = emergencyContact();
  if (fam && hm(now) >= upTime && !isFired('up|' + today)) {
    fire('up|' + today);
    const r = await popup({ icon: '💌', title: t('up_q', { name: fam.name }), text: todaysUpdate(), say: t('up_q', { name: fam.name }),
      buttons: [{ label: '✉️ ' + t('up_send'), value: 'send', cls: 'ok' }, { label: t('up_later'), value: 'no' }] });
    if (r === 'send') shareWithFamily(todaysUpdate());
    return;
  }

  // 8. Did you eat? (after breakfast, lunch and dinner time)
  for (const [meal, after] of [['breakfast', 10.5], ['lunch', 14.5], ['dinner', 21]]) {
    const key = `meal|${meal}|${today}`;
    if (hr >= after && hr < after + 2 && !todayLog('meal').some((e) => e.meal === meal) && !isFired(key)) {
      const r = await simpleAlert(key, '🍽️', t('tile_food'), t('ate_q', { meal: t('meal_' + meal) }),
        [{ label: '✅ ' + t('ate_yes'), value: 'yes', cls: 'ok' }, { label: t('ate_not_yet'), value: 'no' }]);
      if (r === 'yes') { logEvent('meal', { meal }); say(t('ate_ok', { meal: t('meal_' + meal) })); }
      else speak(t('ate_remind'));
      window.dispatchEvent(new Event('sitara:update'));
      return;
    }
  }
}

