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
