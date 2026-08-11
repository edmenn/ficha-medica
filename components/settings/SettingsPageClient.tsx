'use client'

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
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'date' | 'bool'>('text')
  const [newFieldRequired, setNewFieldRequired] = useState(false)
  const [customFieldError, setCustomFieldError] = useState<string | null>(null)
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
    setCustomFieldError(null)
    if (!newFieldName.trim()) return
    const res = await fetch('/api/custom-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        field_name: newFieldName.trim(),
        field_type: newFieldType,
        is_required: newFieldRequired,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setCustomFields(prev => [...prev, data])
      setNewFieldName('')
      setNewFieldType('text')
      setNewFieldRequired(false)
    } else {
      setCustomFieldError(data.error ?? 'No se pudo agregar el campo')
    }
  }

  async function updateField(id: string, patch: Partial<CustomFieldTemplate>) {
    setCustomFieldError(null)
    const res = await fetch(`/api/custom-fields/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (res.ok) {
      setCustomFields(prev => prev.map(field => field.id === id ? data : field))
    } else {
      setCustomFieldError(data.error ?? 'No se pudo actualizar el campo')
    }
  }

  async function removeField(id: string) {
    setCustomFieldError(null)
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
  const showCustomFields = initialRole === 'user'
  const showOperationalSettings = initialRole === 'user'

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">Configuración</h1>
      {showOperationalSettings && <form onSubmit={handleSave} className="space-y-5">
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
      </form>}

      {showCustomFields && <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-400">Campos personalizados</h2>
        <div className="mb-3 rounded-xl border border-slate-700 bg-slate-900/50 p-3">
          <input
            type="text"
            value={newFieldName}
            onChange={e => setNewFieldName(e.target.value)}
            placeholder="Nombre del campo"
            className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
          <div className="mb-2 flex items-center gap-2">
            <label className="text-xs text-slate-400">Tipo:</label>
            <select
              value={newFieldType}
              onChange={e => setNewFieldType(e.target.value as 'text' | 'number' | 'date' | 'bool')}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white"
            >
              <option value="text">Texto</option>
              <option value="number">Número</option>
              <option value="date">Fecha</option>
              <option value="bool">Sí/No</option>
            </select>
          </div>
          <label className="mb-3 flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={newFieldRequired}
              onChange={e => setNewFieldRequired(e.target.checked)}
              className="accent-blue-500"
            />
            Obligatorio
          </label>
          <button
            type="button"
            onClick={addField}
            className="w-full rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-600"
          >
            Agregar
          </button>
        </div>
        {customFieldError && <p className="mb-2 text-xs text-red-400">{customFieldError}</p>}
        <div className="space-y-2">
          {customFields.map(field => (
            <div key={field.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-800 p-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-sm text-white">{field.field_name}</span>
                <select
                  value={field.field_type}
                  onChange={e => updateField(field.id, { field_type: e.target.value as 'text' | 'number' | 'date' | 'bool' })}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300"
                >
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                  <option value="date">Fecha</option>
                  <option value="bool">Sí/No</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={Boolean(field.is_required)}
                    onChange={e => updateField(field.id, { is_required: e.target.checked })}
                    className="accent-blue-500"
                  />
                  Oblig.
                </label>
                <button
                  type="button"
                  onClick={() => removeField(field.id)}
                  className="text-xs text-red-400"
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
          {customFields.length === 0 && (
            <p className="text-sm text-slate-500">Todavía no hay campos personalizados.</p>
          )}
        </div>
      </div>}

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
          <div className="flex flex-col gap-3 sm:flex-row">
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
