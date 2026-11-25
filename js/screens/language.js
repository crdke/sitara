// Language picker: each language is written in its own script.
import { store, save } from '../store.js';
import { setLang, t } from '../i18n.js';
import { LANGUAGES } from '../lang/index.js';
import { h, go, mount } from '../ui.js';
import { speak } from '../voice.js';

export default function language(main) {
  mount(main, 
    h('h1', { class: 'center' }, '🌐 ', LANGUAGES.map((l) => l.strings.lang_title).filter((x, i, a) => a.indexOf(x) === i).slice(0, 2).join(' / ')),
    h('div', { class: 'lang-list' }, LANGUAGES.map((l) => h('button', {
      class: 'lang-btn' + (store.lang === l.code ? ' selected' : ''),
      lang: l.code,
      onclick: () => {
        store.lang = l.code; save(); setLang(l.code);
        speak(t('lang_changed'));
        go('home');

      },
    }, h('span', { class: 'native' }, l.nativeName), l.code !== 'en' ? h('span', { class: 'english' }, l.name) : null))),
  );
}
