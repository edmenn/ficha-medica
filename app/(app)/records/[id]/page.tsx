'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import RecordForm from '@/components/records/RecordForm'
import type { SurgicalRecord, SurgicalFields } from '@/types'

export default function RecordDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [record, setRecord] = useState<SurgicalRecord | null>(null)
  const [fields, setFields] = useState<SurgicalFields | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/records/${id}`)
      .then(r => r.json())
      .then(d => { setRecord(d); setFields(d.final_data); setLoading(false) })
  }, [id])

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
      <RecordForm
        fields={fields}
        recordFields={record.record_fields ?? []}
        onChange={setFields}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  )
}
