import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
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

async function readSheet(records: SurgicalRecord[], customFields: CustomFieldTemplate[] = []) {
  const buf = await buildWorkbook({ records, customFields })
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as Buffer)
  const ws = wb.worksheets[0]
  return ws
}

describe('buildWorkbook', () => {
  it('returns a Buffer with valid xlsx magic bytes', async () => {
    const buf = await buildWorkbook({ records: [makeRecord()] })
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf[0]).toBe(0x50)
    expect(buf[1]).toBe(0x4b)
  })

  it('freezes the header row and sets an autofilter', async () => {
    const ws = await readSheet([makeRecord()])
    const view = ws.views[0] as { state?: string; ySplit?: number }
    expect(view.state).toBe('frozen')
    expect(view.ySplit).toBe(1)
    expect(ws.autoFilter).toBeDefined()
  })

  it('escapes formula-injection prefixes', async () => {
    const record = makeRecord({ observaciones: '=SUM(A1:A10)', paciente: '+2+2', procedimiento: '@cmd', diagnostico: '-1-1' })
    const ws = await readSheet([record])
    const dataRow = ws.getRow(2)
    const get = (col: number) => String(dataRow.getCell(col).value ?? '')
    expect(get(10).startsWith("'=")).toBe(true)
    expect(get(1).startsWith("'+")).toBe(true)
    expect(get(4).startsWith("'@")).toBe(true)
    expect(get(3).startsWith("'-")).toBe(true)
  })

  it('adds custom field columns dynamically', async () => {
    const record = makeRecord({ lote: 'L-42' })
    const customFields: CustomFieldTemplate[] = [
      { id: 'c1', user_id: 'u1', field_name: 'lote', field_type: 'text', is_required: false, display_order: 1 },
    ]
    const ws = await readSheet([record], customFields)
    const headerRow = ws.getRow(1)
    const values = (headerRow.values as unknown[]).map(v => String(v ?? ''))
    const loteCol = values.findIndex(v => v === 'lote')
    expect(loteCol).toBeGreaterThan(0)
    expect(String(ws.getRow(2).getCell(loteCol).value ?? '')).toBe('L-42')
  })

  it('stores workbook title metadata', async () => {
    const buf = await buildWorkbook({ records: [makeRecord()], from: '2025-01-01', to: '2025-04-30' })
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as unknown as Buffer)
    expect(wb.title).toBe('Registros Quirúrgicos')
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
