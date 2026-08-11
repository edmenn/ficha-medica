import { describe, it, expect } from 'vitest'
import {
  normalizeDateString,
  dateToISO,
  isoToDate,
  parseDateToTimestamp,
  validateDateField,
  validateDateRange,
  compareDateStringsDesc,
  isDateInRange,
  isValidCalendarDate,
} from './dates'

describe('normalizeDateString', () => {
  it('normalizes dd-mm-yyyy', () => {
    expect(normalizeDateString('18-08-2026')).toBe('18-08-2026')
  })

  it('normalizes d/m/yy', () => {
    expect(normalizeDateString('18/8/26')).toBe('18-08-2026')
  })

  it('normalizes ISO yyyy-mm-dd', () => {
    expect(normalizeDateString('2026-08-18')).toBe('18-08-2026')
  })

  it('accepts single-digit day and month', () => {
    expect(normalizeDateString('5-3-2026')).toBe('05-03-2026')
  })

  it('returns null for empty input', () => {
    expect(normalizeDateString('')).toBeNull()
    expect(normalizeDateString(null)).toBeNull()
  })

  it('returns null for invalid months/days', () => {
    expect(normalizeDateString('31-02-2026')).toBeNull()
    expect(normalizeDateString('00-05-2026')).toBeNull()
    expect(normalizeDateString('15-00-2026')).toBeNull()
    expect(normalizeDateString('15-13-2026')).toBeNull()
  })

  it('rejects 29-02 in non-leap years and accepts in leap years', () => {
    expect(normalizeDateString('29-02-2026')).toBeNull()
    expect(normalizeDateString('29-02-2024')).toBe('29-02-2024')
  })
})

describe('isValidCalendarDate', () => {
  it('rejects impossible dates', () => {
    expect(isValidCalendarDate(31, 2, 2026)).toBe(false)
    expect(isValidCalendarDate(29, 2, 2026)).toBe(false)
    expect(isValidCalendarDate(29, 2, 2024)).toBe(true)
    expect(isValidCalendarDate(0, 1, 2026)).toBe(false)
    expect(isValidCalendarDate(1, 13, 2026)).toBe(false)
    expect(isValidCalendarDate(31, 4, 2026)).toBe(false)
  })
})

describe('dateToISO / isoToDate', () => {
  it('converts canonical to ISO and back', () => {
    expect(dateToISO('18-08-2026')).toBe('2026-08-18')
    expect(isoToDate('2026-08-18')).toBe('18-08-2026')
  })

  it('returns null for invalid inputs', () => {
    expect(dateToISO('31-02-2026')).toBeNull()
    expect(isoToDate('2026-02-31')).toBeNull()
  })
})

describe('validateDateField', () => {
  it('returns null for valid date', () => {
    expect(validateDateField('18-08-2026')).toBeNull()
  })

  it('returns null for empty', () => {
    expect(validateDateField('')).toBeNull()
    expect(validateDateField(null)).toBeNull()
  })

  it('errors on invalid real date', () => {
    expect(validateDateField('31-02-2026')).toBeTruthy()
    expect(validateDateField('29-02-2026')).toBeTruthy()
    expect(validateDateField('not-a-date')).toBeTruthy()
  })
})

describe('validateDateRange', () => {
  it('returns null when from <= to', () => {
    expect(validateDateRange('2026-01-10', '2026-01-20')).toBeNull()
  })

  it('errors when from > to', () => {
    expect(validateDateRange('2026-01-20', '2026-01-10')).toBeTruthy()
  })

  it('returns null when either is missing', () => {
    expect(validateDateRange(null, '2026-01-10')).toBeNull()
    expect(validateDateRange('2026-01-10', null)).toBeNull()
  })
})

describe('parseDateToTimestamp', () => {
  it('parses canonical dates', () => {
    const ts = parseDateToTimestamp('18-08-2026')
    expect(ts).toBe(Date.UTC(2026, 7, 18))
  })

  it('returns null for invalid dates', () => {
    expect(parseDateToTimestamp('31-02-2026')).toBeNull()
    expect(parseDateToTimestamp(null)).toBeNull()
  })
})

describe('compareDateStringsDesc', () => {
  it('sorts descending by date', () => {
    expect(compareDateStringsDesc('10-08-2026', '16-07-2026')).toBeLessThan(0)
    expect(compareDateStringsDesc('16-07-2026', '10-08-2026')).toBeGreaterThan(0)
  })

  it('handles null dates', () => {
    expect(compareDateStringsDesc(null, '10-08-2026')).toBe(1)
    expect(compareDateStringsDesc('10-08-2026', null)).toBe(-1)
  })
})

describe('isDateInRange', () => {
  it('respects from and to boundaries', () => {
    expect(isDateInRange('15-08-2026', '10-08-2026', '20-08-2026')).toBe(true)
    expect(isDateInRange('05-08-2026', '10-08-2026', '20-08-2026')).toBe(false)
    expect(isDateInRange('25-08-2026', '10-08-2026', '20-08-2026')).toBe(false)
  })

  it('returns false when value missing', () => {
    expect(isDateInRange(null, '10-08-2026', '20-08-2026')).toBe(false)
  })
})
