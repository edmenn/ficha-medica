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

describe('POST /api/custom-fields', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  function post(body: Record<string, unknown>) {
    return import('./route').then(({ POST }) =>
      POST(new NextRequest('http://localhost/api/custom-fields', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      }))
    )
  }

  it('rejects a name that collides with a standard field', async () => {
    requireOperationalContextMock.mockResolvedValue({ profile: { id: 'u1', role: 'user' }, effectiveUserId: 'u1' })
    createServiceClientMock.mockResolvedValue({})
    const res = await post({ field_name: 'Paciente' })
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining('estándar') })
  })

  it('rejects an invalid field type', async () => {
    requireOperationalContextMock.mockResolvedValue({ profile: { id: 'u1', role: 'user' }, effectiveUserId: 'u1' })
    createServiceClientMock.mockResolvedValue({})
    const res = await post({ field_name: 'miCampo', field_type: 'image' })
    expect(res.status).toBe(400)
  })

  it('rejects a duplicate name for the same user', async () => {
    requireOperationalContextMock.mockResolvedValue({ profile: { id: 'u1', role: 'user' }, effectiveUserId: 'u1' })
    const ilikeMock = vi.fn().mockResolvedValue({ data: [{ field_name: 'lote' }], error: null })
    const eqMock = vi.fn().mockReturnValue({ ilike: ilikeMock })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
    createServiceClientMock.mockResolvedValue({ from: vi.fn(() => ({ select: selectMock })) })

    const res = await post({ field_name: 'lote', field_type: 'text' })
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining('ese nombre') })
  })

  it('creates a valid custom field', async () => {
    requireOperationalContextMock.mockResolvedValue({ profile: { id: 'u1', role: 'user' }, effectiveUserId: 'u1' })

    const singleMock = vi.fn().mockResolvedValue({
      data: { id: 'c1', field_name: 'lote', field_type: 'text', is_required: false, display_order: 1 },
      error: null,
    })
    const insertSelectMock = vi.fn().mockReturnValue({ single: singleMock })
    const insertMock = vi.fn().mockReturnValue({ select: insertSelectMock })

    const countHead = vi.fn().mockResolvedValue({ count: 0, error: null })
    const countEq = vi.fn().mockReturnValue({ head: countHead })
    const countSelect = vi.fn().mockReturnValue({ eq: countEq })

    const ilikeMock = vi.fn().mockResolvedValue({ data: [], error: null })
    const eqMock = vi.fn().mockReturnValue({ ilike: ilikeMock })
    const dupSelect = vi.fn().mockReturnValue({ eq: eqMock })

    createServiceClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== 'custom_field_templates') throw new Error(`unexpected ${table}`)
        return {
          select: vi.fn((cols: unknown, opts?: unknown) => {
            if (opts && typeof opts === 'object' && 'head' in opts) return countSelect(cols, opts)
            return dupSelect(cols)
          }),
          insert: insertMock,
        }
      }),
    })

    const res = await post({ field_name: 'lote', field_type: 'text' })
    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toMatchObject({ field_name: 'lote' })
  })
})
