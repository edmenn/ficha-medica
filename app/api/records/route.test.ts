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

describe('GET /api/records', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    requireOperationalContextMock.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const { GET } = await import('./route')
    const response = await GET(new NextRequest('http://localhost/api/records'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('defaults to page 1 for non-numeric page param', async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: [], error: null })
    const selectMock = vi.fn(() => ({ eq: eqMock }))

    requireOperationalContextMock.mockResolvedValue({ profile: { id: 'u1', role: 'user' }, effectiveUserId: 'u1' })
    createServiceClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select: selectMock })),
    })

    const { GET } = await import('./route')
    const response = await GET(new NextRequest('http://localhost/api/records?page=abc'))

    expect(selectMock).toHaveBeenCalledWith('*')
    expect(eqMock).toHaveBeenCalledWith('user_id', 'u1')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ page: 1, pageSize: 20, total: 0, records: [] })
  })
})

describe('POST /api/records', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    requireOperationalContextMock.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const { POST } = await import('./route')
    const response = await POST(new NextRequest('http://localhost/api/records', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('returns 403 for admin user', async () => {
    requireOperationalContextMock.mockResolvedValue({ error: 'Admins no pueden operar registros directamente', status: 403 })

    const { POST } = await import('./route')
    const response = await POST(new NextRequest('http://localhost/api/records', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Admins no pueden operar registros directamente' })
  })

  it('returns 400 when no final_data provided', async () => {
    requireOperationalContextMock.mockResolvedValue({ profile: { id: 'u1', role: 'user' }, effectiveUserId: 'u1' })
    createServiceClientMock.mockResolvedValue({})

    const { POST } = await import('./route')
    const response = await POST(new NextRequest('http://localhost/api/records', {
      method: 'POST',
      body: JSON.stringify({ status: 'draft' }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'final_data or extracted_data is required' })
  })
})
