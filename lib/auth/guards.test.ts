import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentUserProfileMock = vi.fn()
const createServiceClientMock = vi.fn()
const getActiveImpersonationMock = vi.fn()

vi.mock('@/lib/auth', () => ({
  getCurrentUserProfile: getCurrentUserProfileMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: createServiceClientMock,
}))

vi.mock('@/lib/auth/impersonation', () => ({
  getActiveImpersonation: getActiveImpersonationMock,
}))

describe('guards reject inactive users', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('requireOperationalContext rejects an inactive user', async () => {
    getCurrentUserProfileMock.mockResolvedValue({ id: 'u1', email: 'x', role: 'user', is_active: false })

    const { requireOperationalContext } = await import('./guards')
    const result = await requireOperationalContext()
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.status).toBe(403)
  })

  it('requireOperationalContext allows an active user', async () => {
    getCurrentUserProfileMock.mockResolvedValue({ id: 'u1', email: 'x', role: 'user', is_active: true })

    const { requireOperationalContext } = await import('./guards')
    const result = await requireOperationalContext()
    expect('error' in result).toBe(false)
    if (!('error' in result)) expect(result.effectiveUserId).toBe('u1')
  })

  it('requireAdminApi rejects an inactive admin', async () => {
    getCurrentUserProfileMock.mockResolvedValue({ id: 'a1', email: 'a', role: 'admin', is_active: false })

    const { requireAdminApi } = await import('./guards')
    const result = await requireAdminApi()
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.status).toBe(403)
  })

  it('requireUserApi rejects an inactive user', async () => {
    getCurrentUserProfileMock.mockResolvedValue({ id: 'u1', email: 'x', role: 'user', is_active: false })

    const { requireUserApi } = await import('./guards')
    const result = await requireUserApi()
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.status).toBe(403)
  })

  it('requireOperationalContext rejects impersonation onto an inactive user', async () => {
    getCurrentUserProfileMock.mockResolvedValue({ id: 'a1', email: 'a', role: 'admin', is_active: true })
    getActiveImpersonationMock.mockResolvedValue({
      id: 's1',
      admin_id: 'a1',
      target_user_id: 't1',
      started_at: '2026-01-01',
    })

    const maybeSingleMock = vi.fn().mockResolvedValue({ data: { is_active: false }, error: null })
    const eqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
    createServiceClientMock.mockResolvedValue({ from: vi.fn(() => ({ select: selectMock })) })

    const { requireOperationalContext } = await import('./guards')
    const result = await requireOperationalContext()
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.status).toBe(403)
  })
})
