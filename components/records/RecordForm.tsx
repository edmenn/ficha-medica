'use client'

import { normalizeSurgicalFields, STANDARD_FIELD_ORDER, validateSurgicalFields } from '@/lib/record-utils'
import FieldRow from './FieldRow'
import type { SurgicalFields } from '@/types'

interface Props {
  fields: SurgicalFields
  extractedFields: SurgicalFields
  onChange: (updated: SurgicalFields) => void
  onSave: () => void
  saving?: boolean
  readOnly?: boolean
  sanatoriums?: string[]
}

export default function RecordForm({
  fields,
  extractedFields,
  onChange,
  onSave,
  saving,
  readOnly = false,
  sanatoriums = [],
}: Props) {
  const errors = validateSurgicalFields(fields)

  function handleChange(key: string, value: string) {
    onChange(normalizeSurgicalFields({ ...fields, [key]: value || null }))
  }

  return (
    <div>
      {errors.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200">
          {errors.map(error => <p key={error}>{error}</p>)}
        </div>
      )}
      {STANDARD_FIELD_ORDER.map(key => (
        <FieldRow
          key={key}
          fieldName={String(key)}
          value={fields[key as keyof SurgicalFields] ?? ''}
          aiValue={extractedFields[key as keyof SurgicalFields] ?? null}
          onChange={value => handleChange(String(key), value)}
          readOnly={readOnly}
          fieldType={key === 'fecha_cirugia' ? 'date' : 'text'}
          suggestions={key === 'sanatorio' ? sanatoriums : undefined}
        />
      ))}
      {!readOnly && (
        <button
          onClick={onSave}
          disabled={saving || errors.length > 0}
          className="mt-2 w-full rounded-xl bg-green-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Guardando...' : '✓ Guardar registro'}
        </button>
      )}
    </div>
  )
}
