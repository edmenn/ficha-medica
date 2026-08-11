import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

describe('service worker security', () => {
  const swPath = path.join(process.cwd(), 'public', 'sw.js')
  const source = readFileSync(swPath, 'utf8')

  it('does not store clinical images in IndexedDB', () => {
    expect(source).not.toContain('indexedDB')
    expect(source).not.toContain('pending-uploads')
    expect(source).not.toContain('openDb')
    expect(source).not.toContain('flushPendingUploads')
  })

  it('does not use Background Sync', () => {
    expect(source).not.toContain("addEventListener('sync'")
    expect(source).not.toContain('upload-pending')
  })

  it('never caches API responses', () => {
    expect(source).toContain("startsWith('/api/')")
    expect(source).not.toContain("caches.match('/api/")
  })

  it('does not pre-cache dynamic authenticated routes', () => {
    expect(source).not.toContain("'/records'")
    expect(source).not.toContain("'/search'")
    expect(source).not.toContain("'/reports'")
    expect(source).not.toContain("'/new'")
  })
})
