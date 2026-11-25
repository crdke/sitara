// Safety camera. Privacy first:
//  • OFF unless family turns it on (with the elder's agreement)
//  • only checks for movement — no photo or video is ever saved or sent
//  • bedrooms and bathrooms are never watched
//  • if nobody moves for a long time, Sitara asks "Are you okay?"
import { store, logEvent, todayLog } from '../store.js';
import { t, fmtTime } from '../i18n.js';
import { h, header, say, mount, setText } from '../ui.js';
import { choiceGrid } from './common.js';
import { checkIn } from '../actions.js';

const ROOMS = ['living', 'kitchen', 'entrance'];
let room = 'living';

export default function camera(main) {
  mount(main, header(t('cam_title'), '📷'));
  const privacy = h('section', { class: 'card privacy' }, h('p', {}, '🔒 ', t('cam_privacy')), h('p', {}, '🚫 ', t('room_bedroom_note')));
  if (!store.settings.camera) {
    mount(main, h('section', { class: 'card warn' }, h('p', { class: 'lead' }, '⏸️ ', t('cam_off_info'))), privacy);
    return;
  }

  let stream = null; let timer = null; let prev = null; let lastMove = Date.now(); let lastLogged = 0; let asked = false;
  const video = h('video', { playsinline: true, muted: true, class: 'cam-preview', hidden: true });
  const canvas = h('canvas', { width: 64, height: 48, hidden: true });
  const meter = h('div', { class: 'meter-fill' });
  const statusEl = h('p', { class: 'lead' });
  const lastEl = h('p', { class: 'med-detail' });
  const roomName = () => t('room_' + room);
  const motions = () => todayLog('motion').slice(-6).reverse();
  const logList = h('ul', { class: 'done-list' });
  const drawLog = () => { logList.innerHTML = ''; motions().forEach((e) => logList.append(h('li', {}, '🚶 ', t('cam_movement', { room: t('room_' + e.room), time: fmtTime(new Date(e.at)) })))); };
  drawLog();

  const startBtn = h('button', { class: 'big-btn ok' }, '▶ ', t('cam_start'));
  const preview = h('input', { type: 'checkbox', onchange: () => { video.hidden = !preview.checked; } });

  const stop = () => {
    clearInterval(timer); timer = null;
    if (stream) stream.getTracks().forEach((tr) => tr.stop());
    stream = null; setText(statusEl, ''); setText(startBtn, '▶ ' + t('cam_start'));
  };

  const sample = () => {
    const c = canvas.getContext('2d', { willReadFrequently: true });
    c.drawImage(video, 0, 0, 64, 48);
    const px = c.getImageData(0, 0, 64, 48).data;
    const gray = new Uint8Array(64 * 48);
    for (let i = 0; i < gray.length; i++) gray[i] = (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3;
    if (prev) {
      let changed = 0;
      for (let i = 0; i < gray.length; i++) if (Math.abs(gray[i] - prev[i]) > 25) changed++;
      const level = changed / gray.length;
      meter.style.width = Math.min(100, level * 400) + '%';
      const now = Date.now();
      if (level > 0.03) {
        lastMove = now; asked = false;
        setText(lastEl, `${t('cam_last_seen')}: ${fmtTime(new Date())}`);
        if (now - lastLogged > 60000) { lastLogged = now; logEvent('motion', { room }); drawLog(); }
      }
      const still = (now - lastMove) / 60000;
      if (still >= store.settings.stillMinutes && !asked) {
        asked = true;
        checkIn(t('cam_still', { n: Math.round(still) }));
      }
    }
    prev = gray; // the frame is thrown away — nothing is stored
  };

  startBtn.onclick = async () => {
    if (stream) { stop(); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 320, height: 240 }, audio: false });
      video.srcObject = stream; await video.play();
      lastMove = Date.now();
      setText(statusEl, '👁️ ' + t('cam_watching'));
      setText(startBtn, '⏹ ' + t('cam_stop'));
      timer = setInterval(sample, 1000);
    } catch (e) { say(t('cam_no_access')); stop(); }
  };

  const grid = () => choiceGrid(ROOMS.map((r) => ({ label: t('room_' + r), value: r, selected: r === room })), (v) => { room = v; g.replaceWith(g = grid()); });
  let g = grid();

  mount(main, privacy,
    h('h2', { class: 'section-title' }, t('cam_room')), g,
    startBtn, statusEl,
    h('div', { class: 'meter', 'aria-hidden': 'true' }, meter), lastEl,
    h('label', { class: 'toggle' }, preview, ' ', t('cam_show_preview')), video, canvas,
    h('section', { class: 'card' }, h('h2', {}, t('done_today')), logList),
    h('p', { class: 'disclaimer' }, t('fs_still_minutes') + ': ' + store.settings.stillMinutes));
  return stop;
}
