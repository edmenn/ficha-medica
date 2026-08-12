import { describe, it, expect } from 'vitest'
import { normalizeSurgicalFields, validateSurgicalFields } from './record-utils'

describe('normalizeSurgicalFields', () => {
  it('uppercases text fields', () => {
    const fields = normalizeSurgicalFields({
      paciente: '  garcía, juan carlos ',
      diagnostico: 'apendicitis aguda',
      procedimiento: 'apendicectomía laparoscópica',
      cirujano: 'dr. pérez',
      ayudantes: 'dr. martínez, dra. gómez',
      anestesiologo: 'dra. lópez',
      instrumentador: 'enf. rodríguez',
      sanatorio: 'sanatorio san lucas',
      observaciones: 'nota clínica',
    })
    expect(fields.paciente).toBe('GARCÍA, JUAN CARLOS')
    expect(fields.diagnostico).toBe('APENDICITIS AGUDA')
    expect(fields.procedimiento).toBe('APENDICECTOMÍA LAPAROSCÓPICA')
    expect(fields.cirujano).toBe('DR. PÉREZ')
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
  it('rejects a patient name containing digits', () => {
    const errors = validateSurgicalFields(normalizeSurgicalFields({ paciente: '311512 AVEIRO' }))
    expect(errors).toContain('El nombre del paciente no puede contener números')
  })

  it('accepts a patient name without digits', () => {
    const errors = validateSurgicalFields(normalizeSurgicalFields({ paciente: 'GARCÍA, JUAN CARLOS' }))
    expect(errors).not.toContain('El nombre del paciente no puede contener números')
  })
})
