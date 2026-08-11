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

function buildClient({
  deleteReturnsRecord = false,
}: {
  deleteReturnsRecord?: boolean
} = {}) {
  const auditInsertMock = vi.fn().mockResolvedValue({ error: null })

  // selectRecordImagePaths: select().eq().eq().single()
  const singleSelectMock = vi.fn().mockResolvedValue({
    data: { image_path: 'u1/example.jpg', image_paths: ['u1/example.jpg'] },
    error: null,
  })
  const eqUserSelectMock = vi.fn().mockReturnValue({ single: singleSelectMock })
  const eqIdSelectMock = vi.fn().mockReturnValue({ eq: eqUserSelectMock })

  // final_data lookup: select().eq().eq().maybeSingle()
  const maybeSingleMetaMock = vi.fn().mockResolvedValue({
    data: { final_data: { paciente: 'PACIENTE' } },
    error: null,
  })
  const eqUserMetaMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMetaMock })
  const eqIdMetaMock = vi.fn().mockReturnValue({ eq: eqUserMetaMock })

  // delete: delete().eq().eq().select().maybeSingle()
  const maybeSingleDeleteMock = vi.fn().mockResolvedValue({
    data: deleteReturnsRecord ? { id: 'record-1' } : null,
    error: null,
  })
  const selectDeleteMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleDeleteMock })
  const eqUserDeleteMock = vi.fn().mockReturnValue({ select: selectDeleteMock })
  const eqIdDeleteMock = vi.fn().mockReturnValue({ eq: eqUserDeleteMock })

  const removeMock = vi.fn().mockResolvedValue({})
  const storageFromMock = vi.fn().mockReturnValue({ remove: removeMock })

  // select() dispatch: image_paths query -> single; final_data lookup -> maybeSingle
  const selectDispatchMock = vi.fn((columns: string) => {
    if (columns === 'final_data') {
      return { eq: eqIdMetaMock }
    }
    return { eq: eqIdSelectMock }
  })

  const fromMock = vi.fn((table: string) => {
    if (table === 'audit_log') {
      return { insert: auditInsertMock }
    }
    if (table === 'surgical_records') {
      return {
        select: selectDispatchMock,
        delete: vi.fn().mockReturnValue({ eq: eqIdDeleteMock }),
      }
    }
    throw new Error(`unexpected table ${table}`)
  })

  const client = {
    from: fromMock,
    storage: { from: storageFromMock },
  }
  createServiceClientMock.mockResolvedValue(client)

  return { client, auditInsertMock, removeMock }
}

describe('deleteRecordAction', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('throws when no record was deleted and does not remove images', async () => {
    requireOperationalContextMock.mockResolvedValue({
      profile: { id: 'u1', role: 'user' },
      effectiveUserId: 'u1',
    })

    const { removeMock } = buildClient({ deleteReturnsRecord: false })

    const { deleteRecordAction } = await import('./actions')

    await expect(deleteRecordAction('record-1')).rejects.toThrow('No se encontró el registro a borrar')
    expect(removeMock).not.toHaveBeenCalled()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('deletes record, logs audit before deletion, and removes owned images', async () => {
    requireOperationalContextMock.mockResolvedValue({
      profile: { id: 'u1', role: 'user' },
      effectiveUserId: 'u1',
    })

    const { auditInsertMock, removeMock } = buildClient({ deleteReturnsRecord: true })

    const { deleteRecordAction } = await import('./actions')

    await expect(deleteRecordAction('record-1')).resolves.toBeUndefined()
    expect(auditInsertMock).toHaveBeenCalledTimes(1)
    const auditPayload = auditInsertMock.mock.calls[0][0]
    expect(auditPayload.action).toBe('deleted')
    expect(auditPayload.record_id).toBe('record-1')
    expect(auditPayload.effective_user_id).toBeNull()
    expect(removeMock).toHaveBeenCalledWith(['u1/example.jpg'])
    expect(revalidatePathMock).toHaveBeenCalled()
  })
})
