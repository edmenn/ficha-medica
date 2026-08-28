'use client'

import { useEffect, useState } from 'react'
import { formatUsd } from '@/lib/formatters'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { clearAppCache } from '@/lib/clear-cache'
import type { UserRole } from '@/types'

interface OpenRouterModelOption {
  id: string
  name: string
  context_length: number | null
}

interface UsageSummary {
  total_cost_usd: number | null
  total_requests: number
  total_tokens: number | null
  balance_usd: number | null
}

interface Props {
  initialRole: UserRole
  initialPreferredModel: string | null
}

export default function SettingsPageClient({
  initialRole,
  initialPreferredModel,
}: Props) {
  const router = useRouter()
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(initialPreferredModel ?? 'anthropic/claude-3.5-sonnet')
  const [modelQuery, setModelQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [models, setModels] = useState<OpenRouterModelOption[]>([])
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [clearingCache, setClearingCache] = useState(false)
  const [cacheMessage, setCacheMessage] = useState<string | null>(null)
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [sanatoriums, setSanatoriums] = useState<{ id: string; name: string }[]>([])
  const [newSanatorium, setNewSanatorium] = useState('')
  const [sanatoriumError, setSanatoriumError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/settings/usage')
      .then(res => res.ok ? res.json() : null)
      .then(data => setUsage(data))
      .catch(() => setUsage(null))
  }, [])

  useEffect(() => {
    if (initialRole !== 'user') return
    fetch('/api/sanatoriums')
      .then(res => res.ok ? res.json() : { sanatoriums: [] })
      .then(data => setSanatoriums(data.sanatoriums ?? []))
      .catch(() => setSanatoriums([]))
  }, [initialRole])

  async function addSanatorium() {
    setSanatoriumError(null)
    if (!newSanatorium.trim()) return
    const res = await fetch('/api/sanatoriums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newSanatorium.trim() }),
    })
    const data = await res.json()
    if (res.ok) {
      setSanatoriums(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewSanatorium('')
    } else {
      setSanatoriumError(data.error ?? 'No se pudo agregar el sanatorio')
    }
  }

  async function removeSanatorium(id: string) {
    setSanatoriumError(null)
    await fetch(`/api/sanatoriums?id=${id}`, { method: 'DELETE' })
    setSanatoriums(prev => prev.filter(s => s.id !== id))
  }

  async function ensureModelsLoaded() {
    if (modelsLoaded) return
    try {
      const res = await fetch('/api/models')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo cargar la lista de modelos')
      setModels(data.models ?? [])
      setModelsLoaded(true)
    } catch (err) {
      setModelsError(err instanceof Error ? err.message : 'No se pudo cargar la lista de modelos')
      setModelsLoaded(true)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setModelsError(null)

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openrouter_key: apiKey || undefined, preferred_model: model }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Ocurrió un error al guardar la configuración')
      }

      setSaved(true)
      setApiKey('')
      setTimeout(() => setSaved(false), 3000)
      router.refresh()
    } catch (err) {
      setModelsError(err instanceof Error ? err.message : 'Error desconocido al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSaved(false)

    if (password !== passwordConfirm) {
      setPasswordError('Las contraseñas no coinciden')
      return
    }

    setPasswordSaving(true)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setPasswordError(error.message)
      setPasswordSaving(false)
      return
    }

    setPassword('')
    setPasswordConfirm('')
    setPasswordSaving(false)
    setPasswordSaved(true)
    setTimeout(() => setPasswordSaved(false), 3000)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function handleClearCache() {
    setClearingCache(true)
    setCacheMessage(null)
    const { cleared, swUnregistered } = await clearAppCache()
    setClearingCache(false)
    const parts: string[] = []
    if (cleared > 0) parts.push(`${cleared} caché(s)`)
    if (swUnregistered) parts.push('service worker')
    setCacheMessage(`Listo${parts.length ? ': ' + parts.join(' y ') : ''}. Recargando...`)
    setTimeout(() => {
      window.location.href = '/settings'
    }, 800)
  }

  const filteredModels = models.filter(option => {
    const q = modelQuery.trim().toLowerCase()
    if (!q) return true
    return option.id.toLowerCase().includes(q) || option.name.toLowerCase().includes(q)
  }).slice(0, 50)
  const showOperationalSettings = initialRole === 'user'

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
        <h1 className="text-xl font-bold">Configuración</h1>
        <p className="mt-1 text-sm text-slate-400">Cuenta, modelo, campos y mantenimiento</p>
      </div>

      {usage && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5 text-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Uso de IA (informativo)
          </p>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <p className="text-xs text-slate-500">Saldo OpenRouter</p>
              <p className="text-base font-semibold text-slate-200">
                {usage.balance_usd != null ? formatUsd(usage.balance_usd) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Uso total histórico</p>
              <p className="text-base font-semibold text-slate-200">
                {usage.total_cost_usd != null ? formatUsd(usage.total_cost_usd) : formatUsd(0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Consultas IA totales</p>
              <p className="text-base font-semibold text-slate-200">{usage.total_requests}</p>
            </div>
          </div>
        </div>
      )}

      {showOperationalSettings && <form onSubmit={handleSave} className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
        <div>
          <label className="mb-1 block text-sm text-slate-400">OpenRouter API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-or-v1-... (dejá vacío para no cambiar)"
            className="h-10 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 font-mono text-sm text-white focus:border-blue-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-500">Se guarda encriptada. Obtené tu key en openrouter.ai</p>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Modelo preferido</label>
          <input
            type="text"
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder="anthropic/claude-3.5-sonnet"
            className="mb-3 h-10 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 font-mono text-sm text-white focus:border-blue-500 focus:outline-none"
          />
          <label className="mb-1 block text-sm text-slate-400">Buscar y seleccionar modelo</label>
          <input
            type="search"
            value={modelQuery}
            onFocus={() => { void ensureModelsLoaded() }}
            onChange={e => {
              void ensureModelsLoaded()
              setModelQuery(e.target.value)
            }}
            placeholder="Ej: Claude, GPT-4, Llama..."
            className="mb-2 h-10 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
          {modelQuery.trim().length > 0 && (
            <div className="mb-2 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-2">
              {filteredModels.length === 0 ? (
                <p className="p-2 text-sm text-slate-500">No se encontraron modelos</p>
              ) : (
                filteredModels.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setModel(option.id)
                      setModelQuery('')
                    }}
                    className="mb-1 flex w-full flex-col rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-800"
                  >
                    <span className="text-sm font-medium text-slate-200">{option.name}</span>
                    <span className="mt-0.5 font-mono text-xs text-slate-500">{option.id}</span>
                  </button>
                ))
              )}
            </div>
          )}
          {modelsError && <p className="mt-1 text-xs text-amber-400">{modelsError}</p>}
          {!modelsError && (
            <p className="mt-1 text-xs text-slate-500">
              {modelsLoaded && models.length > 0
                ? `Modelos cargados: ${models.length}. Usá el buscador para encontrar un modelo fácilmente.`
                : 'La lista se carga cuando empezás a buscar.'}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="h-10 w-full rounded-xl bg-blue-600 px-4 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saved ? '✓ Guardado' : saving ? 'Guardando...' : 'Guardar'}
        </button>
      </form>}

      {showOperationalSettings && (
        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-400">Sanatorios</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newSanatorium}
              onChange={e => setNewSanatorium(e.target.value.toLocaleUpperCase('es'))}
              placeholder="Nombre del sanatorio"
              className="h-10 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={addSanatorium}
              className="h-10 shrink-0 rounded-lg bg-slate-700 px-4 text-sm font-medium text-white hover:bg-slate-600"
            >
              Agregar
            </button>
          </div>
          {sanatoriumError && <p className="text-xs text-red-400">{sanatoriumError}</p>}
          <div className="flex flex-wrap gap-2">
            {sanatoriums.length === 0 && <p className="text-sm text-slate-500">Todavía no hay sanatorios. Se usan para autocompletar en el formulario.</p>}
            {sanatoriums.map(s => (
              <span key={s.id} className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200">
                {s.name}
                <button
                  type="button"
                  onClick={() => removeSanatorium(s.id)}
                  className="text-slate-500 hover:text-red-400"
                  aria-label={`Quitar ${s.name}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-400">Cuenta</h2>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-slate-400">Nueva contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={8}
              required
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Repetir nueva contraseña</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={e => setPasswordConfirm(e.target.value)}
              minLength={8}
              required
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={passwordSaving}
              className="flex-1 rounded-xl bg-slate-700 px-4 py-3 font-medium text-white hover:bg-slate-600 disabled:opacity-50"
            >
              {passwordSaved ? '✓ Contraseña actualizada' : passwordSaving ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl bg-red-900 px-4 py-3 font-medium text-white hover:bg-red-800"
            >
              Logout
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-400">Solución de problemas</h2>
        <p className="mb-3 text-xs text-slate-500">
          Si ves una versión desactualizada de la app, limpiá el caché local. Esto no borra tus fichas ni tu cuenta.
        </p>
        <button
          type="button"
          onClick={handleClearCache}
          disabled={clearingCache}
          className="h-10 w-full rounded-xl bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {clearingCache ? 'Limpiando...' : '🧹 Limpiar caché y actualizar'}
        </button>
        {cacheMessage && <p className="mt-2 text-xs text-emerald-400">{cacheMessage}</p>}
      </div>
    </div>
  )
}
