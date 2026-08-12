import { describe, it, expect } from 'vitest'
import { normalizePersonName, normalizeSurgicalFields, validateSurgicalFields } from './record-utils'

describe('normalizePersonName', () => {
  it('trims and collapses spaces', () => {
    expect(normalizePersonName('  DR.  PEREZ GARCIA   JUAN CARLOS ')).toBe('DR. PEREZ GARCIA JUAN CARLOS')
  })

  it('removes digits (IDs/documents) from the name', () => {
    expect(normalizePersonName('311512 PEREZ GARCIA, JUAN')).toBe('PEREZ GARCIA, JUAN')
  })

  it('removes leading/trailing commas and punctuation', () => {
    expect(normalizePersonName(', JUAN CARLOS PEREZ')).toBe('JUAN CARLOS PEREZ')
    expect(normalizePersonName('JUAN CARLOS PEREZ,')).toBe('JUAN CARLOS PEREZ')
  })

  it('normalizes medical titles (DRA -> DRA., LIC -> LIC., ENF -> ENF.)', () => {
    expect(normalizePersonName('DRA MARIA GOMEZ')).toBe('DRA. MARIA GOMEZ')
    expect(normalizePersonName('DR GARCIA')).toBe('DR. GARCIA')
    expect(normalizePersonName('LIC RODRIGUEZ')).toBe('LIC. RODRIGUEZ')
    expect(normalizePersonName('ENF LOPEZ')).toBe('ENF. LOPEZ')
  })

  it('dedupes repeated titles (DR. DR. -> DR.)', () => {
    expect(normalizePersonName('DR. DR. PEREZ')).toBe('DR. PEREZ')
  })

  it('removes noise tokens like NO APLICA and SIN DATOS', () => {
    expect(normalizePersonName('DR. PEREZ, NO APLICA')).toBe('DR. PEREZ')
    expect(normalizePersonName('SIN DATOS')).toBeNull()
    expect(normalizePersonName('')).toBeNull()
    expect(normalizePersonName('NO APLICA')).toBeNull()
  })

  it('returns null when only punctuation remains', () => {
    expect(normalizePersonName(',,,')).toBeNull()
  })
})

describe('normalizeSurgicalFields', () => {
  it('uppercases text fields', () => {
    const fields = normalizeSurgicalFields({
      paciente: '  garcía, juan carlos ',
      diagnostico: 'apendicitis aguda',
      procedimiento: 'apendicectomía laparoscópica',
      cirujano: 'dr. garcia',
      ayudantes: 'dr. martínez, dra. gómez',
      anestesiologo: 'dra. lópez',
      instrumentador: 'enf. rodríguez',
      sanatorio: 'sanatorio san lucas',
      observaciones: 'nota clínica',
    })
    expect(fields.paciente).toBe('GARCÍA, JUAN CARLOS')
    expect(fields.diagnostico).toBe('APENDICITIS AGUDA')
    expect(fields.procedimiento).toBe('APENDICECTOMÍA LAPAROSCÓPICA')
    expect(fields.cirujano).toBe('DR. GARCIA')
    expect(fields.ayudantes).toBe('DR. MARTÍNEZ, DRA. GÓMEZ')
    expect(fields.anestesiologo).toBe('DRA. LÓPEZ')
    expect(fields.instrumentador).toBe('ENF. RODRÍGUEZ')
    expect(fields.sanatorio).toBe('SANATORIO SAN LUCAS')
    expect(fields.observaciones).toBe('NOTA CLÍNICA')
  })

  it('does not mangle the date field', () => {
    const fields = normalizeSurgicalFields({ fecha_cirugia: '12-04-2025' })
    expect(fields.fecha_cirugia).toBe('12-04-2025')
  })

  it('returns null for empty strings', () => {
    const fields = normalizeSurgicalFields({ paciente: '   ', observaciones: '' })
    expect(fields.paciente).toBeNull()
    expect(fields.observaciones).toBeNull()
  })
})

describe('validateSurgicalFields', () => {
  it('digits are removed by normalization, so a cleaned patient passes validation', () => {
    const fields = normalizeSurgicalFields({ paciente: '311512 PEREZ GARCIA, JUAN' })
    expect(fields.paciente).toBe('PEREZ GARCIA, JUAN')
    expect(validateSurgicalFields(fields)).not.toContain('El nombre del paciente no puede contener números')
  })

  it('accepts a patient name without digits', () => {
    const errors = validateSurgicalFields(normalizeSurgicalFields({ paciente: 'GARCÍA, JUAN CARLOS' }))
    expect(errors).not.toContain('El nombre del paciente no puede contener números')
  })
})
