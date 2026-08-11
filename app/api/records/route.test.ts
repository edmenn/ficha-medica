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
    const countSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ count: 0, error: null }) })
    const rangeMock = vi.fn().mockResolvedValue({ data: [], error: null })
    const orderCreatedMock = vi.fn().mockReturnValue({ range: rangeMock })
    const orderDateMock = vi.fn().mockReturnValue({ order: orderCreatedMock })
    const eqDataMock = vi.fn().mockReturnValue({ order: orderDateMock })
    const dataSelect = vi.fn().mockReturnValue({ eq: eqDataMock })

    requireOperationalContextMock.mockResolvedValue({ profile: { id: 'u1', role: 'user' }, effectiveUserId: 'u1' })
    createServiceClientMock.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn((cols: unknown, opts?: unknown) => {
          if (opts && typeof opts === 'object' && 'head' in opts) return countSelect(cols, opts)
          return dataSelect(cols)
        }),
      })),
    })

    const { GET } = await import('./route')
    const response = await GET(new NextRequest('http://localhost/api/records?page=abc'))

    expect(dataSelect).toHaveBeenCalledWith('*')
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

  it('never persists client-supplied image_path/image_paths (always manual-entry)', async () => {
    requireOperationalContextMock.mockResolvedValue({ profile: { id: 'u1', role: 'user' }, effectiveUserId: 'u1' })

    const insertPayload: Record<string, unknown> = {}
    const singleMock = vi.fn().mockResolvedValue({
      data: { id: 'new-id', user_id: 'u1', image_path: 'manual-entry', image_paths: ['manual-entry'] },
      error: null,
    })
    const selectMock = vi.fn().mockReturnValue({ single: singleMock })
    const insertMock = vi.fn().mockReturnValue({ select: selectMock })
    const auditInsertMock = vi.fn().mockResolvedValue({ error: null })

    createServiceClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'surgical_records') {
          return { insert: vi.fn(payload => {
            insertPayload.payload = payload
            return { select: selectMock }
          }) }
        }
        if (table === 'audit_log') return { insert: auditInsertMock }
        throw new Error(`unexpected ${table}`)
      }),
    })

    const { POST } = await import('./route')
    const response = await POST(new NextRequest('http://localhost/api/records', {
      method: 'POST',
      body: JSON.stringify({
        final_data: { paciente: 'X', fecha_cirugia: '10-08-2026' },
        image_path: 'otro-usuario/secreto.jpg',
        image_paths: ['otro-usuario/secreto.jpg'],
      }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(response.status).toBe(201)
    const payload = (insertPayload as { payload?: Record<string, unknown> }).payload ?? {}
    expect(payload.image_path).toBe('manual-entry')
    expect(payload.image_paths).toEqual(['manual-entry'])
    expect(insertMock).not.toBeCalledWith(expect.objectContaining({ image_path: 'otro-usuario/secreto.jpg' }))
  })
})
