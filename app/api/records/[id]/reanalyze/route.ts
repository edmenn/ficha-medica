import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireOperationalContext } from '@/lib/auth/guards'
import { decrypt } from '@/lib/crypto'
import { parseAIResponse } from '@/lib/ai-parser'
import { buildExtractionPrompt, createOpenRouterClient, MODELS_WITH_JSON_MODE } from '@/lib/openrouter'
import { normalizeSurgicalFields } from '@/lib/record-utils'
import { createServiceClient } from '@/lib/supabase/server'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { isValidImagePath } from '@/lib/storage-paths'
import type { AnalyzeResponse } from '@/types'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const MAX_SIZE_BYTES = 10 * 1024 * 1024
const MAX_IMAGES_PER_RECORD = 10

function validateImageFile(imageFile: File | null) {
  if (!imageFile) return 'No image provided'
  if (!ALLOWED_MIME.has(imageFile.type)) {
    return 'Formato no soportado. Usá JPG, PNG, WebP o HEIC.'
  }
  if (imageFile.size > MAX_SIZE_BYTES) {
    return 'Imagen demasiado grande (máximo 10MB)'
  }
  return null
}

function tempImagePath(userId: string, mimeType: string) {
  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg').replace('heif', 'heic') ?? 'jpg'
  return `${userId}/${randomUUID()}-reanalyze.${ext}`
}

async function uploadTempImage(service: Awaited<ReturnType<typeof createServiceClient>>, userId: string, file: File) {
  const path = tempImagePath(userId, file.type)
  const buffer = await file.arrayBuffer()
  const { error } = await service.storage
    .from('surgical-images')
    .upload(path, buffer, { contentType: file.type })

  if (error) return null

  const { data } = await service.storage
    .from('surgical-images')
    .createSignedUrl(path, 300)

  if (!data?.signedUrl) {
    await service.storage.from('surgical-images').remove([path])
    return null
  }

  return { path, signedUrl: data.signedUrl }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const limiter = rateLimit(`reanalyze:${clientIp(req)}:${ctx.effectiveUserId}`, { limit: 20, windowMs: 60 * 1000 })
  if (!limiter.allowed) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intentá de nuevo en un momento.' }, { status: 429 })
  }

  const service = await createServiceClient()

  const { data: userSettings } = await service
    .from('users')
    .select('openrouter_key, preferred_model')
    .eq('id', ctx.effectiveUserId)
    .single()

  if (!userSettings?.openrouter_key) {
    return NextResponse.json({ error: 'Configure tu API key de OpenRouter en Configuración' }, { status: 422 })
  }

  let apiKey: string
  try {
    apiKey = decrypt(userSettings.openrouter_key)
  } catch {
    return NextResponse.json({ error: 'API key inválida, reconfigurala en Configuración' }, { status: 422 })
  }

  const { data: customTemplates } = await service
    .from('custom_field_templates')
    .select('field_name, field_type')
    .eq('user_id', ctx.effectiveUserId)
    .order('display_order')

  const formData = await req.formData()
  const imageFile = formData.get('image') as File | null
  const rotatedImageFile = formData.get('image_rotated') as File | null

  const imageError = validateImageFile(imageFile)
  if (imageError) return NextResponse.json({ error: imageError }, { status: 400 })

  const rotatedError = rotatedImageFile ? validateImageFile(rotatedImageFile) : null
  if (rotatedError) return NextResponse.json({ error: rotatedError }, { status: 400 })

  const { data: record, error: recordError } = await service
    .from('surgical_records')
    .select('id, image_path, image_paths')
    .eq('id', id)
    .eq('user_id', ctx.effectiveUserId)
    .single()

  if (recordError || !record) {
    return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
  }

  // Límite de páginas/imágenes por ficha.
  const existingCount = Array.isArray(record.image_paths) ? record.image_paths.length : 0
  if (existingCount + (rotatedImageFile ? 1 : 0) > MAX_IMAGES_PER_RECORD) {
    return NextResponse.json({ error: `Se superó el límite de ${MAX_IMAGES_PER_RECORD} imágenes por ficha` }, { status: 400 })
  }

  let primarySignedUrl: string | null = null
  let tempPrimary: Awaited<ReturnType<typeof uploadTempImage>> | null = null
  let tempRotated: Awaited<ReturnType<typeof uploadTempImage>> | null = null
  const tempPaths: string[] = []

  const cleanup = async () => {
    if (tempPaths.length > 0) {
      await service.storage.from('surgical-images').remove(tempPaths)
    }
  }

  try {
    if (imageFile) {
      tempPrimary = await uploadTempImage(service, ctx.effectiveUserId, imageFile)
      if (!tempPrimary) {
        return NextResponse.json({ error: 'No se pudo preparar la imagen para releer' }, { status: 500 })
      }
      tempPaths.push(tempPrimary.path)
      primarySignedUrl = tempPrimary.signedUrl
    } else if (record.image_path && record.image_path !== 'manual-entry' && isValidImagePath(record.image_path, ctx.effectiveUserId)) {
      const { data: signedData, error: signedError } = await service.storage
        .from('surgical-images')
        .createSignedUrl(record.image_path, 300)
      if (signedError || !signedData?.signedUrl) {
        return NextResponse.json({ error: 'No se pudo acceder a la imagen guardada' }, { status: 500 })
      }
      primarySignedUrl = signedData.signedUrl
    } else {
      return NextResponse.json({ error: 'Este registro no tiene imagen para releer' }, { status: 400 })
    }

    if (rotatedImageFile) {
      tempRotated = await uploadTempImage(service, ctx.effectiveUserId, rotatedImageFile)
      if (tempRotated) tempPaths.push(tempRotated.path)
    }

    const model = userSettings.preferred_model ?? 'anthropic/claude-3.5-sonnet'
    const client = createOpenRouterClient(apiKey)

    let rawResponse: string
    try {
      const completion = await client.chat.completions.create({
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: buildExtractionPrompt(customTemplates ?? []) },
            { type: 'image_url', image_url: { url: primarySignedUrl } },
            ...(tempRotated ? [{ type: 'image_url' as const, image_url: { url: tempRotated.signedUrl } }] : []),
          ],
        }],
        max_tokens: 1000,
        ...(MODELS_WITH_JSON_MODE.has(model) ? { response_format: { type: 'json_object' as const } } : {}),
      })
      rawResponse = completion.choices[0]?.message?.content ?? ''
    } catch (err: unknown) {
      console.error('[reanalyze] OpenRouter error:', err instanceof Error ? err.message : err)
      return NextResponse.json({ error: 'No se pudo releer la imagen con la IA. Intentá de nuevo.' }, { status: 502 })
    }

    const fields = normalizeSurgicalFields(parseAIResponse(rawResponse).fields)

    const { error: auditError } = await service.from('audit_log').insert({
      user_id: ctx.profile.id,
      effective_user_id: ctx.profile.id === ctx.effectiveUserId ? null : ctx.effectiveUserId,
      record_id: record.id,
      action: 'reanalyzed',
      diff: fields,
    })
    if (auditError) console.error('[audit_log insert]', auditError.message)

    return NextResponse.json({
      record_id: record.id,
      extracted_data: fields,
    } satisfies AnalyzeResponse)
  } finally {
    await cleanup()
  }
}
