'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CustomFieldTemplate } from '@/types'

const MODELS = [
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3-haiku',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'google/gemini-2.0-flash-001',
]

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(MODELS[0])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [customFields, setCustomFields] = useState<CustomFieldTemplate[]>([])
  const [newFieldName, setNewFieldName] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('users')
        .select('preferred_model')
        .eq('id', user.id)
        .single()
      if (data?.preferred_model) setModel(data.preferred_model)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    fetch('/api/custom-fields').then(r => r.json()).then(d => setCustomFields(d.fields ?? []))
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
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ openrouter_key: apiKey || undefined, preferred_model: model }),
    })
    setSaving(false)
    setSaved(true)
    setApiKey('')
    setTimeout(() => setSaved(false), 3000)
  }

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
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 border border-slate-700 focus:outline-none focus:border-blue-500"
          >
            {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
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
    </div>
  )
}
