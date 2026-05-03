'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { CustomFieldTemplate, UserRole } from '@/types'

interface OpenRouterModelOption {
  id: string
  name: string
  context_length: number | null
}

interface Props {
  initialRole: UserRole
  initialPreferredModel: string | null
  initialCustomFields: CustomFieldTemplate[]
}

export default function SettingsPageClient({
  initialRole,
  initialPreferredModel,
  initialCustomFields,
}: Props) {
  const router = useRouter()
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(initialPreferredModel ?? 'anthropic/claude-3.5-sonnet')
  const [modelQuery, setModelQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [customFields, setCustomFields] = useState(initialCustomFields)
  const [newFieldName, setNewFieldName] = useState('')
  const [models, setModels] = useState<OpenRouterModelOption[]>([])
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

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

  async function addField() {
    if (!newFieldName.trim()) return
    const res = await fetch('/api/custom-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field_name: newFieldName.trim(), field_type: 'text' }),
    })
    if (res.ok) {
      const data = await res.json()
      setCustomFields(prev => [...prev, data])
      setNewFieldName('')
    }
  }

  async function removeField(id: string) {
    await fetch(`/api/custom-fields/${id}`, { method: 'DELETE' })
    setCustomFields(prev => prev.filter(field => field.id !== id))
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

  const filteredModels = models.filter(option => {
    const q = modelQuery.trim().toLowerCase()
    if (!q) return true
    return option.id.toLowerCase().includes(q) || option.name.toLowerCase().includes(q)
  }).slice(0, 50)

  if (initialRole === 'admin') {
    return (
      <div>
        <h1 className="mb-6 text-xl font-bold">Cuenta administrativa</h1>

        <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-300">Workspace admin</h2>
          <p className="mb-3 text-sm text-slate-400">
            Este entorno es exclusivo para administración de usuarios y revisión de registros.
          </p>
          <Link
            href="/admin/users"
            className="inline-flex rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-600"
          >
            Ir a usuarios
          </Link>
        </div>

        <div>
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
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
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
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={passwordSaving}
                className="flex-1 rounded-xl bg-slate-700 py-3 font-medium text-white hover:bg-slate-600 disabled:opacity-50"
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
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">Configuración</h1>
      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label className="mb-1 block text-sm text-slate-400">OpenRouter API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-or-v1-... (dejá vacío para no cambiar)"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 font-mono text-sm text-white focus:border-blue-500 focus:outline-none"
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
            className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 font-mono text-sm text-white focus:border-blue-500 focus:outline-none"
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
            className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
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
                    className="mb-1 flex w-full flex-col rounded px-3 py-2 text-left transition-colors hover:bg-slate-800"
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
          className="w-full rounded-xl bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saved ? '✓ Guardado' : saving ? 'Guardando...' : 'Guardar'}
        </button>
      </form>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-400">Campos personalizados</h2>
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            value={newFieldName}
            onChange={e => setNewFieldName(e.target.value)}
            placeholder="Nombre del campo"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={addField}
            className="rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-600"
          >
            Agregar
          </button>
        </div>
        <div className="space-y-2">
          {customFields.map(field => (
            <div key={field.id} className="flex items-center justify-between rounded-xl bg-slate-800 p-3">
              <span className="text-sm text-white">{field.field_name}</span>
              <button
                type="button"
                onClick={() => removeField(field.id)}
                className="text-xs text-red-400"
              >
                Quitar
              </button>
            </div>
          ))}
          {customFields.length === 0 && (
            <p className="text-sm text-slate-500">Todavía no hay campos personalizados.</p>
          )}
        </div>
      </div>

      <div className="mt-8">
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
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
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
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={passwordSaving}
              className="flex-1 rounded-xl bg-slate-700 py-3 font-medium text-white hover:bg-slate-600 disabled:opacity-50"
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

    </div>
  )
}
