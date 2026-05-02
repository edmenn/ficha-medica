import { describe, it, expectTypeOf } from 'vitest'
import type { SurgicalRecord, UserProfile, RecordStatus } from './index'

describe('types', () => {
  it('SurgicalRecord has required fields', () => {
    expectTypeOf<SurgicalRecord>().toHaveProperty('id')
    expectTypeOf<SurgicalRecord>().toHaveProperty('extracted_data')
    expectTypeOf<SurgicalRecord>().toHaveProperty('final_data')
    expectTypeOf<SurgicalRecord>().toHaveProperty('status')
  })

  it('RecordStatus is a union', () => {
    const s: RecordStatus = 'final'
    expectTypeOf(s).toEqualTypeOf<RecordStatus>()
  })

  it('UserProfile has role', () => {
    expectTypeOf<UserProfile>().toHaveProperty('role')
  })
})
