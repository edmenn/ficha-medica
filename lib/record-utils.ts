import type { SurgicalFields } from '@/types'

const DATE_RE = /^(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4})$/

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

export function normalizeDateString(value: string | null): string | null {
  if (!value) return null
  const cleaned = value
    .trim()
    .replace(/\s+/g, '')
    .replace(/[.,]/g, match => (match === '.' ? '-' : match))
    .replace(/[–—]/g, '-')
    .replace(/\//g, '-')

  const match = cleaned.match(DATE_RE)
  if (!match) return cleaned

  const first = Number(match[1])
  const second = Number(match[2])
  const third = Number(match[3])

  if ([first, second, third].some(Number.isNaN)) return cleaned

  if (match[1].length === 4) {
    const year = first
    const month = second
    const day = third
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${day.toString().padStart(2, '0')}-${month.toString().padStart(2, '0')}-${year.toString().padStart(4, '0')}`
    }
  }

  const day = first
  const month = second
  let year = third
  if (match[3].length <= 2) {
    year += 2000
  }

  if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
    return `${day.toString().padStart(2, '0')}-${month.toString().padStart(2, '0')}-${year.toString().padStart(4, '0')}`
  }

  return cleaned
}

function parseDateToTimestamp(value: string | null | undefined): number | null {
  if (!value) return null
  const normalized = normalizeDateString(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!match) return null

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  if ([day, month, year].some(Number.isNaN)) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  return Number.isNaN(date.getTime()) ? null : date.getTime()
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
  if (fields.fecha_cirugia) {
    const normalized = normalizeDateString(fields.fecha_cirugia)
    if (!normalized || !normalized.match(/^\d{2}-\d{2}-\d{4}$/)) {
      errors.push('La fecha debe estar en formato dd-mm-aaaa')
    }
  }
  return errors
}

export function compareDateStringsDesc(left: string | null | undefined, right: string | null | undefined) {
  const leftTs = parseDateToTimestamp(left)
  const rightTs = parseDateToTimestamp(right)
  if (leftTs === null && rightTs === null) return 0
  if (leftTs === null) return 1
  if (rightTs === null) return -1
  return rightTs - leftTs
}

export function isDateInRange(
  value: string | null | undefined,
  from: string | null | undefined,
  to: string | null | undefined
) {
  const valueTs = parseDateToTimestamp(value)
  if (valueTs === null) return false

  const fromTs = parseDateToTimestamp(from)
  if (fromTs !== null && valueTs < fromTs) return false

  const toTs = parseDateToTimestamp(to)
  if (toTs !== null && valueTs > toTs) return false

  return true
}
