import { describe, it, expect } from 'vitest'
import { buildWorkbook } from './excel'
import type { SurgicalRecord } from '@/types'

const SAMPLE_RECORDS: SurgicalRecord[] = [
  {
    id: '1',
    user_id: 'u1',
    image_path: 'img/1.jpg',
    ai_raw_response: null,
    extracted_data: {} as never,
    final_data: {
      paciente: 'García, Juan',
      fecha_cirugia: '2025-04-12',
      fecha_fin: '2025-04-12',
      hora_inicio: '08:30',
      hora_fin: '10:15',
      duracion: '1h 45min',
      diagnostico: 'Apendicitis',
      procedimiento: 'Apendicectomía',
      cirujano: 'Dr. Pérez',
      ayudantes: null,
      anestesiologo: 'Dra. López',
      instrumentador: null,
      sanatorio: 'Sanatorio Central',
      observaciones: null,
    },
    status: 'final',
    created_at: '2025-04-12T08:00:00Z',
    updated_at: '2025-04-12T10:30:00Z',
  },
]

describe('buildWorkbook', () => {
  it('returns a Buffer', () => {
    const buf = buildWorkbook(SAMPLE_RECORDS)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(0)
  })

  it('produces valid xlsx magic bytes', () => {
    const buf = buildWorkbook(SAMPLE_RECORDS)
    // XLSX files start with PK (zip format)
    expect(buf[0]).toBe(0x50)
    expect(buf[1]).toBe(0x4b)
  })
})
