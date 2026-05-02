'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { CustomFieldTemplate, UserRole } from '@/types'

interface OpenRouterModelOption {
  id: string
  name: string
  context_length: number | null
}

export default function SettingsPage() {
  const router = useRouter()
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('anthropic/claude-3.5-sonnet')
  const [modelQuery, setModelQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [customFields, setCustomFields] = useState<CustomFieldTemplate[]>([])
  const [newFieldName, setNewFieldName] = useState('')
  const [role, setRole] = useState<UserRole>('user')
  const [models, setModels] = useState<OpenRouterModelOption[]>([])
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/me')
      .then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error ?? 'No se pudo cargar el perfil')
        if (data.profile?.preferred_model) setModel(data.profile.preferred_model)
        if (data.profile?.role) setRole(data.profile.role)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/custom-fields').then(r => r.json()).then(d => setCustomFields(d.fields ?? []))
  }, [])

  useEffect(() => {
    fetch('/api/models')
      .then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error ?? 'No se pudo cargar la lista de modelos')
        setModels(data.models ?? [])
      })
      .catch(err => setModelsError(err instanceof Error ? err.message : 'No se pudo cargar la lista de modelos'))
  }, [])

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
    setCustomFields(prev => prev.filter(f => f.id !== id))
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
    } catch (err) {
      setModelsError(err instanceof Error ? err.message : 'Error desconocido al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPasswordSaving(true)
    setPasswordSaved(false)
    setPasswordError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setPasswordError(error.message)
      setPasswordSaving(false)
      return
    }

    setPassword('')
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

  if (loading) return <p className="text-slate-400 text-center py-12">Cargando...</p>

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Configuración</h1>
      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label className="block text-sm text-slate-400 mb-1">OpenRouter API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-or-v1-... (dejá vacío para no cambiar)"
            className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 border border-slate-700 focus:outline-none focus:border-blue-500 font-mono text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">Se guarda encriptada. Obtené tu key en openrouter.ai</p>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Modelo preferido</label>
          <input
            type="text"
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder="anthropic/claude-3.5-sonnet"
            className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 border border-slate-700 focus:outline-none focus:border-blue-500 font-mono text-sm mb-3"
          />
          <label className="block text-sm text-slate-400 mb-1">Buscar y seleccionar modelo</label>
          <input
            type="search"
            value={modelQuery}
            onChange={e => setModelQuery(e.target.value)}
            placeholder="Ej: Claude, GPT-4, Llama..."
            className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 border border-slate-700 focus:outline-none focus:border-blue-500 mb-2 text-sm"
          />
          {modelQuery.trim().length > 0 && (
            <div className="max-h-48 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg p-2 mb-2">
              {filteredModels.length === 0 ? (
                <p className="text-sm text-slate-500 p-2">No se encontraron modelos</p>
              ) : (
                filteredModels.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setModel(option.id)
                      setModelQuery('')
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-800 rounded mb-1 transition-colors flex flex-col"
                  >
                    <span className="text-sm font-medium text-slate-200">{option.name}</span>
                    <span className="text-xs text-slate-500 font-mono mt-0.5">{option.id}</span>
                  </button>
                ))
              )}
            </div>
          )}
          {modelsError && <p className="text-xs text-amber-400 mt-1">{modelsError}</p>}
          {!modelsError && (
            <p className="text-xs text-slate-500 mt-1">
              {models.length > 0 ? `Modelos cargados: ${models.length}. Usá el buscador para encontrar un modelo fácilmente.` : 'Cargando modelos de OpenRouter...'}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl"
        >
          {saved ? '✓ Guardado' : saving ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-400 mb-3">Cuenta</h2>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Nueva contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={8}
              required
              className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 border border-slate-700 focus:outline-none focus:border-blue-500"
            />
          </div>
          {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={passwordSaving}
              className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-medium py-3 rounded-xl"
            >
              {passwordSaved ? '✓ Contraseña actualizada' : passwordSaving ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="bg-red-900 hover:bg-red-800 text-white font-medium px-4 py-3 rounded-xl"
            >
              Logout
            </button>
          </div>
        </form>
      </div>
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-400 mb-3">Campos personalizados</h2>
        {customFields.map(f => (
          <div key={f.id} className="flex justify-between items-center bg-slate-800 rounded-lg px-3 py-2.5 mb-2">
            <span className="text-sm text-white">{f.field_name}</span>
            <button onClick={() => removeField(f.id)} className="text-red-400 text-sm">x</button>
          </div>
        ))}
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={newFieldName}
            onChange={e => setNewFieldName(e.target.value)}
            placeholder="Nombre del campo"
            className="flex-1 bg-slate-800 text-white rounded-lg px-3 py-2.5 border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
            onKeyDown={e => e.key === 'Enter' && addField()}
          />
          <button onClick={addField} className="bg-slate-700 hover:bg-slate-600 text-white px-4 rounded-lg text-sm">+ Agregar</button>
        </div>
      </div>
      {role === 'admin' && (
        <div className="mt-8 rounded-xl border border-blue-800/60 bg-blue-950/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-blue-200">Panel admin</p>
              <p className="text-xs text-blue-300/80 mt-1">Invitá usuarios y revisá los accesos del equipo.</p>
            </div>
            <Link
              href="/settings/users"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg whitespace-nowrap"
            >
              Gestionar
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
