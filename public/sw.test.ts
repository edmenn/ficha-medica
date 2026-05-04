import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

describe('service worker shell cache', () => {
  it('does not pre-cache dynamic authenticated routes like /records', () => {
    const swPath = path.join(process.cwd(), 'public', 'sw.js')
    const source = readFileSync(swPath, 'utf8')

    expect(source).not.toContain("'/records'")
    expect(source).not.toContain("'/search'")
    expect(source).not.toContain("'/reports'")
    expect(source).not.toContain("'/new'")
  })
})
