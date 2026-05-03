'use client'

import { useState } from 'react'
import type { Invitation, UserProfile } from '@/types'

type AdminUserSummary = Pick<UserProfile, 'id' | 'email' | 'role' | 'created_at'> & {
  preferred_model?: string | null
}

interface Props {
  initialUsers: AdminUserSummary[]
  initialInvites: Invitation[]
}

export default function UsersAdminPanel({ initialUsers, initialInvites }: Props) {
  const [users, setUsers] = useState<AdminUserSummary[]>(initialUsers)
  const [invites, setInvites] = useState<Invitation[]>(initialInvites)
  const [email, setEmail] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [creatingUser, setCreatingUser] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    if (!res.ok) {
      setError(data.error ?? 'No se pudo crear la invitación')
      setLoading(false)
      return
    }
    setInviteUrl(data.url)
    if (data.invite) {
      setInvites(prev => [data.invite, ...prev])
    }
    setEmail('')
    setLoading(false)
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setCreatingUser(true)
    setError(null)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newUserEmail, password: newUserPassword, role: newUserRole }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'No se pudo crear el usuario')
      setCreatingUser(false)
      return
    }
    setUsers(prev => [...prev, data.user])
    setNewUserEmail('')
    setNewUserPassword('')
    setNewUserRole('user')
    setCreatingUser(false)
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">Administración</h1>
      <p className="text-sm text-slate-400 mb-6">Gestioná usuarios activos e invitaciones del equipo.</p>

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
        <h2 className="text-sm font-semibold text-slate-400 mb-3">Crear usuario manualmente</h2>
        <form onSubmit={createUser} className="space-y-2 mb-3">
          <input
            type="email"
            value={newUserEmail}
            onChange={e => setNewUserEmail(e.target.value)}
            placeholder="usuario@ejemplo.com"
            required
            className="w-full bg-slate-800 text-white rounded-lg px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500 text-sm"
          />
          <input
            type="password"
            value={newUserPassword}
            onChange={e => setNewUserPassword(e.target.value)}
            placeholder="Contraseña inicial (mínimo 8 caracteres)"
            minLength={8}
            required
            className="w-full bg-slate-800 text-white rounded-lg px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500 text-sm"
          />
          <select
            value={newUserRole}
            onChange={e => setNewUserRole(e.target.value as 'admin' | 'user')}
            className="w-full bg-slate-800 text-white rounded-lg px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500 text-sm"
          >
            <option value="user">Usuario</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={creatingUser}
            className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
          >
            {creatingUser ? 'Creando...' : 'Crear usuario'}
          </button>
        </form>
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
