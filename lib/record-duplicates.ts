import { normalizeSurgicalFields } from '@/lib/record-utils'
import type { SurgicalFields } from '@/types'

export const DUPLICATE_THRESHOLD = 0.6

type DuplicateCandidate = {
  id: string
  final_data?: SurgicalFields | null
  source_image_hash?: string | null
}

function normalizeComparable(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es') ?? ''
}

// Coincidencia de tokens (palabras) entre dos strings, 0..1. Sin dependencias.
// Ignora puntuación (comas, puntos, acentos normalizados por lower-case).
function tokenize(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

function tokenOverlap(a: string, b: string): number {
  const ta = tokenize(a)
  const tb = tokenize(b)
  if (ta.length === 0 || tb.length === 0) return 0
  const setB = new Set(tb)
  const hits = ta.filter(t => setB.has(t)).length
  return hits / Math.max(ta.length, tb.length)
}

// Score combinado 0..1 de que `fields` corresponda al mismo registro que `candidate`.
// Paciente + fecha son la regla base (peso fuerte); procedimiento y solapamiento de
// tokens refinan la decisión. La similitud de imagen es señal auxiliar.
export function duplicateScore(fields: Partial<SurgicalFields>, candidate: DuplicateCandidate): number {
  const a = normalizeSurgicalFields(fields)
  const b = normalizeSurgicalFields(candidate.final_data ?? {})

  let score = 0

  const pA = normalizeComparable(a.paciente)
  const pB = normalizeComparable(b.paciente)
  if (pA && pB) {
    if (pA === pB) score += 0.35
    else score += 0.2 * tokenOverlap(pA, pB)
  }

  const fA = normalizeComparable(a.fecha_cirugia)
  const fB = normalizeComparable(b.fecha_cirugia)
  if (fA && fB && fA === fB) score += 0.3

  const prA = normalizeComparable(a.procedimiento)
  const prB = normalizeComparable(b.procedimiento)
  if (prA && prB && prA === prB) score += 0.15
  else if (prA && prB) score += 0.1 * tokenOverlap(prA, prB)

  const sA = normalizeComparable(a.sanatorio)
  const sB = normalizeComparable(b.sanatorio)
  if (sA && sB && sA === sB) score += 0.1

  return Math.min(1, Math.round(score * 100) / 100)
}

export function findDuplicate(
  records: DuplicateCandidate[],
  fields: Partial<SurgicalFields>,
  excludeRecordId?: string | null
): { existing_id: string | null; score: number } | null {
  const normalized = normalizeSurgicalFields(fields)
  const paciente = normalizeComparable(normalized.paciente)
  const fecha = normalizeComparable(normalized.fecha_cirugia)

  // Sin datos clave no hay base para detectar duplicado.
  if (!paciente || !fecha) return null

  let best: { existing_id: string; score: number } | null = null
  for (const record of records) {
    if (excludeRecordId && record.id === excludeRecordId) continue
    const data = normalizeSurgicalFields(record.final_data ?? {})
    const rPaciente = normalizeComparable(data.paciente)
    const rFecha = normalizeComparable(data.fecha_cirugia)
    // Regla base: exige coincidencia de paciente y fecha.
    if (rPaciente !== paciente || rFecha !== fecha) continue
    const score = duplicateScore(normalized, record)
    if (!best || score > best.score) {
      best = { existing_id: record.id, score }
    }
  }

  if (!best) return null
  if (best.score < DUPLICATE_THRESHOLD) return null
  return best
}

// Compatibilidad: mantiene la firma anterior para quien la use.
export function findLogicalDuplicate(
  records: DuplicateCandidate[],
  fields: Partial<SurgicalFields>,
  excludeRecordId?: string | null
) {
  return findDuplicate(records, fields, excludeRecordId)?.existing_id ?? null
}
