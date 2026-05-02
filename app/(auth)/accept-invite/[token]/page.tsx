'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)

  useEffect(() => {
    async function validateToken() {
      const res = await fetch(`/api/invites?token=${token}`)
      if (!res.ok) {
        setError('Invitación inválida o vencida')
        setValidating(false)
        return
      }
      const data = await res.json()
      setEmail(data.email)
      setValidating(false)
    }
    validateToken()
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Error al activar la cuenta')
      setLoading(false)
      return
    }
    const supabase = createClient()
    await supabase.auth.signInWithPassword({ email, password })
    router.push('/records')
  }

  if (validating) return <p className="text-slate-400">Verificando invitación...</p>

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Activar cuenta</h1>
      <p className="text-slate-400 mb-6">{email}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Elegí una contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            minLength={8}
            required
            className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 border border-slate-700 focus:outline-none focus:border-blue-500"
          />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg"
        >
          {loading ? 'Activando...' : 'Activar cuenta'}
        </button>
      </form>
    </div>
  )
}
