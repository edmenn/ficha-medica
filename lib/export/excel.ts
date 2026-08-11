import * as XLSX from 'xlsx'
import type { CustomFieldTemplate, SurgicalRecord } from '@/types'
import { customFieldNames, sanitizeCellValue } from './helpers'

interface BuildWorkbookOptions {
  records: SurgicalRecord[]
  customFields?: CustomFieldTemplate[]
  from?: string
  to?: string
  sanatorio?: string
  emittedAt?: string
}const BASE_HEADERS = [
  'Paciente', 'Fecha', 'Diagnóstico', 'Procedimiento', 'Cirujano',
  'Ayudantes', 'Anestesiólogo', 'Instrumentador', 'Sanatorio', 'Observaciones', 'Creado',
]

export function buildWorkbook({
  records,
  customFields = [],
  from,
  to,
  sanatorio,
  emittedAt,
}: BuildWorkbookOptions): Buffer {
  const extraHeaders = customFieldNames(records, customFields)
  const headers = [...BASE_HEADERS, ...extraHeaders]

  const rows = records.map(r => {
    const f = r.final_data ?? {}
    const base = [
      sanitizeCellValue(f.paciente),
      sanitizeCellValue(f.fecha_cirugia),
      sanitizeCellValue(f.diagnostico),
      sanitizeCellValue(f.procedimiento),
      sanitizeCellValue(f.cirujano),
      sanitizeCellValue(f.ayudantes),
      sanitizeCellValue(f.anestesiologo),
      sanitizeCellValue(f.instrumentador),
      sanitizeCellValue(f.sanatorio),
      sanitizeCellValue(f.observaciones),
      sanitizeCellValue(new Date(r.created_at).toLocaleDateString('es-AR')),
    ]
    const extras = extraHeaders.map(key => sanitizeCellValue(f[key]))
    return [...base, ...extras]
  })

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

  // Freeze the header row and add auto-filter.
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_cell({ r: 0, c: headers.length - 1 })}1` }

  ws['!cols'] = headers.map((header, i) => ({
    wch: i === 0 ? 28 : header === 'Observaciones' ? 50 : 20,
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Registros quirúrgicos')

  const metaParts = [
    from && `Desde:${from}`,
    to && `Hasta:${to}`,
    sanatorio && `Sanatorio:${sanatorio}`,
    emittedAt && `Emitido:${emittedAt}`,
  ].filter(Boolean).join(' | ')

  wb.Workbook = { Views: [] }
  wb.Props = {
    Title: 'Registros Quirúrgicos',
    Subject: metaParts || 'Reporte clínico',
    CreatedDate: new Date(),
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
