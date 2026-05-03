import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentUserProfileMock = vi.fn()
const createServiceClientMock = vi.fn()

vi.mock('@/lib/auth', () => ({
  getCurrentUserProfile: getCurrentUserProfileMock,
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
    getCurrentUserProfileMock.mockResolvedValue(null)

    const { GET } = await import('./route')
    const response = await GET()

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('returns 403 for non-admin', async () => {
    getCurrentUserProfileMock.mockResolvedValue({ id: 'u1', role: 'user' })

    const { GET } = await import('./route')
    const response = await GET()

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' })
  })

  it('returns user list for admin', async () => {
    const users = [{ id: 'u1', email: 'test@example.com', role: 'user', created_at: '2026-05-03T00:00:00Z' }]
    const orderMock = vi.fn().mockResolvedValue({ data: users, error: null })
    const selectMock = vi.fn(() => ({ order: orderMock }))

    getCurrentUserProfileMock.mockResolvedValue({ id: 'admin1', role: 'admin' })
    createServiceClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select: selectMock })),
    })

    const { GET } = await import('./route')
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ users })
  })
})
