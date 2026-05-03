'use client'

import { normalizeSurgicalFields, STANDARD_FIELD_ORDER, validateSurgicalFields } from '@/lib/record-utils'
import FieldRow from './FieldRow'
import type { CustomFieldTemplate, SurgicalFields } from '@/types'

interface Props {
  fields: SurgicalFields
  extractedFields: SurgicalFields
  onChange: (updated: SurgicalFields) => void
  onSave: () => void
  saving?: boolean
  customFields?: CustomFieldTemplate[]
  readOnly?: boolean
}

export default function RecordForm({
  fields,
  extractedFields,
  onChange,
  onSave,
  saving,
  customFields = [],
  readOnly = false,
}: Props) {
  const errors = validateSurgicalFields(fields)

  function handleChange(key: string, value: string) {
    onChange(normalizeSurgicalFields({ ...fields, [key]: value || null }))
  }

  const orderedFields = [
    ...STANDARD_FIELD_ORDER.map(field => String(field)),
    ...customFields
      .map(field => field.field_name)
      .filter(fieldName => !STANDARD_FIELD_ORDER.includes(fieldName as keyof SurgicalFields)),
  ]

  return (
    <div>
      {errors.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200">
          {errors.map(error => <p key={error}>{error}</p>)}
        </div>
      )}
      {orderedFields.map(key => (
        <FieldRow
          key={key}
          fieldName={key}
          value={fields[key as keyof SurgicalFields] ?? ''}
          aiValue={extractedFields[key as keyof SurgicalFields] ?? null}
          onChange={value => handleChange(key, value)}
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
