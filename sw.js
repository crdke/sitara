// Service worker: keeps a copy of the app on the phone so it opens and
// reminds even without internet. Bump VERSION after changing any file.
const VERSION = 'sitara-v24';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './icons/icon-192.png', './icons/icon-512.png',
  './js/app.js', './js/i18n.js', './js/store.js', './js/data.js', './js/voice.js', './js/ui.js', './js/icons.js', './js/actions.js',
  './js/assistant.js', './js/wiki.js', './js/mic.js', './js/talk.js', './js/backend.js', './js/config.js', './js/medparse.js', './js/update.js', './js/reminders.js', './js/food.js', './js/music.js',
  './js/lang/index.js', './js/lang/en.js', './js/lang/hi.js', './js/lang/ml.js', './js/lang/mr.js',
  './js/screens/index.js', './js/screens/common.js', './js/screens/home.js', './js/screens/language.js',
  './js/screens/meds.js', './js/screens/call.js', './js/screens/day.js', './js/screens/food.js', './js/screens/pantry.js',
  './js/screens/doctor.js', './js/screens/calendar.js', './js/screens/music.js', './js/screens/camera.js', './js/screens/family.js', './js/screens/addmed.js', './js/screens/medinfo.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Network first (so updates arrive), cached copy when offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))),
  );
});

// Tapping a reminder notification opens Sitara.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => (list[0] ? list[0].focus() : self.clients.openWindow('./'))));
});
