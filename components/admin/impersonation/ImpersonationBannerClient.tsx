'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ImpersonationBannerClient({ targetEmail }: { targetEmail: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleStop() {
    setLoading(true)
    const res = await fetch('/api/admin/impersonation/stop', { method: 'POST' })
    if (res.ok) {
      const data = await res.json() as { redirect?: string }
      router.push(data.redirect ?? '/admin')
      router.refresh()
    } else {
      setLoading(false)
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-amber-700 px-4 py-2 text-sm text-white">
      <span>Viendo el sistema como <strong>{targetEmail}</strong></span>
      <button
        onClick={handleStop}
        disabled={loading}
        className="rounded bg-amber-900 px-3 py-1 text-xs font-medium disabled:opacity-50"
      >
        {loading ? 'Saliendo...' : 'Volver a admin'}
      </button>
    </div>
  )
}
