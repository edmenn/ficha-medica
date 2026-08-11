import { describe, it, expect } from 'vitest'
import { isValidImagePath, filterValidImagePaths } from './storage-paths'

const USER = '11111111-1111-1111-1111-111111111111'

describe('isValidImagePath', () => {
  it('accepts a valid user-prefixed path', () => {
    expect(isValidImagePath(`${USER}/abc-123.jpg`, USER)).toBe(true)
  })

  it('accepts multi-segment paths within the user prefix', () => {
    expect(isValidImagePath(`${USER}/sub/abc.jpg`, USER)).toBe(true)
  })

  it('rejects paths not belonging to the user', () => {
    const other = '99999999-9999-9999-9999-999999999999'
    expect(isValidImagePath(`${other}/abc.jpg`, USER)).toBe(false)
  })

  it('rejects empty/null', () => {
    expect(isValidImagePath(null, USER)).toBe(false)
    expect(isValidImagePath('', USER)).toBe(false)
    expect(isValidImagePath(undefined, USER)).toBe(false)
  })

  it('rejects traversal', () => {
    expect(isValidImagePath(`${USER}/../other.jpg`, USER)).toBe(false)
    expect(isValidImagePath(`../${USER}/x.jpg`, USER)).toBe(false)
  })

  it('rejects absolute paths', () => {
    expect(isValidImagePath(`/${USER}/abc.jpg`, USER)).toBe(false)
    expect(isValidImagePath('http://evil.com/x', USER)).toBe(false)
  })

  it('rejects backslashes and weird segments', () => {
    expect(isValidImagePath(`${USER}/a\\b.jpg`, USER)).toBe(false)
    expect(isValidImagePath(`${USER}/a%20b.jpg`, USER)).toBe(false)
  })

  it('rejects empty remaining path', () => {
    expect(isValidImagePath(`${USER}/`, USER)).toBe(false)
  })
})

describe('filterValidImagePaths', () => {
  it('keeps only valid paths for the user', () => {
    const other = '99999999-9999-9999-9999-999999999999'
    const result = filterValidImagePaths([`${USER}/a.jpg`, `${other}/b.jpg`, '../x', null], USER)
    expect(result).toEqual([`${USER}/a.jpg`])
  })
})
