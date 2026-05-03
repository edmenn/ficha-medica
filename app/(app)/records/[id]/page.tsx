'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import RecordForm from '@/components/records/RecordForm'
import type { AnalyzeResponse, CustomFieldTemplate, RecordField, SurgicalRecord, SurgicalFields } from '@/types'

export default function RecordDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [record, setRecord] = useState<SurgicalRecord | null>(null)
  const [fields, setFields] = useState<SurgicalFields | null>(null)
  const [recordFields, setRecordFields] = useState<RecordField[]>([])
  const [customFields, setCustomFields] = useState<CustomFieldTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reloadingAI, setReloadingAI] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/records/${id}`)
      .then(r => r.json())
      .then(d => {
        setRecord(d)
        setFields(d.final_data)
        setRecordFields(d.record_fields ?? [])
        setLoading(false)
      })
  }, [id])

  useEffect(() => {
    fetch('/api/custom-fields')
      .then(r => r.json())
      .then(d => setCustomFields(d.fields ?? []))
  }, [])

  async function handleSave() {
    if (!fields) return
    setError(null)
    setSaving(true)
    const res = await fetch(`/api/records/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ final_data: fields, status: 'final' }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'No se pudo guardar el registro')
      setSaving(false)
      return
    }
    setSaving(false)
    router.push('/records')
  }

  async function handleReloadAI() {
    setReloadingAI(true)
    setError(null)
    const res = await fetch(`/api/records/${id}/reanalyze`, { method: 'POST' })
    const data = await res.json() as AnalyzeResponse & { error?: string }

    if (!res.ok) {
      setError(data.error ?? 'No se pudo releer la imagen con IA')
      setReloadingAI(false)
      return
    }

    setFields(data.extracted_data)
    setRecordFields(data.record_fields)
    setRecord(prev => prev ? {
      ...prev,
      extracted_data: data.extracted_data,
      record_fields: data.record_fields,
    } : prev)
    setReloadingAI(false)
  }

  async function handleDelete() {
    if (!window.confirm('¿Querés borrar este registro definitivamente? Esta acción no se puede deshacer.')) {
      return
    }

    setDeleting(true)
    setError(null)
    const res = await fetch(`/api/records/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'No se pudo borrar el registro')
      setDeleting(false)
      return
    }

    router.push('/records')
  }

  if (loading) return <p className="text-slate-400 text-center py-12">Cargando...</p>
  if (!record || !fields) return <p className="text-red-400 text-center py-12">Registro no encontrado</p>

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-slate-400">←</button>
        <h1 className="text-xl font-bold">Detalle</h1>
      </div>
      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 mb-4 text-sm text-red-300">
          {error}
        </div>
      )}
      {record.image_url && (
        <div className="relative w-full h-64 mb-6 overflow-hidden rounded-xl bg-slate-900 border border-slate-700">
          <Image
            src={record.image_url}
            alt={fields.paciente ?? 'Documento'}
            fill
            unoptimized
            className="object-contain"
          />
        </div>
      )}
      <div className="flex gap-3 mb-5">
        <button
          type="button"
          onClick={handleReloadAI}
          disabled={reloadingAI || !record.image_url}
          className="flex-1 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium py-3 rounded-xl"
        >
          {reloadingAI ? 'Releyendo...' : 'Releer con IA'}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="bg-red-900 hover:bg-red-800 disabled:opacity-50 text-white font-medium px-4 py-3 rounded-xl"
        >
          {deleting ? 'Borrando...' : 'Borrar'}
        </button>
      </div>
      <RecordForm
        fields={fields}
        recordFields={recordFields}
        customFields={customFields}
        onChange={setFields}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  )
}
