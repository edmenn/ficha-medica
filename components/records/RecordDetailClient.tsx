'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import RecordForm from '@/components/records/RecordForm'
import { deleteRecordAction, updateRecordAction } from '@/app/(app)/records/[id]/actions'
import { prepareImageForUpload } from '@/lib/imageUtils'
import type { AnalyzeResponse, CustomFieldTemplate, SurgicalRecord, SurgicalFields } from '@/types'

interface Props {
  record: SurgicalRecord
  customFields: CustomFieldTemplate[]
}

export default function RecordDetailClient({ record: initialRecord, customFields }: Props) {
  const router = useRouter()
  const [record, setRecord] = useState(initialRecord)
  const [fields, setFields] = useState<SurgicalFields>(initialRecord.final_data)
  const [error, setError] = useState<string | null>(null)
  const [reloadingAI, setReloadingAI] = useState(false)
  const [saving, startSaving] = useTransition()
  const [deleting, startDeleting] = useTransition()

  function handleSave() {
    setError(null)
    startSaving(async () => {
      try {
        await updateRecordAction(record.id, fields)
        router.push('/records')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo guardar el registro')
      }
    })
  }

  async function handleReloadAI() {
    setReloadingAI(true)
    setError(null)
    const form = new FormData()

    if (record.image_url) {
      try {
        const imageRes = await fetch(record.image_url)
        const blob = await imageRes.blob()
        const file = new File([blob], `${record.id}.jpg`, { type: blob.type || 'image/jpeg' })
        const prepared = await prepareImageForUpload(file)
        form.append('image', prepared)
      } catch {
        setError('No se pudo preparar la imagen para releer con IA')
        setReloadingAI(false)
        return
      }
    }

    const res = await fetch(`/api/records/${record.id}/reanalyze`, { method: 'POST', body: form })
    const data = await res.json() as AnalyzeResponse & { error?: string }

    if (!res.ok) {
      setError(data.error ?? 'No se pudo releer la imagen con IA')
      setReloadingAI(false)
      return
    }

    setFields(data.extracted_data)
    setRecord(prev => ({
      ...prev,
      extracted_data: data.extracted_data,
      final_data: data.extracted_data,
    }))
    setReloadingAI(false)
  }

  function handleDelete() {
    if (!window.confirm('¿Querés borrar este registro definitivamente? Esta acción no se puede deshacer.')) {
      return
    }

    setError(null)
    startDeleting(async () => {
      try {
        await deleteRecordAction(record.id)
        router.push('/records')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo borrar el registro')
      }
    })
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-slate-400">←</button>
        <h1 className="text-xl font-bold">Detalle</h1>
      </div>
      {error && (
        <div className="mb-4 rounded-lg border border-red-700 bg-red-900/50 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {record.image_url && (
        <div className="relative mb-6 h-64 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
          <Image
            src={record.image_url}
            alt={fields.paciente ?? 'Documento'}
            fill
            unoptimized
            className="object-contain"
          />
        </div>
      )}
      <div className="mb-5 flex gap-3">
        <button
          type="button"
          onClick={handleReloadAI}
          disabled={reloadingAI || !record.image_url}
          className="flex-1 rounded-xl bg-indigo-700 py-3 font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
        >
          {reloadingAI ? 'Releyendo...' : 'Releer con IA'}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-xl bg-red-900 px-4 py-3 font-medium text-white hover:bg-red-800 disabled:opacity-50"
        >
          {deleting ? 'Borrando...' : 'Borrar'}
        </button>
      </div>
      <RecordForm
        fields={fields}
        extractedFields={record.extracted_data}
        customFields={customFields}
        onChange={setFields}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  )
}
