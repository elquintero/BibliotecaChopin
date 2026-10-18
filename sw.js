/* Service worker de la Biblioteca del Concurso Chopin.
   Guarda la propia aplicación (HTML, iconos y hls.js) para que abra sin conexión.
   Los vídeos NO se guardan ni se interceptan: siempre se piden a su servidor. */
const VERSION = 'v5'; // súbelo (v2, v3…) cuando cambies index.html para forzar la actualización
const CACHE = 'biblioteca-chopin-' + VERSION;
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './maskable-512.png',
  './apple-touch-icon.png'
];
const HLS = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    try { await cache.add(HLS); } catch (e) { /* sin red al instalar: se guardará en el primer uso */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('biblioteca-chopin-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return; // vídeo y peticiones parciales: no se tocan

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && req.url !== HLS) return; // streams y otros dominios: directos a la red

  // La página: primero red (para recibir cambios), y si no hay conexión, la copia guardada
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE)).put('./index.html', res.clone());
        return res;
      } catch (e) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Resto de archivos de la app y hls.js: copia guardada al instante y se refresca en segundo plano
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const refresh = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    return cached || (await refresh) || Response.error();
  })());
});
