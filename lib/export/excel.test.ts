import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { buildWorkbook } from './excel'
import { sanitizeCellValue } from './helpers'
import type { CustomFieldTemplate, SurgicalRecord } from '@/types'

function makeRecord(overrides: Partial<SurgicalRecord['final_data']> = {}): SurgicalRecord {
  return {
    id: '1',
    user_id: 'u1',
    image_path: 'img/1.jpg',
    image_paths: ['img/1.jpg'],
    ai_raw_response: null,
    extracted_data: {} as never,
    final_data: {
      paciente: 'García, Juan',
      fecha_cirugia: '12-04-2025',
      diagnostico: 'Apendicitis',
      procedimiento: 'Apendicectomía',
      cirujano: 'Dr. Pérez',
      ayudantes: null,
      anestesiologo: 'Dra. López',
      instrumentador: null,
      sanatorio: 'Sanatorio Central',
      observaciones: null,
      ...overrides,
    },
    status: 'final',
    created_at: '2025-04-12T08:00:00Z',
    updated_at: '2025-04-12T10:30:00Z',
  }
}

function readSheet(records: SurgicalRecord[], customFields: CustomFieldTemplate[] = []) {
  const buf = buildWorkbook({ records, customFields })
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as (string | number)[][]
}

describe('buildWorkbook', () => {
  it('returns a Buffer with valid xlsx magic bytes', () => {
    const buf = buildWorkbook({ records: [makeRecord()] })
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf[0]).toBe(0x50)
    expect(buf[1]).toBe(0x4b)
  })

  it('sets an autofilter on the sheet', () => {
    const buf = buildWorkbook({ records: [makeRecord()] })
    const wb = XLSX.read(buf, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    expect(ws['!autofilter']).toBeDefined()
  })

  it('escapes formula-injection prefixes', () => {
    const record = makeRecord({ observaciones: '=SUM(A1:A10)', paciente: '+2+2', procedimiento: '@cmd', diagnostico: '-1-1' })
    const rows = readSheet([record])
    const dataRow = rows[1]
    const observaciones = String(dataRow[9])
    expect(observaciones.startsWith('=')).toBe(false)
    expect(observaciones.startsWith("'=")).toBe(true)
    expect(String(dataRow[0]).startsWith("'+")).toBe(true)
    expect(String(dataRow[3]).startsWith("'@")).toBe(true)
    expect(String(dataRow[2]).startsWith("'-")).toBe(true)
  })

  it('adds custom field columns dynamically', () => {
    const record = makeRecord({ lote: 'L-42' })
    const customFields: CustomFieldTemplate[] = [
      { id: 'c1', user_id: 'u1', field_name: 'lote', field_type: 'text', is_required: false, display_order: 1 },
    ]
    const rows = readSheet([record], customFields)
    expect(rows[0]).toContain('lote')
    expect(rows[1][rows[0].indexOf('lote')]).toBe('L-42')
  })

  it('stores metadata props', () => {
    const buf = buildWorkbook({ records: [makeRecord()], from: '2025-01-01', to: '2025-04-30', sanatorio: 'Central' })
    const wb = XLSX.read(buf, { type: 'buffer' })
    expect(wb.Props?.Title).toBe('Registros Quirúrgicos')
  })
})

describe('sanitizeCellValue', () => {
  it('prefixes dangerous leading characters', () => {
    expect(sanitizeCellValue('=1+1')).toBe("'=1+1")
    expect(sanitizeCellValue('+sum')).toBe("'+sum")
    expect(sanitizeCellValue('-2')).toBe("'-2")
    expect(sanitizeCellValue('@echo')).toBe("'@echo")
  })

  it('leaves safe values untouched', () => {
    expect(sanitizeCellValue('Juan')).toBe('Juan')
    expect(sanitizeCellValue('12-04-2025')).toBe('12-04-2025')
    expect(sanitizeCellValue(null)).toBe('')
  })
})
