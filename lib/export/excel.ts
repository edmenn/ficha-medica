import ExcelJS from 'exceljs'
import type { CustomFieldTemplate, SurgicalRecord } from '@/types'
import { customFieldNames, sanitizeCellValue } from './helpers'

interface BuildWorkbookOptions {
  records: SurgicalRecord[]
  customFields?: CustomFieldTemplate[]
  from?: string
  to?: string
  sanatorio?: string
  emittedAt?: string
}

const BASE_HEADERS = [
  'Paciente', 'Fecha', 'Diagnóstico', 'Procedimiento', 'Cirujano',
  'Ayudantes', 'Anestesiólogo', 'Instrumentador', 'Sanatorio', 'Observaciones', 'Creado',
]

export async function buildWorkbook({
  records,
  customFields = [],
  from,
  to,
  sanatorio,
  emittedAt,
}: BuildWorkbookOptions): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Ficha Médica'
  workbook.created = new Date()

  const extraHeaders = customFieldNames(records, customFields)
  const headers = [...BASE_HEADERS, ...extraHeaders]

  const worksheet = workbook.addWorksheet('Registros quirúrgicos', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  worksheet.columns = headers.map((header, i) => ({
    header,
    key: header,
    width: i === 0 ? 28 : header === 'Observaciones' ? 50 : 20,
  }))

  for (const r of records) {
    const f = r.final_data ?? {}
    const row: Record<string, string> = {}
    BASE_HEADERS.forEach((header, i) => {
      const values = [
        f.paciente, f.fecha_cirugia, f.diagnostico, f.procedimiento, f.cirujano,
        f.ayudantes, f.anestesiologo, f.instrumentador, f.sanatorio, f.observaciones,
        new Date(r.created_at).toLocaleDateString('es-AR'),
      ]
      row[header] = sanitizeCellValue(values[i])
    })
    extraHeaders.forEach(key => {
      row[key] = sanitizeCellValue(f[key])
    })
    worksheet.addRow(row)
  }

  // Autofiltro sobre el rango de datos.
  const lastRow = worksheet.rowCount
  if (lastRow >= 1) {
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, lastRow), column: headers.length },
    }
  }

  // Formato de fecha (dd-mm-yyyy) en la columna "Fecha" (columna 2).
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const cell = row.getCell(2)
      cell.numFmt = 'dd-mm-yyyy'
    }
  })

  // Metadatos del reporte en las propiedades del documento.
  workbook.subject = [from && `Desde:${from}`, to && `Hasta:${to}`, sanatorio && `Sanatorio:${sanatorio}`, emittedAt && `Emitido:${emittedAt}`]
    .filter(Boolean)
    .join(' | ') || 'Reporte clínico'
  workbook.title = 'Registros Quirúrgicos'

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer as unknown as ArrayBuffer) as Buffer
}
