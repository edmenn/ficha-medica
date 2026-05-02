import type { SurgicalFields, RecordField } from '@/types'

const STANDARD_FIELDS: (keyof SurgicalFields)[] = [
  'paciente', 'fecha_cirugia', 'hora_inicio', 'hora_fin', 'duracion',
  'diagnostico', 'procedimiento', 'cirujano', 'ayudantes',
  'anestesiologo', 'instrumentador', 'sanatorio', 'observaciones',
]

function extractJSON(raw: string): unknown {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : raw.trim()
  return JSON.parse(jsonStr)
}

export function parseAIResponse(raw: string): {
  fields: SurgicalFields
  record_fields: Omit<RecordField, 'id' | 'record_id'>[]
} {
  const empty: SurgicalFields = Object.fromEntries(
    STANDARD_FIELDS.map(k => [k, null])
  ) as SurgicalFields

  let parsed: Record<string, unknown>
  try {
    parsed = extractJSON(raw) as Record<string, unknown>
  } catch {
    return {
      fields: empty,
      record_fields: STANDARD_FIELDS.map(field_name => ({
        field_name: field_name as string,
        ai_value: null,
        final_value: null,
        confidence: 0,
      })),
    }
  }

  const fields: SurgicalFields = { ...empty }
  for (const key of STANDARD_FIELDS) {
    const val = parsed[key]
    fields[key] = (typeof val === 'string' && val.trim() !== '') ? val.trim() : null
  }

  const record_fields = STANDARD_FIELDS.map(field_name => ({
    field_name: field_name as string,
    ai_value: fields[field_name],
    final_value: fields[field_name],
    confidence: fields[field_name] !== null ? 1 : 0,
  }))

  return { fields, record_fields }
}
