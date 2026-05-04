import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireOperationalContextMock = vi.fn()
const createServiceClientMock = vi.fn()

vi.mock('@/lib/auth/guards', () => ({
  requireOperationalContext: requireOperationalContextMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: createServiceClientMock,
}))

function makeRequest(body: Record<string, unknown>) {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest
}

describe('POST /api/records/duplicates', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns an existing record when patient, date and procedure match another record', async () => {
    requireOperationalContextMock.mockResolvedValue({
      profile: { id: 'u1', role: 'user' },
      effectiveUserId: 'u1',
    })

    const eqDateMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'existing-1',
          final_data: {
            paciente: 'Juan Perez',
            fecha_cirugia: '04-05-2026',
            procedimiento: 'Artroscopia',
          },
        },
      ],
      error: null,
    })
    const eqPatientMock = vi.fn().mockReturnValue({ eq: eqDateMock })
    const eqUserMock = vi.fn().mockReturnValue({ eq: eqPatientMock })
    const selectMock = vi.fn().mockReturnValue({ eq: eqUserMock })

    createServiceClientMock.mockResolvedValue({
      from: vi.fn().mockReturnValue({ select: selectMock }),
    })

    const { POST } = await import('./route')
    const response = await POST(makeRequest({
      fields: {
        paciente: 'Juan Perez',
        fecha_cirugia: '04-05-2026',
        procedimiento: 'Artroscopia',
      },
      exclude_record_id: 'draft-1',
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ existing_id: 'existing-1' })
  })
})
