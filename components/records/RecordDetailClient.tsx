'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import RecordForm from '@/components/records/RecordForm'
import BackToRecordsButton from '@/components/ui/BackToRecordsButton'
import { deleteRecordAction, updateRecordAction } from '@/app/(user)/records/[id]/actions'
import { prepareImageForUpload } from '@/lib/imageUtils'
import { STANDARD_FIELD_ORDER } from '@/lib/record-utils'
import type { AnalyzeResponse, CustomFieldTemplate, SurgicalRecord, SurgicalFields } from '@/types'

interface Props {
  record: SurgicalRecord
  customFields: CustomFieldTemplate[]
}

interface CompareRow {
  key: string
  current: string
  ai: string
  changed: boolean
  selected: 'current' | 'ai'
}

const LABELS: Record<string, string> = {
  paciente: 'Paciente',
  fecha_cirugia: 'Fecha inicio',
  diagnostico: 'Diagnóstico',
  procedimiento: 'Procedimiento',
  cirujano: 'Cirujano',
  ayudantes: 'Ayudantes',
  anestesiologo: 'Anestesiólogo',
  instrumentador: 'Instrumentador',
  sanatorio: 'Sanatorio / Hospital',
  observaciones: 'Observaciones',
}

export default function RecordDetailClient({ record: initialRecord, customFields }: Props) {
  const router = useRouter()
  const [record, setRecord] = useState(initialRecord)
  const [fields, setFields] = useState<SurgicalFields>(initialRecord.final_data)
  const [error, setError] = useState<string | null>(null)
  const [reloadingAI, setReloadingAI] = useState(false)
  const [compareRows, setCompareRows] = useState<CompareRow[] | null>(null)
  const [saving, startSaving] = useTransition()
  const [deleting, startDeleting] = useTransition()

  const hasUnsavedChanges = JSON.stringify(fields) !== JSON.stringify(record.final_data)

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
    setError(null)

    // Si hay cambios manuales sin guardar, pedir confirmación para no perderlos.
    if (hasUnsavedChanges) {
      const ok = window.confirm(
        'Tenés cambios sin guardar. Releer con IA va a descartarlos hasta que confirmes los nuevos valores. ¿Continuar?'
      )
      if (!ok) return
    }

    setReloadingAI(true)
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

    setReloadingAI(false)

    if (!res.ok) {
      setError(data.error ?? 'No se pudo releer la imagen con IA')
      return
    }

    const ai = data.extracted_data
    const current = fields
    const keys = [
      ...STANDARD_FIELD_ORDER.map(k => String(k)),
      ...customFields.map(f => f.field_name),
    ]
    const rows: CompareRow[] = keys
      .map(key => {
        const cur = current[key] ?? ''
        const aiVal = ai[key] ?? ''
        return {
          key,
          current: cur,
          ai: aiVal,
          changed: cur !== aiVal,
          selected: 'current' as const,
        }
      })
      .filter(row => row.changed || row.ai)

    setCompareRows(rows)
  }

  function applyCompare() {
    if (!compareRows) return
    const updated: SurgicalFields = { ...fields }
    for (const row of compareRows) {
      if (row.selected === 'ai' && row.ai !== '') {
        updated[row.key as keyof SurgicalFields] = row.ai
      }
    }
    setFields(updated)
    setRecord(prev => ({ ...prev, extracted_data: { ...prev.extracted_data, ...Object.fromEntries(
      compareRows.filter(r => r.selected === 'ai').map(r => [r.key, r.ai])
    ) } }))
    setCompareRows(null)
    setError(null)
  }

  function cancelCompare() {
    setCompareRows(null)
  }

  function setRowSelection(key: string, selected: 'current' | 'ai') {
    setCompareRows(prev => prev?.map(row => row.key === key ? { ...row, selected } : row) ?? null)
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
        <BackToRecordsButton />
        <h1 className="text-xl font-bold">{compareRows ? 'Comparar relectura' : 'Detalle'}</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-700 bg-red-900/50 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {compareRows && (
        <div className="mb-5 rounded-xl border border-indigo-700 bg-indigo-950/30 p-4">
          <p className="mb-4 text-sm text-indigo-200">
            La IA detectó cambios. Elegí qué valor conservar por campo.
          </p>
          <div className="space-y-3">
            {compareRows.length === 0 && <p className="text-sm text-slate-400">Sin diferencias detectadas.</p>}
            {compareRows.map(row => (
              <div key={row.key} className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                <p className="mb-2 text-xs font-semibold text-slate-300">{LABELS[row.key] ?? row.key}</p>
                <div className="flex flex-col gap-2">
                  <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 ${row.selected === 'current' ? 'border-blue-500 bg-blue-950/30' : 'border-slate-700'}`}>
                    <input
                      type="radio"
                      name={`compare-${row.key}`}
                      checked={row.selected === 'current'}
                      onChange={() => setRowSelection(row.key, 'current')}
                    />
                    <span className="text-xs text-slate-400">Actual:</span>
                    <span className="text-sm text-white">{row.current || <em className="text-slate-500">vacío</em>}</span>
                  </label>
                  <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 ${row.selected === 'ai' ? 'border-emerald-500 bg-emerald-950/30' : 'border-slate-700'}`}>
                    <input
                      type="radio"
                      name={`compare-${row.key}`}
                      checked={row.selected === 'ai'}
                      onChange={() => setRowSelection(row.key, 'ai')}
                    />
                    <span className="text-xs text-emerald-400">IA:</span>
                    <span className="text-sm text-white">{row.ai || <em className="text-slate-500">vacío</em>}</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={applyCompare}
              className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Aplicar selección
            </button>
            <button
              type="button"
              onClick={cancelCompare}
              className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700"
            >
              Descartar
            </button>
          </div>
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
      <div className="mb-5 flex flex-wrap gap-3">
        {record.image_url && (
          <button
            type="button"
            onClick={handleReloadAI}
            disabled={reloadingAI}
            className="flex-1 rounded-xl bg-indigo-700 py-3 font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
          >
            {reloadingAI ? 'Releyendo...' : 'Releer con IA'}
          </button>
        )}
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
