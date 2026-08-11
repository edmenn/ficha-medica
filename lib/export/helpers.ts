import type { CustomFieldTemplate, SurgicalRecord } from '@/types'

// Escape cell values that begin with characters Excel interprets as formulas,
// preventing formula injection when the workbook is opened.
export function sanitizeCellValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.length === 0) return str
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`
  }
  return str
}

// Deterministic list of custom field names for the effective user, excluding
// collisions with standard fields. Used to build export columns dynamically.
export function customFieldNames(records: SurgicalRecord[], templates: CustomFieldTemplate[]): string[] {
  const templateNames = templates.map(t => t.field_name)
  const presentInData = new Set<string>()
  for (const record of records) {
    const f = record.final_data ?? {}
    for (const key of Object.keys(f)) {
      if (!STANDARD_FIELD_NAMES.has(key)) presentInData.add(key)
    }
  }

  const names = new Set<string>()
  for (const name of templateNames) if (!STANDARD_FIELD_NAMES.has(name)) names.add(name)
  Array.from(presentInData).forEach(name => {
    if (!STANDARD_FIELD_NAMES.has(name)) names.add(name)
  })

  return Array.from(names.keys())
}

export const STANDARD_FIELD_NAMES = new Set([
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
])
