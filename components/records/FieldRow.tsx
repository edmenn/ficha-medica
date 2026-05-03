'use client'

import Combobox from '@/components/ui/Combobox'

const FIELD_LABELS: Record<string, string> = {
  paciente: 'Paciente',
  fecha_cirugia: 'Fecha inicio',
  fecha_fin: 'Fecha fin',
  hora_inicio: 'Hora inicio',
  hora_fin: 'Hora fin',
  duracion: 'Duración',
  diagnostico: 'Diagnóstico',
  procedimiento: 'Procedimiento',
  cirujano: 'Cirujano',
  ayudantes: 'Ayudantes',
  anestesiologo: 'Anestesiólogo',
  instrumentador: 'Instrumentador',
  sanatorio: 'Sanatorio / Hospital',
  observaciones: 'Observaciones',
}

const AUTOCOMPLETE_FIELDS = new Set([
  'cirujano',
  'anestesiologo',
  'sanatorio',
  'procedimiento',
  'instrumentador',
])

interface Props {
  fieldName: string
  value: string
  aiValue: string | null
  onChange: (value: string) => void
}

export default function FieldRow({ fieldName, value, aiValue, onChange }: Props) {
  const label = FIELD_LABELS[fieldName] ?? fieldName
  const wasExtracted = aiValue !== null
  const wasModified = value !== (aiValue ?? '')
  const sharedClassName = 'w-full bg-slate-800 text-white rounded-lg px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500 text-sm'

  return (
    <div className={`mb-4 border-l-2 ${wasExtracted ? 'border-emerald-600' : 'border-slate-700'} pl-3`}>
      <label className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <span>{label}</span>
        {wasExtracted && <span className="text-xs text-emerald-500">IA</span>}
        {wasModified && <span className="text-xs text-amber-500">editado</span>}
      </label>
      {AUTOCOMPLETE_FIELDS.has(fieldName) ? (
        <Combobox
          field={fieldName}
          value={value}
          onChange={onChange}
          className={sharedClassName}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder="—"
          className={sharedClassName}
        />
      )}
    </div>
  )
}
