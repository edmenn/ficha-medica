import type { SurgicalFields } from '@/types'
import { normalizeDateString, validateDateField } from '@/lib/dates'

export {
  normalizeDateString,
  validateDateField,
  compareDateStringsDesc,
  isDateInRange,
  dateToISO,
  isoToDate,
  validateDateRange,
} from '@/lib/dates'

export const STANDARD_FIELD_ORDER: (keyof SurgicalFields)[] = [
  'paciente',
  'fecha_cirugia',
  'diagnostico',
  'procedimiento',
  'cirujano',
  'ayudantes',
  'anestesiologo',
  'instrumentador',
  'sanatorio',
  'observaciones',
]

export function emptySurgicalFields(): SurgicalFields {
  return Object.fromEntries(STANDARD_FIELD_ORDER.map(field => [field, null])) as SurgicalFields
}

function normalizeText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }

  if (Array.isArray(value)) {
    const parts = value
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : null
  }

  return null
}

export function normalizeSurgicalFields(input: Partial<SurgicalFields>): SurgicalFields {
  const normalized = emptySurgicalFields()

  for (const [key, rawValue] of Object.entries(input)) {
    normalized[key] = normalizeText(rawValue)
  }

  normalized.fecha_cirugia = normalizeDateString(normalized.fecha_cirugia)
  normalized.ayudantes = normalizeText(input.ayudantes)

  return normalized
}

export function mergeSurgicalFieldsFillNulls(base: SurgicalFields, incoming: SurgicalFields): SurgicalFields {
  const merged = { ...base }

  for (const [key, value] of Object.entries(incoming)) {
    if (merged[key] === null && value !== null) {
      merged[key] = value
    }
  }

  return normalizeSurgicalFields(merged)
}

export function validateSurgicalFields(fields: SurgicalFields): string[] {
  const errors: string[] = []
  const dateError = validateDateField(fields.fecha_cirugia)
  if (dateError) errors.push(dateError)
  return errors
}

// Validate required custom fields. `requiredNames` is the set of field names
// flagged as is_required in the user's templates.
export function validateRequiredFields(
  fields: SurgicalFields,
  requiredNames: string[]
): string[] {
  const errors: string[] = []
  for (const name of requiredNames) {
    const value = fields[name]
    if (value === null || value === undefined || String(value).trim() === '') {
      errors.push(`El campo "${name}" es obligatorio`)
    }
  }
  return errors
}
