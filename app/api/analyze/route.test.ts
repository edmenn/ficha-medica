import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireOperationalUserMock = vi.fn()
const createClientMock = vi.fn()
const createServiceClientMock = vi.fn()

vi.mock('@/lib/auth', () => ({
  requireOperationalUser: requireOperationalUserMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
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
    requireOperationalUserMock.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const { POST } = await import('./route')
    const response = await POST(makeAnalyzeRequest({ type: 'image/jpeg', size: 1 }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('returns 400 for disallowed MIME type', async () => {
    requireOperationalUserMock.mockResolvedValue({ profile: { id: 'u1', role: 'user' } })
    createClientMock.mockResolvedValue({})
    createServiceClientMock.mockResolvedValue({})

    const { POST } = await import('./route')
    const response = await POST(makeAnalyzeRequest({ type: 'application/pdf', size: 1 }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Formato no soportado. Usá JPG, PNG, WebP o HEIC.',
    })
  })

  it('returns 400 for file over 10MB', async () => {
    requireOperationalUserMock.mockResolvedValue({ profile: { id: 'u1', role: 'user' } })
    createClientMock.mockResolvedValue({})
    createServiceClientMock.mockResolvedValue({})

    const { POST } = await import('./route')
    const response = await POST(makeAnalyzeRequest({ type: 'image/jpeg', size: (10 * 1024 * 1024) + 1 }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Imagen demasiado grande (máximo 10MB)',
    })
  })
})
