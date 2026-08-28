import { describe, expect, it } from 'vitest'
import { formatUsd } from './formatters'

describe('formatUsd', () => {
  it('uses Paraguayan separators and four decimal places', () => {
    expect(formatUsd(59419 / 10000)).toBe('US$ 5,9419')
    expect(formatUsd(32 / 10000)).toBe('US$ 0,0032')
    expect(formatUsd(1234567.89)).toBe('US$ 1.234.567,8900')
  })
})
