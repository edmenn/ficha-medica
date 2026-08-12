import ExcelJS from 'exceljs'
import type { SurgicalRecord } from '@/types'
import { sanitizeCellValue } from './helpers'

interface BuildWorkbookOptions {
  records: SurgicalRecord[]
  from?: string
  to?: string
  sanatorio?: string
  emittedAt?: string
}

const HEADERS = [
  'Paciente', 'Fecha', 'Diagnóstico', 'Procedimiento', 'Cirujano',
  'Ayudantes', 'Anestesiólogo', 'Instrumentador', 'Sanatorio', 'Observaciones', 'Creado',
]

export async function buildWorkbook({
  records,
  from,
  to,
  sanatorio,
  emittedAt,
}: BuildWorkbookOptions): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Ficha Médica'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Registros quirúrgicos', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  worksheet.columns = HEADERS.map((header, i) => ({
    header,
    key: header,
    width: i === 0 ? 28 : header === 'Observaciones' ? 50 : 20,
  }))

  for (const r of records) {
    const f = r.final_data ?? {}
    worksheet.addRow({
      'Paciente': sanitizeCellValue(f.paciente),
      'Fecha': sanitizeCellValue(f.fecha_cirugia),
      'Diagnóstico': sanitizeCellValue(f.diagnostico),
      'Procedimiento': sanitizeCellValue(f.procedimiento),
      'Cirujano': sanitizeCellValue(f.cirujano),
      'Ayudantes': sanitizeCellValue(f.ayudantes),
      'Anestesiólogo': sanitizeCellValue(f.anestesiologo),
      'Instrumentador': sanitizeCellValue(f.instrumentador),
      'Sanatorio': sanitizeCellValue(f.sanatorio),
      'Observaciones': sanitizeCellValue(f.observaciones),
      'Creado': sanitizeCellValue(new Date(r.created_at).toLocaleDateString('es-AR')),
    })
  }

  // Autofiltro sobre el rango de datos.
  const lastRow = worksheet.rowCount
  if (lastRow >= 1) {
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, lastRow), column: HEADERS.length },
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
