import { describe, it, expect } from 'vitest'
import { duplicateScore, findDuplicate, DUPLICATE_THRESHOLD } from './record-duplicates'
import type { SurgicalFields } from '@/types'

function candidate(id: string, overrides: Partial<SurgicalFields> = {}) {
  return {
    id,
    final_data: {
      paciente: 'GARCÍA, JUAN CARLOS',
      fecha_cirugia: '12-04-2025',
      diagnostico: null,
      procedimiento: 'APENDICECTOMÍA',
      cirujano: null,
      ayudantes: null,
      anestesiologo: null,
      instrumentador: null,
      sanatorio: 'SANATORIO CENTRAL',
      observaciones: null,
      ...overrides,
    } as SurgicalFields,
  }
}

describe('duplicateScore', () => {
  it('scores 0.9 for a fully matching record (base signals)', () => {
    const score = duplicateScore(candidate('x').final_data, candidate('x'))
    expect(score).toBe(0.9)
  })

  it('scores high when paciente+fecha match (base rule)', () => {
    const score = duplicateScore(
      { paciente: 'GARCÍA, JUAN CARLOS', fecha_cirugia: '12-04-2025', procedimiento: null, sanatorio: null },
      candidate('x')
    )
    // 0.35 (paciente) + 0.30 (fecha) = 0.65
    expect(score).toBe(0.65)
  })

  it('adds partial score for token overlap in paciente', () => {
    const score = duplicateScore(
      { paciente: 'GARCÍA, JUAN CARLOS PÉREZ', fecha_cirugia: '12-04-2025' },
      candidate('x')
    )
    // paciente no exacto: 0.2*overlap(0.75)=0.15 + fecha 0.30 = 0.45
    expect(score).toBe(0.45)
  })

  it('scores below threshold when paciente matches but date differs', () => {
    const score = duplicateScore(
      { paciente: 'GARCÍA, JUAN CARLOS', fecha_cirugia: '12-04-2026' },
      candidate('x')
    )
    // 0.35 (paciente) + 0 (fecha distinta) = 0.35
    expect(score).toBeLessThan(DUPLICATE_THRESHOLD)
  })
})

describe('findDuplicate', () => {
  it('returns null without paciente+fecha', () => {
    expect(findDuplicate([candidate('x')], { paciente: null, fecha_cirugia: null })).toBeNull()
  })

  it('finds a duplicate above threshold and returns score', () => {
    const result = findDuplicate(
      [candidate('x')],
      { paciente: 'GARCÍA, JUAN CARLOS', fecha_cirugia: '12-04-2025', procedimiento: 'APENDICECTOMÍA' }
    )
    expect(result).not.toBeNull()
    expect(result!.existing_id).toBe('x')
    expect(result!.score).toBeGreaterThanOrEqual(DUPLICATE_THRESHOLD)
  })

  it('returns null below threshold (different date)', () => {
    const result = findDuplicate(
      [candidate('x')],
      { paciente: 'GARCÍA, JUAN CARLOS', fecha_cirugia: '12-04-2026' }
    )
    expect(result).toBeNull()
  })

  it('respects excludeRecordId', () => {
    const result = findDuplicate(
      [candidate('x')],
      { paciente: 'GARCÍA, JUAN CARLOS', fecha_cirugia: '12-04-2025' },
      'x'
    )
    expect(result).toBeNull()
  })
})
