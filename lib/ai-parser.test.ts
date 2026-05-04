import { describe, it, expect } from 'vitest'
import { parseAIResponse } from './ai-parser'

const SAMPLE_VALID = {
  paciente: 'García, Juan Carlos',
  fecha_cirugia: '12-04-2025',
  diagnostico: 'Apendicitis aguda',
  procedimiento: 'Apendicectomía laparoscópica',
  cirujano: 'Dr. Osvaldo Pérez',
  ayudantes: 'Dr. Martínez',
  anestesiologo: 'Dra. López',
  instrumentador: 'Enf. Rodríguez',
  sanatorio: 'Sanatorio San Lucas',
  observaciones: null,
}

describe('parseAIResponse', () => {
  it('parses a valid JSON string response', () => {
    const raw = `\`\`\`json\n${JSON.stringify(SAMPLE_VALID)}\n\`\`\``
    const result = parseAIResponse(raw)
    expect(result.fields.paciente).toBe('García, Juan Carlos')
    expect(result.fields.procedimiento).toBe('Apendicectomía laparoscópica')
  })

  it('parses a plain JSON response without code fences', () => {
    const raw = JSON.stringify(SAMPLE_VALID)
    const result = parseAIResponse(raw)
    expect(result.fields.cirujano).toBe('Dr. Osvaldo Pérez')
  })

  it('keeps all ayudantes when the model returns an array', () => {
    const raw = JSON.stringify({ ...SAMPLE_VALID, ayudantes: ['Dr. Martínez', 'Dra. Gómez'] })
    const result = parseAIResponse(raw)
    expect(result.fields.ayudantes).toBe('Dr. Martínez, Dra. Gómez')
  })

  it('maps common alias keys returned by the model', () => {
    const raw = JSON.stringify({
      paciente: 'García, Juan Carlos',
      fecha_inicio: '21-04-26',
      anestesista: 'Dra. López',
      instrumentadora: 'Enf. Rodríguez',
      hospital: 'Sanatorio San Lucas',
    })
    const result = parseAIResponse(raw)
    expect(result.fields.fecha_cirugia).toBe('21-04-2026')
    expect(result.fields.instrumentador).toBe('Enf. Rodríguez')
    expect(result.fields.sanatorio).toBe('Sanatorio San Lucas')
  })

  it('returns null for missing fields, not invented values', () => {
    const partial = { paciente: 'Test', procedimiento: null }
    const result = parseAIResponse(JSON.stringify(partial))
    expect(result.fields.diagnostico).toBeNull()
    expect(result.fields.paciente).toBe('Test')
  })

  it('normalizes short and iso dates to dd-mm-aaaa', () => {
    const shortDate = parseAIResponse(JSON.stringify({ fecha_cirugia: '22-01-26' }))
    const isoDate = parseAIResponse(JSON.stringify({ fecha_cirugia: '2026-01-19' }))
    expect(shortDate.fields.fecha_cirugia).toBe('22-01-2026')
    expect(isoDate.fields.fecha_cirugia).toBe('19-01-2026')
  })

  it('returns empty fields on unparseable response', () => {
    const result = parseAIResponse('I could not extract the data from this image.')
    expect(result.fields.paciente).toBeNull()
  })
})
