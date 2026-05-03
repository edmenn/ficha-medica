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

vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn(),
}))

vi.mock('@/lib/ai-parser', () => ({
  parseAIResponse: vi.fn(),
}))

vi.mock('@/lib/openrouter', () => ({
  buildExtractionPrompt: vi.fn(),
  createOpenRouterClient: vi.fn(),
  MODELS_WITH_JSON_MODE: new Set(),
}))

function makeAnalyzeRequest(file: { type: string; size: number }) {
  return {
    formData: vi.fn().mockResolvedValue({
      get: (key: string) => {
        if (key === 'image') return file
        return null
      },
    }),
  } as unknown as NextRequest
}

describe('POST /api/analyze', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    requireOperationalContextMock.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const { POST } = await import('./route')
    const response = await POST(makeAnalyzeRequest({ type: 'image/jpeg', size: 1 }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('returns 400 for disallowed MIME type', async () => {
    requireOperationalContextMock.mockResolvedValue({ profile: { id: 'u1', role: 'user' }, effectiveUserId: 'u1' })
    createServiceClientMock.mockResolvedValue({})

    const { POST } = await import('./route')
    const response = await POST(makeAnalyzeRequest({ type: 'application/pdf', size: 1 }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Formato no soportado. Usá JPG, PNG, WebP o HEIC.',
    })
  })

  it('returns 400 for file over 10MB', async () => {
    requireOperationalContextMock.mockResolvedValue({ profile: { id: 'u1', role: 'user' }, effectiveUserId: 'u1' })
    createServiceClientMock.mockResolvedValue({})

    const { POST } = await import('./route')
    const response = await POST(makeAnalyzeRequest({ type: 'image/jpeg', size: (10 * 1024 * 1024) + 1 }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Imagen demasiado grande (máximo 10MB)',
    })
  })
})
