// Music: one big Play button per song list. Stop button always visible.
import { store } from '../store.js';
import { t, lang } from '../i18n.js';
import { h, header, say, mount } from '../ui.js';
import * as music from '../music.js';
import { route } from '../app.js';

export default function musicScreen(main) {
  const mine = [...store.playlist].sort((a, b) => (b.lang === lang().code) - (a.lang === lang().code));
  mount(main, 
    header(t('music_title'), '🎵'),
    music.playing ? h('button', { class: 'big-btn danger', onclick: () => { music.stop(); say(t('music_stopped')); route(); } }, '⏹ ', t('music_stop')) : null,
    h('button', { class: 'song card builtin', onclick: () => { music.play(null); say(t('music_playing', { title: t('music_builtin') })); route(); } },
      h('span', { class: 'big-ico' }, '🪕'), h('span', { class: 'song-title' }, t('music_builtin')), h('span', { class: 'play' }, '▶')),
    mine.map((p) => h('button', { class: 'song card', onclick: () => { say(t('music_playing', { title: p.title })); music.play(p); route(); } },
      h('span', { class: 'big-ico' }, '🎶'),
      h('span', { class: 'song-title' }, p.title, /youtube|youtu\.be/.test(p.url) ? h('small', {}, t('music_opens')) : null),
      h('span', { class: 'play' }, '▶'))),
  );
}
