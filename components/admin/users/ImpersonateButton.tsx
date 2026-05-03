'use client'

import { useState } from 'react'

export default function ImpersonateButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const res = await fetch('/api/admin/impersonation/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: userId }),
    })
    if (res.ok) {
      window.location.href = '/records'
    } else {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded-lg bg-amber-700 px-4 py-2 text-sm text-white disabled:opacity-50"
    >
      {loading ? 'Entrando...' : 'Entrar como usuario'}
    </button>
  )
}
