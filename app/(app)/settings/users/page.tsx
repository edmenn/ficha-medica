'use client'

import { useState, useEffect } from 'react'
import type { UserProfile, Invitation } from '@/types'

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [invites, setInvites] = useState<Invitation[]>([])
  const [email, setEmail] = useState('')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users ?? []))
    fetch('/api/invites/list').then(r => r.json()).then(d => setInvites(d.invites ?? []))
  }, [])

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }
    setInviteUrl(data.url)
    setEmail('')
    setLoading(false)
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Usuarios</h1>

      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-400 mb-3">Activos</h2>
        {users.map(u => (
          <div key={u.id} className="bg-slate-800 rounded-xl p-3 mb-2 flex justify-between items-center">
            <div>
              <p className="text-white text-sm">{u.email}</p>
              <p className="text-xs text-slate-500">{u.role}</p>
            </div>
            <span className="text-xs text-green-400">● activo</span>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-400 mb-3">Invitar usuario</h2>
        <form onSubmit={sendInvite} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="email@ejemplo.com"
            required
            className="flex-1 bg-slate-800 text-white rounded-lg px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
          >
            {loading ? '...' : 'Invitar'}
          </button>
        </form>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        {inviteUrl && (
          <div className="mt-3 bg-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">Link de invitación:</p>
            <p className="text-xs text-blue-400 break-all">{inviteUrl}</p>
            <button
              onClick={() => navigator.clipboard.writeText(inviteUrl)}
              className="text-xs text-slate-500 mt-1"
            >
              Copiar
            </button>
          </div>
        )}
      </div>

      {invites.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 mb-3">Invitaciones pendientes</h2>
          {invites.map(inv => (
            <div key={inv.id} className="bg-slate-800 rounded-xl p-3 mb-2 flex justify-between items-center">
              <p className="text-white text-sm">{inv.email}</p>
              <span className="text-xs text-yellow-400">pendiente</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
