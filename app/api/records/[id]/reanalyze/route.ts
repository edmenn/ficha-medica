import { NextRequest, NextResponse } from 'next/server'
import { requireOperationalContext } from '@/lib/auth/guards'
import { decrypt } from '@/lib/crypto'
import { parseAIResponse } from '@/lib/ai-parser'
import { buildExtractionPrompt, createOpenRouterClient, MODELS_WITH_JSON_MODE } from '@/lib/openrouter'
import { extractUsageFromCompletion, insertAiUsage } from '@/lib/ai-usage'
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

// Pasa la imagen embebida en base64 en vez de una signed URL, para que funcione
// también en entornos locales (OpenRouter no puede leer URLs de localhost).
function fileToDataUrl(file: File): Promise<{ dataUrl: string; path: string }> {
  return file.arrayBuffer().then(buffer => {
    const base64 = Buffer.from(buffer).toString('base64')
    const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg').replace('heif', 'heic') ?? 'jpg'
    return { dataUrl: `data:${file.type};base64,${base64}`, path: `uploaded-${ext}` }
  })
}

async function storagePathToDataUrl(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  path: string
): Promise<string | null> {
  const { data, error } = await service.storage.from('surgical-images').download(path)
  if (error || !data) return null
  const mime = path.toLowerCase().endsWith('.png') ? 'image/png'
    : path.toLowerCase().endsWith('.webp') ? 'image/webp'
    : path.toLowerCase().endsWith('.heic') ? 'image/heic'
    : 'image/jpeg'
  const base64 = Buffer.from(await data.arrayBuffer()).toString('base64')
  return `data:${mime};base64,${base64}`
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

  let primaryDataUrl: string | null = null
  let rotatedDataUrl: string | null = null

  try {
    if (imageFile) {
      const prepared = await fileToDataUrl(imageFile)
      primaryDataUrl = prepared.dataUrl
    } else if (record.image_path && record.image_path !== 'manual-entry' && isValidImagePath(record.image_path, ctx.effectiveUserId)) {
      primaryDataUrl = await storagePathToDataUrl(service, record.image_path)
      if (!primaryDataUrl) {
        return NextResponse.json({ error: 'No se pudo acceder a la imagen guardada' }, { status: 500 })
      }
    } else {
      return NextResponse.json({ error: 'Este registro no tiene imagen para releer' }, { status: 400 })
    }

    if (rotatedImageFile) {
      const prepared = await fileToDataUrl(rotatedImageFile)
      rotatedDataUrl = prepared.dataUrl
    }

    const model = userSettings.preferred_model ?? 'anthropic/claude-3.5-sonnet'
    const client = createOpenRouterClient(apiKey)

    let rawResponse: string
    let aiUsage: ReturnType<typeof extractUsageFromCompletion> | null = null
    try {
      const { data: completion, response } = await client.chat.completions.create({
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: buildExtractionPrompt(customTemplates ?? []) },
            { type: 'image_url', image_url: { url: primaryDataUrl } },
            ...(rotatedDataUrl ? [{ type: 'image_url' as const, image_url: { url: rotatedDataUrl } }] : []),
          ],
        }],
        max_tokens: 1000,
        ...(MODELS_WITH_JSON_MODE.has(model) ? { response_format: { type: 'json_object' as const } } : {}),
      }).withResponse()
      rawResponse = completion.choices[0]?.message?.content ?? ''
      aiUsage = extractUsageFromCompletion(completion, response.headers)
    } catch (err: unknown) {
      console.error('[reanalyze] OpenRouter error:', err instanceof Error ? err.message : err)
      return NextResponse.json({ error: 'No se pudo releer la imagen con la IA. Intentá de nuevo.' }, { status: 502 })
    }

    const fields = normalizeSurgicalFields(parseAIResponse(rawResponse).fields)

    if (aiUsage) {
      await insertAiUsage(service, { user_id: ctx.effectiveUserId, record_id: record.id, model, event_type: 'reanalyze', ...aiUsage })
    }

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
  } catch (err: unknown) {
    console.error('[reanalyze] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'No se pudo releer la imagen. Intentá de nuevo.' }, { status: 500 })
  }
}
