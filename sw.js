/* ============================================================
   DAMAS ROYALE — Service Worker (PWA)
   App-shell cache-first; CDN e Firebase sempre pela rede.
   Trocar CACHE ao publicar nova versão invalida o cache antigo.
   ============================================================ */

const CACHE = 'damas-royale-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './css/style.css',
  './js/main.js',
  './js/rules.js',
  './js/ai.js',
  './js/elo.js',
  './js/leagues.js',
  './js/online.js',
  './js/firebase-config.js',
  './js/scene.js',
  './js/board3d.js',
  './js/pieces3d.js',
  './js/fx.js',
  './js/ui.js',
  './js/input.js',
  './js/audio.js',
  './js/history.js',
  './js/themes.js',
  './js/utils.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => {/* offline na instalação — ignora */})
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Recursos externos (Three.js, Firebase, fontes) e tempo real:
     sempre pela rede — não fazem sentido em cache offline. */
  if (url.origin !== self.location.origin) return;

  /* App-shell do mesmo domínio: network-first (sempre a versão mais nova
     quando online) com fallback ao cache quando offline. */
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
