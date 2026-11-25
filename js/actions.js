// Actions that reach the outside world: phone calls, messages, help (SOS).
// In demo mode they are only shown on screen, so nobody is called by mistake.
import { store, emergencyContact, logEvent } from './store.js';
import { t } from './i18n.js';
import { popup, say } from './ui.js';
import { speak } from './voice.js';

export async function callPerson(c, { confirm = true } = {}) {
  if (!c) return;
  if (!c.phone) { say(t('call_no_number', { name: c.name })); return; }
  if (confirm) {
    const ok = await popup({ icon: '📞', title: t('call_confirm', { name: c.name }), buttons: [
      { label: '📞 ' + t('yes'), value: 'yes', cls: 'ok' }, { label: t('no'), value: 'no' }] });
    if (ok !== 'yes') return;
  }
  dial(c.name, c.phone);
}

export function dial(name, phone) {
  logEvent('call', { name });
  if (store.settings.demo) {
    popup({ icon: '📞', title: t('calling', { name }), text: t('demo_call', { name, phone }), buttons: [{ label: t('close'), value: 'x' }] });
    return;
  }
  speak(t('calling', { name }));
  location.href = 'tel:' + phone.replace(/[^\d+]/g, '');
}

export function sendText(phone, text) {
  if (store.settings.demo || !phone) {
    if (navigator.share && !store.settings.demo) { navigator.share({ text }).catch(() => {}); return; }
    popup({ icon: '✉️', title: t('med_tell_family'), text: '“' + text + '”', speak: false, buttons: [{ label: t('close'), value: 'x' }] });
    return;
  }
  location.href = `sms:${phone.replace(/[^\d+]/g, '')}?body=${encodeURIComponent(text)}`;
}

// Share a message with family: uses the phone's share sheet (WhatsApp, SMS...)
export function shareWithFamily(text) {
  if (!store.settings.demo && navigator.share) { navigator.share({ text }).catch(() => {}); return; }
  const c = emergencyContact();
  sendText(c && c.phone, text);
}

let sosRunning = false;
// Help button: count down, then call the emergency contact automatically.
export async function startSOS() {
  if (sosRunning) return;
  const c = emergencyContact();
  if (!c) { say(t('no_emergency_contact')); return; }
  sosRunning = true;
  logEvent('sos', {});
  const res = await popup({
    icon: '🆘', tone: 'danger', title: t('sos_title'),
    say: t('sos_calling_in', { name: c.name, n: 10 }),
    countdown: { seconds: 10, label: (n) => t('sos_calling_in', { name: c.name, n }) },
    buttons: [{ label: '📞 ' + c.name, value: 'call', cls: 'ok' }, { label: t('sos_cancel'), value: 'cancel' }],
  });
  sosRunning = false;
  if (res === 'cancel') { speak(t('check_ok_yes')); return; }
  dial(c.name, c.phone);
  sendLocation();
  location.hash = '#/medinfo'; // ready for whoever comes to help
}

export function sendLocation() {
  const c = emergencyContact();
  const send = (link) => sendText(c && c.phone, link ? t('sos_msg', { link }) : t('sos_msg_noloc'));
  if (!navigator.geolocation) return send(null);
  navigator.geolocation.getCurrentPosition(
    (p) => send(`https://maps.google.com/?q=${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`),
    () => send(null), { timeout: 8000 });
}

// "Are you okay?" — if there is no answer in 60 seconds, call family for them.
let checking = false;
export async function checkIn(question) {
  if (checking) return;
  const c = emergencyContact();
  checking = true;
  const res = await popup({
    icon: '🙋', title: t('check_ok_q'), text: question,
    countdown: c ? { seconds: 60, label: (n) => t('sos_calling_in', { name: c.name, n }) } : null,
    buttons: [{ label: '👍 ' + t('check_ok_yes'), value: 'ok', cls: 'ok' }, { label: '🆘 ' + t('tile_sos'), value: 'help', cls: 'danger' }],
    listen: { yes: 'ok', no: 'help' },
  });
  checking = false;
  if (res === 'ok') { logEvent('checkin', { ok: true }); return res; }
  if (res === 'help') { startSOS(); return res; }
  if (res === 'timeout' && c) {
    speak(t('check_no_answer', { name: c.name }));
    logEvent('checkin', { ok: false });
    setTimeout(() => { dial(c.name, c.phone); sendLocation(); }, 2500);
  }
  return res;
}
