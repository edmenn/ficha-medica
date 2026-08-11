'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface AuditActor {
  id: string
  email: string
  role: string
}

interface AuditEntry {
  id: string
  user_id: string
  effective_user_id?: string | null
  record_id?: string | null
  action: string
  diff: Record<string, unknown>
  created_at: string
}

interface Props {
  initialEntries: AuditEntry[]
  total: number
  actors: AuditActor[]
  availableActions: string[]
  actionLabels: Record<string, string>
  initialQuery: { q: string; record_id: string; action: string; from: string; to: string }
}

  function formatDateTime(value: string) {
    return new Date(value).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

function renderDiff(diff: Record<string, unknown>): string {
  if (!diff || typeof diff !== 'object') return '—'
  const entries = Object.entries(diff)
  if (entries.length === 0) return '—'
  return entries
    .map(([key, value]) => {
      if (key === 'previous' || key === 'current') {
        return `${key === 'previous' ? 'Antes' : 'Ahora'}: ${JSON.stringify(value)}`
      }
      return `${key}: ${JSON.stringify(value)}`
    })
    .join(' · ')
}

export default function AuditLogClient({
  initialEntries,
  total,
  actors,
  availableActions,
  actionLabels,
  initialQuery,
}: Props) {
  const router = useRouter()
  const [q, setQ] = useState(initialQuery.q)
  const [recordId, setRecordId] = useState(initialQuery.record_id)
  const [action, setAction] = useState(initialQuery.action)
  const [from, setFrom] = useState(initialQuery.from)
  const [to, setTo] = useState(initialQuery.to)

  const actorMap = new Map(actors.map(actor => [actor.id, actor.email]))

  function applyFilters() {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (recordId) params.set('record_id', recordId)
    if (action) params.set('action', action)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const qs = params.toString()
    router.push(qs ? `/admin/audit?${qs}` : '/admin/audit')
  }

  return (
    <div>
      <div className="mb-4 grid gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Email del actor</label>
          <select
            value={q}
            onChange={e => setQ(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
          >
            <option value="">Todos</option>
            {actors.map(actor => (
              <option key={actor.id} value={actor.email}>{actor.email}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">ID de registro</label>
          <input
            type="text"
            value={recordId}
            onChange={e => setRecordId(e.target.value)}
            placeholder="uuid del registro"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Acción</label>
          <select
            value={action}
            onChange={e => setAction(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
          >
            <option value="">Todas</option>
            {availableActions.map(a => (
              <option key={a} value={a}>{actionLabels[a] ?? a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Desde</label>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white [color-scheme:dark]"
          />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-slate-500">Hasta</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white [color-scheme:dark]"
            />
          </div>
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
          >
            Aplicar
          </button>
        </div>
      </div>

      <p className="mb-3 text-sm text-slate-400">{total} eventos (mostrando hasta 200)</p>

      <div className="space-y-2">
        {initialEntries.length === 0 && (
          <p className="py-8 text-center text-slate-500">Sin eventos para los filtros elegidos</p>
        )}
        {initialEntries.map(entry => (
          <div key={entry.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-white">
                {actionLabels[entry.action] ?? entry.action}
              </span>
              <span className="text-xs text-slate-500">{formatDateTime(entry.created_at)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Actor: {actorMap.get(entry.user_id) ?? entry.user_id}
              {entry.effective_user_id && ` · afectó a: ${actorMap.get(entry.effective_user_id) ?? entry.effective_user_id}`}
              {entry.record_id && ` · registro: ${entry.record_id.slice(0, 8)}…`}
            </p>
            <p className="mt-1 break-words text-xs text-slate-500">{renderDiff(entry.diff)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
