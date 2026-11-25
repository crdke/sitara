// A text box with a microphone next to it: speak instead of typing.
import { h, say } from '../ui.js';
import * as voice from '../voice.js';
import { t, lang } from '../i18n.js';
import { readyToListen, micOff, micState } from '../mic.js';
import { store, save } from '../store.js';

export function voiceInput(props = {}) {
  const input = h('input', { type: 'text', class: 'field', ...props });
  const mic = h('button', { type: 'button', class: 'mic-mini', 'aria-label': t('tap_speak'), onclick: async () => {
    const alts = await hearQuestion(mic, null);
    if (alts) { input.value = alts[0]; input.dispatchEvent(new Event('input')); }
  } }, '🎤');
  return { el: h('div', { class: 'voice-field' }, input, mic), input };
}

export function choiceGrid(options, onPick) {
  return h('div', { class: 'choice-grid' }, options.map((o) => h('button', { class: 'choice' + (o.selected ? ' on' : ''), onclick: () => onPick(o.value) }, o.label)));
}

// Listen once for a question. Shows "Listening…" on the button and explains
// clearly what went wrong (no voice heard, microphone blocked, no internet).
export async function hearQuestion(btn, statusEl, opts = {}) {
  if (btn.classList.contains('listening')) { voice.stopListening(); return null; }
  if (!voice.canListen()) { say(t('voice_unavailable')); return null; }
  if (!navigator.onLine) { say(t('voice_needs_net')); return null; }
  if (!(await readyToListen())) return null; // first time: calm "tap Allow" note
  btn.classList.add('listening');
  const before = statusEl && statusEl.textContent;
  if (statusEl) statusEl.textContent = t('listening');
  try {
    const alts = await voice.listen();
    store.settings.micAsked = true; save(); // the microphone works on this phone
    if (!alts.length) { if (!opts.quiet) say(t('didnt_hear') + ' ' + t('mic_tip')); return null; }
    return alts;
  } catch (e) {
    const why = e && e.message;
    if (opts.quiet && why !== 'not-allowed') return null; // a follow-up that didn't work: just stop quietly
    // Microphone switched off: no settings for the elder, offer to ask family.
    if (why === 'not-allowed') {
      if (await micOff((await micState()) === 'denied' ? 'denied' : 'system')) say(t('mic_now_on'));
    } else say(micProblem(why));
    return null;
  } finally {
    btn.classList.remove('listening');
    if (statusEl) statusEl.textContent = before;
  }
}

// A clear, spoken reason when listening fails, so the elder (or family) knows what to do.
export function micProblem(why) {
  switch (why) {
    case 'not-allowed': case 'service-not-allowed': return t('mic_blocked');
    case 'language-not-supported': return t('mic_lang', { lang: lang().nativeName });
    case 'no-mic': return t('mic_none');
    case 'audio-capture': case 'mic-busy': return t('mic_busy');
    case 'network': return t('voice_needs_net');
    case 'unsupported': return t('voice_unavailable');
    default: return t('didnt_hear') + ' ' + t('mic_tip');
  }
}
