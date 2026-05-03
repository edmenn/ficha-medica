import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireAdminApiMock = vi.fn()
const createServiceClientMock = vi.fn()

vi.mock('@/lib/auth/guards', () => ({
  requireAdminApi: requireAdminApiMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: createServiceClientMock,
}))

describe('GET /api/users', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    requireAdminApiMock.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const { GET } = await import('./route')
    const response = await GET()

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('returns 403 for non-admin', async () => {
    requireAdminApiMock.mockResolvedValue({ error: 'Forbidden', status: 403 })

    const { GET } = await import('./route')
    const response = await GET()

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' })
  })

  it('returns user list for admin', async () => {
    const users = [{ id: 'u1', email: 'test@example.com', role: 'user', is_active: true, created_at: '2026-05-03T00:00:00Z' }]
    const orderMock = vi.fn().mockResolvedValue({ data: users, error: null })
    const selectMock = vi.fn(() => ({ order: orderMock }))

    requireAdminApiMock.mockResolvedValue({ profile: { id: 'admin1', role: 'admin' } })
    createServiceClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select: selectMock })),
    })

    const { GET } = await import('./route')
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ users: [{ ...users[0], record_count: 0 }] })
  })
})
