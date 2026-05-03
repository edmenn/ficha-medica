'use client'

const DB_NAME = 'ficha-medica-offline'
const STORE_NAME = 'pending-uploads'

interface PendingUploadRecord {
  id: string
  createdAt: number
  recordId: string | null
  image: Blob
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

export async function flushPendingUploads() {
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
