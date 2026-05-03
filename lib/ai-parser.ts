import type { SurgicalFields, RecordField } from '@/types'
import { normalizeSurgicalFields } from './record-utils'

const STANDARD_FIELDS: (keyof SurgicalFields)[] = [
  'paciente', 'fecha_cirugia', 'fecha_fin', 'hora_inicio', 'hora_fin', 'duracion',
  'diagnostico', 'procedimiento', 'cirujano', 'ayudantes',
  'anestesiologo', 'instrumentador', 'sanatorio', 'observaciones',
]

const FIELD_ALIASES: Record<keyof SurgicalFields, string[]> = {
  paciente: ['paciente', 'nombrepaciente', 'pacientenombre'],
  fecha_cirugia: ['fechacirugia', 'fechainicio', 'fechadeinicio', 'fechaprocedimiento', 'fechaintervencion'],
  fecha_fin: ['fechafin', 'fechafinalizacion', 'fechafinalizacioncirugia', 'fechafinal', 'fechaterminacion', 'fechacierre'],
  hora_inicio: ['horainicio', 'horadeinicio', 'horainicial', 'horadeentrada', 'horainiciocirugia'],
  hora_fin: ['horafin', 'horadefin', 'horafinalizacion', 'horaterminacion', 'horasalida', 'horacierrecirugia'],
  duracion: ['duracion', 'tiempoquirurgico', 'tiempocirugia', 'duracioncirugia'],
  diagnostico: ['diagnostico', 'diagnosticooperatorio', 'diagnosticopreoperatorio', 'dx'],
  procedimiento: ['procedimiento', 'cirugia', 'intervencion', 'operacion', 'tecnicaquirurgica'],
  cirujano: ['cirujano', 'cirujana', 'medicocirujano'],
  ayudantes: ['ayudantes', 'ayudante', 'asistentes', 'asistente', 'primerayudante', 'segundoayudante'],
  anestesiologo: ['anestesiologo', 'anestesiologa', 'anestesista', 'medicoanestesiologo'],
  instrumentador: ['instrumentador', 'instrumentadora', 'instrumentista', 'instrumentalista', 'arsenalera'],
  sanatorio: ['sanatorio', 'hospital', 'clinica', 'centroquirurgico', 'centromedico'],
  observaciones: ['observaciones', 'obs', 'notas', 'comentarios'],
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function resolveFieldValue(parsed: Record<string, unknown>, key: keyof SurgicalFields): unknown {
  const aliases = FIELD_ALIASES[key]
  for (const [rawKey, rawValue] of Object.entries(parsed)) {
    const normalized = normalizeKey(rawKey)
    if (aliases.includes(normalized)) {
      return rawValue
    }
  }
  return undefined
}

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

  const rawFields: SurgicalFields = { ...empty }
  for (const key of STANDARD_FIELDS) {
    const val = resolveFieldValue(parsed, key)
    rawFields[key] = Array.isArray(val)
      ? val.map(item => (typeof item === 'string' ? item.trim() : '')).filter(Boolean).join(', ') || null
      : (typeof val === 'string' && val.trim() !== '') ? val.trim() : null
  }

  const fields = normalizeSurgicalFields(rawFields)

  const record_fields = STANDARD_FIELDS.map(field_name => ({
    field_name: field_name as string,
    ai_value: fields[field_name],
    final_value: fields[field_name],
    confidence: fields[field_name] !== null ? 1 : 0,
  }))

  return { fields, record_fields }
}
