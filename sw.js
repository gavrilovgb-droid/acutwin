const CACHE = 'acutwin-v11';

// JS-файлы с логикой — НЕ кэшируем, чтобы обновления доходили сразу
const NO_CACHE_JS = ['/shared.js', '/auth.js', '/api.js'];

// HTML не кэшируем предварительно — только статические ассеты
const STATIC = [
  '/tailwind.css',
  '/design.css',
  '/fonts.css',
  '/manifest.json',
  '/icons/icon.svg',
  '/vitruvian-digital.png',
  '/body-v2.png',
  '/wuxing.png',
  '/data/diseases-index.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API и ключевые JS — только сеть, без кэша
  if (url.pathname.startsWith('/api/')) return;
  if (NO_CACHE_JS.includes(url.pathname)) return;

  // HTML — network-first: всегда пробуем сеть, кэш только при офлайн
  // Это гарантирует что no-store соблюдается и bfcache работает корректно
  const isHtml = url.pathname.endsWith('.html')
    || url.pathname === '/'
    || !url.pathname.includes('.');

  if (isHtml) {
    e.respondWith(
      fetch(e.request)
        .catch(() => caches.match(e.request)) // офлайн-фолбэк
    );
    return;
  }

  // Статика (CSS, JS, изображения) — cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});
