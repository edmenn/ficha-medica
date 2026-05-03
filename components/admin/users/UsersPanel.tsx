'use client'

import { useState } from 'react'
import Link from 'next/link'

interface User {
  id: string
  email: string
  role: 'admin' | 'user'
  is_active: boolean
  created_at: string
  record_count: number
}

interface Invitation {
  id: string
  email: string
  accepted_at: string | null
  created_at: string
  expires_at: string
}

interface Props {
  users: User[]
  invitations: Invitation[]
}

function invitationStatus(invitation: Invitation) {
  if (invitation.accepted_at) return 'Aceptada'
  if (new Date(invitation.expires_at) < new Date()) return 'Expirada'
  return 'Pendiente'
}

export default function UsersPanel({ users, invitations }: Props) {
  const [tab, setTab] = useState<'users' | 'invitations'>('users')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [inviteEmail, setInviteEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error)
      return
    }
    setShowCreateForm(false)
    setEmail('')
    setPassword('')
    setRole('user')
    window.location.reload()
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error)
      return
    }
    setShowInviteForm(false)
    setInviteEmail('')
    window.location.reload()
  }

  async function handleStartImpersonation(userId: string) {
    const res = await fetch('/api/admin/impersonation/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: userId }),
    })
    if (res.ok) window.location.href = '/records'
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Usuarios</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowInviteForm(value => !value); setShowCreateForm(false) }}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-white"
          >
            Invitar
          </button>
          <button
            onClick={() => { setShowCreateForm(value => !value); setShowInviteForm(false) }}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white"
          >
            Crear usuario
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-900/30 border border-red-700 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {showCreateForm && (
        <form onSubmit={handleCreate} className="mb-4 rounded-xl border border-slate-700 bg-slate-900/70 p-4 space-y-3">
          <p className="text-sm font-medium text-white">Nuevo usuario</p>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña (mínimo 8 caracteres)" required minLength={8} className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500" />
          <select value={role} onChange={e => setRole(e.target.value as 'user' | 'admin')} className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white">
            <option value="user">Usuario</option>
            <option value="admin">Admin</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">
              {loading ? 'Creando...' : 'Crear'}
            </button>
            <button type="button" onClick={() => setShowCreateForm(false)} className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-white">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {showInviteForm && (
        <form onSubmit={handleInvite} className="mb-4 rounded-xl border border-slate-700 bg-slate-900/70 p-4 space-y-3">
          <p className="text-sm font-medium text-white">Invitar por email</p>
          <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email" required className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500" />
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">
              {loading ? 'Enviando...' : 'Invitar'}
            </button>
            <button type="button" onClick={() => setShowInviteForm(false)} className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-white">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="mb-4 flex gap-2">
        <button onClick={() => setTab('users')} className={`rounded-lg px-3 py-1.5 text-sm ${tab === 'users' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
          Usuarios ({users.length})
        </button>
        <button onClick={() => setTab('invitations')} className={`rounded-lg px-3 py-1.5 text-sm ${tab === 'invitations' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
          Invitaciones ({invitations.length})
        </button>
      </div>

      {tab === 'users' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/70">
                <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">Email</th>
                <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">Rol</th>
                <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">Estado</th>
                <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">Alta</th>
                <th className="px-4 py-2 text-right text-xs text-slate-400 font-medium">Registros</th>
                <th className="px-4 py-2 text-right text-xs text-slate-400 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/40">
              {users.map(user => (
                <tr key={user.id}>
                  <td className="px-4 py-3 text-white">{user.email}</td>
                  <td className="px-4 py-3 text-slate-300">{user.role}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${user.is_active ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {user.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{new Date(user.created_at).toLocaleDateString('es-AR')}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{user.record_count}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/users/${user.id}`} className="rounded px-2 py-1 text-xs bg-slate-700 text-white">Ver</Link>
                      {user.role === 'user' && user.is_active && (
                        <button onClick={() => handleStartImpersonation(user.id)} className="rounded px-2 py-1 text-xs bg-amber-700 text-white">
                          Entrar como usuario
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'invitations' && (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/70">
                <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">Email</th>
                <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">Estado</th>
                <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">Expira</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/40">
              {invitations.map(invitation => (
                <tr key={invitation.id}>
                  <td className="px-4 py-3 text-white">{invitation.email}</td>
                  <td className="px-4 py-3 text-slate-300">{invitationStatus(invitation)}</td>
                  <td className="px-4 py-3 text-slate-400">{new Date(invitation.expires_at).toLocaleDateString('es-AR')}</td>
                </tr>
              ))}
              {invitations.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-center text-sm text-slate-500">Sin invitaciones</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
