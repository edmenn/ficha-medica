import type { SurgicalFields } from '@/types'
import { emptySurgicalFields, normalizeSurgicalFields } from './record-utils'

const FIELD_ALIASES: Record<string, keyof SurgicalFields> = {
  fecha_inicio: 'fecha_cirugia',
  anestesista: 'anestesiologo',
  instrumentadora: 'instrumentador',
  hospital: 'sanatorio',
}

function extractJSON(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    return JSON.parse(fence ? fence[1].trim() : raw.trim()) as Record<string, unknown>
  }
}

function remapFieldAliases(rawFields: Record<string, unknown>): Partial<SurgicalFields> {
  const remapped: Partial<SurgicalFields> = {}

  for (const [rawKey, value] of Object.entries(rawFields)) {
    const key = FIELD_ALIASES[rawKey] ?? rawKey
    remapped[key] = value as SurgicalFields[keyof SurgicalFields]
  }

  return remapped
}

// La IA/OCR no debe dejar numeros (IDs, documentos, folios) en el nombre del paciente.
function stripDigitsFromPatient(fields: SurgicalFields): SurgicalFields {
  if (!fields.paciente) return fields
  const cleaned = fields.paciente.replace(/\d+/g, '').replace(/\s+/g, ' ').trim()
  return { ...fields, paciente: cleaned || null }
}

export function parseAIResponse(raw: string): { fields: SurgicalFields } {
  try {
    const extracted = extractJSON(raw)
    return {
      fields: stripDigitsFromPatient(normalizeSurgicalFields(remapFieldAliases(extracted))),
    }
  } catch {
    return { fields: emptySurgicalFields() }
  }
}
