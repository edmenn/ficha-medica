'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import ImageCapture from '@/components/capture/ImageCapture'
import RecordForm from '@/components/records/RecordForm'
import { prepareImageVariantsForAI } from '@/lib/imageUtils'
import type { AnalyzeResponse, CustomFieldTemplate, SurgicalFields } from '@/types'

type Step = 'capture' | 'processing' | 'review'

export default function NewRecordPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('capture')
  const [preview, setPreview] = useState<string | null>(null)
  const [analyzeData, setAnalyzeData] = useState<AnalyzeResponse | null>(null)
  const [fields, setFields] = useState<SurgicalFields | null>(null)
  const [customFields, setCustomFields] = useState<CustomFieldTemplate[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/custom-fields')
      .then(r => r.json())
      .then(data => setCustomFields(data.fields ?? []))
  }, [])

  async function handleImageSelected(file: File) {
    setStep('processing')
    setError(null)
    setPreview(URL.createObjectURL(file))

    let prepared: File
    let rotated: File | null
    try {
      const variants = await prepareImageVariantsForAI(file)
      prepared = variants.primary
      rotated = variants.rotated
    } catch {
      setError('Error al procesar la imagen')
      setStep('capture')
      return
    }

    const form = new FormData()
    form.append('image', prepared)
    if (rotated) {
      form.append('image_rotated', rotated)
    }

    const res = await fetch('/api/analyze', { method: 'POST', body: form })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Error al analizar imagen')
      setStep('capture')
      return
    }

    setAnalyzeData(data)
    setFields(data.extracted_data)
    setStep('review')
  }

  async function handleSave() {
    if (!analyzeData || !fields) return
    setSaving(true)
    const res = await fetch(`/api/records/${analyzeData.record_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ final_data: fields, status: 'final' }),
    })
    if (res.ok) {
      router.push('/records')
    } else {
      const data = await res.json()
      setError(data.error ?? 'Error al guardar')
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-slate-400">←</button>
        <h1 className="text-xl font-bold">
          {step === 'capture' && 'Nueva ficha'}
          {step === 'processing' && 'Analizando...'}
          {step === 'review' && 'Revisar datos'}
        </h1>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 mb-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {step === 'capture' && (
        <ImageCapture onImageSelected={handleImageSelected} />
      )}

      {step === 'processing' && (
        <div className="text-center py-12">
          {preview && (
            <Image
              src={preview}
              alt="Documento"
              width={1200}
              height={900}
              unoptimized
              className="w-full rounded-xl mb-6 max-h-64 object-contain"
            />
          )}
          <div className="animate-pulse text-blue-400 text-lg mb-2">🤖 Extrayendo datos con IA...</div>
          <p className="text-slate-500 text-sm">Esto puede tardar unos segundos</p>
        </div>
      )}

      {step === 'review' && analyzeData && fields && (
        <>
          {preview && (
            <Image
              src={preview}
              alt="Documento"
              width={1200}
              height={900}
              unoptimized
              className="w-full rounded-xl mb-6 max-h-48 object-contain"
            />
          )}
          <RecordForm
            fields={fields}
            recordFields={analyzeData.record_fields}
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
