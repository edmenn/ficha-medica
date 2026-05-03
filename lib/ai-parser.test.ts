import { describe, it, expect } from 'vitest'
import { parseAIResponse } from './ai-parser'

const SAMPLE_VALID = {
  paciente: 'García, Juan Carlos',
  fecha_cirugia: '2025-04-12',
  fecha_fin: '2025-04-12',
  hora_inicio: '08:30',
  hora_fin: '10:15',
  duracion: '5min',
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
      fecha_finalizacion: '21/04/26',
      hora_de_inicio: '14.12',
      hora_salida: '16;01',
      anestesista: 'Dra. López',
      instrumentadora: 'Enf. Rodríguez',
      hospital: 'Sanatorio San Lucas',
    })
    const result = parseAIResponse(raw)
    expect(result.fields.fecha_cirugia).toBe('2026-04-21')
    expect(result.fields.fecha_fin).toBe('2026-04-21')
    expect(result.fields.hora_inicio).toBe('14:12')
    expect(result.fields.hora_fin).toBe('16:01')
    expect(result.fields.instrumentador).toBe('Enf. Rodríguez')
    expect(result.fields.sanatorio).toBe('Sanatorio San Lucas')
    expect(result.fields.duracion).toBe('1h 49min')
  })

  it('returns null for missing fields, not invented values', () => {
    const partial = { paciente: 'Test', procedimiento: null }
    const result = parseAIResponse(JSON.stringify(partial))
    expect(result.fields.diagnostico).toBeNull()
    expect(result.fields.paciente).toBe('Test')
  })

  it('derives duration from normalized start and end times', () => {
    const raw = JSON.stringify(SAMPLE_VALID)
    const result = parseAIResponse(raw)
    expect(result.fields.duracion).toBe('1h 45min')
  })

  it('returns empty fields on unparseable response', () => {
    const result = parseAIResponse('I could not extract the data from this image.')
    expect(result.fields.paciente).toBeNull()
  })
})
