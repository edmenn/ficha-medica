import { normalizeSurgicalFields } from '@/lib/record-utils'
import type { SurgicalFields } from '@/types'

type DuplicateCandidate = {
  id: string
  final_data?: SurgicalFields | null
}

function normalizeComparable(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es') ?? ''
}

export function findLogicalDuplicate(
  records: DuplicateCandidate[],
  fields: Partial<SurgicalFields>,
  excludeRecordId?: string | null
) {
  const normalized = normalizeSurgicalFields(fields)
  const paciente = normalizeComparable(normalized.paciente)
  const fecha = normalizeComparable(normalized.fecha_cirugia)
  const procedimiento = normalizeComparable(normalized.procedimiento)

  if (!paciente || !fecha) return null

  const candidates = records.filter(record => {
    if (excludeRecordId && record.id === excludeRecordId) return false
    const data = normalizeSurgicalFields(record.final_data ?? {})
    return (
      normalizeComparable(data.paciente) === paciente &&
      normalizeComparable(data.fecha_cirugia) === fecha
    )
  })

  if (candidates.length === 0) return null
  if (!procedimiento) return candidates[0]

  return candidates.find(record => {
    const data = normalizeSurgicalFields(record.final_data ?? {})
    return normalizeComparable(data.procedimiento) === procedimiento
  }) ?? candidates[0]
}
