import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireOperationalContextMock = vi.fn()
const createServiceClientMock = vi.fn()
const revalidatePathMock = vi.fn()

vi.mock('@/lib/auth/guards', () => ({
  requireOperationalContext: requireOperationalContextMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: createServiceClientMock,
}))

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}))

describe('deleteRecordAction', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('throws when no record was deleted', async () => {
    requireOperationalContextMock.mockResolvedValue({
      profile: { id: 'u1', role: 'user' },
      effectiveUserId: 'u1',
    })

    const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null })
    const selectDeleteMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
    const eqUserDeleteMock = vi.fn().mockReturnValue({ select: selectDeleteMock })
    const eqIdDeleteMock = vi.fn().mockReturnValue({ eq: eqUserDeleteMock })

    const singleSelectMock = vi.fn().mockResolvedValue({
      data: { image_path: 'u1/example.jpg', image_paths: ['u1/example.jpg'] },
      error: null,
    })
    const eqUserSelectMock = vi.fn().mockReturnValue({ single: singleSelectMock })
    const eqIdSelectMock = vi.fn().mockReturnValue({ eq: eqUserSelectMock })
    const selectImageMock = vi.fn().mockReturnValue({ eq: eqIdSelectMock })

    const removeMock = vi.fn()
    const storageFromMock = vi.fn().mockReturnValue({ remove: removeMock })

    const fromMock = vi.fn((table: string) => {
      if (table === 'surgical_records') {
        return {
          select: selectImageMock,
          delete: vi.fn().mockReturnValue({ eq: eqIdDeleteMock }),
        }
      }

      throw new Error(`unexpected table ${table}`)
    })

    createServiceClientMock.mockResolvedValue({
      from: fromMock,
      storage: { from: storageFromMock },
    })

    const { deleteRecordAction } = await import('./actions')

    await expect(deleteRecordAction('record-1')).rejects.toThrow('No se encontró el registro a borrar')
    expect(removeMock).not.toHaveBeenCalled()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})
