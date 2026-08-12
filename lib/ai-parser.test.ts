import { describe, it, expect } from 'vitest'
import { parseAIResponse } from './ai-parser'

const SAMPLE_VALID = {
  paciente: 'García, Juan Carlos',
  fecha_cirugia: '12-04-2025',
  diagnostico: 'Apendicitis aguda',
  procedimiento: 'Apendicectomía laparoscópica',
  cirujano: 'Dr. García, Juan',
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
    expect(result.fields.paciente).toBe('GARCÍA, JUAN CARLOS')
    expect(result.fields.procedimiento).toBe('APENDICECTOMÍA LAPAROSCÓPICA')
  })

  it('parses a plain JSON response without code fences', () => {
    const raw = JSON.stringify(SAMPLE_VALID)
    const result = parseAIResponse(raw)
    expect(result.fields.cirujano).toBe('DR. GARCÍA, JUAN')
  })

  it('keeps all ayudantes when the model returns an array', () => {
    const raw = JSON.stringify({ ...SAMPLE_VALID, ayudantes: ['Dr. Martínez', 'Dra. Gómez'] })
    const result = parseAIResponse(raw)
    expect(result.fields.ayudantes).toBe('DR. MARTÍNEZ, DRA. GÓMEZ')
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
    expect(result.fields.instrumentador).toBe('ENF. RODRÍGUEZ')
    expect(result.fields.sanatorio).toBe('SANATORIO SAN LUCAS')
  })

  it('returns null for missing fields, not invented values', () => {
    const partial = { paciente: 'Test', procedimiento: null }
    const result = parseAIResponse(JSON.stringify(partial))
    expect(result.fields.diagnostico).toBeNull()
    expect(result.fields.paciente).toBe('TEST')
  })

  it('strips digits (IDs/documents) from the patient name', () => {
    const result = parseAIResponse(JSON.stringify({ paciente: '311512 PEREZ GARCIA, JUAN' }))
    expect(result.fields.paciente).toBe('PEREZ GARCIA, JUAN')
  })

  it('normalizes medical titles in names', () => {
    const result = parseAIResponse(JSON.stringify({ cirujano: 'DRA MARIA GOMEZ', anestesiologo: 'DR PEREZ' }))
    expect(result.fields.cirujano).toBe('DRA. MARIA GOMEZ')
    expect(result.fields.anestesiologo).toBe('DR. PEREZ')
  })

  it('removes noise tokens like NO APLICA from ayudantes', () => {
    const result = parseAIResponse(JSON.stringify({
      ayudantes: 'DR. PEREZ, JUAN, PEDRO, NO APLICA',
    }))
    expect(result.fields.ayudantes).toBe('DR. PEREZ, JUAN, PEDRO')
  })

  it('removes leading comma from a name', () => {
    const result = parseAIResponse(JSON.stringify({ paciente: ', JUAN CARLOS PEREZ' }))
    expect(result.fields.paciente).toBe('JUAN CARLOS PEREZ')
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
