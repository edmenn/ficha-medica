'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import ImageCapture from '@/components/capture/ImageCapture'
import { updateRecordAction } from '@/app/(user)/records/[id]/actions'
import RecordForm from '@/components/records/RecordForm'
import BackToRecordsButton from '@/components/ui/BackToRecordsButton'
import { prepareImageForUpload } from '@/lib/imageUtils'
import { flushPendingUploads, savePendingUpload } from '@/lib/pending-uploads'
import { emptySurgicalFields } from '@/lib/record-utils'
import type { AnalyzeResponse, CustomFieldTemplate, SurgicalFields, SurgicalRecord } from '@/types'

type Step = 'capture' | 'processing' | 'review'

interface Props {
  blockedForRole?: boolean
}

export default function NewRecordClient({ blockedForRole = false }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('capture')
  const [previews, setPreviews] = useState<string[]>([])
  const [analyzeData, setAnalyzeData] = useState<AnalyzeResponse | null>(null)
  const [fields, setFields] = useState<SurgicalFields | null>(null)
  const [customFields, setCustomFields] = useState<CustomFieldTemplate[]>([])
  const [error, setError] = useState<string | null>(blockedForRole ? 'Admins no pueden operar registros' : null)
  const [saving, setSaving] = useState(false)
  const [processingExtraPage, setProcessingExtraPage] = useState(false)
  const [pendingDuplicateFile, setPendingDuplicateFile] = useState<File | null>(null)
  const [pendingDuplicateExistingId, setPendingDuplicateExistingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/custom-fields')
      .then(r => r.json())
      .then(data => setCustomFields(data.fields ?? []))
  }, [])

  useEffect(() => {
    function handleOnline() {
      void flushPendingUploads()
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  async function queuePendingUpload(file: File) {
    await savePendingUpload(file, null)

    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready
      const syncRegistration = registration as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> }
      }
      if (syncRegistration.sync) {
        await syncRegistration.sync.register('upload-pending')
      }
    }
  }

  async function analyzePreparedFile(prepared: File, options?: { recordId?: string; confirmDuplicate?: boolean }) {
    const form = new FormData()
    form.append('image', prepared)
    if (options?.recordId) form.append('record_id', options.recordId)
    if (options?.confirmDuplicate) form.append('confirm_duplicate', '1')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)

    let res: Response
    try {
      res = await fetch('/api/analyze', { method: 'POST', body: form, signal: controller.signal })
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError'
      if (isTimeout || !navigator.onLine) {
        await queuePendingUpload(prepared)
        setError('Sin conexión. La ficha se enviará cuando vuelva la señal.')
      } else {
        setError('Error de conexión')
      }
      if (!options?.recordId) setStep('capture')
      return
    } finally {
      clearTimeout(timeout)
    }

    const data = await res.json()

    if (!res.ok) {
      if (res.status === 503) {
        await queuePendingUpload(prepared)
        setError('Sin conexión. La ficha se enviará cuando vuelva la señal.')
        if (!options?.recordId) setStep('capture')
        return
      }
      setError(data.error ?? 'Error al analizar imagen')
      if (!options?.recordId) setStep('capture')
      return
    }

    if (data.warning === 'duplicate' && !options?.confirmDuplicate) {
      setAnalyzeData(data)
      setFields(data.extracted_data)
      setPendingDuplicateFile(prepared)
      setStep('review')
      return
    }

    setAnalyzeData(data)
    setFields(data.extracted_data)
    setStep('review')
  }

  async function handleImageSelected(file: File) {
    setStep('processing')
    setError(null)
    setPendingDuplicateFile(null)
    setPreviews([URL.createObjectURL(file)])

    let prepared: File
    try {
      prepared = await prepareImageForUpload(file)
    } catch {
      setError('Error al procesar la imagen')
      setStep('capture')
      return
    }

    await analyzePreparedFile(prepared)
  }

  async function handleAddPage(file: File) {
    if (!analyzeData?.record_id) return

    setProcessingExtraPage(true)
    setError(null)
    setPreviews(prev => [...prev, URL.createObjectURL(file)])

    let prepared: File
    try {
      prepared = await prepareImageForUpload(file)
    } catch {
      setError('Error al procesar la imagen adicional')
      setProcessingExtraPage(false)
      return
    }

    await analyzePreparedFile(prepared, { recordId: analyzeData.record_id })
    setProcessingExtraPage(false)
  }

  async function handleConfirmDuplicate() {
    if (!pendingDuplicateFile) return
    setError(null)
    setStep('processing')
    await analyzePreparedFile(pendingDuplicateFile, { confirmDuplicate: true })
    setPendingDuplicateFile(null)
  }

  async function checkLogicalDuplicate(recordId: string, currentFields: SurgicalFields) {
    const res = await fetch('/api/records/duplicates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: currentFields, exclude_record_id: recordId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? 'No se pudo verificar duplicados')
    }

    const data = await res.json() as { existing_id?: string | null }
    return data.existing_id ?? null
  }

  async function persistRecord(currentFields: SurgicalFields) {
    await updateRecordAction(analyzeData!.record_id, currentFields)
    router.push('/records')
    router.refresh()
  }

  async function handleSave(options?: { confirmDuplicate?: boolean }) {
    if (!analyzeData || !fields) return
    if (analyzeData.warning === 'duplicate' && pendingDuplicateFile) {
      setError('Confirmá si querés crear una ficha duplicada o abrí la existente.')
      return
    }
    setSaving(true)
    try {
      if (!options?.confirmDuplicate) {
        const existingId = await checkLogicalDuplicate(analyzeData.record_id, fields)
        if (existingId) {
          setPendingDuplicateExistingId(existingId)
          setSaving(false)
          return
        }
      }
      setPendingDuplicateExistingId(null)
      await persistRecord(fields)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
      setSaving(false)
    }
  }

  async function handleManualEntry() {
    const emptyFields = emptySurgicalFields()
    setError(null)
    setSaving(true)

    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          final_data: emptyFields,
          extracted_data: emptyFields,
          status: 'draft',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'No se pudo crear la ficha manual')
      }

      const record = data as SurgicalRecord
      setAnalyzeData({
        record_id: record.id,
        extracted_data: emptyFields,
      })
      setFields(emptyFields)
      setPendingDuplicateExistingId(null)
      setPendingDuplicateFile(null)
      setPreviews([])
      setStep('review')
      setSaving(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la ficha manual')
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <BackToRecordsButton />
        <h1 className="text-xl font-bold">
          {step === 'capture' && 'Nueva ficha'}
          {step === 'processing' && 'Analizando...'}
          {step === 'review' && 'Revisar datos'}
        </h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-700 bg-red-900/50 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {step === 'capture' && !blockedForRole && (
        <ImageCapture onImageSelected={handleImageSelected} onManualEntry={handleManualEntry} disabled={saving} />
      )}

      {step === 'processing' && (
        <div className="py-12 text-center">
          {previews[0] && (
            <Image
              src={previews[0]}
              alt="Documento"
              width={1200}
              height={900}
              unoptimized
              className="mb-6 max-h-64 w-full rounded-xl object-contain"
            />
          )}
          <div className="mb-2 text-lg text-blue-400 animate-pulse">🤖 Extrayendo datos con IA...</div>
          <p className="text-sm text-slate-500">Esto puede tardar unos segundos</p>
        </div>
      )}

      {step === 'review' && analyzeData && fields && (
        <>
          {previews.length > 0 && (
            <div className="mb-6 grid grid-cols-2 gap-3">
              {previews.map((preview, index) => (
                <Image
                  key={`${preview}-${index}`}
                  src={preview}
                  alt={`Documento ${index + 1}`}
                  width={1200}
                  height={900}
                  unoptimized
                  className="max-h-40 w-full rounded-xl object-contain"
                />
              ))}
            </div>
          )}
          {analyzeData.warning === 'duplicate' && analyzeData.existing_id && (
            <div className="mb-4 rounded-lg border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200">
              <p className="mb-3">Ya existe una ficha para este paciente en esta fecha.</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => router.push(`/records/${analyzeData.existing_id}`)}
                  className="flex-1 rounded-lg bg-slate-700 px-4 py-2.5 text-white"
                >
                  Ver existente
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDuplicate}
                  className="flex-1 rounded-lg bg-amber-700 px-4 py-2.5 text-white"
                >
                  Crear igual
                </button>
              </div>
            </div>
          )}
          {pendingDuplicateExistingId && (
            <div className="mb-4 rounded-lg border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200">
              <p className="mb-3">Hay una ficha posiblemente duplicada con los mismos datos clave.</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => router.push(`/records/${pendingDuplicateExistingId}`)}
                  className="flex-1 rounded-lg bg-slate-700 px-4 py-2.5 text-white"
                >
                  Ver existente
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave({ confirmDuplicate: true })}
                  className="flex-1 rounded-lg bg-amber-700 px-4 py-2.5 text-white"
                >
                  Crear igual
                </button>
              </div>
            </div>
          )}
          <div className="mb-4">
            <ImageCapture onImageSelected={handleAddPage} disabled={processingExtraPage || saving} />
          </div>
          <RecordForm
            fields={fields}
            extractedFields={analyzeData.extracted_data}
            customFields={customFields}
            onChange={setFields}
            onSave={handleSave}
            saving={saving}
          />
        </>
      )}
    </div>
  )
}
