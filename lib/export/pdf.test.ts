import { describe, it, expect } from 'vitest'
import { buildPDF } from './pdf'
import type { CustomFieldTemplate, SurgicalRecord } from '@/types'

function makeRecord(id: string, paciente: string, extra: Record<string, string | null> = {}): SurgicalRecord {
  return {
    id,
    user_id: 'u1',
    image_path: 'manual-entry',
    image_paths: ['manual-entry'],
    ai_raw_response: null,
    extracted_data: {} as never,
    final_data: {
      paciente,
      fecha_cirugia: '12-04-2025',
      diagnostico: 'Apendicitis',
      procedimiento: 'Apendicectomía',
      cirujano: 'Dr. Pérez',
      ayudantes: null,
      anestesiologo: 'Dra. López',
      instrumentador: null,
      sanatorio: 'Sanatorio Central',
      observaciones: 'Observación extensa: ' + 'x'.repeat(200),
      ...extra,
    },
    status: 'final',
    created_at: '2025-04-12T08:00:00Z',
    updated_at: '2025-04-12T10:30:00Z',
  }
}

describe('buildPDF', () => {
  it('produces a valid PDF buffer', async () => {
    const buf = await buildPDF([makeRecord('1', 'García, Juan')], '2025-01-01', '2025-04-30', undefined, new Date().toISOString())
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(100)
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('produces a valid PDF with zero records', async () => {
    const buf = await buildPDF([], '2025-01-01', '2025-04-30', undefined, new Date().toISOString())
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(buf.length).toBeGreaterThan(100)
  })

  it('handles multiple records and custom fields', async () => {
    const records = [
      makeRecord('1', 'Paciente A'),
      makeRecord('2', 'Paciente B', { lote: 'L-9', nota: 'urgente' }),
    ]
    const customFields: CustomFieldTemplate[] = [
      { id: 'c1', user_id: 'u1', field_name: 'lote', field_type: 'text', is_required: false, display_order: 1 },
      { id: 'c2', user_id: 'u1', field_name: 'nota', field_type: 'text', is_required: false, display_order: 2 },
    ]
    const buf = await buildPDF(records, '2025-01-01', '2025-04-30', undefined, new Date().toISOString(), customFields)
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('renders many records into a multi-page document without error', async () => {
    const records = Array.from({ length: 30 }, (_, i) => makeRecord(`id-${i}`, `Paciente ${i}`))
    const buf = await buildPDF(records, '2025-01-01', '2025-04-30')
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
  })
})
