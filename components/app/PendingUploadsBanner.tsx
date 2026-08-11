'use client'

import { useCallback, useEffect, useState } from 'react'
import { flushPendingUploads, getPendingUploads, purgeExpiredPendingUploads, removePendingUpload } from '@/lib/pending-uploads'

interface SyncResult {
  sent: number
  failed: number
  remaining: number
}

export default function PendingUploadsBanner() {
  const [count, setCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const uploads = await getPendingUploads()
    setCount(uploads.length)
  }, [])

  useEffect(() => {
    void purgeExpiredPendingUploads().then(refresh)

    function onOnline() {
      void refresh()
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [refresh])

  async function handleSync() {
    setSyncing(true)
    setError(null)
    try {
      const res = await flushPendingUploads()
      setResult(res)
      await refresh()
    } catch {
      setError('No se pudo sincronizar. Intentá de nuevo.')
    } finally {
      setSyncing(false)
    }
  }

  async function handleDiscardAll() {
    const uploads = await getPendingUploads()
    for (const u of uploads) {
      await removePendingUpload(u.id)
    }
    setResult(null)
    await refresh()
  }

  if (count === 0 && !result) return null

  return (
    <div className="mb-4 rounded-xl border border-amber-700 bg-amber-950/40 p-4 text-amber-200">
      <p className="mb-2 text-sm font-semibold">
        {count > 0
          ? `Hay ${count} ficha${count !== 1 ? 's' : ''} pendiente${count !== 1 ? 's' : ''} de enviar en este dispositivo.`
          : 'Sincronización terminada.'}
      </p>

      {result && (
        <p className="mb-2 text-xs text-amber-300">
          Enviadas: {result.sent} · Fallidas: {result.failed} · Pendientes: {result.remaining}
        </p>
      )}
      {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
      <p className="mb-2 text-xs text-amber-400/80">
        Las imágenes se guardan sin cifrar en este dispositivo. Las fichas recuperadas quedarán como borrador para que las revises antes de confirmarlas. Cerrá sesión o borralas cuando termines para no dejar datos médicos en el equipo.
      </p>

      {count > 0 && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {syncing ? 'Enviando...' : 'Enviar ahora'}
          </button>
          <button
            type="button"
            onClick={handleDiscardAll}
            disabled={syncing}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            Descartar todas
          </button>
        </div>
      )}
    </div>
  )
}
