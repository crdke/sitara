// Family Setup: where a son, daughter or carer fills in everything once.
// The elder never needs to come here.
import { store, save, newId, loadDemo, clearAll } from '../store.js';
import { t, n, fmtTime } from '../i18n.js';
import { h, header, go, popup, toast, mount, setText } from '../ui.js';
import { COMMON_MEDICINES, PURPOSES, FOOD_TIMING, RELATIONS, CONDITIONS } from '../data.js';
import { LANGUAGES } from '../lang/index.js';
import { route } from '../app.js';
import { makeSetupLink } from '../update.js';
import { checkBackend, backendUrl } from '../backend.js';
import { BACKEND_URL } from '../config.js';
import { speak, voiceStatus } from '../voice.js';
import { hearQuestion } from './common.js';
import { micState, askMic, micSteps } from '../mic.js';
import { lang } from '../i18n.js';

const field = (label, input) => h('label', { class: 'f' }, h('span', {}, label), input);
const inp = (props) => h('input', { class: 'field', type: 'text', ...props });
const sel = (options, value) => h('select', { class: 'field' }, options.map(([v, label]) => h('option', { value: v, selected: v === value }, label)));
const openSecs = new Set(); // keep sections open when the screen redraws
const section = (title, ...kids) => {
  const id = title.split(' (')[0];
  return h('details', { class: 'card fs-sec', open: openSecs.has(id), ontoggle: (e) => { e.target.open ? openSecs.add(id) : openSecs.delete(id); } },
    h('summary', {}, title), ...kids);
};
const removeBtn = (onclick) => h('button', { class: 'icon-btn', 'aria-label': t('remove'), onclick }, '🗑');

function listRows(items, render, onRemove) {
  return h('ul', { class: 'fs-list' }, items.map((x) => h('li', {}, h('div', { class: 'fs-row' }, render(x)), removeBtn(() => { onRemove(x); save(); route(); }))));
}

