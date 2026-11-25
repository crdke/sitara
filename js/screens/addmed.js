// The elder adds a medicine themselves, in the easiest way for them:
//   📷 photo of the prescription (read by the AI)
//   🎤 say it ("Metformin 500, morning and night, after food")
//   🔎 search the list of common medicines (type or speak)
// Every medicine is shown back in big text to confirm before it is saved.
import { store, save, newId } from '../store.js';
import { t, n, fmtTime, list } from '../i18n.js';
import { h, header, go, say, toast, mount } from '../ui.js';
import { speak } from '../voice.js';
import { voiceInput, choiceGrid, hearQuestion } from './common.js';
import { aiReady, readPrescription } from '../backend.js';
import { searchMedicines, parseSpoken, slotsFromTimes, SLOT_TIMES } from '../medparse.js';

const SLOTS = ['morning', 'afternoon', 'night'];
const FOODS = ['after', 'before', 'empty', 'any'];

// Make the photo smaller before sending (faster, cheaper) and a tiny copy to keep.
function shrink(file, maxSide, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function savePhoto(dataUrl) {
  const id = newId();
  try { localStorage.setItem('sitara.photo.' + id, dataUrl); return id; } catch (e) { return null; } // phone storage full: skip the copy
}
export const loadPhoto = (id) => { try { return localStorage.getItem('sitara.photo.' + id); } catch (e) { return null; } };

const fromCatalogue = (m) => ({ name: m.name, dose: m.dose || '1 tablet', slots: slotsFromTimes(m.times), times: m.times, food: m.food, purpose: m.purpose });

export default function addmed(main) {
  const body = h('div');
  mount(main, header(t('am_title'), '➕'), body);
  let queue = [];
  let heard = '';

  const show = (...kids) => { body.innerHTML = ''; mount(body, ...kids); window.scrollTo(0, 0); };

  // ---------- 1. choose how ----------
  function choose() {
    const status = h('p', { class: 'mic-status' });
    const file = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, onchange: () => file.files[0] && fromPhoto(file.files[0]) });
    const sayBtn = h('button', { class: 'big-btn way', onclick: async () => {
      const alts = await hearQuestion(sayBtn, status);
      if (alts) fromSpeech(alts[0]);
    } }, h('span', { class: 'way-ico' }, '🎤'), h('span', {}, t('am_say'), h('small', {}, t('am_say_hint'))));
    show(
      h('h2', { class: 'q' }, t('am_how')),
      h('button', { class: 'big-btn way', onclick: () => (aiReady() ? file.click() : say(t('am_photo_needs_ai'))) },
        h('span', { class: 'way-ico' }, '📷'), h('span', {}, t('am_photo'), h('small', {}, t('am_photo_hint')))),
      aiReady() ? h('p', { class: 'disclaimer' }, '🔒 ', t('am_photo_privacy')) : null,
      file,
      sayBtn, status,
      h('button', { class: 'big-btn way', onclick: search }, h('span', { class: 'way-ico' }, '🔎'), h('span', {}, t('am_search'))),
    );
    speak(t('am_how'));
  }

  // ---------- 2a. photo ----------
  async function fromPhoto(f) {
    const big = await shrink(f, 1600, 0.8);
    const small = await shrink(f, 520, 0.6);
    show(h('img', { src: small, class: 'rx-preview', alt: t('am_photo_saved') }), h('p', { class: 'lead center' }, '⏳ ', t('am_reading')));
    speak(t('am_reading'));
    let meds = [];
    try { meds = await readPrescription({ image: big.split(',')[1], mime: 'image/jpeg' }); } catch (e) { meds = []; }
    if (!meds.length) { say(t('am_none_found')); choose(); return; }
    const photoId = savePhoto(small);
    queue = meds.map((m) => ({ ...m, slots: slotsFromTimes(m.times), photoId }));
    say(t('am_found', { n: queue.length }));
    setTimeout(() => review(0), 1800);
  }

  // ---------- 2b. speech ----------
  async function fromSpeech(sentence) {
    heard = sentence;
    let drafts = [];
    if (aiReady()) {
      try { drafts = (await readPrescription({ text: sentence })).map((m) => ({ ...m, slots: slotsFromTimes(m.times) })); } catch (e) { drafts = []; }
    }
    if (!drafts.length) drafts = [parseSpoken(sentence)];
    queue = drafts;
    review(0);
  }

  // ---------- 2c. search ----------
  function search() {
    const vi = voiceInput({ placeholder: t('am_search_ph'), 'aria-label': t('am_search') });
    const results = h('div', { class: 'results' });
    const draw = () => {
      const q = vi.input.value.trim();
      results.innerHTML = '';
      if (q.length < 2) return;
      const found = searchMedicines(q).slice(0, 8);
      found.forEach((m) => results.append(h('button', { class: 'contact', onclick: () => { queue = [fromCatalogue(m)]; review(0); } },
        h('span', { class: 'avatar', style: 'background:#1d4e89', 'aria-hidden': 'true' }, '💊'),
        h('span', { class: 'contact-text' }, h('span', { class: 'contact-name' }, m.name), h('span', { class: 'contact-rel' }, `${m.aka} · ${n('p_' + m.purpose)}`)))));
      if (!found.length) results.append(h('p', { class: 'empty' }, t('am_no_results')));
      results.append(h('button', { class: 'big-btn ghost', onclick: () => { queue = [{ name: q, dose: '1 tablet', slots: [], food: 'after', purpose: 'other' }]; review(0); } }, '➕ ', t('am_add_typed', { name: q })));
    };
    vi.input.addEventListener('input', draw);
    show(h('h2', { class: 'q' }, '🔎 ', t('am_search')), vi.el, results);
    vi.input.focus();
  }

  // ---------- 3. confirm each medicine ----------
  function review(i) {
    if (i >= queue.length) { go('meds'); return; }
    const d = { ...queue[i] };
    const name = voiceInput({ value: d.name || '', 'aria-label': t('am_name') });
    const dose = h('input', { class: 'field', type: 'text', value: d.dose || '1 tablet', 'aria-label': t('am_dose') });
    let slots = new Set(d.slots || []);
    let food = FOODS.includes(d.food) ? d.food : 'after';

    const slotRow = () => h('div', { class: 'slot-row' }, SLOTS.map((sl) => h('button', {
      class: 'slot' + (slots.has(sl) ? ' on' : ''), 'aria-pressed': String(slots.has(sl)),
      onclick: () => { slots.has(sl) ? slots.delete(sl) : slots.add(sl); slotEl.replaceWith(slotEl = slotRow()); },
    }, h('span', { class: 'slot-ico', 'aria-hidden': 'true' }, sl === 'morning' ? '🌅' : sl === 'afternoon' ? '☀️' : '🌙'), t('am_' + sl), h('small', {}, fmtTime(SLOT_TIMES[sl])))));
    let slotEl = slotRow();
    const foodGrid = () => choiceGrid(FOODS.map((f) => ({ label: t('food_' + f), value: f, selected: f === food })), (v) => { food = v; foodEl.replaceWith(foodEl = foodGrid()); });
    let foodEl = foodGrid();

    const saveIt = () => {
      if (!name.input.value.trim()) { name.input.focus(); return; }
      if (!slots.size) { say(t('am_pick_time')); return; }
      // keep the exact time from the prescription when it falls in that part of the day
      const times = SLOTS.filter((sl) => slots.has(sl)).map((sl) => (d.times || []).find((tm) => slotsFromTimes([tm])[0] === sl) || SLOT_TIMES[sl]);
      const med = { id: newId(), name: name.input.value.trim(), dose: dose.value.trim() || '1 tablet', times, food, purpose: d.purpose || 'other' };
      if (d.photoId) med.photoId = d.photoId;
      store.meds.push(med);
      save();
      say(t('am_saved', { name: med.name, times: list(times.map(fmtTime)) }));
      setTimeout(() => review(i + 1), 2200);
    };

    show(
      queue.length > 1 ? h('p', { class: 'step' }, t('am_count', { i: i + 1, n: queue.length })) : null,
      heard && i === 0 ? h('p', { class: 'you-said' }, t('am_heard', { text: heard })) : null,
      h('h2', { class: 'q' }, t('am_check')),
      d.unsure ? h('p', { class: 'card warn' }, '⚠️ ', t('am_unsure')) : null,
      h('label', { class: 'f' }, t('am_name')), name.el,
      h('label', { class: 'f' }, t('am_dose')), dose,
      h('label', { class: 'f' }, t('am_when')), slotEl,
      h('label', { class: 'f' }, t('am_food')), foodEl,
      h('button', { class: 'big-btn ok', onclick: saveIt }, '✅ ', t('am_save')),
      h('button', { class: 'big-btn ghost', onclick: () => review(i + 1) }, t('am_skip')),
    );
    speak(`${d.name || ''}. ${t('am_check')}`);
  }

  choose();
}
