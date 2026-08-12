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

// Campos de texto que se normalizan a MAYÚSCULAS (todo lo que ingrese el usuario o la IA).
const UPPERCASE_FIELDS = new Set<keyof SurgicalFields>(['paciente', 'diagnostico', 'procedimiento', 'cirujano', 'ayudantes', 'anestesiologo', 'instrumentador', 'sanatorio', 'observaciones'])

function normalizeText(value: unknown, field?: keyof SurgicalFields): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return null
    return field && UPPERCASE_FIELDS.has(field) ? trimmed.toLocaleUpperCase('es') : trimmed
  }

  if (Array.isArray(value)) {
    const parts = value
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
    if (parts.length === 0) return null
    const joined = parts.join(', ')
    return field && UPPERCASE_FIELDS.has(field) ? joined.toLocaleUpperCase('es') : joined
  }

  return null
}

export function normalizeSurgicalFields(input: Partial<SurgicalFields>): SurgicalFields {
  const normalized = emptySurgicalFields()

  for (const [key, rawValue] of Object.entries(input)) {
    normalized[key] = normalizeText(rawValue, key as keyof SurgicalFields)
  }

  normalized.fecha_cirugia = normalizeDateString(normalized.fecha_cirugia)

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

  // El nombre del paciente no debe contener números (evita IDs/documentos en el nombre).
  if (fields.paciente && /\d/.test(fields.paciente)) {
    errors.push('El nombre del paciente no puede contener números')
  }

  return errors
}
