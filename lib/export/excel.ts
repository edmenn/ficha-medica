import * as XLSX from 'xlsx'
import type { SurgicalRecord } from '@/types'

const HEADERS = [
  'Paciente', 'Fecha Inicio', 'Fecha Fin', 'Hora Inicio', 'Hora Fin', 'Duración',
  'Diagnóstico', 'Procedimiento', 'Cirujano', 'Ayudantes',
  'Anestesiólogo', 'Instrumentador', 'Sanatorio', 'Observaciones', 'Creado',
]

export function buildWorkbook(records: SurgicalRecord[]): Buffer {
  const rows = records.map(r => {
    const f = r.final_data
    return [
      f.paciente, f.fecha_cirugia, f.fecha_fin ?? null, f.hora_inicio, f.hora_fin, f.duracion,
      f.diagnostico, f.procedimiento, f.cirujano, f.ayudantes,
      f.anestesiologo, f.instrumentador, f.sanatorio, f.observaciones,
      new Date(r.created_at).toLocaleDateString('es-AR'),
    ]
  })

  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows])
  ws['!cols'] = HEADERS.map((_, i) => ({ wch: i === 0 ? 25 : 18 }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Registros quirúrgicos')

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
