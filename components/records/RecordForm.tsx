'use client'

import FieldRow from './FieldRow'
import type { RecordField, SurgicalFields } from '@/types'

interface Props {
  fields: SurgicalFields
  recordFields: RecordField[]
  onChange: (updated: SurgicalFields) => void
  onSave: () => void
  saving?: boolean
}

const FIELD_ORDER: (keyof SurgicalFields)[] = [
  'paciente', 'fecha_cirugia', 'hora_inicio', 'hora_fin', 'duracion',
  'diagnostico', 'procedimiento', 'cirujano', 'ayudantes',
  'anestesiologo', 'instrumentador', 'sanatorio', 'observaciones',
]

export default function RecordForm({ fields, recordFields, onChange, onSave, saving }: Props) {
  function handleChange(key: string, value: string) {
    onChange({ ...fields, [key]: value || null })
  }

  return (
    <div>
      {FIELD_ORDER.map(key => {
        const rf = recordFields.find(f => f.field_name === key)
        return (
          <FieldRow
            key={key}
            fieldName={key as string}
            value={fields[key] ?? ''}
            aiValue={rf?.ai_value ?? null}
            confidence={rf?.confidence ?? 1}
            onChange={v => handleChange(key as string, v)}
          />
        )
      })}
      <button
        onClick={onSave}
        disabled={saving}
        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl mt-2"
      >
        {saving ? 'Guardando...' : '✓ Guardar registro'}
      </button>
    </div>
  )
}
