'use client'

const FIELD_LABELS: Record<string, string> = {
  paciente: 'Paciente',
  fecha_cirugia: 'Fecha de cirugía',
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

interface Props {
  fieldName: string
  value: string
  aiValue: string | null
  confidence: number
  onChange: (value: string) => void
}

export default function FieldRow({ fieldName, value, aiValue, confidence, onChange }: Props) {
  const label = FIELD_LABELS[fieldName] ?? fieldName
  const isLowConfidence = confidence < 0.5
  const wasModified = value !== aiValue

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm text-slate-400">{label}</label>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          isLowConfidence
            ? 'bg-amber-900/50 text-amber-300'
            : wasModified
              ? 'bg-blue-900/50 text-blue-300'
              : 'bg-slate-800 text-slate-500'
        }`}>
          {isLowConfidence ? '⚠️ revisar' : wasModified ? '✏️ editado' : ''}
        </span>
      </div>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="—"
        className={`w-full bg-slate-800 text-white rounded-lg px-3 py-2.5 border ${
          isLowConfidence ? 'border-amber-600' : 'border-slate-700'
        } focus:outline-none focus:border-blue-500 text-sm`}
      />
    </div>
  )
}
