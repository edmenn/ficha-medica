'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  userId: string
  initialRole: 'admin' | 'user'
  initialIsActive: boolean
}

export default function UserAdminActions({ userId, initialRole, initialIsActive }: Props) {
  const router = useRouter()
  const [role, setRole] = useState(initialRole)
  const [isActive, setIsActive] = useState(initialIsActive)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function saveChanges(next?: { role?: 'admin' | 'user'; is_active?: boolean }) {
    setLoading(true)
    setError(null)
    setMessage(null)

    const payload = {
      role,
      is_active: isActive,
      ...next,
    }

    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'No se pudo guardar')
      return
    }

    setRole(data.user.role)
    setIsActive(data.user.is_active)
    setMessage('Cambios guardados')
    router.refresh()
  }

  async function deleteUser() {
    if (!window.confirm('Esto desactiva el usuario y bloquea su acceso operativo. ¿Continuar?')) return

    setLoading(true)
    setError(null)
    setMessage(null)

    const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'No se pudo eliminar')
      return
    }

    setIsActive(false)
    setMessage('Usuario eliminado')
    router.refresh()
  }

  async function startImpersonation() {
    setLoading(true)
    setError(null)

    const res = await fetch('/api/admin/impersonation/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: userId }),
    })
    const data = await res.json().catch(() => ({}))

    if (res.ok) {
      window.location.href = '/records'
      return
    }

    setLoading(false)
    setError(data.error ?? 'No se pudo entrar como usuario')
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">Acciones administrativas</p>

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-400">Rol</span>
          <select
            value={role}
            onChange={event => setRole(event.target.value as 'admin' | 'user')}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
          >
            <option value="user">Usuario</option>
            <option value="admin">Admin</option>
          </select>
        </label>

        <label className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2">
          <span className="text-sm text-slate-300">Usuario activo</span>
          <input
            type="checkbox"
            checked={isActive}
            onChange={event => setIsActive(event.target.checked)}
            className="h-5 w-5"
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {message && <p className="text-sm text-emerald-400">{message}</p>}

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => saveChanges()}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Guardar cambios
          </button>

          {role === 'user' && isActive && (
            <button
              type="button"
              onClick={startImpersonation}
              disabled={loading}
              className="rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Entrar como usuario
            </button>
          )}

          {!isActive && (
            <button
              type="button"
              onClick={() => saveChanges({ is_active: true })}
              disabled={loading}
              className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Reactivar usuario
            </button>
          )}

          {isActive && (
            <button
              type="button"
              onClick={deleteUser}
              disabled={loading}
              className="rounded-lg bg-red-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Eliminar usuario
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
