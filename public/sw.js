const CACHE = 'ficha-medica-v2'
const APP_SHELL = ['/']
const DB_NAME = 'ficha-medica-offline'
const STORE_NAME = 'pending-uploads'

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

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Sin conexión' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )
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

self.addEventListener('sync', event => {
  if (event.tag === 'upload-pending') {
    event.waitUntil(flushPendingUploads())
  }
})

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getPendingUploads() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function removePendingUpload(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function flushPendingUploads() {
  const uploads = await getPendingUploads()

  for (const upload of uploads) {
    const form = new FormData()
    form.append('image', new File([upload.image], 'pending-upload.jpg', { type: upload.image.type || 'image/jpeg' }))
    if (upload.recordId) {
      form.append('record_id', upload.recordId)
    }

    const response = await fetch('/api/analyze', { method: 'POST', body: form })
    if (response.ok) {
      await removePendingUpload(upload.id)
    }
  }
}
