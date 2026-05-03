import type { SurgicalFields } from '@/types'

const TIME_RE = /^(\d{1,2}):(\d{2})$/
const DURATION_TOKEN_RE = /(\d+)\s*(h|min)/gi

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
  const fields = { ...input } as SurgicalFields
  const normalized: SurgicalFields = {} as SurgicalFields

  for (const [key, rawValue] of Object.entries(fields)) {
    normalized[key] = normalizeText(rawValue)
  }

  normalized.ayudantes = normalizeText(fields.ayudantes)
  normalized.duracion = computeDurationFromFields(normalized)

  return normalized
}

export function getDurationMinutes(fields: SurgicalFields): number | null {
  const computed = computeDurationFromFields(fields)
  return parseDurationToMinutes(computed)
}
