import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const requireOperationalContextMock = vi.fn()
const createServiceClientMock = vi.fn()

vi.mock('@/lib/auth/guards', () => ({
  requireOperationalContext: requireOperationalContextMock,
}))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: createServiceClientMock,
}))

describe('POST /api/sanatoriums', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    requireOperationalContextMock.mockResolvedValue({ profile: { id: 'u1', role: 'user' }, effectiveUserId: 'u1' })
  })

  it('rejects empty names', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/sanatoriums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '   ' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('normalizes to uppercase and inserts', async () => {
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 's1', name: 'SANATORIO CENTRAL' }, error: null }) }),
    })
    createServiceClientMock.mockResolvedValue({
      from: vi.fn(() => ({ insert: insertMock })),
    })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/sanatoriums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: ' sanatorio central ' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'SANATORIO CENTRAL', user_id: 'u1' }))
  })

  it('returns 409 on duplicate name', async () => {
    createServiceClientMock.mockResolvedValue({
      from: vi.fn(() => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate' } }) }),
        }),
      })),
    })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/sanatoriums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'SANATORIO CENTRAL' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
  })
})
