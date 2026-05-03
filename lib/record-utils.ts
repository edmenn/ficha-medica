import type { SurgicalFields } from '@/types'

const TIME_RE = /^(\d{1,2}):(\d{2})$/
const DURATION_TOKEN_RE = /(\d+)\s*(h|min)/gi
const DATE_RE = /^(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4})$/

export const STANDARD_FIELD_ORDER: (keyof SurgicalFields)[] = [
  'paciente',
  'fecha_cirugia',
  'fecha_fin',
  'hora_inicio',
  'hora_fin',
  'duracion',
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

function normalizeDateString(value: string | null): string | null {
  if (!value) return null
  const cleaned = value
    .trim()
    .replace(/\s+/g, '')
    .replace(/[.,]/g, match => (match === '.' ? '-' : match))
    .replace(/[–—]/g, '-')
    .replace(/\//g, '-')

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned
  }

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
      return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
    }
  }

  const day = first
  const month = second
  let year = third
  if (match[3].length <= 2) {
    year += 2000
  }

  if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
    return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
  }

  return cleaned
}

function normalizeTimeString(value: string | null): string | null {
  if (!value) return null
  const cleaned = value
    .trim()
    .replace(/\s+/g, '')
    .replace(/[.;,]/g, ':')
    .replace(/[hH]$/g, '')

  const match = cleaned.match(/^(\d{1,2})[:\-](\d{2})$/)
  if (!match) return cleaned

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) {
    return cleaned
  }

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null
  const match = value.match(TIME_RE)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) return null
  return (hours * 60) + minutes
}

function parseDateValue(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDuration(totalMinutes: number): string | null {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return null
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}min`
  if (hours > 0) return `${hours}h`
  return `${minutes}min`
}

function parseDurationToMinutes(value: string | null | undefined): number | null {
  if (!value) return null
  let total = 0
  const matcher = new RegExp(DURATION_TOKEN_RE)
  let match: RegExpExecArray | null
  while ((match = matcher.exec(value)) !== null) {
    const amount = Number(match[1])
    const unit = match[2].toLowerCase()
    if (Number.isNaN(amount)) continue
    total += unit === 'h' ? amount * 60 : amount
  }
  return total > 0 ? total : null
}

function computeDurationFromFields(fields: SurgicalFields): string | null {
  const startMinutes = parseTimeToMinutes(fields.hora_inicio)
  const endMinutes = parseTimeToMinutes(fields.hora_fin)
  if (startMinutes === null || endMinutes === null) {
    return formatDuration(parseDurationToMinutes(fields.duracion) ?? 0)
  }

  const startDate = parseDateValue(fields.fecha_cirugia)
  const endDate = parseDateValue(fields.fecha_fin ?? fields.fecha_cirugia)

  if (startDate && endDate) {
    const startAt = new Date(startDate)
    startAt.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)

    const endAt = new Date(endDate)
    endAt.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)

    if (endAt < startAt) {
      endAt.setDate(endAt.getDate() + 1)
    }

    const diffMinutes = Math.round((endAt.getTime() - startAt.getTime()) / 60000)
    return formatDuration(diffMinutes)
  }

  let diffMinutes = endMinutes - startMinutes
  if (diffMinutes < 0) diffMinutes += 24 * 60
  return formatDuration(diffMinutes)
}

export function normalizeSurgicalFields(input: Partial<SurgicalFields>): SurgicalFields {
  const normalized = emptySurgicalFields()

  for (const [key, rawValue] of Object.entries(input)) {
    normalized[key] = normalizeText(rawValue)
  }

  normalized.fecha_cirugia = normalizeDateString(normalized.fecha_cirugia)
  normalized.fecha_fin = normalizeDateString(normalized.fecha_fin)
  normalized.hora_inicio = normalizeTimeString(normalized.hora_inicio)
  normalized.hora_fin = normalizeTimeString(normalized.hora_fin)
  normalized.ayudantes = normalizeText(input.ayudantes)
  normalized.duracion = computeDurationFromFields(normalized)

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

  if (fields.fecha_cirugia && fields.fecha_fin) {
    const start = parseDateValue(fields.fecha_cirugia)
    const end = parseDateValue(fields.fecha_fin)
    if (start && end && start > end) {
      errors.push('La fecha de inicio no puede ser posterior a la fecha de fin')
    }
  }

  if (fields.hora_inicio && fields.hora_fin && fields.fecha_cirugia === fields.fecha_fin) {
    if (fields.hora_inicio > fields.hora_fin) {
      errors.push('La hora de inicio no puede ser posterior a la hora de fin')
    }
  }

  return errors
}

export function getDurationMinutes(fields: SurgicalFields): number | null {
  const computed = computeDurationFromFields(fields)
  return parseDurationToMinutes(computed)
}
