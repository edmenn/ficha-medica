'use client'

import FieldRow from './FieldRow'
import type { CustomFieldTemplate, RecordField, SurgicalFields } from '@/types'

interface Props {
  fields: SurgicalFields
  recordFields: RecordField[]
  onChange: (updated: SurgicalFields) => void
  onSave: () => void
  saving?: boolean
  customFields?: CustomFieldTemplate[]
}

const FIELD_ORDER: string[] = [
  'paciente', 'fecha_cirugia', 'hora_inicio', 'hora_fin', 'duracion',
  'diagnostico', 'procedimiento', 'cirujano', 'ayudantes',
  'anestesiologo', 'instrumentador', 'sanatorio', 'observaciones',
]

export default function RecordForm({ fields, recordFields, onChange, onSave, saving, customFields = [] }: Props) {
  function handleChange(key: string, value: string) {
    onChange({ ...fields, [key]: value || null })
  }

  const orderedFields: string[] = [
    ...FIELD_ORDER,
    ...customFields
      .map(field => field.field_name)
      .filter(fieldName => !FIELD_ORDER.includes(fieldName)),
  ]

  return (
    <div>
      {orderedFields.map(key => {
        const rf = recordFields.find(f => f.field_name === key)
        return (
          <FieldRow
            key={key}
            fieldName={key}
            value={fields[key as keyof SurgicalFields] ?? ''}
            aiValue={rf?.ai_value ?? null}
            confidence={rf?.confidence ?? 1}
            onChange={v => handleChange(key, v)}
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
