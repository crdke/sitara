// Microphone permission, made simple.
// Every browser must ask once before a website may use the microphone; no
// website can skip that. So Sitara:
//   • asks at a calm moment, with a big "Tap Allow" note first (normally the
//     family does this once while setting up; the browser then remembers it),
//   • and if it is switched off, never sends the elder into settings: it offers
//     to message the family with the exact steps, and the buttons and typing
//     still work in the meantime.
import { store, save } from './store.js';
import { t } from './i18n.js';
import { popup, say } from './ui.js';
import { soundMode } from './voice.js';

// 'granted' | 'prompt' | 'denied' | 'unknown' (the browser doesn't say)
export async function micState() {
  try {
    const p = await navigator.permissions.query({ name: 'microphone' });
    return p.state;
  } catch (e) {
    return 'unknown';
  }
}

// Open the microphone for a moment so the browser shows its "Allow?" question.
// Returns 'granted', 'denied' (blocked for this site), 'system' (the phone or
// computer itself blocks the browser) or 'none' (no microphone).
export async function askMic() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return 'none';
  try {
    soundMode('play-and-record'); // iPhone: playback-only mode would hide the microphone
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((tr) => tr.stop());
    store.settings.micAsked = true; save();
    return 'granted';
  } catch (e) {
    store.settings.micAsked = true; save();
    if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
      // Site allowed, but the phone/computer stops the browser using the microphone.
      return /system/i.test(e.message) || (await micState()) === 'granted' ? 'system' : 'denied';
    }
    if (e.name === 'NotFoundError') return 'none';
    return ['NotReadableError', 'AbortError', 'TrackStartError'].includes(e.name) ? 'busy' : 'system';
  }
}

// Which device is this? Used to show the right steps.
export function platform() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Mac/.test(ua)) return 'mac';
  return 'pc';
}

// Short steps for the family, in the app's language.
export function micSteps(kind = 'denied') {
  const p = platform();
  if (p === 'ios' && /CriOS/.test(navigator.userAgent)) return t('mic_sys_ios'); // Chrome on iPhone: only the iPhone setting
  if (kind === 'system') return t(p === 'android' ? 'mic_sys_android' : p === 'ios' ? 'mic_sys_ios' : p === 'mac' ? 'mic_sys_mac' : 'mic_sys_pc');
  return t(p === 'android' ? 'mic_site_android' : p === 'ios' ? 'mic_site_ios' : 'mic_site_pc');
}

// Before the very first listen: a calm note, then the browser's question.
// Returns true when listening can go ahead.
// No extra note of our own: the phone's single "Allow" question is enough.
// Only a microphone that is already switched off gets the friendly popup.
export async function readyToListen() {
  const st = await micState();
  if (st === 'denied') return micOff('denied');
  return true;
}

// iPhones need a moment after the permission check before the microphone can
// be opened again; without it the very first recording can come out silent.
const settle = () => new Promise((r) => setTimeout(() => r(true), 600));

// The microphone is off. First try to switch it on right here (the phone asks
// again if it can). Only if the phone still refuses are the settings steps
// shown, with "Ask my family" so nobody has to dig through settings alone.
// Returns true when the microphone is now on.
export async function micOff(kind = 'denied') {
  const { shareWithFamily } = await import('./actions.js');
  const askFamily = (k) => shareWithFamily(t('mic_family_msg', { name: store.profile.name || 'Sitara', steps: micSteps(k) }));
  const choice = await popup({ icon: '🎤', title: t('mic_off_title'), text: t('mic_off_text'),
    buttons: [{ label: '🎤 ' + t('mic_turn_on'), value: 'on', cls: 'ok' },
      { label: '✉️ ' + t('mic_ask_family'), value: 'family' }, { label: t('close'), value: 'close', cls: 'ghost' }] });
  if (choice === 'family') { askFamily(kind); return false; }
  if (choice !== 'on') return false;
  const res = await askMic();
  if (res === 'granted') return settle();
  if (res === 'busy' || res === 'none') { say(t(res === 'busy' ? 'mic_busy' : 'mic_none')); return false; }
  const next = await popup({ icon: '🎤', title: t('mic_off_title'), text: t('mic_still_off') + ' ' + micSteps(res),
    buttons: [{ label: '✉️ ' + t('mic_ask_family'), value: 'family', cls: 'ok' }, { label: t('close'), value: 'close', cls: 'ghost' }] });
  if (next === 'family') askFamily(res);
  return false;
}