export default function family(main) {
  // --- Profile & conditions
  const name = inp({ value: store.profile.name, oninput: (e) => { store.profile.name = e.target.value; save(); } });
  const conds = h('div', { class: 'chips' }, Object.keys(CONDITIONS).map((c) => {
    const on = store.profile.conditions.includes(c);
    return h('button', { class: 'chip-t' + (on ? ' on' : ''), 'aria-pressed': String(on), onclick: () => {
      const s = new Set(store.profile.conditions); on ? s.delete(c) : s.add(c);
      store.profile.conditions = [...s]; save(); route();
    } }, (on ? '✓ ' : '') + n('c_' + c));
  }));

  // --- Emergency info (shown on the medical info card)
  const profileInput = (key, props) => inp({ ...props, value: store.profile[key] || '', oninput: (e) => { store.profile[key] = e.target.value.trim(); save(); } });
  const bloodSel = sel([['', '—'], ...['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => [b, b])], store.profile.blood || '');
  bloodSel.addEventListener('change', () => { store.profile.blood = bloodSel.value; save(); });

  // --- Medicine form
  const mName = inp({ placeholder: 'Metformin 500 mg' });
  const mDose = inp({ value: '1 tablet' });
  const mTimes = inp({ value: '08:00, 20:00' });
  const mFood = sel(FOOD_TIMING.map((f) => [f, t('food_' + f)]), 'after');
  const mPurpose = sel(PURPOSES.map((p) => [p, n('p_' + p)]), 'other');
  const mStock = inp({ type: 'number', value: '30', min: '0' });
  const pickCommon = (m) => {
    mName.value = m.name; mDose.value = m.dose || '1 tablet'; mTimes.value = m.times.join(', ');
    mFood.value = m.food; mPurpose.value = m.purpose; mName.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const addMed = () => {
    const times = mTimes.value.split(/[,\s]+/).map((x) => x.trim()).filter((x) => /^\d{1,2}:\d{2}$/.test(x)).map((x) => x.padStart(5, '0'));
    if (!mName.value.trim() || !times.length) { toast(t('fs_med_name') + ' / ' + t('fs_times')); return; }
    store.meds.push({ id: newId(), name: mName.value.trim(), dose: mDose.value.trim() || '1 tablet', times, food: mFood.value, purpose: mPurpose.value, stock: Number(mStock.value) || 0 });
    save(); toast(t('saved')); route();
  };

  // --- Contact form
  const cName = inp({}); const cRel = sel(RELATIONS.map((r) => [r, n('r_' + r)]), 'son');
  const cPhone = inp({ type: 'tel', placeholder: '+91 …' }); const cAlias = inp({ placeholder: 'रवि, രവി' });
  const cEm = h('input', { type: 'checkbox' });
  const addContact = () => {
    if (!cName.value.trim()) return;
    if (cEm.checked) store.contacts.forEach((c) => { c.emergency = false; });
    store.contacts.push({ id: newId(), name: cName.value.trim(), relation: cRel.value, phone: cPhone.value.trim(), aliases: cAlias.value.trim(), emergency: cEm.checked });
    save(); toast(t('saved')); route();
  };

  // --- Doctor form
  const dName = inp({ placeholder: 'Dr. …' }); const dSpec = inp({}); const dPhone = inp({ type: 'tel' }); const dHosp = inp({});
  const addDoctor = () => {
    if (!dName.value.trim()) return;
    store.doctors.push({ id: newId(), name: dName.value.trim(), speciality: dSpec.value.trim(), phone: dPhone.value.trim(), hospital: dHosp.value.trim() });
    save(); toast(t('saved')); route();
  };

  // --- Playlist form
  const sTitle = inp({}); const sUrl = inp({ type: 'url', placeholder: 'https://' });
  const sLang = sel(LANGUAGES.map((l) => [l.code, l.nativeName]), store.lang || 'en');
  const addSong = () => {
    if (!sTitle.value.trim() || !sUrl.value.trim()) return;
    store.playlist.push({ id: newId(), title: sTitle.value.trim(), url: sUrl.value.trim(), lang: sLang.value });
    save(); toast(t('saved')); route();
  };

  // --- Settings toggles
  const toggle = (key, label) => h('label', { class: 'toggle' },
    h('input', { type: 'checkbox', checked: !!store.settings[key], onchange: (e) => { store.settings[key] = e.target.checked; save(); } }), ' ', label);
  const timeInput = (key, def) => h('input', { class: 'field', type: 'time', value: store.settings[key] || def,
    onchange: (e) => { if (e.target.value) { store.settings[key] = e.target.value; save(); } } });
  const still = inp({ type: 'number', min: '1', value: String(store.settings.stillMinutes), onchange: (e) => { store.settings.stillMinutes = Math.max(1, Number(e.target.value) || 120); save(); } });

  // --- Smart AI & natural voice (backend)
  const bStatus = h('p', { class: 'lead', 'aria-live': 'polite' });
  const bUrl = inp({ type: 'url', placeholder: BACKEND_URL || 'https://sitara-backend.yourname.workers.dev', value: store.settings.backendUrl || '',
    onchange: (e) => { store.settings.backendUrl = e.target.value.trim(); save(); } });
  const bCode = inp({ type: 'password', autocomplete: 'off', value: store.settings.accessCode || '',
    onchange: (e) => { store.settings.accessCode = e.target.value.trim(); save(); } });
  const showHealth = (hl) => {
    if (!backendUrl()) { setText(bStatus, ''); return; }
    if (!hl || !hl.ok) { setText(bStatus, '⚠️ ' + t('backend_fail')); return; }
    if (hl.paused) { setText(bStatus, '⏸️ ' + t('backend_paused')); return; }
    if (hl.access && hl.access !== 'ok') { setText(bStatus, '🔒 ' + t('backend_locked')); return; }
    setText(bStatus, '✅ ' + t('backend_ok', { ai: hl.ai ? t('yes') : t('no'), voice: hl.voice ? t('yes') : t('no') }));
  };
  const testBtn = h('button', { class: 'big-btn small', onclick: async () => {
    store.settings.backendUrl = bUrl.value.trim(); store.settings.accessCode = bCode.value.trim(); save();
    setText(bStatus, '…');
    showHealth(await checkBackend(true)); showVoice();
  } }, '🔌 ', t('fs_backend_test'));
  // Phone voice check, so missing Malayalam/Marathi voices are found before judging.
  const voiceInfo = h('p', { class: 'lead', 'aria-live': 'polite' });
  const showVoice = () => {
    const st = voiceStatus();
    if (st === null) return;
    const key = { phone: 'voice_found', backup: 'voice_backup', hindi: 'voice_hindi', none: 'voice_missing' }[st];
    setText(voiceInfo, (st === 'phone' || st === 'backup' ? '✅ ' : '⚠️ ') + t(key, { lang: lang().nativeName }));
  };
  showVoice();
  if ('speechSynthesis' in window) speechSynthesis.addEventListener('voiceschanged', showVoice);
  // Microphone test: shows exactly what was heard, or why nothing was.
  const micResult = h('p', { class: 'lead', 'aria-live': 'polite' }, t('mic_test_hint', { lang: lang().nativeName }));
  const micTestBtn = h('button', { class: 'big-btn small', onclick: async () => {
    const alts = await hearQuestion(micTestBtn, micResult);
    if (alts) { setText(micResult, '✅ ' + t('mic_ok', { text: alts[0] })); speak(t('mic_ok', { text: alts[0] })); }
  } }, '🎤 ', t('mic_test'));
  const phoneVoiceBtn = h('button', { class: 'big-btn small', onclick: () => speak(t('ans_hello', { name: store.profile.name })) }, '🔊 ', t('fs_voice_test'));
  if (backendUrl()) checkBackend().then((hl) => { showHealth(hl); showVoice(); });

  const notifBtn = h('button', { class: 'big-btn small', onclick: async () => {
    if (!('Notification' in window)) return;
    const p = await Notification.requestPermission();
    toast(p === 'granted' ? t('notif_on') : t('notif_blocked'));
  } }, '🔔 ', t('fs_notify'));
  const installBtn = h('button', { class: 'big-btn small', onclick: async () => {
    if (window.__installPrompt) { window.__installPrompt.prompt(); window.__installPrompt = null; }
    else toast('Chrome menu ⋮ → "Add to Home screen"');
  } }, '📲 ', t('fs_install'));

  // Microphone: the family allows it once here, so the elder is never asked.
  const micInfo = h('p', { 'aria-live': 'polite' });
  const micBtn = h('button', { class: 'big-btn ok', onclick: async () => {
    showMic(await askMic());
  } }, '🎤 ', t('mic_allow'));
  const showMic = (st) => {
    micBtn.hidden = st === 'granted';
    if (st === 'granted') setText(micInfo, '✅ ' + t('fs_mic_on'));
    else if (st === 'denied' || st === 'system') setText(micInfo, '⚠️ ' + t('fs_mic_off') + ' ' + micSteps(st));
    else if (st === 'none') setText(micInfo, '⚠️ ' + t('mic_none'));
    else if (st === 'busy') setText(micInfo, '⚠️ ' + t('mic_busy'));
    else setText(micInfo, t('fs_mic_ask'));
  };
  micState().then((st) => showMic(st === 'unknown' ? (store.settings.micAsked ? 'granted' : 'prompt') : st));

  mount(main, 
    header(t('fs_title'), '⚙️'),
    h('p', { class: 'lead' }, t('fs_hint')),
    h('section', { class: 'card' }, h('h2', {}, '🎤 ', t('fs_mic_title')), micInfo, micBtn),
    h('section', { class: 'card remote' },
      h('h2', {}, '📲 ', t('rs_title')),
      h('p', {}, t('rs_hint')),
      h('button', { class: 'big-btn ok', onclick: async () => {
        const link = await makeSetupLink();
        const text = t('rs_msg', { link });
        if (navigator.share) navigator.share({ text }).catch(() => {});
        else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
      } }, '📤 ', t('rs_send'))),

    h('section', { class: 'card' }, h('h2', {}, '🌐 ', t('fs_language')),
      h('div', { class: 'chips' }, LANGUAGES.map((l) => h('button', { class: 'chip-t' + (store.lang === l.code ? ' on' : ''), onclick: () => go('language') }, l.nativeName)))),

    section('👤 ' + t('fs_profile'), field(t('fs_name'), name),
      field(t('fs_age'), profileInput('age', { type: 'number', min: '40', max: '120', inputmode: 'numeric' })),
      field(t('fs_blood'), bloodSel),
      field(t('fs_allergies'), profileInput('allergies', {})),
      field(t('fs_address'), profileInput('address', {})),
      h('p', { class: 'f' }, t('fs_conditions')), conds),

    section('💊 ' + t('fs_meds') + ` (${store.meds.length})`,
      listRows(store.meds, (m) => [h('b', {}, m.name), ` · ${m.dose} · ${m.times.map(fmtTime).join(', ')} · ${t('food_' + m.food)} · ${t('med_stock', { n: m.stock })}`],
        (m) => { store.meds = store.meds.filter((x) => x !== m); }),
      h('h3', {}, '➕ ', t('fs_add_med')),
      h('p', { class: 'f' }, t('fs_pick_common')),
      h('div', { class: 'common-meds' }, COMMON_MEDICINES.map((m) => h('button', { class: 'chip-t', onclick: () => pickCommon(m) },
        h('b', {}, m.name), h('small', {}, ` ${m.aka} · ${n('p_' + m.purpose)}`)))),
      field(t('fs_med_name'), mName), field(t('fs_dose'), mDose), field(t('fs_times'), mTimes),
      field(t('fs_food'), mFood), field(t('fs_purpose'), mPurpose), field(t('fs_stock'), mStock),
      h('button', { class: 'big-btn ok', onclick: addMed }, '✅ ', t('add'))),

    section('📞 ' + t('fs_contacts') + ` (${store.contacts.length})`,
      listRows(store.contacts, (c) => [h('b', {}, c.name), ` · ${n('r_' + c.relation)} · ${c.phone || '—'}`, c.emergency ? ' · ⭐ ' + t('fs_emergency') : ''],
        (c) => { store.contacts = store.contacts.filter((x) => x !== c); }),
      h('h3', {}, '➕ ', t('add')),
      field(t('fs_contact_name'), cName), field(t('fs_relation'), cRel), field(t('fs_phone'), cPhone), field(t('fs_aliases'), cAlias),
      h('label', { class: 'toggle' }, cEm, ' ⭐ ', t('fs_emergency')),
      h('button', { class: 'big-btn ok', onclick: addContact }, '✅ ', t('add'))),

    section('🩺 ' + t('fs_doctors') + ` (${store.doctors.length})`,
      listRows(store.doctors, (d) => [h('b', {}, d.name), ` · ${d.speciality || ''} · ${d.hospital || ''} · ${d.phone || ''}`],
        (d) => { store.doctors = store.doctors.filter((x) => x !== d); }),
      h('h3', {}, '➕ ', t('add')),
      field(t('fs_doctor_name'), dName), field(t('fs_speciality'), dSpec), field(t('fs_phone'), dPhone), field(t('fs_hospital'), dHosp),
      h('button', { class: 'big-btn ok', onclick: addDoctor }, '✅ ', t('add'))),

    section('🎵 ' + t('fs_playlist') + ` (${store.playlist.length})`,
      listRows(store.playlist, (p) => [h('b', {}, p.title), ` · ${p.lang}`], (p) => { store.playlist = store.playlist.filter((x) => x !== p); }),
      field(t('fs_song_title'), sTitle), field(t('fs_song_url'), sUrl), field(t('fs_language'), sLang),
      h('button', { class: 'big-btn ok', onclick: addSong }, '✅ ', t('add'))),

    section('🤖 ' + t('fs_backend'),
      h('p', {}, t('fs_backend_hint')),
      field(t('fs_backend_url'), bUrl), field(t('fs_access_code'), bCode), testBtn, bStatus,
      toggle('useAI', t('fs_use_ai')), toggle('shareHealth', t('fs_share_health')), toggle('oneVoice', t('fs_one_voice')), toggle('sarvamVoice', t('fs_natural_voice'))),

    section('⚙️ ' + t('fs_settings'),
      voiceInfo, phoneVoiceBtn, micTestBtn, micResult,
      toggle('simple', t('fs_simple')), toggle('slow', t('fs_slow')), toggle('demo', t('fs_demo')), toggle('camera', '📷 ' + t('fs_camera')),
      field(t('fs_checkin_time'), timeInput('checkinTime', '09:00')),
      field(t('fs_update_time'), timeInput('updateTime', '20:30')),
      field(t('fs_still_minutes'), still), notifBtn, installBtn),

    h('div', { class: 'btn-row' },
      h('button', { class: 'big-btn small ghost', onclick: () => { loadDemo(); toast(t('saved')); route(); } }, '🧪 ', t('fs_demo_data')),
      h('button', { class: 'big-btn small danger', onclick: async () => {
        const r = await popup({ icon: '🗑', title: t('fs_clear_q'), buttons: [{ label: t('yes'), value: 'y', cls: 'danger' }, { label: t('no'), value: 'n' }] });
        if (r === 'y') { clearAll(); route(); }
      } }, '🗑 ', t('fs_clear'))),
  );
}
