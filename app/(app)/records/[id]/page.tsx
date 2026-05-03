'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import RecordForm from '@/components/records/RecordForm'
import type { CustomFieldTemplate, SurgicalRecord, SurgicalFields } from '@/types'

export default function RecordDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [record, setRecord] = useState<SurgicalRecord | null>(null)
  const [fields, setFields] = useState<SurgicalFields | null>(null)
  const [customFields, setCustomFields] = useState<CustomFieldTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/records/${id}`)
      .then(r => r.json())
      .then(d => { setRecord(d); setFields(d.final_data); setLoading(false) })
  }, [id])

  useEffect(() => {
    fetch('/api/custom-fields')
      .then(r => r.json())
      .then(d => setCustomFields(d.fields ?? []))
  }, [])

  async function handleSave() {
    if (!fields) return
    setSaving(true)
    await fetch(`/api/records/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ final_data: fields, status: 'final' }),
    })
    setSaving(false)
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
      <RecordForm
        fields={fields}
        recordFields={record.record_fields ?? []}
        customFields={customFields}
        onChange={setFields}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  )
}
