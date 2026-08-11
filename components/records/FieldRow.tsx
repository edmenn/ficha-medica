'use client'

import { useEffect, useRef, useState } from 'react'
import { dateToISO, isoToDate } from '@/lib/dates'

const FIELD_LABELS: Record<string, string> = {
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

interface Props {
  fieldName: string
  value: string
  aiValue: string | null
  onChange: (value: string) => void
  readOnly?: boolean
  fieldType?: 'text' | 'number' | 'date' | 'bool'
  isRequired?: boolean
}

export default function FieldRow({ fieldName, value, aiValue, onChange, readOnly = false, fieldType = 'text', isRequired = false }: Props) {
  const label = FIELD_LABELS[fieldName] ?? fieldName
  const wasExtracted = aiValue !== null
  const wasModified = value !== (aiValue ?? '')
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
  const [dateValue, setDateValue] = useState<string>(dateToISO(value) ?? '')
  const sharedClassName = 'w-full bg-slate-800 text-white rounded-lg px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500 text-sm'
  const isDateField = fieldType === 'date'

  useEffect(() => {
    if (!textAreaRef.current) return
    const element = textAreaRef.current
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }, [value])

  useEffect(() => {
    if (isDateField) setDateValue(dateToISO(value) ?? '')
  }, [value, isDateField])

  function handleDateBlur() {
    const normalized = isoToDate(dateValue)
    onChange(normalized ?? '')
  }

  let input: React.ReactNode
  if (isDateField) {
    input = (
      <input
        type="date"
        value={dateValue}
        disabled={readOnly}
        onChange={event => setDateValue(event.target.value)}
        onBlur={handleDateBlur}
        className={`${sharedClassName} text-slate-200 [color-scheme:dark]`}
      />
    )
  } else if (fieldType === 'number') {
    input = (
      <input
        type="number"
        value={value}
        readOnly={readOnly}
        onChange={event => onChange(event.target.value)}
        placeholder="—"
        className={`${sharedClassName} [color-scheme:dark]`}
      />
    )
  } else if (fieldType === 'bool') {
    input = (
      <div className="flex gap-3 pt-1">
        {(['true', 'false'] as const).map(option => {
          const isActive = value === (option === 'true' ? 'true' : 'false') || value === (option === 'true' ? 'Sí' : 'No')
          return (
            <button
              key={option}
              type="button"
              disabled={readOnly}
              onClick={() => onChange(option === 'true' ? 'Sí' : 'No')}
              className={`rounded-lg border px-4 py-2 text-sm ${isActive ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-700 bg-slate-800 text-slate-300'}`}
            >
              {option === 'true' ? 'Sí' : 'No'}
            </button>
          )
        })}
      </div>
    )
  } else {
    input = (
      <textarea
        ref={textAreaRef}
        rows={1}
        value={value}
        readOnly={readOnly}
        onChange={event => onChange(event.target.value)}
        placeholder="—"
        className={`${sharedClassName} min-h-12 resize-none overflow-hidden whitespace-pre-wrap break-words`}
      />
    )
  }

  return (
    <div className={`mb-4 border-l-2 ${wasExtracted ? 'border-emerald-600' : 'border-slate-700'} pl-3`}>
      <label className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <span>{label}{isRequired && <span className="text-red-400"> *</span>}</span>
        {wasExtracted && <span className="text-xs text-emerald-500">IA</span>}
        {wasModified && <span className="text-xs text-amber-500">editado</span>}
      </label>
      {input}
    </div>
  )
}
