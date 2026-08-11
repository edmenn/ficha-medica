const CACHE = 'ficha-medica-v3'
const APP_SHELL = ['/']

self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)))
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Nunca cachear respuestas de API: no se persisten datos médicos en el dispositivo.
  if (url.pathname.startsWith('/api/')) {
    return
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request).then(cached => cached ?? caches.match('/')))
    )
    return
  }

  event.respondWith(caches.match(event.request).then(cached => cached ?? fetch(event.request)))
})
