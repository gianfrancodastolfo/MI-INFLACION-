// Service worker de Stock Flores: guarda la app para abrirla rápido y sin conexión.
// Nunca guarda las respuestas del servidor (las operaciones siempre van a la planilla).
const CACHE = 'stock-flores-v1';
const BASE = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Páginas: primero la red (para tener siempre la última versión), si no hay, la guardada.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copia));
          return r;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  // Archivos de la app (con nombre único por versión), fotos e íconos: primero lo guardado.
  e.respondWith(
    caches.match(req).then(
      (guardado) =>
        guardado ||
        fetch(req).then((r) => {
          if (r.ok) {
            const copia = r.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return r;
        }),
    ),
  );
});
