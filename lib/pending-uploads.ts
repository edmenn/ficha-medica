'use client'

const DB_NAME = 'ficha-medica-offline'
const STORE_NAME = 'pending-uploads'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 días: las cargas pendientes vencen.

export interface PendingUploadRecord {
  id: string
  createdAt: number
  recordId: string | null
  image: Blob
  attempts: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function savePendingUpload(file: File, recordId: string | null) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      recordId,
      image: file,
      attempts: 0,
    } satisfies PendingUploadRecord)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPendingUploads(): Promise<PendingUploadRecord[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve(request.result as PendingUploadRecord[])
    request.onerror = () => reject(request.error)
  })
}

export async function removePendingUpload(id: string) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Elimina cargas vencidas y devuelve cuántas se descartaron.
export async function purgeExpiredPendingUploads(now = Date.now()): Promise<number> {
  const uploads = await getPendingUploads()
  const expired = uploads.filter(u => now - u.createdAt > MAX_AGE_MS)
  for (const u of expired) {
    await removePendingUpload(u.id)
  }
  return expired.length
}

export async function incrementAttempt(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const record = getReq.result as PendingUploadRecord | undefined
      if (record) {
        store.put({ ...record, attempts: (record.attempts ?? 0) + 1 })
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Intenta sincronizar las cargas pendientes. Devuelve un resumen
// {sent, failed, remaining} para que la UI lo muestre al usuario.
export async function flushPendingUploads(): Promise<{ sent: number; failed: number; remaining: number }> {
  const uploads = await getPendingUploads()
  let sent = 0
  let failed = 0

  for (const upload of uploads) {
    if (Date.now() - upload.createdAt > MAX_AGE_MS) {
      await removePendingUpload(upload.id)
      continue
    }

    try {
      const form = new FormData()
      form.append('image', new File([upload.image], 'pending-upload.jpg', { type: upload.image.type || 'image/jpeg' }))
      if (upload.recordId) {
        form.append('record_id', upload.recordId)
      }

      const response = await fetch('/api/analyze', { method: 'POST', body: form })
      if (response.ok) {
        await removePendingUpload(upload.id)
        sent += 1
      } else {
        await incrementAttempt(upload.id)
        failed += 1
      }
    } catch {
      await incrementAttempt(upload.id)
      failed += 1
    }
  }

  const remaining = (await getPendingUploads()).length
  return { sent, failed, remaining }
}
