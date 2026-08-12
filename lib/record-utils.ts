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

// Campos que representan nombres de personas (se aplica limpieza de nombres).
const PERSON_NAME_FIELDS = new Set<keyof SurgicalFields>(['paciente', 'cirujano', 'ayudantes', 'anestesiologo', 'instrumentador'])

// Tokens sin valor que la IA puede agregar en campos de personas.
const NOISE_TOKENS = new Set(['NO APLICA', 'SIN DATOS', 'S/D', 'SIN ESPECIFICAR', 'NO CORRESPONDE'])

const TITLE_ALIASES: Record<string, string> = {
  'DR': 'DR.',
  'DR.': 'DR.',
  'DRA': 'DRA.',
  'DRA.': 'DRA.',
  'LIC': 'LIC.',
  'LIC.': 'LIC.',
  'ENF': 'ENF.',
  'ENF.': 'ENF.',
  'PROFA': 'PROF.',
  'PROF': 'PROF.',
  'TEC': 'TEC.',
  'TÉC': 'TEC.',
}

// Normaliza un nombre de persona (paciente/cirujano/ayudantes/anestesiólogo/
// instrumentador): limpia bordes, quita dígitos, normaliza títulos y filtra ruido.
// NO reordena apellido/nombre a ciegas (riesgo con nombres compuestos).
export function normalizePersonName(value: unknown): string | null {
  if (typeof value !== 'string') {
    if (Array.isArray(value)) return normalizePersonList(value)
    return null
  }

  let text = value.trim().replace(/\s+/g, ' ')
  if (text === '') return null

  // Quitar dígitos (IDs, documentos, folios) y ruido de bordes.
  text = text.replace(/\d+/g, '').replace(/\s+/g, ' ').trim()
  text = text.replace(/^[\s,;.]+/, '').replace(/[\s,;.]+$/, '').trim()

  if (text === '') return null

  // Quitar tokens de ruido completos (p.ej. ", NO APLICA", "SIN DATOS").
  text = text
    .split(',')
    .map(part => part.trim())
    .filter(part => part !== '' && !NOISE_TOKENS.has(part.toLocaleUpperCase('es')))
    .join(', ')

  // Normalizar títulos (DR -> DR., DRA -> DRA., LIC -> LIC., ENF -> ENF.).
  text = text.replace(/(^|[\s,(])(DR\.?|DRA\.?|LIC\.?|ENF\.?|PROF\.?|PROFA\.?|TEC\.?|TÉC\.?)(?=[\s,]|$)/gi, (match, prefix, title) => {
    const normalized = TITLE_ALIASES[title.toLocaleUpperCase('es')] ?? title
    return `${prefix}${normalized}`
  })

  // Quitar títulos duplicados (DR. DR. -> DR.).
  text = text.replace(/(DR\.|DRA\.|LIC\.|ENF\.|PROF\.)\s+(?=DR\.|DRA\.|LIC\.|ENF\.|PROF\.)/gi, '').trim()

  if (text === '') return null
  return text.toLocaleUpperCase('es')
}

// Normaliza una lista de personas (p.ej. ayudantes) separadas por coma.
function normalizePersonList(values: string[]): string | null {
  const parts = values
    .map(item => normalizePersonName(item))
    .filter((item): item is string => Boolean(item))
  return parts.length > 0 ? parts.join(', ') : null
}

function normalizeText(value: unknown, field?: keyof SurgicalFields): string | null {
  if (field && PERSON_NAME_FIELDS.has(field)) {
    return normalizePersonName(value)
  }

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
