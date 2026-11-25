/* PrintLab service worker — the installed app opens offline, but whenever
   the device is online it fetches the newest version first.
   - Page loads (navigations): network-first — online you always get the
     latest index.html; offline the cached copy is served exactly as-is.
   - Other same-origin files (icons, manifest): cache-first, refreshed
     whenever a new service worker version installs.
   - The jsPDF library from cdnjs is cached on first use so PDF export
     works offline. */
const CACHE = 'printlab-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    if (e.request.mode === 'navigate') {
      // Page open: newest from the network when online, cached copy when offline.
      e.respondWith(
        fetch(e.request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return res;
          })
          .catch(() =>
            caches.match(e.request).then((hit) => hit || caches.match('/index.html'))
          )
      );
    } else {
      e.respondWith(
        caches.match(e.request).then(
          (hit) =>
            hit ||
            fetch(e.request)
              .then((res) => {
                const copy = res.clone();
                caches.open(CACHE).then((c) => c.put(e.request, copy));
                return res;
              })
              .catch(() => caches.match('/index.html'))
        )
      );
    }
  } else if (url.hostname === 'cdnjs.cloudflare.com') {
    // jsPDF library — cache on first successful load so PDF export works offline.
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  }
});
