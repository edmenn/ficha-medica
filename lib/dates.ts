// Centralized date parsing, validation and formatting.
// Single source of truth for surgical date handling across the app.

const DATE_RE = /^(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4})$/
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function isValidCalendarDate(day: number, month: number, year: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false
  if (year < 1 || year > 9999) return false
  if (month < 1 || month > 12) return false
  if (day < 1) return false

  const daysInMonth = [
    31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30,
    31, 31, 30, 31, 30, 31,
  ]
  return day <= daysInMonth[month - 1]
}

// Convert a user-supplied date string (dd-mm-yyyy, d/m/yy, iso, etc.) into a
// canonical `dd-mm-yyyy` string, or null if it cannot be parsed as a real date.
export function normalizeDateString(value: string | null | undefined): string | null {
  if (!value) return null
  const cleaned = value
    .trim()
    .replace(/\s+/g, '')
    .replace(/[.,]/g, match => (match === '.' ? '-' : match))
    .replace(/[–—]/g, '-')
    .replace(/\//g, '-')

  let match = cleaned.match(ISO_RE)

  if (match) {
    return normalizeDateString(`${match[3]}-${match[2]}-${match[1]}`)
  }

  match = cleaned.match(DATE_RE)
  let day: number
  let month: number
  let year: number

  if (!match) {
    return null
  } else {
    day = Number(match[1])
    month = Number(match[2])
    let y = Number(match[3])

    // ISO-like `yyyy-mm-dd` inside the general regex
    if (match[1].length === 4) {
      year = day
      month = Number(match[2])
      day = Number(match[3])
      y = year
    }

    if (match[3].length <= 2) {
      y += 2000
    }
    year = y
  }

  if (!isValidCalendarDate(day, month, year)) return null

  return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${String(year).padStart(4, '0')}`
}

// Convert a canonical `dd-mm-yyyy` to ISO `yyyy-mm-dd`, or null.
export function dateToISO(value: string | null | undefined): string | null {
  const normalized = normalizeDateString(value)
  if (!normalized) return null
  const [day, month, year] = normalized.split('-')
  return `${year}-${month}-${day}`
}

// Convert an ISO `yyyy-mm-dd` to canonical `dd-mm-yyyy`, or null.
export function isoToDate(value: string | null | undefined): string | null {
  if (!value) return null
  const match = value.trim().match(ISO_RE)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!isValidCalendarDate(day, month, year)) return null
  return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${String(year).padStart(4, '0')}`
}

export function parseDateToTimestamp(value: string | null | undefined): number | null {
  const normalized = normalizeDateString(value)
  if (!normalized) return null
  const [day, month, year] = normalized.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

// Validate a surgical date field. Returns an error string or null.
export function validateDateField(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null
  const normalized = normalizeDateString(value)
  if (!normalized) {
    return 'La fecha debe ser una fecha real en formato dd-mm-aaaa'
  }
  return null
}

// Validate that `from` is not after `to`. Both are ISO `yyyy-mm-dd`.
export function validateDateRange(from: string | null | undefined, to: string | null | undefined): string | null {
  if (!from && !to) return null
  const fromTs = parseDateToTimestamp(from)
  const toTs = parseDateToTimestamp(to)
  if (fromTs !== null && toTs !== null && fromTs > toTs) {
    return 'La fecha "Desde" no puede ser posterior a "Hasta"'
  }
  return null
}

export function compareDateStringsDesc(left: string | null | undefined, right: string | null | undefined) {
  const leftTs = parseDateToTimestamp(left)
  const rightTs = parseDateToTimestamp(right)
  if (leftTs === null && rightTs === null) return 0
  if (leftTs === null) return 1
  if (rightTs === null) return -1
  return rightTs - leftTs
}

export function isDateInRange(
  value: string | null | undefined,
  from: string | null | undefined,
  to: string | null | undefined
) {
  const valueTs = parseDateToTimestamp(value)
  if (valueTs === null) return false
  const fromTs = parseDateToTimestamp(from)
  if (fromTs !== null && valueTs < fromTs) return false
  const toTs = parseDateToTimestamp(to)
  if (toTs !== null && valueTs > toTs) return false
  return true
}
